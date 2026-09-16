import fs from "node:fs";
import path from "node:path";
import { inspect } from "node:util";
import { describe, expect, it } from "@jest/globals";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAI } from "@langchain/openai";
import {
  getConfigDiagnostics,
  getSafeConfig,
  loadConfig,
} from "../../../src/pr-review/config/index.js";
import { formatConfigDoctorReport } from "../../../src/pr-review/config/doctor.js";
import { createReviewModel } from "../../../src/pr-review/algorithm/providers/index.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

function testConfig(
  overrides: Readonly<Record<string, string | undefined>> = {},
) {
  return loadConfig({ NODE_ENV: "test", ...overrides });
}

function readTextFiles(directory: string): string {
  if (!fs.existsSync(directory)) return "";
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readTextFiles(entryPath);
      return fs.readFileSync(entryPath, "utf8");
    })
    .join("\n");
}

function listRepositoryTextFiles(directory: string): string[] {
  const ignoredDirectories = new Set([
    ".git",
    ".venv",
    "dist",
    "node_modules",
    "__pycache__",
  ]);
  const binaryExtensions = /\.(png|jpg|jpeg|gif|webp|ico|lock)$/i;

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".env" || entry.name.endsWith(".local")) return [];
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name)
        ? []
        : listRepositoryTextFiles(entryPath);
    }
    return binaryExtensions.test(entry.name) ? [] : [entryPath];
  });
}

describe("PR Review configuration", () => {
  it("allows a mock LLM without any API key or .env file", async () => {
    const candidate = testConfig();

    expect(candidate.llm.provider).toBe("mock");
    expect(candidate.llm.apiKey).toBeNull();
    const response = await createReviewModel(candidate.llm).invoke([]);
    expect(response.content).toBe("");
  });

  it("rejects DeepSeek use with a clear missing-key error", () => {
    const candidate = testConfig({
      LLM_PROVIDER: "deepseek",
      LLM_MODEL: "deepseek-v4-flash",
    });

    expect(() => createReviewModel(candidate.llm)).toThrow("DEEPSEEK_API_KEY");
  });

  it("rejects Qwen use with clear missing configuration errors", () => {
    const missingKey = testConfig({
      LLM_PROVIDER: "qwen",
      LLM_MODEL: "configured-by-test",
      QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
    });
    const missingBaseUrl = testConfig({
      LLM_PROVIDER: "qwen",
      LLM_MODEL: "configured-by-test",
      DASHSCOPE_API_KEY: "test-qwen-key",
    });

    expect(() => createReviewModel(missingKey.llm)).toThrow(
      "DASHSCOPE_API_KEY",
    );
    expect(() => createReviewModel(missingBaseUrl.llm)).toThrow(
      "QWEN_BASE_URL",
    );
  });

  it("rejects OpenAI use with a clear missing-key error", () => {
    const candidate = testConfig({
      LLM_PROVIDER: "openai",
      LLM_MODEL: "configured-by-test",
    });

    expect(() => createReviewModel(candidate.llm)).toThrow("OPENAI_API_KEY");
  });

  it("rejects Anthropic use with a clear missing-key error", () => {
    const candidate = testConfig({
      LLM_PROVIDER: "anthropic",
      LLM_MODEL: "configured-by-test",
    });

    expect(() => createReviewModel(candidate.llm)).toThrow("ANTHROPIC_API_KEY");
  });

  it("does not require a LangSmith key when tracing is disabled", () => {
    const candidate = testConfig({ LANGSMITH_TRACING: "false" });

    expect(getConfigDiagnostics(candidate).errors).toEqual([]);
  });

  it("uses a safe mock publisher by default", () => {
    const candidate = testConfig();

    expect(candidate.publisher.mode).toBe("mock");
    expect(candidate.publisher.realPublishingEnabled).toBe(false);
  });

  it("forcibly disables real publishing outside production", () => {
    const candidate = loadConfig({
      NODE_ENV: "development",
      PUBLISHER_MODE: "real",
      REAL_PUBLISHING_ENABLED: "true",
    });

    expect(candidate.publisher.realPublishingEnabled).toBe(false);
    expect(getConfigDiagnostics(candidate).warnings).toContainEqual(
      expect.stringContaining("forcibly disabled"),
    );
  });

  it("returns a safe config without secret values", () => {
    const secret = "test-openai-secret-that-must-not-leak";
    const candidate = testConfig({
      LLM_PROVIDER: "openai",
      LLM_MODEL: "configured-by-test",
      OPENAI_API_KEY: secret,
      LANGSMITH_API_KEY: "test-langsmith-secret-that-must-not-leak",
      FIRECRAWL_API_KEY: "test-firecrawl-secret-that-must-not-leak",
    });
    const safe = getSafeConfig(candidate);
    const serializedSafe = JSON.stringify(safe);
    const inspectedFullConfig = inspect(candidate);
    const serializedFullConfig = JSON.stringify(candidate);

    expect(serializedSafe).not.toContain(secret);
    expect(serializedSafe).not.toContain("test-langsmith-secret");
    expect(serializedSafe).not.toContain("test-firecrawl-secret");
    expect(inspectedFullConfig).not.toContain(secret);
    expect(serializedFullConfig).not.toContain(secret);
    expect(safe.llm.apiKeyConfigured).toBe(true);
  });

  it("supports configurable role model policy without exposing secrets", () => {
    const candidate = testConfig({
      PR_REVIEW_EXECUTION_MODE: "hybrid",
      PR_REVIEW_PLANNER_PROVIDER: "deepseek",
      PR_REVIEW_PLANNER_MODEL: "deepseek-v4-flash",
      PR_REVIEW_SPECIALIST_PROVIDER: "deepseek",
      PR_REVIEW_SPECIALIST_MODEL: "deepseek-v4-flash",
      PR_REVIEW_CRITIC_PROVIDER: "qwen",
      PR_REVIEW_CRITIC_MODEL: "qwen-test-model",
      PR_REVIEW_JUDGE_PROVIDER: "qwen",
      PR_REVIEW_JUDGE_MODEL: "qwen-test-model",
      PR_REVIEW_REVISION_PROVIDER: "deepseek",
      PR_REVIEW_REVISION_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_KEY: "role-policy-deepseek-secret",
      DASHSCOPE_API_KEY: "role-policy-qwen-secret",
      QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
    });
    const safe = getSafeConfig(candidate);

    expect(candidate.roleModelPolicy.executionMode).toBe("hybrid");
    expect(candidate.roleModelPolicy.critic.provider).toBe("qwen");
    expect(candidate.providers.deepseekConfigured).toBe(true);
    expect(candidate.providers.qwenConfigured).toBe(true);
    expect(getConfigDiagnostics(candidate).errors).toEqual([]);
    expect(JSON.stringify(safe)).not.toContain("role-policy-deepseek-secret");
    expect(JSON.stringify(safe)).not.toContain("role-policy-qwen-secret");
  });

  it("diagnoses missing role provider configuration in real execution", () => {
    const candidate = testConfig({
      PR_REVIEW_EXECUTION_MODE: "real",
      PR_REVIEW_PLANNER_PROVIDER: "deepseek",
      PR_REVIEW_PLANNER_MODEL: "deepseek-v4-flash",
    });

    expect(getConfigDiagnostics(candidate).errors).toContainEqual(
      expect.stringContaining("planner role provider deepseek"),
    );
  });

  it.each([
    {
      provider: "deepseek",
      keyVariable: "DEEPSEEK_API_KEY",
      secret: "test-deepseek-secret-that-must-not-leak",
      extra: {},
    },
    {
      provider: "qwen",
      keyVariable: "DASHSCOPE_API_KEY",
      secret: "test-qwen-secret-that-must-not-leak",
      extra: {
        QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
      },
    },
  ])("redacts $provider credentials from safe config", (testCase) => {
    const candidate = testConfig({
      LLM_PROVIDER: testCase.provider,
      LLM_MODEL: "configured-by-test",
      [testCase.keyVariable]: testCase.secret,
      ...testCase.extra,
    });
    const safe = JSON.stringify(getSafeConfig(candidate));

    expect(safe).not.toContain(testCase.secret);
    expect(safe).not.toContain(testCase.keyVariable);
  });

  it("never prints a secret in config doctor output", () => {
    const secret = "doctor-qwen-secret-that-must-not-leak";
    const candidate = testConfig({
      LLM_PROVIDER: "qwen",
      LLM_MODEL: "configured-by-test",
      DASHSCOPE_API_KEY: secret,
      QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
    });
    const { output } = formatConfigDoctorReport(candidate);

    expect(output).not.toContain(secret);
    expect(output).toContain("api key: configured");
    expect(output).toContain("base URL: configured");
  });

  it("constructs DeepSeek and Qwen through injected SDK factories", () => {
    const fakeModel = new FakeListChatModel({ responses: ["injected"] });
    const deepSeekSecret = "dependency-injected-deepseek-key";
    const qwenSecret = "dependency-injected-qwen-key";
    let deepSeekFields: { apiKey: string; model: string } | undefined;
    let qwenFields:
      | { apiKey: string; model: string; configuration: { baseURL: string } }
      | undefined;
    const deepSeekConfig = testConfig({
      LLM_PROVIDER: "deepseek",
      LLM_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_KEY: deepSeekSecret,
    });
    const qwenConfig = testConfig({
      LLM_PROVIDER: "qwen",
      LLM_MODEL: "configured-by-test",
      DASHSCOPE_API_KEY: qwenSecret,
      QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
    });

    expect(
      createReviewModel(deepSeekConfig.llm, {
        deepseekSDKFactory: (fields) => {
          deepSeekFields = fields;
          return fakeModel;
        },
      }),
    ).toBe(fakeModel);
    expect(
      createReviewModel(qwenConfig.llm, {
        qwenSDKFactory: (fields) => {
          qwenFields = fields;
          return fakeModel;
        },
      }),
    ).toBe(fakeModel);
    expect(deepSeekFields).toMatchObject({
      apiKey: deepSeekSecret,
      model: "deepseek-v4-flash",
    });
    expect(qwenFields).toMatchObject({
      apiKey: qwenSecret,
      model: "configured-by-test",
      configuration: {
        baseURL: "https://model-studio.test/compatible-mode/v1",
      },
    });
  });

  it("returns traceable LangChain models with structured output and tools", () => {
    const deepSeekConfig = testConfig({
      LLM_PROVIDER: "deepseek",
      LLM_MODEL: "deepseek-v4-flash",
      DEEPSEEK_API_KEY: "constructor-only-deepseek-key",
    });
    const qwenConfig = testConfig({
      LLM_PROVIDER: "qwen",
      LLM_MODEL: "constructor-only-qwen-model",
      DASHSCOPE_API_KEY: "constructor-only-qwen-key",
      QWEN_BASE_URL: "https://model-studio.test/compatible-mode/v1",
    });

    const deepSeekModel = createReviewModel(deepSeekConfig.llm);
    const qwenModel = createReviewModel(qwenConfig.llm);

    expect(deepSeekModel).toBeInstanceOf(ChatDeepSeek);
    expect(qwenModel).toBeInstanceOf(ChatOpenAI);
    expect(deepSeekModel.withStructuredOutput).toEqual(expect.any(Function));
    expect(deepSeekModel.bindTools).toEqual(expect.any(Function));
    expect(qwenModel.withStructuredOutput).toEqual(expect.any(Function));
    expect(qwenModel.bindTools).toEqual(expect.any(Function));
    expect(deepSeekModel.withConfig({ tags: ["trace-test"] })).toBeDefined();
    expect(qwenModel.withConfig({ tags: ["trace-test"] })).toBeDefined();
  });

  it("keeps server config and secret variable names out of the frontend", () => {
    const frontend = readTextFiles(
      path.join(repositoryRoot, "apps", "pr-review-console", "src"),
    );

    expect(frontend).not.toMatch(/pr-review[\\/]config/);
    expect(frontend).not.toContain("OPENAI_API_KEY");
    expect(frontend).not.toContain("ANTHROPIC_API_KEY");
    expect(frontend).not.toContain("LANGSMITH_API_KEY");
    expect(frontend).not.toContain("DEEPSEEK_API_KEY");
    expect(frontend).not.toContain("DASHSCOPE_API_KEY");
  });

  it("allows process.env access only in config/env.ts within PR Review", () => {
    const configRoot = path.join(repositoryRoot, "src", "pr-review", "config");
    const files = fs
      .readdirSync(configRoot)
      .filter((file) => file.endsWith(".ts") && file !== "env.ts");

    for (const file of files) {
      expect(
        fs.readFileSync(path.join(configRoot, file), "utf8"),
      ).not.toContain("process.env");
    }
  });

  it("finds no credential-shaped values in tracked or new repository files", () => {
    const fileNames = listRepositoryTextFiles(repositoryRoot);
    const credentialPatterns = [
      /sk-[A-Za-z0-9_-]{20,}/g,
      /lsv2_[A-Za-z0-9_-]{20,}/g,
      /gh[pousr]_[A-Za-z0-9_]{20,}/g,
    ];

    const filesWithCredentialShapes = new Set<string>();
    for (const file of fileNames) {
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of credentialPatterns) {
        if (pattern.test(content)) {
          filesWithCredentialShapes.add(path.relative(repositoryRoot, file));
        }
        pattern.lastIndex = 0;
      }
    }
    expect([...filesWithCredentialShapes]).toEqual([]);
  });
});

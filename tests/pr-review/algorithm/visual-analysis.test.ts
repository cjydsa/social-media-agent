import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import {
  QwenVisualAnalyzer,
  VisualAnalysisError,
  visionEvidenceItems,
} from "../../../src/pr-review/algorithm/llm/index.js";
import {
  buildLLMConfigForSelection,
  parsePrReviewEnv,
} from "../../../src/pr-review/config/index.js";

const uploadDirs: string[] = [];

function makeUploadDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vision-test-"));
  uploadDirs.push(dir);
  // Minimal valid PNG (1x1 pixel).
  writeFileSync(
    path.join(dir, "sample.png"),
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
  return dir;
}

function visionEnv(): Record<string, string | undefined> {
  return {
    DASHSCOPE_API_KEY: "sk-test-secret",
    QWEN_BASE_URL: "https://dashscope.example/v1",
    PR_REVIEW_VISION_MODEL: "qwen-vl-plus",
  };
}

function analyzer(uploadDir: string, fetchFn: typeof fetch): QwenVisualAnalyzer {
  const llm = buildLLMConfigForSelection(parsePrReviewEnv(visionEnv()), {
    provider: "qwen",
    model: "qwen-vl-plus",
  });
  return new QwenVisualAnalyzer({ llm, uploadDir, fetchFn });
}

afterEach(() => {
  while (uploadDirs.length > 0) {
    rmSync(uploadDirs.pop()!, { recursive: true, force: true });
  }
});

function mockVisionFetch(json: unknown): typeof fetch {
  return jest.fn(async () => {
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "content-type": "application/json" },
    }) as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("QwenVisualAnalyzer", () => {
  it("parses a valid vision response and inlines the image as base64", async () => {
    const uploadDir = makeUploadDir();
    const fetchFn = mockVisionFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ocrText: "促销",
              sceneDescription: "海报",
              visualElements: [],
              riskObservations: [],
              brandSafety: "PASS",
              brandSafetyReason: "无风险。",
            }),
          },
        },
      ],
    });
    const result = await analyzer(uploadDir, fetchFn).analyze("sample.png");
    expect(result.brandSafety).toBe("PASS");
    expect(result.ocrText).toBe("促销");

    const request = (fetchFn as unknown as jest.Mock).mock.calls[0]![1] as RequestInit;
    expect(request.headers).toEqual(
      expect.objectContaining({ authorization: "Bearer sk-test-secret" }),
    );
    const body = JSON.parse(String(request.body)) as {
      model: string;
      messages: unknown[];
    };
    expect(body.model).toBe("qwen-vl-plus");
    const userContent = (
      body.messages[1] as {
        content: Array<{ type: string; image_url?: { url?: string } }>;
      }
    ).content;
    expect(userContent[0]?.type).toBe("text");
    expect(userContent[1]?.type).toBe("image_url");
    expect(userContent[1]?.image_url?.url).toMatch(/^data:image\/png;base64,/);
  });

  it("throws a non-retryable VisualAnalysisError for bad config", async () => {
    const uploadDir = makeUploadDir();
    const llm = buildLLMConfigForSelection(parsePrReviewEnv(visionEnv()), {
      provider: "mock",
      model: "mock",
    });
    const target = new QwenVisualAnalyzer({ llm, uploadDir, fetchFn: fetch });
    await expect(target.analyze("sample.png")).rejects.toThrow(
      VisualAnalysisError,
    );
  });

  it("rejects unsupported image extensions", async () => {
    const uploadDir = makeUploadDir();
    writeFileSync(path.join(uploadDir, "x.bin"), "bytes");
    await expect(
      analyzer(uploadDir, mockVisionFetch({})).analyze("x.bin"),
    ).rejects.toThrow(/Unsupported image extension/i);
  });

  it("maps HTTP 500 to a retryable error", async () => {
    const uploadDir = makeUploadDir();
    const fetchFn = jest.fn(async () => {
      return new Response("internal error", { status: 500 }) as unknown as Response;
    }) as unknown as typeof fetch;
    await expect(
      analyzer(uploadDir, fetchFn).analyze("sample.png"),
    ).rejects.toMatchObject({ retryable: true });
  });

  it("rejects non-JSON model output", async () => {
    const uploadDir = makeUploadDir();
    const fetchFn = mockVisionFetch({
      choices: [{ message: { content: "not json" } }],
    });
    await expect(
      analyzer(uploadDir, fetchFn).analyze("sample.png"),
    ).rejects.toThrow(/not JSON/i);
  });

  it("rejects JSON that fails the schema", async () => {
    const uploadDir = makeUploadDir();
    const fetchFn = mockVisionFetch({
      choices: [{ message: { content: JSON.stringify({ ocrText: 42 }) } }],
    });
    await expect(
      analyzer(uploadDir, fetchFn).analyze("sample.png"),
    ).rejects.toThrow(/schema validation/i);
  });

  it("accepts multi-image batch and returns a combined analysis", async () => {
    const uploadDir = makeUploadDir();
    writeFileSync(path.join(uploadDir, "second.png"), "fake bytes");
    const fetchFn = mockVisionFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ocrText: "图1：促销\n图2：商品详情",
              sceneDescription: "电商活动海报",
              visualElements: ["价格标签", "商品图"],
              riskObservations: [
                { observation: "未标注活动截止日期", severity: "MEDIUM" },
              ],
              brandSafety: "WARN",
              brandSafetyReason: "缺少必要的时间限定信息。",
            }),
          },
        },
      ],
    });
    const results = await analyzer(uploadDir, fetchFn).analyzeBatch([
      "sample.png",
      "second.png",
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].ocrText).toContain("图1");
    expect(results[0].brandSafety).toBe("WARN");
    // Verify the request included both images as text+image_url pairs.
    const request = (fetchFn as unknown as jest.Mock).mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      messages: unknown[];
    };
    const userMsg = body.messages[1] as { content: unknown[] };
    const imageParts = userMsg.content.filter(
      (c: { type?: string }) => c.type === "image_url",
    );
    expect(imageParts).toHaveLength(2);
  });
});

describe("visionEvidenceItems", () => {
  it("marks a clean image with no top risk in the title", () => {
    const [item] = visionEvidenceItems([
      {
        ocrText: "",
        sceneDescription: "产品图",
        visualElements: ["产品"],
        riskObservations: [],
        brandSafety: "PASS",
        brandSafetyReason: "无风险",
      },
    ]);
    expect(item.title).toBe("图片素材分析（PASS）");
    expect(item.title).not.toContain("最高风险");
    expect(item.content).toContain("未发现明显视觉风险。");
  });
});

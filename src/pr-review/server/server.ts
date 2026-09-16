import "dotenv/config";
import path from "node:path";
import {
  createLangGraphReviewEngine,
  type LangGraphReviewEngineOptions,
} from "../algorithm/engine/langgraph-review-engine.js";
import {
  DeterministicEvidenceToolset,
  VisualEvidenceToolset,
  type VisualEvidenceAnalyzer,
} from "../algorithm/evidence/evidence-tools.js";
import { createRuntimeAgents, QwenVisualAnalyzer } from "../algorithm/llm/index.js";
import type { AgentRoleLLMConfig } from "../algorithm/llm/runtime-agents.js";
import { InMemoryReviewRepository } from "../backend/repositories/in-memory.js";
import { MockPublisher } from "../backend/publishers/mock-publisher.js";
import { ReviewOrchestrationService } from "../backend/services/orchestration.js";
import {
  buildLLMConfigForSelection,
  buildVisionLLMConfig,
  loadConfig,
  parsePrReviewEnv,
} from "../config/index.js";
import type { LLMConfig, PrReviewConfig } from "../config/index.js";
import { createReviewApp } from "./app.js";
import { seedDemoData } from "./seed.js";
import { LocalUploadStorage } from "./uploads.js";

/**
 * Composition root (SPRINT-006): the only place that reads execution mode
 * and assembles LLM-backed agents / vision analysis. Mock mode keeps
 * SPRINT-005 behavior bit-for-bit.
 */
function buildEngineOptions(
  config: PrReviewConfig,
): LangGraphReviewEngineOptions {
  const env = parsePrReviewEnv();
  const mode = config.roleModelPolicy.executionMode;
  if (mode === "mock") return {};

  const roleLLM: AgentRoleLLMConfig = {
    planner: buildLLMConfigForSelection(env, config.roleModelPolicy.planner),
    specialist: buildLLMConfigForSelection(env, config.roleModelPolicy.specialist),
    critic: buildLLMConfigForSelection(env, config.roleModelPolicy.critic),
    judge: buildLLMConfigForSelection(env, config.roleModelPolicy.judge),
    revision: buildLLMConfigForSelection(env, config.roleModelPolicy.revision),
  };

  const options: LangGraphReviewEngineOptions = {
    agents: createRuntimeAgents({ roleLLM }),
  };

  // Vision (image) analysis: only wired when a vision LLM is configured.
  const visionLLM: LLMConfig | null = buildVisionLLMConfig(env);
  if (visionLLM && visionLLM.apiKey?.isConfigured()) {
    const uploadDir = path.resolve(process.cwd(), config.server.uploadDir);
    const analyzer: VisualEvidenceAnalyzer = new QwenVisualAnalyzer({
      llm: visionLLM,
      uploadDir,
    });
    options.evidenceToolset = new VisualEvidenceToolset(
      new DeterministicEvidenceToolset(),
      analyzer,
    );
  }
  return options;
}

async function main(): Promise<void> {
  const config = loadConfig();

  const repository = new InMemoryReviewRepository();
  const engineOptions = buildEngineOptions(config);
  const engine = createLangGraphReviewEngine(engineOptions);
  const publisher = new MockPublisher();
  const orchestration = new ReviewOrchestrationService({
    repositories: {
      cases: repository,
      versions: repository,
      results: repository,
      evidence: repository,
      actions: repository,
      revisions: repository,
    },
    engine,
    publisher,
  });

  const uploadStorage = new LocalUploadStorage(
    path.resolve(process.cwd(), config.server.uploadDir),
  );

  if (config.server.demoSeed) {
    const existing = await repository.listCases({ limit: 1, cursor: null });
    const seeded = await seedDemoData({
      orchestration,
      uploadStorage,
      hasExistingCases: existing.data.length > 0,
    });
    if (seeded > 0) {
      console.log(
        `[pr-review] Seeded ${seeded} synthetic demo cases (PR_REVIEW_DEMO_SEED).`,
      );
    }
  }

  const consoleDistDir = path.resolve(
    process.cwd(),
    "apps/pr-review-console/dist",
  );
  const app = createReviewApp({
    orchestration,
    uploadStorage,
    consoleDistDir,
  });

  const host = config.server.host;
  const port = config.app.apiPort;
  app.listen(port, host, () => {
    console.log(
      `[pr-review] Server listening at http://${host}:${port} (auth mode: ${config.server.authMode}, publisher: ${publisher.mode})`,
    );
  });
}

main().catch((error) => {
  console.error("[pr-review] Failed to start server:", error);
  process.exitCode = 1;
});

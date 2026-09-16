import "dotenv/config";
import path from "node:path";
import { createLangGraphReviewEngine } from "../algorithm/engine/langgraph-review-engine.js";
import { InMemoryReviewRepository } from "../backend/repositories/in-memory.js";
import { MockPublisher } from "../backend/publishers/mock-publisher.js";
import { ReviewOrchestrationService } from "../backend/services/orchestration.js";
import { loadConfig } from "../config/index.js";
import { createReviewApp } from "./app.js";
import { seedDemoData } from "./seed.js";
import { LocalUploadStorage } from "./uploads.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const repository = new InMemoryReviewRepository();
  const engine = createLangGraphReviewEngine();
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

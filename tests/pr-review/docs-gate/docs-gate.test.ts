import { describe, expect, it } from "@jest/globals";
import {
  checkDocsGate,
  parseGitPorcelainZ,
} from "../../../scripts/pr-review-docs-gate.js";

const taskLog = "docs/pr-review/change-log/TASK-001.md";

describe("PR Review docs consistency gate", () => {
  it("passes Algorithm code only with its task log and Domain document", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [
        "src/pr-review/algorithm/reviewers/fact.ts",
        taskLog,
        "docs/pr-review/domains/algorithm.md",
      ],
    });

    expect(result.valid).toBe(true);
  });

  it("fails Algorithm code when its Domain document is missing", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: ["src/pr-review/algorithm/reviewers/fact.ts", taskLog],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Required documentation did not change: docs/pr-review/domains/algorithm.md",
    );
  });

  it("fails when the current task Change Log is missing", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [
        "src/pr-review/algorithm/reviewers/fact.ts",
        "docs/pr-review/domains/algorithm.md",
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      `Required documentation did not change: ${taskLog}`,
    );
  });

  it("requires Backend Domain and Contracts for API/DTO changes", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [
        "src/pr-review/backend/api/reviews.ts",
        taskLog,
        "docs/pr-review/domains/backend.md",
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.requiredDocs).toContain("docs/pr-review/03-contracts.md");
  });

  it.each([
    {
      code: "apps/pr-review-console/src/App.tsx",
      domain: "docs/pr-review/domains/frontend.md",
    },
    {
      code: "tests/pr-review/unit/reviewer.test.ts",
      domain: "docs/pr-review/domains/test-and-evaluation.md",
    },
    {
      code: "evals/pr-review/runner.ts",
      domain: "docs/pr-review/domains/test-and-evaluation.md",
    },
    {
      code: "src/pr-review/social-data/adapters/weibo.ts",
      domain: "docs/pr-review/domains/social-data.md",
    },
  ])("maps $code to $domain", ({ code, domain }) => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [code, taskLog, domain],
    });

    expect(result.valid).toBe(true);
  });

  it("requires Contracts for Social Data schema and port changes", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [
        "src/pr-review/social-data/schemas/social-post.ts",
        taskLog,
        "docs/pr-review/domains/social-data.md",
      ],
    });

    expect(result.valid).toBe(false);
    expect(result.requiredDocs).toContain("docs/pr-review/03-contracts.md");
  });

  it("passes a docs-only task with its task Change Log", () => {
    const result = checkDocsGate({
      taskId: "TASK-001",
      changedFiles: [taskLog, "docs/pr-review/01-PRD.md", "docs.zip"],
    });

    expect(result.valid).toBe(true);
  });

  it("rejects an invalid or missing-style task ID", () => {
    const result = checkDocsGate({
      taskId: "task 001",
      changedFiles: [taskLog],
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Task ID/);
  });

  it("parses modified, untracked, and renamed porcelain records", () => {
    const output = [
      " M package.json",
      "?? docs/pr-review/new.md",
      "R  src/new.ts",
      "src/old.ts",
      "",
    ].join("\0");

    expect(parseGitPorcelainZ(output)).toEqual([
      "docs/pr-review/new.md",
      "package.json",
      "src/new.ts",
      "src/old.ts",
    ]);
  });
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface DocsGateInput {
  taskId: string;
  changedFiles: readonly string[];
}

export interface DocsGateResult {
  valid: boolean;
  errors: string[];
  changedFiles: string[];
  requiredDocs: string[];
}

const TASK_ID_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const CODE_FILE_PATTERN = /\.(?:cjs|js|jsx|json|mjs|ts|tsx)$/i;

function normalizeRepositoryPath(file: string): string {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isCodeFile(file: string): boolean {
  return CODE_FILE_PATTERN.test(file);
}

function addDomainRequirements(file: string, requiredDocs: Set<string>): void {
  if (!isCodeFile(file)) return;

  if (file.startsWith("src/pr-review/algorithm/")) {
    requiredDocs.add("docs/pr-review/domains/algorithm.md");
  }
  if (file.startsWith("src/pr-review/algorithm/providers/")) {
    requiredDocs.add("docs/pr-review/06-environment-and-api-config.md");
  }
  if (file.startsWith("src/pr-review/config/")) {
    requiredDocs.add("docs/pr-review/domains/algorithm.md");
    requiredDocs.add("docs/pr-review/06-environment-and-api-config.md");
  }
  if (/^src\/pr-review\/algorithm\/(?:schemas|state|ports)\//.test(file)) {
    requiredDocs.add("docs/pr-review/03-contracts.md");
  }
  if (file.startsWith("src/pr-review/backend/")) {
    requiredDocs.add("docs/pr-review/domains/backend.md");
  }
  if (/^src\/pr-review\/backend\/(?:api|dto)\//.test(file)) {
    requiredDocs.add("docs/pr-review/03-contracts.md");
  }
  if (file.startsWith("apps/pr-review-console/")) {
    requiredDocs.add("docs/pr-review/domains/frontend.md");
  }
  if (
    file.startsWith("tests/pr-review/") ||
    file.startsWith("evals/pr-review/")
  ) {
    requiredDocs.add("docs/pr-review/domains/test-and-evaluation.md");
  }
  if (file.startsWith("src/pr-review/social-data/")) {
    requiredDocs.add("docs/pr-review/domains/social-data.md");
  }
  if (/^src\/pr-review\/social-data\/(?:schemas|types|ports)\//.test(file)) {
    requiredDocs.add("docs/pr-review/03-contracts.md");
  }
}

export function parseGitPorcelainZ(output: string): string[] {
  const records = output.split("\0");
  const files = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.length < 4) continue;

    const status = record.slice(0, 2);
    files.add(normalizeRepositoryPath(record.slice(3)));

    if (/[RC]/.test(status)) {
      const previousPath = records[index + 1];
      if (previousPath) {
        files.add(normalizeRepositoryPath(previousPath));
        index += 1;
      }
    }
  }

  return [...files].sort();
}

export function checkDocsGate(input: DocsGateInput): DocsGateResult {
  const changedFiles = [
    ...new Set(input.changedFiles.map(normalizeRepositoryPath)),
  ]
    .filter(Boolean)
    .sort();
  const changedFileSet = new Set(changedFiles);
  const requiredDocs = new Set<string>();
  const errors: string[] = [];

  if (!TASK_ID_PATTERN.test(input.taskId)) {
    errors.push(
      "Task ID must contain only uppercase letters, numbers, and hyphens.",
    );
  } else {
    requiredDocs.add(`docs/pr-review/change-log/${input.taskId}.md`);
  }

  for (const file of changedFiles) {
    addDomainRequirements(file, requiredDocs);
  }

  for (const requiredDoc of [...requiredDocs].sort()) {
    if (!changedFileSet.has(requiredDoc)) {
      errors.push(`Required documentation did not change: ${requiredDoc}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    changedFiles,
    requiredDocs: [...requiredDocs].sort(),
  };
}

export function getWorkingTreeChanges(): string[] {
  const output = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { encoding: "utf8" },
  );
  return parseGitPorcelainZ(output);
}

function readTaskId(args: readonly string[]): string | null {
  const equalsArgument = args.find((argument) =>
    argument.startsWith("--task="),
  );
  if (equalsArgument) return equalsArgument.slice("--task=".length);

  const taskIndex = args.indexOf("--task");
  return taskIndex >= 0 ? (args[taskIndex + 1] ?? null) : null;
}

function runCli(): void {
  const taskId = readTaskId(process.argv.slice(2));
  if (!taskId) {
    console.error(
      "DOCS GATE: FAIL\nMissing task ID. Run: yarn pr-review:docs:check --task <TASK-ID>",
    );
    process.exitCode = 1;
    return;
  }

  let changedFiles: string[];
  try {
    changedFiles = getWorkingTreeChanges();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`DOCS GATE: FAIL\nUnable to read Git status: ${message}`);
    process.exitCode = 1;
    return;
  }

  const result = checkDocsGate({ taskId, changedFiles });
  console.log(`DOCS GATE: ${result.valid ? "PASS" : "FAIL"}`);
  console.log(`Task: ${taskId}`);
  console.log(`Changed files checked: ${result.changedFiles.length}`);
  console.log("Required documentation:");
  for (const requiredDoc of result.requiredDocs) {
    console.log(
      `  ${result.changedFiles.includes(requiredDoc) ? "present" : "missing"}: ${requiredDoc}`,
    );
  }

  if (!result.valid) {
    console.error("Errors:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (entryPoint === import.meta.url) runCli();

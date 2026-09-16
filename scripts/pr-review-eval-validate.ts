import { runEvaluationValidation } from "../evals/pr-review/index.js";

try {
  const result = runEvaluationValidation();
  console.log("PR Review evaluation dataset validation: PASS");
  console.log(`Dataset version: ${result.manifest.datasetVersion}`);
  console.log(`Case count: ${result.caseCount}`);
  console.log(
    `Split counts: dev=${result.manifest.splitCounts.dev}, test=${result.manifest.splitCounts.test}`,
  );
} catch (error) {
  console.error("PR Review evaluation dataset validation: FAIL");
  console.error(error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}

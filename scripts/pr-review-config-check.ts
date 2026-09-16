import "dotenv/config";
import { config } from "../src/pr-review/config/index.js";
import { formatConfigDoctorReport } from "../src/pr-review/config/doctor.js";

const { output, diagnostics } = formatConfigDoctorReport(config);
console.log(output);

if (diagnostics.errors.length) {
  process.exitCode = 1;
}

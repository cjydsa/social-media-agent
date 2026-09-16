import "dotenv/config";
import { runProviderSmoke } from "./pr-review-provider-smoke.js";

await runProviderSmoke("qwen");

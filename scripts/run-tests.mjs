import { spawnSync } from "node:child_process";
const database = process.env.MONGODB_TEST_DB || "organic_work_test";
if (!database.includes("test") || database === process.env.MONGODB_DB)
  throw new Error("Database kiểm thử phải riêng biệt và có chữ test");
const mode = process.argv[2];
const args =
  mode === "e2e"
    ? ["node_modules/@playwright/test/cli.js", "test"]
    : ["--import", "tsx", "scripts/integration.ts"];
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, MONGODB_DB: database, ALLOW_DEMO_SEED: "true" },
});
process.exit(result.status ?? 1);

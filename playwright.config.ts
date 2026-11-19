import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !process.env[line.slice(0, i)])
    process.env[line.slice(0, i)] = line.slice(i + 1);
}
if (!/test/.test(process.env.MONGODB_DB || ""))
  throw new Error("E2E yêu cầu MONGODB_DB riêng có chữ test");
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/setup.ts",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3101",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: "npm run build && npm run start -- -p 3101",
    url: "http://localhost:3101",
    reuseExistingServer: false,
    timeout: 180000,
    env: { APP_ORIGIN: "http://localhost:3101" },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});

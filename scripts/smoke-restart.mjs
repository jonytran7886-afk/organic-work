import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const snapshot = JSON.parse(readFileSync(".persistence-check.json", "utf8"));
const origin = "http://localhost:3102";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3102"],
  {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      MONGODB_DB: process.env.MONGODB_TEST_DB || "organic_work_test",
      APP_ORIGIN: origin,
      NODE_ENV: "production",
    },
  },
);
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(origin);
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert(ready, "Không khởi động được app production");
  const login = await fetch(origin + "/api/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@organic.vn",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie);
  const data = await (
    await fetch(origin + "/api/data", { headers: { Cookie: cookie } })
  ).json();
  assert.equal(data.tasks.length, snapshot.tasks.count);
  assert.equal(data.users.length, snapshot.users.count);
  assert.equal(data.departments.length, snapshot.departments.count);
  let checked = false;
  for (const task of data.tasks
    .filter((t) => t.title.startsWith("E2E "))
    .reverse()) {
    const response = await fetch(origin + "/api/tasks/" + task._id, {
      headers: { Cookie: cookie },
    });
    assert.equal(response.status, 200);
    const detail = await response.json();
    if (
      detail.comments.some((c) => c.body === "Xác nhận đóng gói lúc 08:30.")
    ) {
      assert(detail.activities.some((a) => a.type === "status"));
      assert(detail.activities.some((a) => a.type === "archived"));
      assert(detail.comments.some((c) => c.body === "Đồng đội xác nhận"));
      checked = true;
      break;
    }
  }
  assert(checked, "Không thấy bình luận/lịch sử E2E sau restart");
  console.log(
    "PASS app production mới sau restart MongoDB: đăng nhập, số bản ghi, công việc, bình luận và lịch sử đều còn.",
  );
} finally {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {}
}

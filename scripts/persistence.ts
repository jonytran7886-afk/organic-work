import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { db, client, serialize } from "../src/lib/db";
if (!/test/.test(process.env.MONGODB_DB || ""))
  throw new Error("Chỉ chạy trên database test");
try {
  const d = await db();
  const records: Record<string, any> = {};
  for (const name of [
    "departments",
    "users",
    "tasks",
    "task_comments",
    "task_activities",
  ]) {
    const rows = await d.collection(name).find().sort({ _id: 1 }).toArray();
    records[name] = {
      count: rows.length,
      sha256: createHash("sha256")
        .update(JSON.stringify(serialize(rows)))
        .digest("hex"),
    };
  }
  const path = ".persistence-check.json";
  if (process.argv[2] === "snapshot") {
    writeFileSync(path, JSON.stringify(records, null, 2));
    console.log(
      "Snapshot trước khi khởi động lại:",
      Object.fromEntries(Object.entries(records).map(([k, v]) => [k, v.count])),
    );
  } else {
    assert.deepEqual(records, JSON.parse(readFileSync(path, "utf8")));
    console.log(
      "PASS giữ nguyên phòng, tài khoản, công việc, bình luận và lịch sử sau restart MongoDB; kết nối từ tiến trình mới.",
    );
  }
} finally {
  await client().close();
}

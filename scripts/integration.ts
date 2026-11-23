import assert from "node:assert/strict";
import { setup, seed } from "./db";
import { db, client, id } from "../src/lib/db";
import {
  changeTask,
  createTask,
  adminWrite,
  comment,
  scope,
} from "../src/lib/service";
import { overdue, today } from "../src/lib/model";
import { verifyPassword } from "../src/lib/password";
import { queryWork } from "../src/lib/work-query";
import { groupWork, addDays, counts } from "../src/lib/work-model";
if (!/test/.test(process.env.MONGODB_DB || ""))
  throw new Error("Dùng database test riêng");
try {
  await setup();
  await seed();
  const d = await db();
  const before = await d.collection("tasks").countDocuments();
  const users = await d.collection("users").countDocuments();
  const admin = await d
      .collection("users")
      .findOne({ email: "admin@organic.vn" }),
    sales = await d
      .collection("users")
      .findOne({ email: "kinhdoanh@organic.vn" }),
    ops = await d.collection("users").findOne({ email: "vanhanh@organic.vn" }),
    worker = await d
      .collection("users")
      .findOne({ email: "nv.vanhanh@organic.vn" }),
    other = await d
      .collection("users")
      .findOne({ email: "nv.chatluong@organic.vn" }),
    peer = await d
      .collection("users")
      .findOne({ email: "nv.vanhanh2@organic.vn" });
  const sample = await d.collection("tasks").findOne({ seedKey: "sample-0" });
  await changeTask(admin, String(sample!._id), {
    title: "Nội dung đã cập nhật",
  });
  const hash = admin!.passwordHash;
  await setup();
  await seed();
  assert.equal(await d.collection("tasks").countDocuments(), before);
  assert.equal(await d.collection("users").countDocuments(), users);
  assert.equal(
    (await d.collection("tasks").findOne({ _id: sample!._id }))!.title,
    "Nội dung đã cập nhật",
  );
  assert.equal(
    (await d.collection("users").findOne({ _id: admin!._id }))!.passwordHash,
    hash,
  );
  assert(
    (await d.collection("users").indexes()).some(
      (i) => i.unique && i.key.email,
    ),
  );
  assert(
    (await d.collection("departments").indexes()).some(
      (i) => i.unique && i.key.code,
    ),
  );
  console.log("PASS setup/seed chạy lại, indexes, giữ nội dung và mật khẩu");
  const resetId = await adminWrite(admin, {
    kind: "user",
    name: "Reset test",
    email: `reset-${Date.now()}@organic.vn`,
    role: "employee",
    departmentId: String(ops!.departmentId),
    active: true,
    password: "123456",
  });
  const otherSession = await d.collection("sessions").insertOne({
    userId: admin!._id,
    tokenHash: `reset-other-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60000),
  });
  await d.collection("sessions").insertOne({
    userId: resetId,
    tokenHash: `reset-target-${Date.now()}`,
    expiresAt: new Date(Date.now() + 60000),
  });
  await assert.rejects(() =>
    adminWrite(worker, {
      kind: "reset-password",
      _id: String(resetId),
      password: "654321",
      confirmPassword: "654321",
    }),
  );
  await assert.rejects(() =>
    adminWrite(admin, {
      kind: "reset-password",
      _id: String(resetId),
      password: "short",
      confirmPassword: "short",
    }),
  );
  await assert.rejects(() =>
    adminWrite(admin, {
      kind: "reset-password",
      _id: String(resetId),
      password: "654321",
      confirmPassword: "DifferentPassword123",
    }),
  );
  assert.equal(
    await d.collection("sessions").countDocuments({ userId: resetId }),
    1,
  );
  await adminWrite(admin, {
    kind: "reset-password",
    _id: String(resetId),
    password: "654321",
    confirmPassword: "654321",
  });
  const resetUser = await d.collection("users").findOne({ _id: resetId });
  assert(verifyPassword("654321", resetUser!.passwordHash));
  assert(!verifyPassword("123456", resetUser!.passwordHash));
  assert.equal(
    await d.collection("sessions").countDocuments({ userId: resetId }),
    0,
  );
  assert(
    await d.collection("sessions").findOne({ _id: otherSession.insertedId }),
  );
  console.log("PASS admin reset password, validation and session revocation");
  const dated = await createTask(admin, {
    title: "Date range",
    owningDepartmentId: String(ops!.departmentId),
    startDate: "2026-01-01",
    dueDate: "2026-01-03",
  });
  assert.equal(dated.startDate, "2026-01-01");
  await assert.rejects(() =>
    createTask(admin, {
      title: "Invalid range",
      owningDepartmentId: String(ops!.departmentId),
      startDate: "2026-01-04",
      dueDate: "2026-01-03",
    }),
  );
  await assert.rejects(() =>
    changeTask(admin, String(dated._id), { dueDate: "2025-12-31" }),
  );
  await assert.rejects(() =>
    changeTask(admin, String(dated._id), { startDate: "2026-02-30" }),
  );
  await changeTask(admin, String(dated._id), { startDate: "2026-01-02" });
  assert.equal(
    (await d.collection("tasks").findOne({ _id: dated._id }))!.startDate,
    "2026-01-02",
  );
  console.log("PASS start/end date validation");
  const task = await createTask(sales, {
    title: "Kiểm thử transaction " + Date.now(),
    description: "Integration",
    owningDepartmentId: String(ops!.departmentId),
    dueDate: "2020-01-01",
  });
  await assert.rejects(() =>
    changeTask(sales, String(task._id), { assigneeId: String(worker!._id) }),
  );
  await assert.rejects(() =>
    changeTask(ops, String(task._id), { assigneeId: String(other!._id) }),
  );
  await changeTask(ops, String(task._id), { assigneeId: String(worker!._id) });
  await assert.rejects(() =>
    changeTask(peer, String(task._id), { status: "doing" }),
  );
  await assert.rejects(() =>
    changeTask(other, String(task._id), { status: "doing" }),
  );
  await comment(peer, String(task._id), "Đồng đội có thể bình luận");
  await changeTask(worker, String(task._id), { status: "doing" });
  const count = await d
    .collection("task_activities")
    .countDocuments({ taskId: task._id });
  await assert.rejects(
    () =>
      changeTask(
        worker,
        String(task._id),
        {
          status: "done",
          result: "Đóng gói 08:30, 500 kiện, đầu mối Vận hành: Thanh Hà",
        },
        true,
      ),
    /TEST_ACTIVITY_FAILURE/,
  );
  assert.equal(
    (await d.collection("tasks").findOne({ _id: task._id }))!.status,
    "doing",
  );
  assert.equal(
    await d.collection("task_activities").countDocuments({ taskId: task._id }),
    count,
  );
  console.log("PASS transaction hủy toàn bộ khi lỗi ghi lịch sử");
  await changeTask(worker, String(task._id), {
    status: "done",
    result: "Đóng gói 08:30, 500 kiện, đầu mối Vận hành: Thanh Hà",
  });
  assert(
    (await d.collection("tasks").findOne({ _id: task._id }))!
      .completedAt instanceof Date,
  );
  await changeTask(worker, String(task._id), { status: "todo" });
  const reopened = await d.collection("tasks").findOne({ _id: task._id });
  assert.equal(reopened!.completedAt, null);
  assert(overdue(reopened as any));
  await changeTask(ops, String(task._id), { archived: true });
  await assert.rejects(() => comment(worker, String(task._id), "Bị khóa"));
  await assert.rejects(() =>
    changeTask(ops, String(task._id), { title: "Bị khóa" }),
  );
  await changeTask(ops, String(task._id), { archived: false });
  assert.equal(
    await d.collection("task_comments").countDocuments({ taskId: task._id }),
    1,
  );
  console.log(
    "PASS phân quyền, phân công, hoàn thành/mở lại, lưu trữ/khôi phục",
  );
  await assert.rejects(
    () =>
      adminWrite(admin, {
        kind: "user",
        _id: String(admin!._id),
        email: admin!.email,
        name: admin!.name,
        role: "employee",
        departmentId: String(admin!.departmentId),
        active: true,
      }),
    /ít nhất một Admin/,
  );
  await assert.rejects(
    () =>
      adminWrite(admin, {
        kind: "user",
        _id: String(worker!._id),
        email: worker!.email,
        name: worker!.name,
        role: "employee",
        departmentId: String(sales!.departmentId),
        active: true,
      }),
    /phân công/,
  );
  assert.equal(
    await d
      .collection("tasks")
      .countDocuments({ ...scope(other), _id: task._id }),
    0,
  );
  assert.throws(() => id("abc"));
  await assert.rejects(() =>
    createTask(sales, {
      title: "Lỗi",
      dueDate: "2026-02-31",
      owningDepartmentId: String(ops!.departmentId),
    }),
  );
  console.log("PASS bảo vệ Admin cuối, chuyển phòng, phạm vi và xác thực");
  const fixed = "2026-11-19";
  const boundary = [-1, 0, 1, 7, 8, null].map((offset, index) => ({
    _id: String(index),
    status: "todo",
    priority: "normal",
    ...(offset === null ? {} : { dueDate: addDays(fixed, offset) }),
  }));
  const groups = groupWork(boundary, fixed);
  assert.deepEqual(
    groups.map((g) => [g.key, g.tasks.map((t) => t._id)]),
    [
      ["late", ["0"]],
      ["today", ["1"]],
      ["week", ["2", "3"]],
      ["later", ["4"]],
      ["undated", ["5"]],
    ],
  );
  assert.equal(groups.flatMap((g) => g.tasks).length, 6);
  assert.equal(overdue({ status: "todo" }), false);
  assert.equal(
    overdue({ status: "todo", dueDate: "2000-01-01", archivedAt: new Date() }),
    false,
  );
  const tied = groupWork(
    [
      { _id: "low", status: "todo", priority: "low", dueDate: fixed },
      { _id: "urgent", status: "todo", priority: "urgent", dueDate: fixed },
    ],
    fixed,
  );
  assert.equal(tied[0].tasks[0]._id, "urgent");
  await assert.rejects(
    () => changeTask(worker, String(task._id), { status: "waiting" }),
    /Cần nhập lý do/,
  );
  const historyBeforeWait = await d
    .collection("task_activities")
    .countDocuments({ taskId: task._id });
  await assert.rejects(
    () =>
      changeTask(
        worker,
        String(task._id),
        { status: "waiting", waitingReason: "Lỗi rollback lý do chờ" },
        true,
      ),
    /TEST_ACTIVITY_FAILURE/,
  );
  const rolledBack = await d.collection("tasks").findOne({ _id: task._id });
  assert.equal(rolledBack!.status, "todo");
  assert.equal(rolledBack!.waitingReason, undefined);
  assert.equal(
    await d.collection("task_activities").countDocuments({ taskId: task._id }),
    historyBeforeWait,
  );
  await changeTask(worker, String(task._id), {
    status: "waiting",
    waitingReason: "Chờ duyệt quy cách",
  });
  await assert.rejects(
    () =>
      changeTask(peer, String(task._id), { waitingReason: "Không được phép" }),
    /Không có quyền/,
  );
  await changeTask(worker, String(task._id), {
    waitingReason: "Chờ quản lý xác nhận",
  });
  const mine = await queryWork(worker, new URLSearchParams({ view: "mine" }));
  assert(
    mine.tasks.every(
      (t) =>
        String(t.assigneeId) === String(worker!._id) &&
        t.status !== "done" &&
        !t.archivedAt,
    ),
  );
  assert.equal(mine.groups.flatMap((g) => g.tasks).length, mine.total);
  const own = await queryWork(ops, new URLSearchParams({ view: "progress" }));
  assert.equal(own.scope, "owned");
  assert(
    own.tasks.every(
      (t) => String(t.owningDepartmentId) === String(ops!.departmentId),
    ),
  );
  const sent = await queryWork(
    sales,
    new URLSearchParams({ view: "progress", scope: "sent" }),
  );
  assert(
    sent.tasks.every(
      (t) =>
        String(t.requestingDepartmentId) === String(sales!.departmentId) &&
        String(t.owningDepartmentId) !== String(sales!.departmentId),
    ),
  );
  for (const metric of [
    "todo",
    "doing",
    "waiting",
    "done",
    "late",
    "unassigned",
  ]) {
    const rows = await queryWork(
      ops,
      new URLSearchParams({ view: "board", scope: "owned", metric }),
    );
    assert.equal(rows.total, (own.stats as any)[metric]);
  }
  const filtered = await queryWork(
    ops,
    new URLSearchParams({
      view: "progress",
      assignee: String(worker!._id),
      priority: "high",
    }),
  );
  assert(
    filtered.tasks.every(
      (t) =>
        String(t.assigneeId) === String(worker!._id) && t.priority === "high",
    ),
  );
  await assert.rejects(
    () => queryWork(worker, new URLSearchParams({ view: "progress" })),
    /không có quyền/,
  );
  await assert.rejects(
    () =>
      queryWork(
        ops,
        new URLSearchParams({
          view: "progress",
          department: String(sales!.departmentId),
        }),
      ),
    /ngoài phạm vi/,
  );
  await assert.rejects(
    () =>
      queryWork(ops, new URLSearchParams({ view: "progress", scope: "all" })),
    /Không có quyền/,
  );
  await assert.rejects(
    () =>
      queryWork(
        worker,
        new URLSearchParams({ view: "mine", assignee: String(peer!._id) }),
      ),
    /cá nhân/,
  );
  await changeTask(worker, String(task._id), {
    status: "done",
    result: "Đóng gói 08:30, 500 kiện, đầu mối Vận hành: Thanh Hà",
  });
  const finished = await d.collection("tasks").findOne({ _id: task._id });
  assert.equal(finished!.waitingReason, null);
  assert(
    await d.collection("task_activities").findOne({
      taskId: task._id,
      type: "waitingReason",
      before: "Chờ quản lý xác nhận",
      after: null,
    }),
  );
  const completed = await queryWork(
    worker,
    new URLSearchParams({ view: "mine", completed: "1" }),
  );
  assert(completed.tasks.some((t) => String(t._id) === String(task._id)));
  console.log(
    "PASS nhóm mốc ngày, ưu tiên, lý do chờ/rollback/lịch sử, scope và mọi bộ đếm Tiến độ",
  );
  const counter = await d
    .collection("system_counters")
    .findOne({ _id: "department_code" } as any);
  const reservedCode =
    "PB-" + String((counter?.value || 0) + 1).padStart(6, "0");
  await d.collection("departments").insertOne({
    name: "Mã cũ đã tồn tại",
    code: reservedCode,
    createdAt: new Date(),
  });
  const autoIds = await Promise.all(
    [0, 1, 2].map((index) =>
      adminWrite(admin, {
        kind: "department",
        name: "Tự cấp mã " + Date.now() + " " + index,
        code: "CLIENT-CANNOT-SET",
      }),
    ),
  );
  const autoDepartments = await d
    .collection("departments")
    .find({ _id: { $in: autoIds } })
    .toArray();
  assert.equal(new Set(autoDepartments.map((row) => row.code)).size, 3);
  assert(
    autoDepartments.every(
      (row) =>
        /^PB-\d{6,}$/.test(row.code) &&
        row.code !== reservedCode &&
        row.code !== "CLIENT-CANNOT-SET",
    ),
  );
  const chosen = autoDepartments[0];
  await adminWrite(admin, {
    kind: "department",
    _id: String(chosen._id),
    name: "Tên mới không đổi mã",
  });
  assert.equal(
    (await d.collection("departments").findOne({ _id: chosen._id }))!.code,
    chosen.code,
  );
  await assert.rejects(
    () =>
      adminWrite(admin, {
        kind: "department",
        _id: String(chosen._id),
        name: "Không đổi mã",
        code: "FORGED",
      }),
    /giữ ổn định/,
  );
  console.log(
    "PASS cấp mã phòng tự động đồng thời, bỏ qua mã cũ trùng và giữ mã khi đổi tên",
  );
  console.log("PERSISTENCE_TASK_ID=" + task._id);
} finally {
  await client().close();
}

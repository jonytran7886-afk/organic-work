import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, client, id } from "../src/lib/db";
import { createTask, changeTask } from "../src/lib/service";
import { queryWork } from "../src/lib/work-query";
import { today } from "../src/lib/model";
import { pdfDocument } from "./helpers/task-documents";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
async function write(page: Page, path: string, body: any, method = "PATCH") {
  return page.request.fetch("/api/" + path, {
    method,
    headers: { Origin: new URL(page.url()).origin },
    data: body,
  });
}
async function actors() {
  const d = await db();
  const get = (email: string) =>
    d.collection("users").findOne({ email: email + "@organic.vn" });
  const [manager, a, b, outside, sender, admin, inactive] = await Promise.all([
    get("vanhanh"),
    get("nv.vanhanh"),
    get("nv.vanhanh2"),
    get("nv.chatluong"),
    get("kinhdoanh"),
    get("admin"),
    get("nv.nghi"),
  ]);
  return {
    d,
    manager: manager!,
    a: a!,
    b: b!,
    outside: outside!,
    sender: sender!,
    admin: admin!,
    inactive: inactive!,
  };
}
async function family() {
  const people = await actors(),
    { manager, a, b } = people;
  const marker = randomUUID();
  const parent = await createTask(manager, {
    title: "Truyền thông đợt 1 " + marker,
    owningDepartmentId: String(manager.departmentId),
    dueDate: today(),
    assigneeId: String(manager._id),
  });
  const children = [];
  for (const [name, user] of [
    ["Chuẩn hóa nhận diện", a],
    ["Thiết kế mẫu nội dung", b],
  ] as const)
    children.push(
      await createTask(manager, {
        title: name + " " + marker,
        owningDepartmentId: String(manager.departmentId),
        parentTaskId: String(parent._id),
        assigneeId: String(user._id),
        dueDate: today(),
      }),
    );
  return { ...people, parent, children, marker };
}
test.afterAll(async () => {
  await client().close();
});

test("Việc con liên phòng giữ quyền phòng gửi, kết quả bắt buộc và người nghiệm thu phòng gửi", async () => {
  const { d, sender, manager, a, b } = await actors();
  const parent = await createTask(sender, {
    title: "Truyền thông đợt 1 liên phòng " + randomUUID(),
    owningDepartmentId: String(manager.departmentId),
    dueDate: today(),
  });
  const child = await createTask(manager, {
    title: "Chuẩn hóa nhận diện liên phòng",
    parentTaskId: String(parent._id),
    owningDepartmentId: String(manager.departmentId),
    assigneeId: String(a._id),
    dueDate: today(),
  });
  expect(child.requestingDepartmentId).toEqual(sender.departmentId);
  await expect(
    changeTask(sender, String(child._id), { assigneeId: String(b._id) }),
  ).rejects.toThrow(/quyền chỉnh sửa/);
  await expect(
    changeTask(a, String(child._id), { status: "done" }),
  ).rejects.toThrow(/kết quả thực hiện/);
  await changeTask(a, String(child._id), {
    status: "done",
    result: "Đã bàn giao bộ nhận diện",
  });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("done");
  expect(
    await d.collection("notifications").countDocuments({
      taskId: parent._id,
      recipientId: sender._id,
      types: "completed",
    }),
  ).toBe(1);
  await changeTask(manager, String(parent._id), { status: "todo" });
  await changeTask(manager, String(parent._id), {
    reviewerId: String(sender._id),
  });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("doing");
  await changeTask(sender, String(parent._id), {
    status: "done",
    result: "Đã nghiệm thu bộ nhận diện",
  });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!
      .reviewAcceptedById,
  ).toEqual(sender._id);
});

test("Tạo việc con kèm tệp, liên kết cha, danh sách cá nhân và số liệu không cộng trùng", async ({
  page,
  browser,
}) => {
  const { manager, a, d } = await actors();
  await login(page, "vanhanh");
  const marker = randomUUID(),
    parent = await createTask(manager, {
      title: "Truyền thông đợt 1 " + marker,
      owningDepartmentId: String(manager.departmentId),
      dueDate: today(),
    });
  const from = "/board?mode=list&q=" + marker;
  await page.goto("/tasks/" + parent._id + "?" + new URLSearchParams({ from }));
  await page
    .getByRole("button", { name: "+ Thêm công việc con", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(parent.title, { exact: true })).toBeVisible();
  await expect(
    dialog.getByLabel("Phòng phụ trách", { exact: true }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Tiêu đề công việc")
    .fill("Chuẩn hóa nhận diện " + marker);
  await dialog.getByLabel("Người đảm nhận chính", { exact: true }).fill(a.name);
  await dialog.getByRole("option", { name: a.name, exact: true }).click();
  await dialog.getByLabel("Ngày bắt đầu").fill(today());
  await dialog.getByLabel("Ngày kết thúc").fill(today());
  await expect(
    dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Chọn tệp đính kèm").setInputFiles({
    name: "nhan-dien.pdf",
    mimeType: "application/pdf",
    buffer: pdfDocument(),
  });
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp("/tasks/" + parent._id));
  await expect(page.locator(".subtasks-section")).toContainText(
    "0/1 hoàn thành",
  );
  await expect(page.locator(".subtask-list")).toContainText(a.name);
  const childInfo = await (
    await page.request.get("/api/tasks/" + parent._id)
  ).json();
  const childId = childInfo.children[0]._id;
  await page.locator(".subtask-list a").first().click();
  await expect(page.locator(".parent-task-backlink")).toContainText(
    parent.title,
  );
  await page.reload();
  await expect(page.locator(".task-attachments")).toContainText(
    "nhan-dien.pdf",
  );
  await page.locator(".parent-task-backlink").click();
  const second = await createTask(manager, {
    title: "Thiết kế mẫu nội dung " + marker,
    parentTaskId: String(parent._id),
    owningDepartmentId: String(manager.departmentId),
    dueDate: today(),
  });
  const result = await queryWork(
    manager,
    new URLSearchParams({ view: "progress", metric: "all", q: marker }),
  );
  expect(result.total).toBe(2);
  expect(result.parents).toHaveLength(1);
  expect(result.stats.todo).toBe(2);
  expect(result.tasks.map((t) => String(t._id))).toContain(String(second._id));
  const worker = await browser.newPage();
  try {
    await login(worker, "nv.vanhanh");
    await worker.goto("/my-tasks?q=" + marker);
    await expect(
      worker.locator('[data-task-id="' + childId + '"]'),
    ).toBeVisible();
    await worker.locator(".work-task-title").click();
    expect(
      (
        await worker.request.get(
          "/api/files/" +
            (await (await worker.request.get("/api/tasks/" + childId)).json())
              .attachments[0]._id,
        )
      ).ok(),
    ).toBe(true);
  } finally {
    await worker.close();
  }
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".subtasks-section")).toContainText(
    "0/2 hoàn thành",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/subtasks-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "docs/subtasks-desktop.png", fullPage: true });
  await page.locator(".subtask-list a").first().click();
  await page
    .getByRole("link", { name: "‹ Quay lại danh sách", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/board\\?mode=list&q=" + marker));
  expect(
    (await d.collection("tasks").findOne({ _id: id(childId) }))!.parentTaskId,
  ).toEqual(parent._id);
});

test("Tự hoàn thành, mở lại và hai việc con cuối hoàn thành đồng thời chỉ ghi lịch sử một lần", async () => {
  const { d, manager, a, b, parent, children } = await family();
  await changeTask(a, String(children[0]._id), { status: "done" });
  let root = await d.collection("tasks").findOne({ _id: parent._id });
  expect(root!.status).toBe("doing");
  expect(root!.completedChildCount).toBe(1);
  await expect(
    changeTask(manager, String(parent._id), { status: "done" }),
  ).rejects.toThrow(/Còn 1/);
  await changeTask(b, String(children[1]._id), { status: "done" });
  root = await d.collection("tasks").findOne({ _id: parent._id });
  expect(root!.status).toBe("done");
  expect(root!.completedAt).toBeInstanceOf(Date);
  await changeTask(a, String(children[0]._id), { status: "todo" });
  root = await d.collection("tasks").findOne({ _id: parent._id });
  expect(root!.status).toBe("doing");
  expect(root!.completedAt).toBeNull();
  expect(root!.handovers).toHaveLength(1);
  await changeTask(b, String(children[1]._id), { status: "todo" });
  await Promise.all([
    changeTask(a, String(children[0]._id), {
      status: "done",
      requestId: randomUUID(),
    }),
    changeTask(b, String(children[1]._id), {
      status: "done",
      requestId: randomUUID(),
    }),
  ]);
  root = await d.collection("tasks").findOne({ _id: parent._id });
  expect(root!.status).toBe("done");
  expect(root!.completedChildCount).toBe(2);
  expect(root!.handovers).toHaveLength(2);
  expect(
    await d.collection("task_activities").countDocuments({
      taskId: parent._id,
      type: "status",
      after: "done",
      source: "subtasks",
    }),
  ).toBe(2);
  await expect(
    changeTask(manager, String(parent._id), { assigneeId: String(a._id) }),
  ).rejects.toThrow(/Mở lại/);
  await changeTask(manager, String(parent._id), { status: "todo" });
  await changeTask(manager, String(parent._id), { assigneeId: String(a._id) });
  for (const child of children)
    expect(
      String(
        (await d.collection("tasks").findOne({ _id: child._id }))!.assigneeId,
      ),
    ).toBe(String(child.assigneeId));
});

test("Người nghiệm thu, xác nhận đúng quyền và yêu cầu nghiệm thu lại sau mở việc con", async ({
  page,
}) => {
  const { d, manager, a, b, outside, parent, children } = await family();
  await changeTask(manager, String(parent._id), { reviewerId: String(a._id) });
  await expect(
    changeTask(manager, String(parent._id), { status: "done" }),
  ).rejects.toThrow(/Còn 2/);
  await changeTask(a, String(children[0]._id), { status: "done" });
  await changeTask(b, String(children[1]._id), { status: "done" });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("doing");
  await expect(
    changeTask(b, String(parent._id), { status: "done" }),
  ).rejects.toThrow(/người nghiệm thu/);
  await expect(
    changeTask(outside, String(parent._id), { status: "done" }),
  ).rejects.toThrow(/quyền truy cập/);
  await login(page, "nv.vanhanh");
  await page.goto("/tasks/" + parent._id);
  await expect(
    page.getByText("Đủ điều kiện nghiệm thu · 2/2 hoàn thành", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Xác nhận hoàn thành", exact: true })
    .click();
  await expect(
    page.locator(".task-detail-header .inline-task-status"),
  ).toHaveValue("done");
  await expect(
    changeTask(a, String(parent._id), { status: "done" }),
  ).rejects.toThrow(/đã hoàn thành/);
  expect(
    await d
      .collection("task_activities")
      .countDocuments({ taskId: parent._id, type: "status", after: "done" }),
  ).toBe(1);
  await expect(
    changeTask(manager, String(parent._id), { reviewerId: String(b._id) }),
  ).rejects.toThrow(/Mở lại/);
  await changeTask(a, String(children[0]._id), { status: "todo" });
  await changeTask(a, String(children[0]._id), { status: "done" });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("doing");
  await changeTask(a, String(parent._id), { status: "done" });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!
      .reviewAcceptedById,
  ).toEqual(a._id);
});

test("Giao lại giữ nguyên dữ liệu, danh sách A/B, quyền và thông báo", async ({
  page,
  browser,
}) => {
  const { d, a, b, outside, inactive, parent, children } = await family();
  const child = children[0];
  await changeTask(a, String(child._id), { status: "doing" });
  await login(page, "vanhanh");
  await page.goto("/tasks/" + parent._id);
  const row = page.locator(".subtask-list li").filter({ hasText: child.title });
  await row.getByLabel("Thao tác " + child.title, { exact: true }).click();
  await row.getByRole("button", { name: "Giao lại", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(a.name);
  await dialog
    .getByLabel("Người đảm nhận chính", { exact: true })
    .selectOption(String(b._id));
  await dialog.getByLabel("Lý do giao lại").fill("Chuyển đầu mối thiết kế");
  await dialog.getByRole("button", { name: "Giao lại", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const latest = await d.collection("tasks").findOne({ _id: child._id });
  expect(latest!.status).toBe("doing");
  expect(latest!.dueDate).toBe(child.dueDate);
  expect(latest!.parentTaskId).toEqual(parent._id);
  const history = await d
    .collection("task_activities")
    .findOne({ taskId: child._id, type: "assigneeId" });
  expect(history!.before).toEqual(a._id);
  expect(history!.after).toEqual(b._id);
  expect(history!.reason).toBe("Chuyển đầu mối thiết kế");
  expect(
    await d.collection("notifications").countDocuments({
      taskId: child._id,
      recipientId: b._id,
      types: "assigned",
    }),
  ).toBe(1);
  await expect(
    changeTask(a, String(child._id), { status: "done" }),
  ).rejects.toThrow(/quyền đổi trạng thái/);
  await changeTask(b, String(child._id), {
    status: "waiting",
    waitingReason: "Chờ nội dung",
  });
  const aPage = await browser.newPage(),
    bPage = await browser.newPage();
  try {
    await login(aPage, "nv.vanhanh");
    await login(bPage, "nv.vanhanh2");
    await aPage.goto("/my-tasks?q=" + encodeURIComponent(child.title));
    await bPage.goto("/my-tasks?q=" + encodeURIComponent(child.title));
    await expect(
      aPage.locator('[data-task-id="' + child._id + '"]'),
    ).toHaveCount(0);
    await expect(
      bPage.locator('[data-task-id="' + child._id + '"]'),
    ).toBeVisible();
    for (const user of [outside, inactive])
      expect(
        (
          await write(page, "tasks/" + child._id, {
            assigneeId: String(user._id),
          })
        ).status(),
      ).toBe(400);
  } finally {
    await aPage.close();
    await bPage.close();
  }
  await page.goto("/tasks/" + child._id);
  await expect(
    page.getByRole("button", { name: "Giao lại", exact: true }),
  ).toBeVisible();
});

test("Giới hạn quan hệ, lưu trữ có xác nhận, khôi phục và rollback", async ({
  page,
}) => {
  const { d, manager, a, parent, children } = await family();
  const payload = {
    title: "Invalid child",
    owningDepartmentId: String(manager.departmentId),
    dueDate: today(),
    parentTaskId: String(children[0]._id),
  };
  await expect(createTask(manager, payload)).rejects.toThrow(/một cấp/);
  await expect(
    createTask(a, { ...payload, parentTaskId: String(parent._id) }),
  ).rejects.toThrow(/Không có quyền/);
  await expect(
    createTask(manager, {
      ...payload,
      parentTaskId: String(parent._id),
      owningDepartmentId: "000000000000000000000001",
    }),
  ).rejects.toThrow();
  await expect(
    changeTask(manager, String(parent._id), { archived: true }),
  ).rejects.toThrow(/công việc con/);
  await changeTask(a, String(children[0]._id), { status: "done" });
  await expect(
    changeTask(manager, String(children[1]._id), { archived: true }),
  ).rejects.toThrow(/Cần xác nhận/);
  await login(page, "vanhanh");
  await page.goto("/tasks/" + children[1]._id);
  await page
    .getByRole("button", { name: "Lưu trữ công việc", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Xác nhận lưu trữ công việc con",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm
    .getByRole("button", { name: "Xác nhận lưu trữ", exact: true })
    .click();
  await expect(confirm).toHaveCount(0);
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("done");
  await changeTask(manager, String(children[1]._id), { archived: false });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("doing");
  await expect(
    changeTask(a, String(children[0]._id), { status: "todo" }, true),
  ).rejects.toThrow("TEST_ACTIVITY_FAILURE");
  expect(
    (await d.collection("tasks").findOne({ _id: children[0]._id }))!.status,
  ).toBe("done");
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!
      .completedChildCount,
  ).toBe(1);
  await changeTask(manager, String(children[0]._id), { archived: true });
  await changeTask(manager, String(children[1]._id), { archived: true });
  const before = await d.collection("tasks").findOne({ _id: parent._id });
  expect(before!.activeChildCount).toBe(0);
  await changeTask(manager, String(parent._id), { archived: true });
  await expect(
    changeTask(manager, String(children[0]._id), { archived: false }),
  ).rejects.toThrow(/Khôi phục công việc cha/);
  await expect(
    createTask(manager, { ...payload, parentTaskId: String(parent._id) }),
  ).rejects.toThrow(/lưu trữ/);
  await changeTask(manager, String(parent._id), { archived: false });
  await changeTask(manager, String(children[1]._id), { archived: false });
  expect(
    (await d.collection("tasks").findOne({ _id: parent._id }))!.status,
  ).toBe("todo");
});

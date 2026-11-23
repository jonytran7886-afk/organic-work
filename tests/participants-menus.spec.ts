import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, client } from "../src/lib/db";
import { createTask, changeTask } from "../src/lib/service";
import { queryWork } from "../src/lib/work-query";
import { today } from "../src/lib/model";
import { pdfDocument } from "./helpers/task-documents";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
async function people() {
  const d = await db(),
    get = (email: string) =>
      d.collection("users").findOne({ email: email + "@organic.vn" });
  const [manager, a, b, outside, inactive, sender, admin] = await Promise.all([
    get("vanhanh"),
    get("nv.vanhanh"),
    get("nv.vanhanh2"),
    get("nv.chatluong"),
    get("nv.nghi"),
    get("kinhdoanh"),
    get("admin"),
  ]);
  return {
    d,
    manager: manager!,
    a: a!,
    b: b!,
    outside: outside!,
    inactive: inactive!,
    sender: sender!,
    admin: admin!,
  };
}
async function fillChild(
  page: Page,
  name: string,
  assigneeName: string,
  file = false,
) {
  const dialog = page.getByRole("dialog", {
    name: "Thêm công việc con",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Phòng phụ trách", { exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Tiêu đề công việc").fill(name);
  await dialog
    .getByLabel("Người đảm nhận chính", { exact: true })
    .fill(assigneeName);
  await dialog.getByRole("option", { name: assigneeName, exact: true }).click();
  await dialog.getByLabel("Ngày bắt đầu").fill(today());
  await dialog.getByLabel("Ngày kết thúc").fill(today());
  await expect(
    dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
  ).toBeEnabled();
  if (file)
    await dialog.getByLabel("Chọn tệp đính kèm").setInputFiles({
      name: "yeu-cau.pdf",
      mimeType: "application/pdf",
      buffer: pdfDocument(),
    });
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
}
test.afterAll(async () => {
  await client().close();
});

test("Một người chính, nhiều người tham gia: loại trùng, đúng quyền, thông báo và số liệu", async ({
  page,
}) => {
  const { d, manager, a, b, outside, inactive, sender } = await people();
  const title = "Participants " + randomUUID();
  const task = await createTask(manager, {
    title,
    owningDepartmentId: String(manager.departmentId),
    assigneeId: String(a._id),
    participantIds: [
      String(a._id),
      String(b._id),
      String(b._id).toUpperCase(),
      String(manager._id),
    ],
    dueDate: today(),
  });
  expect(task.participantIds.map(String).sort()).toEqual(
    [String(b._id), String(manager._id)].sort(),
  );
  const query = (user: any, involvement: string) =>
    queryWork(
      user,
      new URLSearchParams({ view: "mine", involvement, q: title }),
    );
  expect((await query(b, "assigned")).total).toBe(0);
  expect((await query(b, "participating")).total).toBe(1);
  const progress = await queryWork(
    manager,
    new URLSearchParams({ view: "progress", metric: "all", q: title }),
  );
  expect(progress.total).toBe(1);
  expect(progress.stats.open).toBe(1);
  expect(
    progress.allocation.find((row) => String(row.id) === String(a._id))!.open,
  ).toBe(1);
  expect(
    progress.allocation.find((row) => String(row.id) === String(b._id))!.open,
  ).toBe(0);
  await expect(
    changeTask(b, String(task._id), { status: "doing" }),
  ).rejects.toThrow(/quyền đổi trạng thái/);
  await expect(
    changeTask(b, String(task._id), { participantIds: [] }),
  ).rejects.toThrow(/quyền chỉnh sửa/);
  for (const person of [outside, inactive])
    await expect(
      changeTask(manager, String(task._id), {
        participantIds: [String(person._id)],
      }),
    ).rejects.toThrow(/Người tham gia/);
  await expect(
    changeTask(sender, String(task._id), { participantIds: [String(b._id)] }),
  ).rejects.toThrow(/quyền truy cập/);
  await expect(
    createTask(a, {
      title: "Forbidden participants",
      owningDepartmentId: String(a.departmentId),
      dueDate: today(),
      participantIds: [String(b._id)],
    }),
  ).rejects.toThrow(/quản lý người tham gia/);
  expect(
    await d.collection("notifications").countDocuments({
      taskId: task._id,
      recipientId: b._id,
      types: "participating",
    }),
  ).toBe(1);
  await login(page, "nv.vanhanh2");
  await page.goto("/my-tasks?q=" + encodeURIComponent(title));
  await expect(page.locator('[data-task-id="' + task._id + '"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Tôi tham gia", exact: true }).click();
  await expect(page.locator('[data-task-id="' + task._id + '"]')).toBeVisible();
  await page.locator(".work-task-title").click();
  await expect(page.locator(".task-participants")).toContainText(b.name);
  await expect(
    page.getByLabel("Trạng thái công việc", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Quản lý người tham gia", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Bình luận", { exact: true })
    .fill("Đã nhận phần phối hợp");
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect(page.locator(".discussion")).toContainText(
    "Đã nhận phần phối hợp",
  );
  await changeTask(manager, String(task._id), {
    assigneeId: String(b._id),
    reassignmentReason: "Nhận đầu mối chính",
  });
  const promoted = await d.collection("tasks").findOne({ _id: task._id });
  expect(promoted!.participantIds.map(String)).toEqual([String(manager._id)]);
  expect(promoted!.status).toBe("todo");
  expect(promoted!.dueDate).toBe(task.dueDate);
  expect((await query(b, "participating")).total).toBe(0);
  expect((await query(b, "assigned")).total).toBe(1);
  await changeTask(manager, String(task._id), {
    participantIds: [String(manager._id), String(a._id)],
  });
  await expect(
    changeTask(a, String(task._id), { status: "doing" }),
  ).rejects.toThrow(/quyền đổi trạng thái/);
  // Even a malformed legacy membership does not widen canView/scope.
  await d
    .collection("tasks")
    .updateOne(
      { _id: task._id },
      { $addToSet: { participantIds: outside._id } },
    );
  expect((await query(outside, "participating")).total).toBe(0);
  await d.collection("tasks").updateOne({ _id: task._id }, {
    $pull: { participantIds: outside._id },
  } as any);
});

test("Menu danh sách và chi tiết tạo con tại chỗ, giữ bộ lọc, hiện tỷ lệ và vị trí khu vực con", async ({
  page,
}) => {
  const { manager, a, b } = await people();
  await login(page, "vanhanh");
  const marker = randomUUID(),
    parent = await createTask(manager, {
      title: "Truyền thông đợt 1 " + marker,
      owningDepartmentId: String(manager.departmentId),
      assigneeId: String(manager._id),
      dueDate: today(),
    });
  const mine = "/my-tasks?q=" + marker;
  await page.goto(mine);
  let row = page.locator('[data-task-id="' + parent._id + '"]');
  await row.getByLabel("Thao tác " + parent.title, { exact: true }).click();
  await row
    .getByRole("button", { name: "+ Thêm công việc con", exact: true })
    .click();
  await fillChild(page, "Chuẩn hóa nhận diện " + marker, a.name, true);
  await expect(page).toHaveURL(new RegExp("/my-tasks\\?q=" + marker));
  await expect(row).toHaveAttribute("data-child-count", "1");
  await expect(row).toContainText("0/1 hoàn thành");
  await expect(row).toBeInViewport();
  const board = "/board?mode=list&q=" + marker;
  await page.goto(board);
  row = page.locator('[data-task-id="' + parent._id + '"]');
  await row.getByLabel("Thao tác " + parent.title, { exact: true }).click();
  await row
    .getByRole("button", { name: "+ Thêm công việc con", exact: true })
    .click();
  await fillChild(page, "Thiết kế mẫu nội dung " + marker, b.name);
  await expect(page).toHaveURL(new RegExp("/board\\?mode=list&q=" + marker));
  await expect(row).toHaveAttribute("data-child-count", "2");
  await expect(page.locator(".list-mode .subtask-badge")).toHaveCount(2);
  await row.getByRole("link").first().click();
  const hierarchy = page.getByRole("region", {
    name: "Công việc con",
    exact: true,
  });
  await expect(hierarchy).toContainText("0/2 hoàn thành");
  expect(
    await hierarchy.evaluate(
      (section) =>
        !!(
          section.compareDocumentPosition(
            document.querySelector(".discussion")!,
          ) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
    ),
  ).toBe(true);
  await expect(
    hierarchy
      .locator(".section-title")
      .getByRole("button", { name: "+ Thêm công việc con", exact: true }),
  ).toBeVisible();
  const detailUrl = page.url();
  await hierarchy
    .getByRole("button", { name: "+ Thêm công việc con", exact: true })
    .click();
  await fillChild(page, "Bàn giao mẫu " + marker, b.name);
  await expect(page).toHaveURL(detailUrl);
  await expect(hierarchy).toContainText("0/3 hoàn thành");
  await page.screenshot({
    path: "docs/subtasks-v2-detail-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/subtasks-v2-detail-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Quản lý người tham gia trong form/giao lại, menu theo quyền trên desktop và mobile", async ({
  page,
  browser,
}) => {
  const { manager, a, b, outside, sender, d } = await people();
  await login(page, "vanhanh");
  const title = "UI participants " + randomUUID();
  await page
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tiêu đề công việc").fill(title);
  await dialog.getByLabel("Người đảm nhận chính", { exact: true }).fill(a.name);
  await dialog.getByRole("option", { name: a.name, exact: true }).click();
  const picker = dialog.getByRole("group", {
    name: "Người tham gia",
    exact: true,
  });
  await expect(
    picker.getByRole("checkbox", { name: a.name, exact: true }),
  ).toHaveCount(0);
  await picker.getByRole("checkbox", { name: b.name, exact: true }).check();
  await picker
    .getByRole("checkbox", { name: manager.name, exact: true })
    .check();
  await dialog.getByLabel("Ngày bắt đầu").fill(today());
  await dialog.getByLabel("Ngày kết thúc").fill(today());
  await expect(
    dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks\//);
  const taskId = new URL(page.url()).pathname.split("/").at(-1)!;
  await expect(page.locator(".task-participants")).toContainText(b.name);
  await expect(
    page
      .locator(".assignee-heading")
      .getByRole("button", { name: "Giao lại", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Giao lại", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Người đảm nhận chính", { exact: true })
    .selectOption(String(b._id));
  await expect(
    dialog
      .getByRole("group", { name: "Người tham gia", exact: true })
      .getByRole("checkbox", { name: b.name, exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("group", { name: "Người tham gia", exact: true })
    .getByRole("checkbox", { name: a.name, exact: true })
    .check();
  await dialog.getByLabel("Lý do giao lại").fill("B làm đầu mối, A phối hợp");
  await dialog.getByRole("button", { name: "Giao lại", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await d.collection("tasks").findOne({
    _id: (await import("mongodb")).ObjectId.createFromHexString(taskId),
  });
  expect(saved!.participantIds.map(String).sort()).toEqual(
    [String(a._id), String(manager._id)].sort(),
  );
  await page
    .getByRole("button", { name: "Quản lý người tham gia", exact: true })
    .click();
  const detailPicker = page.getByRole("group", {
    name: "Người tham gia",
    exact: true,
  });
  await detailPicker
    .getByRole("checkbox", { name: a.name, exact: true })
    .uncheck();
  await page
    .getByRole("button", { name: "Lưu người tham gia", exact: true })
    .click();
  await expect(page.locator(".task-participants")).not.toContainText(a.name);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board?mode=list&q=" + encodeURIComponent(title));
  const row = page
    .locator(".list-mode")
    .locator('[data-task-id="' + taskId + '"]');
  await row.getByLabel("Thao tác " + title, { exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Giao lại", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/subtasks-v2-menu-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const employee = await browser.newPage();
  try {
    await login(employee, "nv.vanhanh2");
    await employee.goto("/my-tasks?q=" + encodeURIComponent(title));
    const employeeRow = employee.locator('[data-task-id="' + taskId + '"]');
    await employeeRow.getByLabel("Thao tác " + title, { exact: true }).click();
    await expect(
      employeeRow.getByRole("button", { name: "Giao lại", exact: true }),
    ).toHaveCount(0);
    await expect(
      employeeRow.getByRole("button", {
        name: "+ Thêm công việc con",
        exact: true,
      }),
    ).toHaveCount(1);
    const cross = await createTask(sender, {
      title: "Cross menu " + randomUUID(),
      owningDepartmentId: String(manager.departmentId),
      dueDate: today(),
    });
    await login(employee, "kinhdoanh");
    await employee.goto(
      "/board?mode=list&q=" + encodeURIComponent(cross.title),
    );
    const sentRow = employee
      .locator(".list-mode")
      .locator('[data-task-id="' + cross._id + '"]');
    await sentRow
      .getByLabel("Thao tác " + cross.title, { exact: true })
      .click();
    await expect(
      sentRow.getByRole("button", { name: "Phân công", exact: true }),
    ).toHaveCount(0);
    await expect(
      sentRow.getByRole("button", {
        name: "+ Thêm công việc con",
        exact: true,
      }),
    ).toHaveCount(0);
    await login(employee, "nv.chatluong");
    expect((await employee.request.get("/api/tasks/" + taskId)).status()).toBe(
      403,
    );
    await login(employee, "admin");
    await employee.goto("/board?mode=list&q=" + encodeURIComponent(title));
    const adminRow = employee
      .locator(".list-mode")
      .locator('[data-task-id="' + taskId + '"]');
    await adminRow.getByLabel("Thao tác " + title, { exact: true }).click();
    await expect(
      adminRow.getByRole("button", { name: "Giao lại", exact: true }),
    ).toBeVisible();
  } finally {
    await employee.close();
  }
});

import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, client } from "../src/lib/db";
import { createTask, changeTask } from "../src/lib/service";
import { today } from "../src/lib/model";

async function setup() {
  const database = await db();
  const manager = (await database
    .collection("users")
    .findOne({ email: "vanhanh@organic.vn" }))!;
  const worker = (await database
    .collection("users")
    .findOne({ email: "nv.vanhanh@organic.vn" }))!;
  const task = await createTask(manager, {
    title: "Task Detail " + randomUUID(),
    description: "Mô tả cần theo dõi",
    owningDepartmentId: String(manager.departmentId),
    assigneeId: String(worker._id),
    dueDate: today(),
  });
  return { manager, worker, task };
}
async function login(page: Page, account: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account + "@organic.vn");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
test.afterAll(async () => {
  await client().close();
});

test("Task Detail: header, tabs, bình luận, lịch sử và chỉnh thuộc tính inline", async ({
  page,
}) => {
  const { task } = await setup();
  await login(page, "vanhanh");
  await page.goto("/tasks/" + task._id);
  await expect(
    page.getByRole("heading", { name: task.title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tạo công việc", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Hoạt động", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".detail-editor")).not.toHaveAttribute("open");
  await page.getByLabel("Bình luận", { exact: true }).fill("Nội dung nháp");
  await page.getByRole("tab", { name: "Tệp đính kèm", exact: true }).click();
  await expect(
    page.getByText("Chưa có tệp đính kèm.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".detail-timeline")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Thêm tệp khi bàn giao kết quả" }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Kết quả thực hiện", exact: true })
    .click();
  await expect(
    page.getByText("Chưa có kết quả bàn giao.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Hoạt động", exact: true }).click();
  await expect(page.getByLabel("Bình luận", { exact: true })).toHaveValue(
    "Nội dung nháp",
  );
  await page
    .getByRole("button", { name: "Gửi bình luận", exact: true })
    .click();
  await expect(page.locator(".detail-timeline .comment")).toContainText(
    "Nội dung nháp",
  );
  await page.getByRole("button", { name: "Lịch sử", exact: true }).click();
  await expect(page.locator(".detail-timeline .comment")).toHaveCount(0);
  await expect(
    page.locator(".detail-timeline .activity").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bình luận", exact: true }).click();
  await expect(page.locator(".detail-timeline .activity")).toHaveCount(0);
  await page
    .getByLabel("Ưu tiên công việc", { exact: true })
    .selectOption("high");
  await expect(page.locator(".task-detail-header .priority")).toHaveText("Cao");
  await page
    .locator(".task-detail-header .inline-task-status")
    .selectOption("waiting");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lý do chờ", { exact: true }).fill("Đợi vật tư");
  await dialog.getByRole("button", { name: "Lưu trạng thái chờ" }).click();
  await expect(
    page.locator(".task-detail-header .inline-task-status"),
  ).toHaveValue("waiting");
  await expect(page.locator(".task-detail-header .waiting-note")).toHaveText(
    "Đợi vật tư",
  );
  await page
    .locator(".task-detail-header")
    .getByLabel("Thao tác " + task.title, { exact: true })
    .click();
  await page.getByRole("link", { name: "Xem lịch sử", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Hoạt động", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Lịch sử", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Task Detail: Subtask inline và người nghiệm thu nằm trong thuộc tính", async ({
  page,
}) => {
  const { task, manager, worker } = await setup();
  const child = await createTask(manager, {
    title: "Việc con " + randomUUID(),
    parentTaskId: String(task._id),
    owningDepartmentId: String(manager.departmentId),
    assigneeId: String(worker._id),
    dueDate: today(),
  });
  await login(page, "vanhanh");
  await page.goto("/tasks/" + task._id);
  const subtasks = page.getByRole("region", {
    name: "Công việc con",
    exact: true,
  });
  await expect(
    subtasks.getByLabel("Người nghiệm thu", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator(".task-detail-properties")
      .getByLabel("Người nghiệm thu", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Người nghiệm thu", { exact: true })
    .selectOption(String(worker._id));
  await expect(
    page.getByLabel("Người nghiệm thu", { exact: true }),
  ).toHaveValue(String(worker._id));
  await subtasks
    .getByLabel("Trạng thái " + child.title, { exact: true })
    .selectOption("doing");
  await expect(
    subtasks.getByLabel("Trạng thái " + child.title, { exact: true }),
  ).toHaveValue("doing");
  await subtasks.locator(".detail-child-list > summary").click();
  await expect(
    subtasks.getByRole("link", { name: child.title, exact: true }),
  ).toBeHidden();
  await subtasks.locator(".detail-child-list > summary").click();
  await subtasks.getByRole("link", { name: child.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/tasks/" + child._id));
});

test("Task Detail: mobile thu gọn thuộc tính, giữ quyền và menu không tràn", async ({
  page,
}) => {
  const { task } = await setup();
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "nv.vanhanh");
  await page.goto("/tasks/" + task._id);
  const properties = page.locator(".task-detail-properties");
  await expect(properties).not.toHaveAttribute("open");
  await properties.locator(":scope > summary").click();
  await expect(
    page.getByLabel("Ưu tiên công việc", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Phân công người phụ trách", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".task-detail-header .inline-task-status"),
  ).toBeEnabled();
  await page.getByLabel("Thao tác " + task.title, { exact: true }).click();
  const bounds = await page.locator(".task-menu-popover").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

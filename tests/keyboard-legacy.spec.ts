import { test, expect } from "@playwright/test";
import { db, client } from "../src/lib/db";
import { today } from "../src/lib/model";
test("Bàn phím, lý do chờ dữ liệu cũ và giữ bộ lọc khi đổi chế độ bảng", async ({
  page,
}) => {
  const d = await db(),
    worker = await d
      .collection("users")
      .findOne({ email: "nv.vanhanh@organic.vn" }),
    manager = await d
      .collection("users")
      .findOne({ email: "vanhanh@organic.vn" });
  const result = await d
    .collection("tasks")
    .insertOne({
      title: "Bàn phím và lý do cũ " + Date.now(),
      description: "Kiểm tra tương thích dữ liệu cũ",
      owningDepartmentId: worker!.departmentId,
      requestingDepartmentId: worker!.departmentId,
      createdById: manager!._id,
      assigneeId: worker!._id,
      dueDate: today(),
      status: "waiting",
      priority: "normal",
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  try {
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("nv.vanhanh@organic.vn");
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(process.env.DEMO_PASSWORD!);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/my-tasks$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".work-task").first()).toBeVisible();
    expect(
      await page
        .locator(".work-task")
        .first()
        .evaluate((e) => e.getBoundingClientRect().top),
    ).toBeLessThan(844);
    const task = page.locator('[data-task-id="' + result.insertedId + '"]');
    await expect(task.locator(".waiting-note")).toContainText("Chưa ghi lý do");
    await task.locator(".work-task-title").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".waiting-detail")).toContainText(
      "Chưa ghi lý do",
    );
    await page
      .getByLabel("Lý do chờ hiện tại")
      .fill("Đã bổ sung vướng mắc từ dữ liệu cũ");
    await page.getByRole("button", { name: "Lưu lý do chờ" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".history")).toContainText(
      "Đã bổ sung vướng mắc từ dữ liệu cũ",
    );
    await page.getByLabel("Trạng thái công việc").selectOption("doing");
    await expect(page.getByLabel("Trạng thái công việc")).toHaveValue("doing");
    await page.getByLabel("Trạng thái công việc").selectOption("waiting");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Lý do chờ", { exact: true })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Đóng", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      dialog.getByRole("button", { name: "Lưu trạng thái chờ" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const checked = await (
      await page.request.get("/api/tasks/" + result.insertedId)
    ).json();
    expect(checked.task.status).toBe("doing");
    expect(checked.task.waitingReason).toBeNull();
    expect(
      checked.activities.some(
        (a: any) =>
          a.type === "waitingReason" &&
          a.before === "Đã bổ sung vướng mắc từ dữ liệu cũ" &&
          a.after === null,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/board?metric=waiting&mode=list");
    await page.getByLabel("Ưu tiên", { exact: true }).selectOption("high");
    await expect(page).toHaveURL(
      (u) =>
        u.searchParams.get("priority") === "high" &&
        u.searchParams.get("metric") === "waiting",
    );
    await page
      .getByRole("button", { name: "Bảng Kanban", exact: false })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      (u) =>
        !u.searchParams.get("mode") &&
        u.searchParams.get("metric") === "waiting" &&
        u.searchParams.get("priority") === "high",
    );
    await page.getByRole("button", { name: "Danh sách", exact: false }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL((u) => u.searchParams.get("mode") === "list");
    const response = await (
      await page.request.get(
        "/api/work?view=board&" + new URL(page.url()).searchParams,
      )
    ).json();
    expect(response.total).toBeGreaterThan(0);
    expect(
      response.tasks.every(
        (t: any) => t.status === "waiting" && t.priority === "high",
      ),
    ).toBe(true);
    const url = page.url();
    await page.locator(".list-mode tbody a").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".back-link")).toBeVisible();
    await page.locator(".back-link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(url);
  } finally {
    await client().close();
  }
});

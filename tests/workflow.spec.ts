import { navTo } from "./helpers/navigation";
import { test, expect, Page, Browser } from "@playwright/test";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
  await expect(
    page.getByRole("heading", { name: "Việc của tôi", exact: true }),
  ).toBeVisible();
}
async function post(page: Page, path: string, body: any, method = "POST") {
  return page.evaluate(
    async ({ path, body, method }) => {
      const r = await fetch("/api/" + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body, method },
  );
}
test("Giao việc liên phòng, phân quyền, trạng thái, bình luận, lưu trữ và lọc", async ({
  browser,
}) => {
  const contexts = await Promise.all(
    Array.from({ length: 6 }, () => browser.newContext()),
  );
  const [sales, ops, worker, other, peer, admin] = await Promise.all(
    contexts.map((c) => c.newPage()),
  );
  for (const [p, e] of [
    [sales, "kinhdoanh"],
    [ops, "vanhanh"],
    [worker, "nv.vanhanh"],
    [other, "nv.chatluong"],
    [peer, "nv.vanhanh2"],
    [admin, "admin"],
  ] as const)
    await login(p, e);
  await sales
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  const modal = sales.getByRole("dialog");
  await modal
    .getByLabel("Tiêu đề công việc")
    .fill("E2E Xác nhận lịch đóng gói lô gà Kỳ Anh " + Date.now());
  await modal.getByLabel("Phòng phụ trách").fill("van hanh");
  await modal.getByRole("option", { name: "Vận hành", exact: true }).click();
  await expect(modal.getByLabel("Người đảm nhận chính")).toBeDisabled();
  await modal.getByLabel("Ngày bắt đầu").fill("2019-12-31");
  await modal.getByLabel("Ngày kết thúc").fill("2020-01-01");
  await modal.getByLabel("Ưu tiên", { exact: true }).fill("cao");
  await modal.getByLabel("Ưu tiên", { exact: true }).press("Enter");
  await expect(modal.getByLabel("Ưu tiên", { exact: true })).toHaveValue("Cao");
  await modal
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(sales).toHaveURL(/\/tasks\//);
  await expect(
    sales.locator(".meta").filter({ hasText: "Ngày bắt đầu" }),
  ).toContainText("2019-12-31");
  await expect(
    sales.locator(".meta").filter({ hasText: "Ngày kết thúc" }),
  ).toContainText("2020-01-01");
  const url = sales.url(),
    taskId = new URL(url).pathname.split("/").at(-1)!;
  await ops.goto(url);
  await expect(
    ops.getByRole("heading", { name: "Thông tin công việc" }),
  ).toBeVisible();
  const options = await ops
    .getByLabel("Phân công người phụ trách")
    .locator("option")
    .allTextContents();
  expect(options).toContain("Phạm Thanh Hà");
  expect(options).not.toContain("Đỗ Ngọc Linh");
  await ops
    .getByLabel("Phân công người phụ trách")
    .selectOption({ label: "Phạm Thanh Hà" });
  await expect(ops.getByLabel("Phân công người phụ trách")).toHaveValue(
    /^[a-f0-9]{24}$/,
  );
  await expect
    .poll(async () => {
      await worker.reload();
      const r = await worker.request.get("/api/tasks/" + taskId);
      return (await r.json()).task.assigneeId;
    })
    .not.toBeNull();
  await worker.goto("/my-tasks");
  await worker
    .locator('[data-task-id="' + taskId + '"] .work-task-title')
    .click();
  await worker.getByLabel("Trạng thái công việc").selectOption("doing");
  await expect(worker.getByLabel("Trạng thái công việc")).toHaveValue("doing");
  await worker
    .getByLabel("Bình luận", { exact: true })
    .fill("Xác nhận đóng gói lúc 08:30.");
  await worker.getByRole("button", { name: "Gửi bình luận" }).click();
  await expect(
    worker.getByText("Xác nhận đóng gói lúc 08:30.", { exact: true }),
  ).toBeVisible();
  await worker.getByLabel("Trạng thái công việc").selectOption("done");
  await worker
    .getByRole("dialog")
    .getByLabel("Kết quả thực hiện")
    .fill("Đóng gói 08:30, 500 kiện, đầu mối Thanh Hà");
  await worker
    .getByRole("dialog")
    .getByRole("button", { name: "Hoàn thành", exact: true })
    .click();
  await expect(
    worker.getByText("Hoàn thành lúc", { exact: true }),
  ).toBeVisible();
  await worker.reload();
  await expect(worker.getByLabel("Trạng thái công việc")).toHaveValue("done");
  await sales.reload();
  await expect(
    sales.getByText("Xác nhận đóng gói lúc 08:30.", { exact: true }),
  ).toBeVisible();
  await expect(
    sales.getByText("đã đổi trạng thái", { exact: false }).first(),
  ).toBeVisible();
  expect((await other.request.get("/api/tasks/" + taskId)).status()).toBe(403);
  await other.goto(url);
  await expect(
    other
      .getByRole("alert")
      .filter({ hasText: /Không có quyền|Email hoặc mật khẩu không đúng/ }),
  ).toContainText("Không có quyền");
  expect(
    (await post(other, "tasks/" + taskId, { status: "doing" }, "PATCH")).status,
  ).toBe(400);
  await peer.goto(url);
  await expect(
    peer.getByRole("heading", { name: "Thông tin công việc" }),
  ).toBeVisible();
  expect(
    (await post(peer, "tasks/" + taskId, { status: "doing" }, "PATCH")).status,
  ).toBe(400);
  expect(
    (
      await post(peer, "tasks/" + taskId + "/comments", {
        body: "Đồng đội xác nhận",
      })
    ).status,
  ).toBe(200);
  const data = await (await sales.request.get("/api/data")).json();
  expect(
    (
      await post(
        sales,
        "tasks/" + taskId,
        {
          assigneeId: data.users.find((u: any) => u.name === "Vũ Hải Đăng")._id,
        },
        "PATCH",
      )
    ).status,
  ).toBe(400);
  await ops.getByLabel("Trạng thái công việc").selectOption("todo");
  await expect(ops.getByText("Quá hạn", { exact: true })).toBeVisible();
  await ops.reload();
  await expect(ops.getByText("Hoàn thành lúc", { exact: true })).toHaveCount(0);
  await admin.goto("/progress");
  const count = Number(await admin.locator(".stat-late>strong").innerText());
  await admin.locator(".stat-late").click();
  await expect(admin.locator(".result-count")).toHaveText(count + " công việc");
  await ops.goto(url);
  await ops.getByRole("button", { name: "Lưu trữ công việc" }).click();
  await expect(
    ops.getByRole("button", { name: "Khôi phục công việc" }),
  ).toBeVisible();
  await admin.goto("/progress");
  await expect(admin.locator(".stat-late>strong")).toHaveText(
    String(count - 1),
  );
  expect(
    (
      await post(worker, "tasks/" + taskId + "/comments", {
        body: "Không được ghi",
      })
    ).status,
  ).toBe(400);
  await ops.getByRole("button", { name: "Khôi phục công việc" }).click();
  await expect(
    ops.getByText("Xác nhận đóng gói lúc 08:30.", { exact: true }),
  ).toBeVisible();
  await expect(
    ops.getByText("Đồng đội xác nhận", { exact: true }),
  ).toBeVisible();
  for (const c of contexts) await c.close();
});
test("Admin tạo phòng và tài khoản; vô hiệu hóa thu hồi phiên", async ({
  browser,
}) => {
  const a = await browser.newPage();
  await login(a, "admin");
  await a.getByRole("link", { name: "Tài khoản", exact: true }).click();
  const suffix = Date.now();
  await a.getByRole("link", { name: "Phòng ban", exact: true }).click();
  await a.getByRole("button", { name: "Thêm phòng ban", exact: false }).click();
  let dialog = a.getByRole("dialog");
  await dialog
    .getByLabel("Tên phòng ban", { exact: true })
    .fill("Phòng kiểm thử " + suffix);
  await dialog
    .getByRole("button", { name: "Tạo phòng ban", exact: true })
    .click();
  await expect(
    a.locator("tr").filter({ hasText: "Phòng kiểm thử " + suffix }),
  ).toBeVisible();
  await a.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await a.getByRole("button", { name: "Thêm tài khoản", exact: false }).click();
  dialog = a.getByRole("dialog");
  await dialog.getByLabel("Họ tên").fill("Nhân viên E2E " + suffix);
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("e2e" + suffix + "@organic.vn");
  await dialog.getByLabel("Mật khẩu khởi tạo", { exact: true }).fill(password);
  await dialog
    .getByLabel("Phòng ban", { exact: true })
    .selectOption({ label: "Phòng kiểm thử " + suffix });
  await dialog
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(
    a.locator("tr").filter({ hasText: "Nhân viên E2E " + suffix }),
  ).toBeVisible();
  const n = await browser.newPage();
  await login(n, "e2e" + suffix);
  await expect(
    n.getByRole("button", { name: "Tạo công việc", exact: true }),
  ).toBeVisible();
  await a
    .getByRole("button", {
      name: "Thao tác Nhân viên E2E " + suffix,
      exact: true,
    })
    .click();
  await a.getByRole("menuitem", { name: "Vô hiệu hóa", exact: true }).click();
  await a
    .getByRole("alertdialog")
    .getByRole("button", { name: "Vô hiệu hóa", exact: true })
    .click();
  await expect(
    a.locator("tr").filter({ hasText: "Nhân viên E2E " + suffix }),
  ).toContainText("Đã vô hiệu hóa");
  expect((await n.request.get("/api/data")).status()).toBe(401);
  await n.reload();
  await n
    .getByLabel("Email", { exact: true })
    .fill("e2e" + suffix + "@organic.vn");
  await n.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await n.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    n
      .getByRole("alert")
      .filter({ hasText: /Không có quyền|Email hoặc mật khẩu không đúng/ }),
  ).toContainText("Email hoặc mật khẩu không đúng");
  await a.close();
  await n.close();
});
test("Giao diện mobile ưu tiên danh sách", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "nv.vanhanh");
  await navTo(page, "Công việc phòng ban");
  await expect(page.locator(".mobile-list")).toBeVisible();
  await expect(page.locator(".board-mode")).toBeHidden();
  await page.locator(".mobile-list select").first().selectOption("doing");
  await expect(page.locator(".mobile-list select").first()).toHaveValue(
    "doing",
  );
  await page.locator(".mobile-list select").first().selectOption("waiting");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Lý do chờ", { exact: true })
    .fill("Chờ xác nhận của quản lý ca");
  await dialog.getByRole("button", { name: "Lưu trạng thái chờ" }).click();
  await expect(page.locator(".mobile-list select").first()).toHaveValue(
    "waiting",
  );
  await page.reload();
  await expect(page.locator(".mobile-list select").first()).toHaveValue(
    "waiting",
  );
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập Organic Work" }),
  ).toBeVisible();
  expect((await page.request.get("/api/data")).status()).toBe(401);
});

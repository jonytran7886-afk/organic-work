import { navTo } from "./helpers/navigation";
import { test, expect, Page } from "@playwright/test";
const password = process.env.DEMO_PASSWORD!;
async function login(p: Page, email = "admin") {
  await p.goto("/login");
  await p.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await p.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(p).toHaveURL(/\/my-tasks$/);
}
async function menu(p: Page, name: string, action: string) {
  await p
    .getByRole("button", { name: "Thao tác " + name, exact: true })
    .click();
  await p.getByRole("menuitem", { name: action, exact: true }).click();
}
async function createUser(p: Page, name: string, email: string) {
  await p.getByRole("button", { name: "Thêm tài khoản", exact: false }).click();
  const d = p.getByRole("dialog");
  await d.getByLabel("Họ tên", { exact: true }).fill(name);
  await d.getByLabel("Email", { exact: true }).fill(email);
  await d.getByLabel("Mật khẩu khởi tạo").fill(password);
  await d.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(d).toHaveCount(0);
}
test("Route riêng, lịch sử trình duyệt, dialog tạo, lỗi email trùng, xem và sửa đúng tài khoản", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole("heading", { name: "Tài khoản", exact: true }),
  ).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
  await navTo(page, "Phòng ban");
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await expect(
    page.getByRole("heading", { name: "Phòng ban", exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[name=name]")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Phòng ban", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/admin/users");
  const suffix = Date.now(),
    name = "CRUD A " + suffix,
    email = "crud-a-" + suffix + "@organic.vn",
    name2 = "CRUD B " + suffix,
    email2 = "crud-b-" + suffix + "@organic.vn";
  await createUser(page, name, email);
  await createUser(page, name2, email2);
  await page.reload();
  await expect(page.locator("tr").filter({ hasText: email })).toBeVisible();
  await page
    .getByRole("button", { name: "Thêm tài khoản", exact: false })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Họ tên").fill("Không mất nội dung");
  await d
    .getByLabel("Email", { exact: true })
    .fill("  " + email.toUpperCase() + "  ");
  await d.getByLabel("Mật khẩu khởi tạo").fill(password);
  await d.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(d.locator("#error-email")).toHaveText("Email đã tồn tại");
  await expect(d.getByLabel("Họ tên")).toHaveValue("Không mất nội dung");
  await d.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("chưa được lưu");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await menu(page, name, "Chỉnh sửa");
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Email", { exact: true })).toHaveValue(email);
  await expect(d.locator("input[type=password]")).toHaveCount(0);
  await d.getByLabel("Họ tên").fill("Bản chỉnh bị hủy");
  await page.keyboard.press("Escape");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Tiếp tục chỉnh sửa" })
    .click();
  await expect(page.getByRole("dialog").getByLabel("Họ tên")).toHaveValue(
    "Bản chỉnh bị hủy",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thao tác " + name, exact: true }),
  ).toBeFocused();
  await menu(page, name2, "Chỉnh sửa");
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Họ tên")).toHaveValue(name2);
  await d.getByLabel("Họ tên").fill(name2 + " sửa");
  await d.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(d).toHaveCount(0);
  const data = await (await page.request.get("/api/admin")).json();
  expect(data.users.find((u: any) => u.email === email).name).toBe(name);
  expect(data.users.find((u: any) => u.email === email2).name).toBe(
    name2 + " sửa",
  );
  await menu(page, name, "Xem chi tiết");
  d = page.getByRole("dialog");
  await expect(d).toContainText(email);
  await expect(d.locator("input,select")).toHaveCount(0);
  await d.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(d.getByLabel("Họ tên")).toHaveValue(name);
  await d.getByRole("button", { name: "Hủy", exact: true }).click();
  await page.getByLabel("Tìm tài khoản").fill(email2);
  await page.getByLabel("Lọc trạng thái").selectOption("active");
  await menu(page, name2 + " sửa", "Vô hiệu hóa");
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText("mất quyền truy cập");
  await confirmation.getByRole("button", { name: "Hủy", exact: true }).click();
  await expect(page.locator("tr").filter({ hasText: email2 })).toContainText(
    "Hoạt động",
  );
  await menu(page, name2 + " sửa", "Vô hiệu hóa");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Vô hiệu hóa", exact: true })
    .click();
  await expect(page.locator(".success-notice")).toContainText(
    "không còn phù hợp",
  );
  await expect(page.getByLabel("Tìm tài khoản")).toHaveValue(email2);
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByLabel("Lọc trạng thái").selectOption("inactive");
  await menu(page, name2 + " sửa", "Kích hoạt lại");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Kích hoạt lại", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
test("Phòng ban tự tạo mã, giữ mã khi đổi tên, tham chiếu tài khoản/công việc và bảo vệ Admin", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.goto("/admin/departments");
  const suffix = Date.now(),
    name = "Phòng CRUD " + suffix;
  await page
    .getByRole("button", { name: "Thêm phòng ban", exact: false })
    .click();
  let d = page.getByRole("dialog");
  await d.getByLabel("Tên phòng ban", { exact: true }).fill(name);
  await expect(d.locator("input[name=code]")).toHaveCount(0);
  await d.getByRole("button", { name: "Tạo phòng ban", exact: true }).click();
  await expect(d).toHaveCount(0);
  const before = await (await page.request.get("/api/admin")).json();
  const department = before.departments.find((v: any) => v.name === name);
  const code = department.code;
  expect(code).toMatch(/^PB-\d{6,}$/);
  await page.reload();
  await expect(page.locator("tr").filter({ hasText: name })).toContainText(
    code,
  );
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Thêm tài khoản", exact: false })
    .click();
  d = page.getByRole("dialog");
  await d.getByLabel("Họ tên").fill("Tham chiếu " + suffix);
  await d
    .getByLabel("Email", { exact: true })
    .fill("ref-" + suffix + "@organic.vn");
  await d.getByLabel("Mật khẩu khởi tạo").fill(password);
  await d.getByLabel("Phòng ban", { exact: true }).selectOption(department._id);
  await d.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(d).toHaveCount(0);
  const created = await page.evaluate(
    async ({ departmentId }) => {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Tham chiếu phòng đổi tên",
          owningDepartmentId: departmentId,
          dueDate: "2030-01-01",
        }),
      });
      return await r.json();
    },
    { departmentId: department._id },
  );
  await page.goto("/admin/departments");
  await menu(page, name, "Chỉnh sửa");
  d = page.getByRole("dialog");
  await expect(d.locator("input[name=code]")).toHaveCount(0);
  await expect(d).toContainText(code);
  await d.getByLabel("Tên phòng ban", { exact: true }).fill(name + " mới");
  await d.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(d).toHaveCount(0);
  const after = await (await page.request.get("/api/admin")).json();
  expect(
    after.departments.find((v: any) => v._id === department._id).code,
  ).toBe(code);
  expect(
    after.users.find((v: any) => v.email === "ref-" + suffix + "@organic.vn")
      .departmentId,
  ).toBe(department._id);
  await page.goto("/tasks/" + created._id);
  await expect(page.locator(".detail-meta")).toContainText(name + " mới");
  await page.goto("/admin/users");
  await page
    .getByRole("button", { name: "Thêm tài khoản", exact: false })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByLabel("Phòng ban", { exact: true })
      .locator("option")
      .filter({ hasText: name + " mới" }),
  ).toHaveCount(1);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  const admin = after.users.find((u: any) => u.email === "admin@organic.vn");
  await menu(page, admin.name, "Vô hiệu hóa");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Vô hiệu hóa", exact: true })
    .click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "ít nhất một Admin",
  );
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Hủy", exact: true })
    .click();
  const worker = after.users.find(
    (u: any) => u.email === "nv.vanhanh@organic.vn",
  );
  await menu(page, worker.name, "Chỉnh sửa");
  d = page.getByRole("dialog");
  await d.getByLabel("Phòng ban", { exact: true }).selectOption(department._id);
  await d.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText("phân công đang mở");
  await d.getByRole("button", { name: "Hủy", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  const employee = await browser.newPage();
  await login(employee, "nv.vanhanh");
  expect((await employee.request.get("/api/admin")).status()).toBe(403);
  await employee.goto("/admin/users");
  await expect(
    employee.getByRole("alert").filter({ hasText: "Chỉ Admin" }),
  ).toBeVisible();
  await employee.close();
});
test("Dialog CRUD ở 390/1440 px, keyboard, lỗi lưu giữ nội dung và khóa gửi lặp", async ({
  page,
}) => {
  await login(page);
  await page.goto("/admin/users");
  await page.screenshot({
    path: "docs/admin-users-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Thêm tài khoản", exact: false })
    .focus();
  await page.keyboard.press("Enter");
  const d = page.getByRole("dialog");
  await expect(d.getByLabel("Họ tên")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(d.getByRole("button", { name: "Đóng dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    d.getByRole("button", { name: "Tạo tài khoản", exact: true }),
  ).toBeFocused();
  await d.getByLabel("Họ tên").fill("Giữ dữ liệu khi lỗi");
  await d
    .getByLabel("Email", { exact: true })
    .fill("test-save-error-" + Date.now() + "@organic.vn");
  await d.getByLabel("Mật khẩu khởi tạo").fill(password);
  let calls = 0;
  await page.route("**/api/admin", async (route) => {
    if (route.request().method() === "POST") {
      calls++;
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Lỗi lưu có kiểm soát" }),
      });
    } else await route.continue();
  });
  await d.getByRole("button", { name: "Tạo tài khoản", exact: true }).click();
  await expect(d.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  await expect(d.getByRole("alert")).toContainText("Lỗi lưu có kiểm soát");
  expect(calls).toBe(1);
  await expect(d.getByLabel("Họ tên")).toHaveValue("Giữ dữ liệu khi lỗi");
  await page.screenshot({
    path: "docs/admin-user-dialog-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toHaveCount(1);
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Bỏ thay đổi", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Thêm tài khoản", exact: false }),
  ).toBeFocused();
  await page.unroute("**/api/admin");
  await page.screenshot({
    path: "docs/admin-users-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navTo(page, "Phòng ban");
  await page.screenshot({
    path: "docs/admin-departments-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/admin-departments-desktop.png",
    fullPage: true,
  });
});

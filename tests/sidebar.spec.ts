import { test, expect, type Page } from "@playwright/test";
import { navTo } from "./helpers/navigation";
async function login(page: Page, email = "admin") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
test("Sidebar hai nhóm đúng thứ tự, aria-current, bỏ tab và tương thích URL cũ", async ({
  page,
}) => {
  await login(page);
  const sidebar = page.locator(".desktop-sidebar");
  await expect(
    sidebar
      .getByRole("navigation", { name: "Công việc", exact: true })
      .getByRole("link"),
  ).toHaveText([/^Việc của tôi/, "Công việc phòng ban", "Tiến độ"]);
  await expect(
    sidebar
      .getByRole("navigation", { name: "Quản trị", exact: true })
      .getByRole("link"),
  ).toHaveText(["Tài khoản", "Phòng ban"]);
  await expect(
    sidebar.getByRole("link", { name: "Quản trị", exact: true }),
  ).toHaveCount(0);
  await navTo(page, "Tài khoản");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    sidebar.getByRole("link", { name: "Tài khoản", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".topbar")).toContainText("Quản trị / Tài khoản");
  await expect(page.locator(".admin-tabs")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tài khoản", exact: true }),
  ).toBeVisible();
  await navTo(page, "Phòng ban");
  await expect(page.locator(".topbar")).toContainText("Quản trị / Phòng ban");
  await expect(
    sidebar.getByRole("link", { name: "Phòng ban", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(
    sidebar.getByRole("link", { name: "Tài khoản", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(
    sidebar.getByRole("link", { name: "Phòng ban", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.reload();
  await expect(
    sidebar.getByRole("link", { name: "Phòng ban", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.goto("/admin?tab=departments&q=Vận");
  await expect(page).toHaveURL(
    (u) =>
      u.pathname === "/admin/departments" &&
      u.searchParams.get("q") === "Vận" &&
      !u.searchParams.has("tab"),
  );
  await expect(page.getByLabel("Tìm phòng ban")).toHaveValue("Vận");
  await page.goto("/admin?tab=users");
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole("heading", { name: "Tài khoản", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/sidebar-admin-desktop.png",
    fullPage: true,
  });
});
test("Drawer mobile có cùng hai nhóm, hỗ trợ bàn phím, đóng khi chọn và trả focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const trigger = page.getByRole("button", {
    name: "Mở điều hướng",
    exact: true,
  });
  const drawer = page.getByRole("dialog", { name: "Điều hướng", exact: true });
  await expect(page.locator(".desktop-sidebar")).not.toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Đóng điều hướng", exact: true }),
  ).toBeFocused();
  await expect(
    drawer
      .getByRole("navigation", { name: "Công việc", exact: true })
      .getByRole("link"),
  ).toHaveCount(3);
  await expect(
    drawer
      .getByRole("navigation", { name: "Quản trị", exact: true })
      .getByRole("link"),
  ).toHaveCount(2);
  await page.screenshot({
    path: "docs/sidebar-mobile-drawer.png",
    fullPage: true,
  });
  await drawer.getByRole("link", { name: "Tài khoản", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(drawer).not.toBeVisible();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(trigger).toBeFocused();
  await navTo(page, "Phòng ban");
  await expect(
    page.getByRole("heading", { name: "Phòng ban", exact: true }),
  ).toBeVisible();
  await trigger.click();
  await expect(
    drawer.getByRole("link", { name: "Phòng ban", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole("link", { name: "Organic Work", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    drawer.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    drawer.getByRole("link", { name: "Organic Work", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/admin-sidebar-mobile.png",
    fullPage: true,
  });
});
test("Nhân viên/trưởng phòng không thấy nhóm Quản trị và API/trang vẫn từ chối", async ({
  browser,
}) => {
  for (const email of ["nv.vanhanh", "vanhanh"]) {
    const page = await browser.newPage();
    await login(page, email);
    await expect(
      page
        .locator(".desktop-sidebar")
        .getByRole("navigation", { name: "Quản trị", exact: true }),
    ).toHaveCount(0);
    const items = page
      .locator(".desktop-sidebar")
      .getByRole("navigation", { name: "Công việc", exact: true })
      .getByRole("link");
    await expect(items).toHaveCount(email === "vanhanh" ? 3 : 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Mở điều hướng", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Điều hướng",
      exact: true,
    });
    await expect(
      drawer.getByRole("navigation", { name: "Quản trị", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/admin/departments");
    await expect(
      page.getByRole("alert").filter({ hasText: "Chỉ Admin" }),
    ).toBeVisible();
    expect((await page.request.get("/api/admin")).status()).toBe(403);
    const denied = await page.evaluate(async () => {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "department",
          name: "Không có quyền",
          code: "no-access",
        }),
      });
      return r.status;
    });
    expect(denied).toBe(403);
    await page.close();
  }
});

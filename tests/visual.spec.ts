import { navTo } from "./helpers/navigation";
import { test, expect } from "@playwright/test";
test("Bố cục Việc của tôi, Tiến độ và Kanban ở 1440/390 px", async ({
  page,
}) => {
  await page.goto("/login");
  const logo = page.getByRole("img", { name: "Organic Việt Nam", exact: true });
  await expect(logo).toBeVisible();
  await expect
    .poll(() =>
      logo.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: "docs/brand-login-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/brand-login-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Email", { exact: true }).fill("vanhanh@organic.vn");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
  await expect(page.locator(".work-task").first()).toBeVisible();
  await page.screenshot({ path: "docs/my-tasks-desktop.png", fullPage: true });
  await navTo(page, "Tiến độ");
  await expect(page.locator(".progress-stats")).toBeVisible();
  await page.screenshot({ path: "docs/progress-desktop.png", fullPage: true });
  await navTo(page, "Công việc phòng ban");
  await expect(page.locator(".kanban")).toBeVisible();
  await page.screenshot({ path: "docs/kanban-desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-list")).toBeVisible();
  await page.screenshot({ path: "docs/board-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navTo(page, "Việc của tôi");
  await expect(page.locator(".work-task").first()).toBeVisible();
  expect(
    await page
      .locator(".work-task")
      .first()
      .evaluate((e) => e.getBoundingClientRect().top),
  ).toBeLessThan(844);
  await page.screenshot({ path: "docs/my-tasks-mobile.png", fullPage: true });
  await navTo(page, "Tiến độ");
  await expect(page.locator(".progress-stats")).toBeVisible();
  await page.screenshot({ path: "docs/progress-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

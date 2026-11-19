import { expect, type Page } from "@playwright/test";
export async function navTo(page: Page, label: string) {
  const trigger = page.getByRole("button", {
    name: "Mở điều hướng",
    exact: true,
  });
  if (await trigger.isVisible()) {
    const drawer = page.getByRole("dialog", {
      name: "Điều hướng",
      exact: true,
    });
    if (!(await drawer.isVisible())) await trigger.click();
    await drawer.getByRole("link", { name: label, exact: true }).click();
    await expect(drawer).not.toBeVisible();
  } else await page.getByRole("link", { name: label, exact: true }).click();
}

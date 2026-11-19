import { test, expect, Page } from "@playwright/test";
async function login(page: Page, email = "admin") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
  await expect(page.locator(".desktop-sidebar")).toBeVisible();
}
test("Chuyển tab giữ nguyên sidebar/header, không tải lại bootstrap hoặc trắng trang khi API chậm", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator(".work-empty")).toBeVisible();
  let bootstrap = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/data") bootstrap++;
  });
  await page.evaluate(() => {
    const w = window as any;
    w.__shell = {
      sidebar: document.querySelector(".desktop-sidebar"),
      topbar: document.querySelector(".topbar"),
      removed: false,
      startup: false,
    };
    w.__shell.observer = new MutationObserver(() => {
      if (!w.__shell.sidebar.isConnected || !w.__shell.topbar.isConnected)
        w.__shell.removed = true;
      if (document.querySelector("main.loading")) w.__shell.startup = true;
    });
    w.__shell.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
  await page.route("**/api/work?**", async (route) => {
    await new Promise((r) => setTimeout(r, 900));
    await route.continue().catch(() => {});
  });
  for (const [label, ready] of [
    ["Tiến độ", ".progress-stats"],
    ["Công việc phòng ban", ".kanban"],
    ["Tài khoản", ".admin-console"],
  ] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator(ready)).toBeVisible();
    expect(
      await page.evaluate(() => {
        const w = window as any;
        return (
          document.querySelector(".desktop-sidebar") === w.__shell.sidebar &&
          document.querySelector(".topbar") === w.__shell.topbar
        );
      }),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Phòng ban", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/departments$/);
  await page.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await page.getByRole("link", { name: /^Việc của tôi/ }).click();
  await expect(page.locator(".work-empty")).toBeVisible({ timeout: 500 });
  const result = await page.evaluate(() => {
    const w = window as any;
    w.__shell.observer.disconnect();
    return { removed: w.__shell.removed, startup: w.__shell.startup };
  });
  expect(result).toEqual({ removed: false, startup: false });
  expect(bootstrap).toBe(0);
});
test("Lọc client không điều hướng RSC, giữ tìm kiếm khi đổi lọc và phiên bị tắt mất quyền khi chuyển tab", async ({
  browser,
}) => {
  const admin = await browser.newPage(),
    employee = await browser.newPage();
  await login(admin);
  await login(employee, "nv.vanhanh");
  await employee
    .getByRole("link", { name: "Công việc phòng ban", exact: true })
    .click();
  await expect(employee.locator(".kanban")).toBeVisible();
  let rsc = 0,
    documents = 0;
  employee.on("request", (r) => {
    if (new URL(r.url()).searchParams.has("_rsc")) rsc++;
    if (r.isNavigationRequest() && r.resourceType() === "document") documents++;
  });
  await employee
    .getByLabel("Tìm công việc", { exact: true })
    .fill("Không khớp điều hướng");
  await employee.getByLabel("Ưu tiên", { exact: true }).selectOption("high");
  await expect(employee).toHaveURL(
    (u) =>
      u.searchParams.get("q") === "Không khớp điều hướng" &&
      u.searchParams.get("priority") === "high",
  );
  expect(rsc).toBe(0);
  expect(documents).toBe(0);
  // A temporary account avoids changing shared demo roles or disabling fixture users.
  const directory = await (await admin.request.get("/api/admin")).json();
  const email = "nav-session-" + Date.now() + "@organic.vn";
  const fields = {
    kind: "user",
    name: "Phiên điều hướng",
    email,
    password: process.env.DEMO_PASSWORD,
    role: "employee",
    departmentId: directory.departments[0]._id,
    active: true,
  };
  const created = await admin.evaluate(async (v) => {
    const r = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    return r.json();
  }, fields);
  await employee
    .getByRole("button", { name: "Đăng xuất", exact: true })
    .click();
  await login(employee, email.replace("@organic.vn", ""));
  await admin.evaluate(
    async ({ fields, id }) => {
      const { password, ...value } = fields;
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...value, _id: id, active: false }),
      });
    },
    { fields, id: created.id },
  );
  await employee
    .getByRole("link", { name: "Công việc phòng ban", exact: true })
    .click();
  await expect(
    employee.getByRole("heading", { name: "Đăng nhập Organic Work" }),
  ).toBeVisible();
  expect((await employee.request.get("/api/session")).status()).toBe(401);
  await employee.close();
  await admin.close();
});

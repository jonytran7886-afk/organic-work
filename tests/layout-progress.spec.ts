import { test, expect, Page } from "@playwright/test";
import { db, client } from "../src/lib/db";
import { today } from "../src/lib/model";
import { addDays } from "../src/lib/work-model";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string, path = "/login") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  if (path === "/login") await expect(page).toHaveURL(/\/my-tasks$/);
}
async function write(page: Page, path: string, body: any, method = "POST") {
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
test.afterAll(async () => {
  await client().close();
});
test("Nhóm việc đúng các mốc ngày, chế độ hoàn thành, tìm kiếm và xóa lọc", async ({
  browser,
}) => {
  const manager = await browser.newPage(),
    worker = await browser.newPage();
  await login(manager, "vanhanh");
  const data = await (await manager.request.get("/api/data")).json();
  const employee = data.users.find((u: any) => u.name === "Phạm Thanh Hà");
  const marker = "Nhóm hạn E2E " + Date.now();
  const tasks: any[] = [];
  for (const [offset, priority] of [
    [-1, "normal"],
    [0, "low"],
    [0, "urgent"],
    [1, "normal"],
    [7, "normal"],
    [8, "normal"],
  ] as const) {
    const response = await write(manager, "tasks", {
      title: marker + " " + offset + " " + priority,
      owningDepartmentId: employee.departmentId,
      assigneeId: employee._id,
      dueDate: addDays(today(), offset),
      priority,
    });
    expect(response.status).toBe(200);
    tasks.push({ ...response.data, offset });
  }
  const d = await db();
  const ops = await d
    .collection("users")
    .findOne({ email: "vanhanh@organic.vn" });
  const missing = await d.collection("tasks").insertOne({
    title: marker + " legacy",
    status: "todo",
    priority: "normal",
    assigneeId: employee._id
      ? new (await import("mongodb")).ObjectId(employee._id)
      : null,
    owningDepartmentId: ops!.departmentId,
    requestingDepartmentId: ops!.departmentId,
    createdById: ops!._id,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await login(worker, "nv.vanhanh");
  await worker.getByLabel("Tìm công việc", { exact: true }).fill(marker);
  await expect(worker.locator(".work-task")).toHaveCount(7);
  const groups = [
    ["late", [-1]],
    ["today", [0]],
    ["week", [1, 7]],
    ["later", [8]],
  ] as const;
  for (const [group, offsets] of groups) {
    for (const task of tasks.filter((t) =>
      (offsets as readonly number[]).includes(t.offset),
    )) {
      await expect(
        worker.locator(
          '[data-group="' + group + '"] [data-task-id="' + task._id + '"]',
        ),
      ).toBeVisible();
    }
  }
  await expect(
    worker.locator(
      '[data-group="undated"] [data-task-id="' + missing.insertedId + '"]',
    ),
  ).toBeVisible();
  await expect(
    worker.locator('[data-group="today"] .work-task').first(),
  ).toHaveAttribute(
    "data-task-id",
    tasks.find((t) => t.offset === 0 && t.priority === "urgent")._id,
  );
  await worker
    .locator(".mini-counts button")
    .filter({ hasText: "Hôm nay" })
    .click();
  await expect(worker.locator(".work-task")).toHaveCount(2);
  await worker
    .locator(".mini-counts button")
    .filter({ hasText: "Hôm nay" })
    .click();
  await expect(worker.locator(".work-task")).toHaveCount(7);
  const target = worker.locator('[data-task-id="' + tasks[0]._id + '"]');
  await target.getByRole("button", { name: "Hoàn thành", exact: true }).click();
  await expect(worker.locator(".work-task")).toHaveCount(6);
  await worker
    .getByRole("button", { name: "Đã hoàn thành", exact: true })
    .click();
  await expect(
    worker.locator('[data-task-id="' + tasks[0]._id + '"]'),
  ).toBeVisible();
  await worker.reload();
  await expect(
    worker.locator('[data-task-id="' + tasks[0]._id + '"]'),
  ).toBeVisible();
  await worker
    .getByLabel("Tìm công việc", { exact: true })
    .fill("không-khớp-" + Date.now());
  await expect(
    worker.getByRole("heading", { name: "Không tìm thấy công việc phù hợp" }),
  ).toBeVisible();
  await worker
    .getByRole("button", { name: "Xóa bộ lọc", exact: true })
    .first()
    .click();
  await expect(worker.getByLabel("Tìm công việc", { exact: true })).toHaveValue(
    "",
  );
  await manager.close();
  await worker.close();
});
test("Tiến độ liên phòng, phân công tại dòng, lý do chờ và giữ bộ lọc qua chi tiết", async ({
  browser,
}) => {
  const sales = await browser.newPage(),
    ops = await browser.newPage(),
    worker = await browser.newPage();
  await login(sales, "kinhdoanh");
  await login(ops, "vanhanh");
  await login(worker, "nv.vanhanh");
  const data = await (await ops.request.get("/api/data")).json(),
    dept = data.departments.find((d: any) => d.code === "operations"),
    employee = data.users.find((u: any) => u.name === "Phạm Thanh Hà");
  const title = "Tiến độ E2E Xác nhận lịch đóng gói lô gà Kỳ Anh " + Date.now();
  const created = await write(sales, "tasks", {
    title,
    owningDepartmentId: dept._id,
    dueDate: addDays(today(), -1),
  });
  expect(created.status).toBe(200);
  const id = created.data._id;
  await ops.getByRole("link", { name: "Tiến độ", exact: true }).click();
  await expect(
    ops.getByRole("button", { name: "Phòng tôi phụ trách", exact: true }),
  ).toBeVisible();
  await ops
    .getByRole("button", { name: "Chưa phân công", exact: true })
    .click();
  const row = ops.locator('[data-task-id="' + id + '"]');
  await expect(row).toBeVisible();
  const options = await row
    .getByLabel("Phân công " + title, { exact: true })
    .locator("option")
    .allTextContents();
  expect(options).toContain("Phạm Thanh Hà");
  expect(options).not.toContain("Tài khoản đã tắt");
  expect(options).not.toContain("Trần Minh Anh");
  await row
    .getByLabel("Phân công " + title, { exact: true })
    .selectOption(employee._id);
  await expect(row).toHaveCount(0);
  await sales.getByRole("link", { name: "Tiến độ", exact: true }).click();
  await sales
    .getByRole("button", { name: "Yêu cầu đã gửi", exact: true })
    .click();
  await sales.getByRole("button", { name: "Quá hạn", exact: true }).click();
  await expect(sales.locator('[data-task-id="' + id + '"]')).toBeVisible();
  await expect(sales.locator('[data-task-id="' + id + '"] select')).toHaveCount(
    0,
  );
  expect(
    (await write(sales, "tasks/" + id, { assigneeId: employee._id }, "PATCH"))
      .status,
  ).toBe(400);
  await worker.reload();
  const task = worker.locator('[data-task-id="' + id + '"]');
  await expect(task).toBeVisible();
  await task
    .getByRole("button", { name: "Chuyển sang Đang chờ", exact: true })
    .click();
  const dialog = worker.getByRole("dialog");
  await dialog
    .getByLabel("Lý do chờ", { exact: true })
    .fill("Chờ duyệt lịch đóng gói từ trưởng ca");
  await dialog.getByRole("button", { name: "Lưu trạng thái chờ" }).click();
  await expect(
    task.getByText("Chờ duyệt lịch đóng gói từ trưởng ca", { exact: false }),
  ).toBeVisible();
  await worker.reload();
  await expect(
    task.getByText("Chờ duyệt lịch đóng gói từ trưởng ca", { exact: false }),
  ).toBeVisible();
  await ops.goto(
    "/progress?scope=owned&metric=waiting&q=" + encodeURIComponent(title),
  );
  await expect(
    ops.locator('[data-task-id="' + id + '"] .waiting-note'),
  ).toContainText("Chờ duyệt lịch đóng gói từ trưởng ca");
  const waiting = Number(await ops.locator(".stat-waiting>strong").innerText());
  expect(waiting).toBe(1);
  await worker.route("**/api/tasks/" + id, async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Lỗi lưu có kiểm soát" }),
      });
    else await route.continue();
  });
  await task.getByRole("button", { name: "Hoàn thành", exact: true }).click();
  await expect(worker.locator(".error").first()).toContainText(
    "Lỗi lưu có kiểm soát",
  );
  await expect(task.locator(".status")).toHaveText("Đang chờ");
  await worker.unroute("**/api/tasks/" + id);
  await task.getByRole("button", { name: "Hoàn thành", exact: true }).click();
  await expect(task).toHaveCount(0);
  await ops.reload();
  await expect(ops.locator(".stat-waiting>strong")).toHaveText("0");
  await ops.goto(
    "/progress?scope=owned&priority=normal&metric=done&q=" +
      encodeURIComponent(title),
  );
  await expect(ops.locator('[data-task-id="' + id + '"]')).toBeVisible();
  const before = ops.url();
  await ops.locator('[data-task-id="' + id + '"] .work-task-title').click();
  await expect(
    ops.getByRole("heading", { name: "Lịch sử hoạt động" }),
  ).toBeVisible();
  await expect(ops.locator(".history")).toContainText(
    "Chờ duyệt lịch đóng gói từ trưởng ca",
  );
  await expect(ops.locator(".waiting-detail")).toHaveCount(0);
  await ops.locator(".back-link").click();
  await expect(ops).toHaveURL(
    (url) =>
      url.pathname === new URL(before).pathname &&
      url.searchParams.toString() === new URL(before).searchParams.toString(),
  );
  await expect(ops.getByLabel("Ưu tiên", { exact: true })).toHaveValue(
    "normal",
  );
  await ops.goto("/progress?scope=owned");
  await expect(ops.locator(".progress-stats")).toBeVisible();
  const count = Number(await ops.locator(".stat-late>strong").innerText());
  await ops.locator(".stat-late").click();
  await expect(ops).toHaveURL(/\/board\?/);
  await expect(ops.locator(".result-count")).toHaveText(count + " công việc");
  const boardUrl = ops.url();
  if (count) {
    await ops.locator(".task-title,.table-wrap tbody a").first().click();
    await ops.locator(".back-link").click();
    await expect(ops).toHaveURL(boardUrl);
  }
  await sales.close();
  await ops.close();
  await worker.close();
});
test("Chặn Tiến độ nhân viên và tham số vượt quyền; link chi tiết sau đăng nhập", async ({
  browser,
}) => {
  const employee = await browser.newPage(),
    manager = await browser.newPage();
  await login(employee, "nv.vanhanh");
  const peer = await browser.newPage();
  await login(peer, "nv.vanhanh2");
  await expect(
    peer.getByRole("heading", { name: "Bạn chưa có công việc được giao" }),
  ).toBeVisible();
  await peer.close();
  await expect(
    employee.getByRole("link", { name: "Tiến độ", exact: true }),
  ).toHaveCount(0);
  await employee.goto("/progress");
  await expect(
    employee
      .locator(".error")
      .filter({ hasText: "không có quyền xem Tiến độ" }),
  ).toBeVisible();
  expect((await employee.request.get("/api/work?view=progress")).status()).toBe(
    403,
  );
  await login(manager, "vanhanh");
  const data = await (await manager.request.get("/api/data")).json();
  const sales = data.departments.find((d: any) => d.code === "sales");
  expect(
    (
      await manager.request.get(
        "/api/work?view=progress&scope=owned&department=" + sales._id,
      )
    ).status(),
  ).toBe(403);
  expect(
    (await manager.request.get("/api/work?view=progress&scope=all")).status(),
  ).toBe(403);
  await manager.goto("/progress?scope=owned&department=" + sales._id);
  await expect(manager.locator(".error")).toContainText("ngoài phạm vi");
  await expect(manager.locator(".stat")).toHaveCount(0);
  const t = data.tasks.find(
    (t: any) => t.owningDepartmentId === data.user.departmentId,
  );
  const fresh = await browser.newPage();
  await login(fresh, "nv.vanhanh", "/tasks/" + t._id);
  await expect(fresh).toHaveURL(new RegExp("/tasks/" + t._id));
  await expect(
    fresh.getByRole("heading", { name: "Thông tin công việc" }),
  ).toBeVisible();
  await fresh.goto("/");
  await expect(fresh).toHaveURL(/\/my-tasks$/);
  await manager.goto("/");
  await expect(manager).toHaveURL(/\/progress$/);
  await employee.close();
  await manager.close();
  await fresh.close();
});
test("Admin lọc tiến độ theo phòng, phân bổ theo người và tất cả ô số liệu mở đúng danh sách", async ({
  page,
}) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Tiến độ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Theo phòng phụ trách", exact: true }),
  ).toBeVisible();
  const data = await (await page.request.get("/api/data")).json();
  const operations = data.departments.find((d: any) => d.code === "operations");
  await page
    .getByLabel("Phòng phụ trách", { exact: true })
    .selectOption(operations._id);
  await expect(
    page.getByRole("heading", { name: "Theo người phụ trách", exact: true }),
  ).toBeVisible();
  const url = page.url();
  const baseline = await (
    await page.request.get(
      "/api/work?view=progress&department=" + operations._id,
    )
  ).json();
  for (const metric of [
    "todo",
    "doing",
    "waiting",
    "done",
    "late",
    "unassigned",
  ]) {
    await page.locator(".stat-" + metric).click();
    await expect(page).toHaveURL(/\/board\?/);
    await expect(page.locator(".result-count")).toHaveText(
      baseline.stats[metric] + " công việc",
    );
    expect(new URL(page.url()).searchParams.get("department")).toBe(
      operations._id,
    );
    await page.goto(url);
    await expect(page.locator(".progress-stats")).toBeVisible();
  }
  await page
    .locator(".allocation .text-link")
    .filter({ hasText: "Phạm Thanh Hà" })
    .click();
  await expect(page).toHaveURL(/\/board\?/);
  expect(new URL(page.url()).searchParams.get("open")).toBe("1");
  const rows = await (
    await page.request.get(
      "/api/work?view=board&" + new URL(page.url()).searchParams,
    )
  ).json();
  expect(
    rows.tasks.every(
      (t: any) =>
        t.status !== "done" && t.owningDepartmentId === operations._id,
    ),
  ).toBe(true);
});

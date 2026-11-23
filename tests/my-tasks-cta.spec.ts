import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, client } from "../src/lib/db";
import { createTask, changeTask } from "../src/lib/service";
import {
  canCreateSubtask,
  canManage,
  taskStatusActions,
  today,
} from "../src/lib/model";
import { queryWork } from "../src/lib/work-query";

async function actors() {
  const d = await db();
  const [worker, peer, manager, outside] = await Promise.all(
    ["nv.vanhanh", "nv.vanhanh2", "vanhanh", "nv.chatluong"].map((name) =>
      d.collection("users").findOne({ email: name + "@organic.vn" }),
    ),
  );
  return {
    d,
    worker: worker!,
    peer: peer!,
    manager: manager!,
    outside: outside!,
  };
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
test.afterAll(async () => {
  await client().close();
});

test("CTA theo trạng thái, sort, nhóm thu gọn và menu keyboard/responsive", async ({
  page,
}) => {
  const { worker } = await actors();
  const marker = "CTA " + randomUUID();
  const tasks = [];
  for (const [name, status] of [
    ["A", "todo"],
    ["B", "doing"],
    ["C", "waiting"],
    ["D", "done"],
  ]) {
    const task = await createTask(worker, {
      title: marker + " " + name,
      owningDepartmentId: String(worker.departmentId),
      assigneeId: String(worker._id),
      dueDate: today(),
    });
    if (status !== "todo")
      await changeTask(worker, String(task._id), {
        status,
        ...(status === "waiting" ? { waitingReason: "Chờ kiểm tra" } : {}),
      });
    tasks.push(task);
  }
  await login(page, "nv.vanhanh");
  await page.goto("/my-tasks?q=" + encodeURIComponent(marker));
  await expect(page.locator(".compact-task-row")).toHaveCount(3);
  await expect(page.locator(".compact-task-heading > span")).toHaveText([
    "Tên công việc",
    "Trạng thái",
    "Người được giao",
    "Hạn hoàn thành",
    "Ưu tiên",
    "Menu",
  ]);
  await expect(page.locator(".compact-task-heading")).toHaveCount(1);
  for (const [index, status] of [
    [0, "todo"],
    [1, "doing"],
    [2, "waiting"],
  ] as const) {
    const row = page.locator(`[data-task-id="${tasks[index]._id}"]`);
    await expect(row.locator(".task-primary-action")).toHaveCount(0);
    await expect(row.locator(".inline-task-status")).toHaveValue(status);
    const height = await row.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(height).toBeGreaterThanOrEqual(48);
    expect(height).toBeLessThanOrEqual(56);
    await expect(row.locator(".compact-task-assignee")).toContainText(
      worker.name,
    );
  }

  await page.getByLabel("Sắp xếp công việc").selectOption("title");
  await expect(page.locator(".compact-task-row .work-task-title")).toHaveText(
    tasks.slice(0, 3).map((task) => task.title),
  );
  const group = page.locator('.task-group[data-group="today"]');
  await group.locator(":scope > summary").click();
  await expect(group.locator(".compact-task-row").first()).toBeHidden();
  await group.locator(":scope > summary").click();
  const row = page.locator(`[data-task-id="${tasks[0]._id}"]`);
  await row.locator(".inline-task-status").selectOption("doing");
  await expect(row.locator(".inline-task-status")).toHaveValue("doing");
  await row.locator(".inline-task-status").selectOption("waiting");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lý do chờ", { exact: true }).fill("Đợi xác nhận");
  await dialog.getByRole("button", { name: "Lưu trạng thái chờ" }).click();
  await expect(row.locator(".inline-task-status")).toHaveValue("waiting");
  await expect(row.locator(".waiting-note")).toHaveText("Đợi xác nhận");
  const trigger = row.getByLabel("Thao tác " + tasks[0].title, { exact: true });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const panel = row.locator(".task-menu-popover");
    await expect(
      panel.getByRole("link", { name: "Mở chi tiết", exact: true }),
    ).toBeFocused();
    await expect(
      panel.getByRole("button", {
        name: /Bắt đầu|Hoàn thành|Đang chờ|Tiếp tục|Mở lại/,
      }),
    ).toHaveCount(0);
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.screenshot({
      path: "docs/my-tasks-inline-" + width + ".png",
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Đã hoàn thành", exact: true })
    .click();
  const done = page.locator(`[data-task-id="${tasks[3]._id}"]`);
  await done.locator(".inline-task-status").selectOption("todo");
  await expect(done).toHaveCount(0);
});

test("Employee subtask permission remains scoped to creator or assignee", async () => {
  const { worker, peer, manager, outside } = await actors();
  const parent = await createTask(worker, {
    title: randomUUID(),
    dueDate: today(),
    owningDepartmentId: String(worker.departmentId),
    assigneeId: String(worker._id),
  });
  expect(canManage(worker, parent)).toBe(false);
  expect(canCreateSubtask(worker, parent)).toBe(true);
  expect(canCreateSubtask(peer, parent)).toBe(false);
  expect(canCreateSubtask(outside, parent)).toBe(false);
  const child = await createTask(worker, {
    title: randomUUID(),
    dueDate: today(),
    parentTaskId: String(parent._id),
    owningDepartmentId: String(worker.departmentId),
    assigneeId: String(worker._id),
  });
  expect(String(child.parentTaskId)).toBe(String(parent._id));
  await expect(
    createTask(peer, {
      title: randomUUID(),
      dueDate: today(),
      parentTaskId: String(parent._id),
      owningDepartmentId: String(peer.departmentId),
    }),
  ).rejects.toThrow();
  const { d } = await actors();
  const current = await d.collection("tasks").findOne({ _id: parent._id });
  expect(taskStatusActions(manager, current!)).toEqual([]);
});

test("Subtasks expand inline with independent status and one shared heading", async ({
  page,
}) => {
  const { worker } = await actors();
  const marker = "Inline " + randomUUID();
  const parent = await createTask(worker, {
    title: marker,
    owningDepartmentId: String(worker.departmentId),
    assigneeId: String(worker._id),
    dueDate: today(),
  });
  const child = await createTask(worker, {
    title: marker + " child",
    parentTaskId: String(parent._id),
    owningDepartmentId: String(worker.departmentId),
    assigneeId: String(worker._id),
    dueDate: today(),
  });
  for (let index = 0; index < 26; index++) {
    await createTask(worker, {
      title: marker + " child " + index,
      parentTaskId: String(parent._id),
      owningDepartmentId: String(worker.departmentId),
      assigneeId: String(worker._id),
      dueDate: today(),
    });
  }
  await login(page, "nv.vanhanh");
  await page.goto("/my-tasks?q=" + encodeURIComponent(marker));
  const row = page.locator(`[data-task-id="${parent._id}"]`);
  await row
    .getByRole("button", {
      name: "Mở công việc con của " + marker,
      exact: true,
    })
    .click();
  const nested = page
    .locator(".nested-task")
    .locator(`[data-task-id="${child._id}"]`);
  await expect(nested).toHaveCount(1);
  const children = page.getByRole("region", {
    name: "Công việc con của " + marker,
    exact: true,
  });
  await expect(children.locator(".compact-task-row")).toHaveCount(25);
  await children
    .getByRole("button", { name: "Xem thêm công việc con", exact: true })
    .click();
  await expect(children.locator(".compact-task-row")).toHaveCount(27);
  await expect(nested.locator(".inline-task-status")).toHaveValue("todo");
  await expect(row.locator(".inline-task-status")).toBeDisabled();
  await expect(page.locator(".compact-task-heading")).toHaveCount(1);
  await nested.locator(".inline-task-status").selectOption("doing");
  await expect(nested.locator(".inline-task-status")).toHaveValue("doing");
});

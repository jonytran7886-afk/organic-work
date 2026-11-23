import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, client, id } from "../src/lib/db";
import {
  stageFile,
  cleanupUploads,
  attachmentLimits,
} from "../src/lib/attachments";
import { changeTask, createTask } from "../src/lib/service";
import { today } from "../src/lib/model";
import { pdfDocument, excelDocument } from "./helpers/task-documents";
const password = process.env.DEMO_PASSWORD!;
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email + "@organic.vn");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/my-tasks$/);
}
async function write(page: Page, path: string, data: any, method = "POST") {
  const response = await page.request.fetch("/api/" + path, {
    method,
    headers: { Origin: new URL(page.url()).origin },
    data,
  });
  return { status: response.status(), data: await response.json() };
}
test.afterAll(async () => {
  await client().close();
});

test("Nhân viên tạo việc trong phòng mình trên desktop/mobile và không vượt quyền phân công", async ({
  page,
}) => {
  await login(page, "nv.kinhdoanh");
  const directory = await (await page.request.get("/api/data")).json();
  const own = directory.user;
  const title = "Employee self-created " + Date.now();
  await page
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Phòng phụ trách", { exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByLabel("Người đảm nhận chính", { exact: true }),
  ).toHaveValue("Chưa phân công");
  await dialog
    .getByRole("button", { name: "Giao cho tôi", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Người đảm nhận chính", { exact: true }),
  ).toHaveValue(/\(Tôi\)/);
  await dialog.getByLabel("Tiêu đề công việc").fill(title);
  await dialog.getByLabel("Ngày bắt đầu").fill(today());
  await dialog.getByLabel("Ngày kết thúc").fill(today());
  await expect(
    dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks\//);
  await page.goto("/my-tasks?q=" + encodeURIComponent(title));
  await expect(page.locator(".work-task-title")).toHaveText(title);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Phòng phụ trách", { exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Hủy", exact: true }).click();
  const base = {
    title: title + " unassigned",
    owningDepartmentId: own.departmentId,
    dueDate: today(),
    assigneeId: null,
  };
  expect((await write(page, "tasks", base)).status).toBe(200);
  const outside = directory.departments.find(
    (d: any) => d._id !== own.departmentId,
  );
  const coworker = directory.users.find(
    (u: any) =>
      u.active && u.departmentId === own.departmentId && u._id !== own._id,
  );
  expect(
    (await write(page, "tasks", { ...base, owningDepartmentId: outside._id }))
      .status,
  ).toBe(400);
  expect(
    (await write(page, "tasks", { ...base, assigneeId: coworker._id })).status,
  ).toBe(400);
  const saved = await (await db()).collection("tasks").findOne({ title });
  expect(String(saved!.assigneeId)).toBe(own._id);
  expect(String(saved!.owningDepartmentId)).toBe(own.departmentId);
  expect(
    (
      await write(
        page,
        "tasks/" + saved!._id,
        { assigneeId: coworker._id },
        "PATCH",
      )
    ).status,
  ).toBe(400);
});

test("Tự giao, giữ tệp khi đổi phòng, tải lỗi và mất phản hồi lưu không tạo trùng", async ({
  page,
}) => {
  await login(page, "vanhanh");
  const title = "Self assign files " + Date.now();
  await page
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tiêu đề công việc").fill(title);
  await dialog.getByLabel("Ngày bắt đầu").fill(today());
  await dialog.getByLabel("Ngày kết thúc").fill(today());
  await expect(
    dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
  ).toBeEnabled();
  await dialog.getByLabel("Chọn tệp đính kèm").setInputFiles({
    name: "spec.pdf",
    mimeType: "application/pdf",
    buffer: pdfDocument(),
  });
  await dialog.getByRole("button", { name: "Giao cho tôi" }).click();
  await expect(
    dialog.getByLabel("Người đảm nhận chính", { exact: true }),
  ).toHaveValue(/\(Tôi\)/);
  await dialog
    .getByLabel("Phòng phụ trách", { exact: true })
    .fill("kinh doanh");
  await dialog.getByRole("option", { name: "Kinh doanh", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Giao cho tôi" }),
  ).toHaveCount(0);
  await expect(dialog.locator('[name="assigneeId"]')).toBeDisabled();
  await expect(dialog.getByText("spec.pdf", { exact: true })).toBeVisible();
  await dialog.getByLabel("Phòng phụ trách", { exact: true }).fill("van hanh");
  await dialog.getByRole("option", { name: "Vận hành", exact: true }).click();
  await expect(
    dialog.getByLabel("Người đảm nhận chính", { exact: true }),
  ).toHaveValue("Chưa phân công");
  await dialog.getByRole("button", { name: "Giao cho tôi" }).click();
  await page.screenshot({
    path: "docs/priority-create-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/priority-create-mobile.png",
    fullPage: true,
  });
  await page.route("**/api/uploads", (route) => route.abort());
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(dialog.getByRole("alert").first()).toContainText("spec.pdf");
  expect(await (await db()).collection("tasks").countDocuments({ title })).toBe(
    0,
  );
  await expect(dialog.getByLabel("Tiêu đề công việc")).toHaveValue(title);
  await page.unroute("**/api/uploads");
  let saved = false;
  await page.route("**/api/tasks", async (route) => {
    if (route.request().method() !== "POST" || saved) return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    saved = true;
    await route.abort();
  });
  await dialog
    .getByRole("button", { name: "Tạo công việc", exact: true })
    .click();
  await expect(dialog.getByRole("alert").first()).toBeVisible();
  await expect(dialog.getByText("Đã tải", { exact: false })).toBeVisible();
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(page).toHaveURL(/\/tasks\//);
  await page.reload();
  await expect(
    page
      .locator(".task-attachments")
      .getByRole("link", { name: "spec.pdf", exact: true }),
  ).toBeVisible();
  const d = await db(),
    task = await d.collection("tasks").findOne({ title });
  expect(await d.collection("tasks").countDocuments({ title })).toBe(1);
  expect(
    await d.collection("attachments").countDocuments({ taskId: task!._id }),
  ).toBe(1);
  expect(
    await d.collection("notifications").countDocuments({ taskId: task!._id }),
  ).toBe(0);
  await page.goto("/my-tasks?q=" + encodeURIComponent(title));
  await expect(page.locator(".work-task-title")).toHaveText(title);
  await expect(page.locator(".nav-count").first()).not.toHaveText("0");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/priority-self-assigned-mobile.png",
    fullPage: true,
  });
});

test("Yêu cầu liên phòng, thông báo, phân công, bàn giao và quyền tải tệp", async ({
  browser,
}) => {
  const sales = await browser.newPage(),
    ops = await browser.newPage(),
    worker = await browser.newPage(),
    outsider = await browser.newPage();
  try {
    for (const [page, email] of [
      [sales, "kinhdoanh"],
      [ops, "vanhanh"],
      [worker, "nv.vanhanh"],
      [outsider, "nv.chatluong"],
    ] as const)
      await login(page, email);
    const directory = await (await sales.request.get("/api/data")).json();
    const employee = directory.users.find(
      (u: any) => u.email === "nv.vanhanh@organic.vn",
    );
    // Managers receive only public directory fields; resolve the seeded recipient by name if email is omitted.
    const target =
      employee || directory.users.find((u: any) => u.name === "Phạm Thanh Hà");
    const title = "Đóng gói Kỳ Anh " + Date.now();
    await sales
      .getByRole("button", { name: "Tạo công việc", exact: true })
      .click();
    const dialog = sales.getByRole("dialog");
    await dialog.getByLabel("Tiêu đề công việc").fill(title);
    await dialog
      .getByLabel("Yêu cầu và kết quả cần bàn giao")
      .fill("Xác nhận giờ đóng gói, số lượng và đầu mối Vận hành");
    await dialog
      .getByLabel("Phòng phụ trách", { exact: true })
      .fill("van hanh");
    await dialog.getByRole("option", { name: "Vận hành", exact: true }).click();
    await dialog.getByLabel("Ngày bắt đầu").fill("2020-01-01");
    await dialog.getByLabel("Ngày kết thúc").fill("2020-01-02");
    await expect(
      dialog.getByRole("button", { name: "Chọn tệp", exact: true }),
    ).toBeEnabled();
    await dialog.getByLabel("Chọn tệp đính kèm").setInputFiles([
      {
        name: "quy-cach.pdf",
        mimeType: "application/pdf",
        buffer: pdfDocument(),
      },
      {
        name: "so-luong.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: excelDocument(),
      },
      { name: "bo.pdf", mimeType: "application/pdf", buffer: pdfDocument() },
    ]);
    await dialog.getByRole("button", { name: "Bỏ tệp bo.pdf" }).click();
    await dialog
      .getByRole("button", { name: "Tạo công việc", exact: true })
      .click();
    await expect(sales).toHaveURL(/\/tasks\//);
    const taskId = new URL(sales.url()).pathname.split("/").at(-1)!;
    const detail = await (
      await sales.request.get("/api/tasks/" + taskId)
    ).json();
    expect(detail.task.assigneeId).toBeNull();
    expect(detail.attachments).toHaveLength(2);
    expect(
      (
        await outsider.request.get("/api/files/" + detail.attachments[0]._id)
      ).status(),
    ).toBe(403);
    const download = await ops.request.get(
      "/api/files/" + detail.attachments[0]._id,
    );
    expect(download.ok()).toBe(true);
    expect(await download.body()).toEqual(pdfDocument());
    expect(
      (await ops.request.get("/api/files/" + detail.attachments[1]._id)).ok(),
    ).toBe(true);
    let notices = await (await ops.request.get("/api/notifications")).json();
    expect(
      notices.items.filter(
        (n: any) => n.taskId === taskId && n.types.includes("request"),
      ),
    ).toHaveLength(1);
    await ops.goto(
      "/progress?scope=incoming&metric=unassigned&q=" +
        encodeURIComponent(title),
    );
    await expect(ops.locator(".stat-unassigned > strong")).toHaveText("1");
    await ops
      .getByLabel("Phân công " + title, { exact: true })
      .selectOption(target._id);
    await expect(ops.locator('[data-task-id="' + taskId + '"]')).toHaveCount(0);
    expect(
      (
        await write(
          sales,
          "tasks/" + taskId,
          { assigneeId: target._id },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    notices = await (await worker.request.get("/api/notifications")).json();
    expect(
      notices.items.filter(
        (n: any) => n.taskId === taskId && n.types.includes("assigned"),
      ),
    ).toHaveLength(1);
    const patch = { dueDate: "2020-01-03", requestId: randomUUID() };
    expect((await write(ops, "tasks/" + taskId, patch, "PATCH")).status).toBe(
      200,
    );
    expect((await write(ops, "tasks/" + taskId, patch, "PATCH")).status).toBe(
      200,
    );
    notices = await (await worker.request.get("/api/notifications")).json();
    expect(
      notices.items.filter(
        (n: any) => n.taskId === taskId && n.types.includes("due"),
      ),
    ).toHaveLength(1);
    const assigned = notices.items.find(
      (n: any) => n.taskId === taskId && n.types.includes("assigned"),
    );
    await write(outsider, "notifications/" + assigned._id, {}, "PATCH");
    expect(
      (await (
        await db()
      )
        .collection("notifications")
        .findOne({ _id: id(assigned._id) }))!.readAt,
    ).toBeNull();
    await worker.reload();
    await worker.getByRole("button", { name: /^Thông báo,/ }).click();
    const assignmentNotice = worker
      .getByRole("region", { name: "Danh sách thông báo" })
      .locator("li")
      .filter({ hasText: title })
      .filter({ hasText: "Bạn được giao công việc" });
    await assignmentNotice
      .getByRole("button", { name: "Đánh dấu đã đọc " + title, exact: true })
      .click();
    await expect(assignmentNotice.getByRole("button")).toHaveCount(0);
    await assignmentNotice
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(worker).toHaveURL(new RegExp("/tasks/" + taskId + "$"));
    await worker.reload();
    notices = await (await worker.request.get("/api/notifications")).json();
    expect(
      notices.items.find((n: any) => n._id === assigned._id).readAt,
    ).toBeTruthy();
    expect(
      (await write(worker, "tasks/" + taskId, { status: "done" }, "PATCH"))
        .status,
    ).toBe(400);
    await worker.goto("/tasks/" + taskId);
    await worker.getByLabel("Trạng thái công việc").selectOption("waiting");
    await worker
      .getByRole("dialog")
      .getByLabel("Lý do chờ", { exact: true })
      .fill("Chờ xác nhận ca đóng gói");
    await worker.getByRole("button", { name: "Lưu trạng thái chờ" }).click();
    await expect(worker.locator(".waiting-detail")).toContainText(
      "Chờ xác nhận ca đóng gói",
    );
    await ops.goto(
      "/progress?scope=incoming&metric=waiting&q=" + encodeURIComponent(title),
    );
    await expect(ops.locator(".stat-waiting > strong")).toHaveText("1");
    await expect(ops.locator(".stat-late > strong")).toHaveText("1");
    await worker.getByLabel("Trạng thái công việc").selectOption("done");
    const completion = worker.getByRole("dialog");
    await completion
      .getByLabel("Kết quả thực hiện")
      .fill("Đóng gói 08:30, 500 kiện, đầu mối Vận hành: Thanh Hà");
    await completion
      .getByLabel("Liên kết tài liệu")
      .fill("https://example.com/packing");
    await expect(
      completion.getByRole("button", { name: "Chọn tệp", exact: true }),
    ).toBeEnabled();
    await completion.getByLabel("Chọn tệp đính kèm").setInputFiles({
      name: "ket-qua.pdf",
      mimeType: "application/pdf",
      buffer: pdfDocument(),
    });
    await expect(
      completion.getByText("ket-qua.pdf", { exact: true }),
    ).toBeVisible();
    await worker.setViewportSize({ width: 390, height: 844 });
    await worker.screenshot({
      path: "docs/priority-completion-mobile.png",
      fullPage: true,
    });
    await completion
      .getByRole("button", { name: "Hoàn thành", exact: true })
      .click();
    await expect(completion).toHaveCount(0);
    await sales.reload();
    await expect(sales.locator(".handover-results")).toContainText(
      "Đóng gói 08:30, 500 kiện",
    );
    await expect(sales.locator(".task-attachments")).toContainText(
      "Tài liệu bàn giao",
    );
    const completed = await (
      await sales.request.get("/api/tasks/" + taskId)
    ).json();
    const resultFile = completed.attachments.find(
      (f: any) => f.purpose === "result",
    );
    expect((await sales.request.get("/api/files/" + resultFile._id)).ok()).toBe(
      true,
    );
    notices = await (await sales.request.get("/api/notifications")).json();
    expect(
      notices.items.filter(
        (n: any) => n.taskId === taskId && n.types.includes("completed"),
      ),
    ).toHaveLength(1);
    await write(ops, "tasks/" + taskId, { status: "todo" }, "PATCH");
    expect(
      (await write(worker, "tasks/" + taskId, { status: "done" }, "PATCH"))
        .status,
    ).toBe(400);
    await sales.reload();
    await expect(sales.locator(".handover-results")).toContainText("08:30");
    await sales.screenshot({
      path: "docs/priority-handover-desktop.png",
      fullPage: true,
    });
    const d = await db(),
      original = await d.collection("users").findOne({ _id: id(target._id) });
    const outsideUser = await d
      .collection("users")
      .findOne({ email: "nv.chatluong@organic.vn" });
    try {
      await d
        .collection("users")
        .updateOne(
          { _id: original!._id },
          { $set: { departmentId: outsideUser!.departmentId } },
        );
      const hidden = await (
        await worker.request.get("/api/notifications")
      ).json();
      expect(hidden.items.some((n: any) => n.taskId === taskId)).toBe(false);
      expect(
        (await worker.request.get("/api/files/" + resultFile._id)).status(),
      ).toBe(403);
      await write(worker, "notifications/" + assigned._id, {}, "PATCH");
    } finally {
      await d
        .collection("users")
        .updateOne(
          { _id: original!._id },
          { $set: { departmentId: original!.departmentId } },
        );
    }
    await write(sales, "notifications/all", {}, "PATCH");
    expect(
      (await (await sales.request.get("/api/notifications")).json()).unread,
    ).toBe(0);
    const oldTask = await d.collection("tasks").insertOne({
      title: "Legacy completed request",
      status: "done",
      archivedAt: null,
      owningDepartmentId: original!.departmentId,
      requestingDepartmentId: outsideUser!.departmentId,
      createdById: original!._id,
      assigneeId: original!._id,
      priority: "normal",
      dueDate: today(),
    });
    const oldResponse = await ops.request.get(
      "/api/tasks/" + oldTask.insertedId,
    );
    expect(oldResponse.ok()).toBe(true);
    await ops.goto("/tasks/" + oldTask.insertedId);
    await expect(
      ops.getByText("Chưa có kết quả bàn giao được ghi nhận."),
    ).toBeVisible();
  } finally {
    for (const p of [sales, ops, worker, outsider]) await p.close();
  }
});

test("GridFS giới hạn, dọn tạm, liên kết và rollback kết quả cùng transaction", async () => {
  expect(today(new Date("2026-11-19T16:59:59Z"))).toBe("2026-11-19");
  expect(today(new Date("2026-11-19T17:00:00Z"))).toBe("2026-11-20");
  const d = await db(),
    actor = await d
      .collection("users")
      .findOne({ email: "kinhdoanh@organic.vn" }),
    ops = await d.collection("users").findOne({ email: "vanhanh@organic.vn" });
  const key = randomUUID(),
    file = new File([pdfDocument()], "brief.pdf");
  const staged = await stageFile(actor, file, key);
  expect(String((await stageFile(actor, file, key))._id)).toBe(
    String(staged._id),
  );
  await expect(
    stageFile(
      actor,
      new File([Buffer.from("wrong")], "fake.pdf"),
      randomUUID(),
    ),
  ).rejects.toThrow(/Định dạng/);
  await expect(
    stageFile(
      actor,
      new File([Buffer.alloc(attachmentLimits().maxBytes + 1)], "large.pdf"),
      randomUUID(),
    ),
  ).rejects.toThrow(/dung lượng/);
  const requestId = randomUUID(),
    input = {
      title: "Atomic attachments " + Date.now(),
      dueDate: today(),
      owningDepartmentId: String(ops!.departmentId),
      requestId,
      attachmentIds: [String(staged._id)],
    };
  const [first, second] = await Promise.all([
    createTask(actor, input),
    createTask(actor, input),
  ]);
  expect(String(first._id)).toBe(String(second._id));
  await expect(
    createTask(
      { ...actor, departmentId: id("000000000000000000000001") },
      input,
    ),
  ).rejects.toThrow(/Không còn quyền/);
  await expect(
    createTask(actor, {
      ...input,
      requestId: randomUUID(),
      attachmentIds: Array(attachmentLimits().maxFiles + 1).fill(
        String(staged._id),
      ),
    }),
  ).rejects.toThrow(/vượt giới hạn/);
  const rejected = await stageFile(actor, file, randomUUID());
  await expect(
    createTask(ops, {
      ...input,
      requestId: randomUUID(),
      attachmentIds: [String(rejected._id)],
    }),
  ).rejects.toThrow(/không thuộc/);
  expect(
    (await d.collection("attachments").findOne({ _id: rejected._id }))!.state,
  ).toBe("staged");
  const result = await stageFile(ops, file, randomUUID());
  const handover = {
    status: "done",
    result: "08:30, 500 kiện, Thanh Hà",
    attachmentIds: [String(result._id)],
    requestId: randomUUID(),
  };
  await expect(
    changeTask(ops, String(first._id), handover, true),
  ).rejects.toThrow("TEST_ACTIVITY_FAILURE");
  expect(
    (await d.collection("tasks").findOne({ _id: first._id }))!.status,
  ).toBe("todo");
  expect(
    (await d.collection("attachments").findOne({ _id: result._id }))!.state,
  ).toBe("staged");
  await changeTask(ops, String(first._id), handover);
  await changeTask(ops, String(first._id), handover);
  expect(
    (await d.collection("tasks").findOne({ _id: first._id }))!.handovers,
  ).toHaveLength(1);
  expect(
    await d
      .collection("notifications")
      .countDocuments({ taskId: first._id, types: "completed" }),
  ).toBe(1);
  await d
    .collection("attachments")
    .updateOne({ _id: rejected._id }, { $set: { expiresAt: new Date(0) } });
  await cleanupUploads();
  expect(
    await d.collection("fs.files").findOne({ _id: rejected._id }),
  ).toBeNull();
  expect(
    await d.collection("fs.chunks").countDocuments({ files_id: rejected._id }),
  ).toBe(0);
  const legacy = await d.collection("tasks").insertOne({
    title: "Legacy done",
    status: "done",
    owningDepartmentId: ops!.departmentId,
    requestingDepartmentId: actor!.departmentId,
  });
  expect(
    (await d.collection("tasks").findOne({ _id: legacy.insertedId }))!.status,
  ).toBe("done");
});

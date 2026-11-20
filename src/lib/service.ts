import { z } from "zod";
import { db, client, id } from "./db";
import { canView, canManage, canStatus } from "./model";
import { hashPassword } from "./password";
const text = z.string().trim().min(1).max(250);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Ngày không hợp lệ",
  );
const taskSchema = z.object({
  title: text,
  description: z.string().max(20000).default(""),
  owningDepartmentId: text,
  assigneeId: z.string().nullable().optional(),
  dueDate: date,
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});
export function scope(u: any) {
  return u.role === "admin"
    ? {}
    : {
        $or: [
          { owningDepartmentId: u.departmentId },
          ...(u.role === "manager"
            ? [{ requestingDepartmentId: u.departmentId }]
            : []),
        ],
      };
}
async function assignment(
  d: any,
  department: any,
  assignee: any,
  session?: any,
) {
  if (
    !(await d
      .collection("departments")
      .findOne({ _id: department }, { session }))
  )
    throw new Error("Phòng ban không tồn tại");
  if (
    assignee &&
    !(await d
      .collection("users")
      .findOne(
        { _id: assignee, departmentId: department, active: true },
        { session },
      ))
  )
    throw new Error("Người phụ trách phải đang hoạt động và thuộc phòng nhận");
}
export async function createTask(u: any, input: any) {
  if (u.role === "employee") throw new Error("Không có quyền tạo việc");
  const v = taskSchema.parse(input);
  const owningDepartmentId = id(v.owningDepartmentId);
  const assigneeId = v.assigneeId ? id(v.assigneeId) : null;
  if (
    u.role !== "admin" &&
    !owningDepartmentId.equals(u.departmentId) &&
    assigneeId
  )
    throw new Error("Yêu cầu liên phòng phải để trống người phụ trách");
  const d = await db();
  const session = client().startSession();
  let task: any;
  try {
    await session.withTransaction(async () => {
      await assignment(d, owningDepartmentId, assigneeId, session);
      task = {
        ...v,
        _id: new (await import("mongodb")).ObjectId(),
        owningDepartmentId,
        requestingDepartmentId: u.departmentId,
        assigneeId,
        createdById: u._id,
        status: "todo",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await d.collection("tasks").insertOne(task, { session });
      await d.collection("task_activities").insertOne(
        {
          taskId: task._id,
          actorId: u._id,
          type: "created",
          createdAt: new Date(),
        },
        { session },
      );
    });
    return task;
  } finally {
    await session.endSession();
  }
}
export async function changeTask(
  u: any,
  taskId: string,
  input: any,
  failActivity = false,
) {
  const d = await db();
  const session = client().startSession();
  try {
    await session.withTransaction(async () => {
      const t = await d
        .collection("tasks")
        .findOne({ _id: id(taskId) }, { session });
      if (!t || !canView(u, t))
        throw new Error("Không có quyền truy cập công việc");
      const keys = Object.keys(input);
      if (
        !keys.length ||
        keys.some(
          (k) =>
            ![
              "title",
              "description",
              "dueDate",
              "priority",
              "assigneeId",
              "status",
              "waitingReason",
              "archived",
            ].includes(k),
        )
      )
        throw new Error("Trường cập nhật không hợp lệ");
      if (t.archivedAt && !(keys.length === 1 && input.archived === false))
        throw new Error("Việc đã lưu trữ chỉ được xem hoặc khôi phục");
      const changes: any = {};
      for (const key of keys) {
        if (key === "status") {
          if (!canStatus(u, t))
            throw new Error("Không có quyền đổi trạng thái");
          changes.status = z
            .enum(["todo", "doing", "waiting", "done"])
            .parse(input.status);
          changes.completedAt = changes.status === "done" ? new Date() : null;
        } else if (key === "waitingReason") {
          if (!canStatus(u, t))
            throw new Error("Không có quyền cập nhật lý do chờ");
          changes.waitingReason = z
            .string()
            .trim()
            .min(1, "Cần nhập lý do chờ")
            .max(500, "Lý do chờ tối đa 500 ký tự")
            .parse(input.waitingReason);
        } else {
          if (!canManage(u, t))
            throw new Error("Không có quyền chỉnh sửa công việc");
          if (key === "archived")
            changes.archivedAt = z.boolean().parse(input.archived)
              ? new Date()
              : null;
          if (key === "title") changes.title = text.parse(input.title);
          if (key === "description")
            changes.description = z
              .string()
              .max(20000)
              .parse(input.description);
          if (key === "dueDate") changes.dueDate = date.parse(input.dueDate);
          if (key === "priority")
            changes.priority = z
              .enum(["low", "normal", "high", "urgent"])
              .parse(input.priority);
          if (key === "assigneeId") {
            changes.assigneeId = input.assigneeId ? id(input.assigneeId) : null;
            await assignment(
              d,
              t.owningDepartmentId,
              changes.assigneeId,
              session,
            );
          }
        }
      }
      const nextStatus = changes.status || t.status;
      if (
        nextStatus === "waiting" &&
        t.status !== "waiting" &&
        !changes.waitingReason
      )
        throw new Error("Cần nhập lý do khi chuyển sang Đang chờ");
      if ("waitingReason" in input && nextStatus !== "waiting")
        throw new Error("Chỉ cập nhật lý do khi công việc Đang chờ");
      if (nextStatus !== "waiting" && t.waitingReason)
        changes.waitingReason = null;
      const activityKeys = Array.from(
        new Set([
          ...keys,
          ...("waitingReason" in changes ? ["waitingReason"] : []),
        ]),
      );
      await d
        .collection("tasks")
        .updateOne(
          { _id: t._id },
          { $set: { ...changes, updatedAt: new Date() } },
          { session },
        );
      if (failActivity) throw new Error("TEST_ACTIVITY_FAILURE");
      await d.collection("task_activities").insertMany(
        activityKeys.map((k) => ({
          taskId: t._id,
          actorId: u._id,
          type: k,
          before: t[k === "archived" ? "archivedAt" : k] ?? null,
          after: changes[k === "archived" ? "archivedAt" : k],
          createdAt: new Date(),
        })),
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}
export async function comment(u: any, taskId: string, body: any) {
  const d = await db();
  const session = client().startSession();
  try {
    await session.withTransaction(async () => {
      const t = await d
        .collection("tasks")
        .findOne({ _id: id(taskId) }, { session });
      if (!t || !canView(u, t) || t.archivedAt)
        throw new Error("Không có quyền bình luận");
      await d
        .collection("tasks")
        .updateOne(
          { _id: t._id },
          { $set: { updatedAt: new Date() } },
          { session },
        );
      await d.collection("task_comments").insertOne(
        {
          taskId: t._id,
          authorId: u._id,
          body: z.string().trim().min(1).max(5000).parse(body),
          createdAt: new Date(),
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}
export class AdminInputError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
    public status = 400,
  ) {
    super(message);
  }
}
export async function adminWrite(u: any, input: any) {
  if (u.role !== "admin")
    throw new AdminInputError("Chỉ Admin được truy cập", {}, 403);
  const d = await db();
  if (input.kind === "department") {
    const name = text.parse(input.name);
    if (input._id) {
      const existing = await d
        .collection("departments")
        .findOne({ _id: id(input._id) });
      if (!existing) throw new AdminInputError("Phòng ban không tồn tại");
      if (input.code !== undefined && input.code !== existing.code)
        throw new AdminInputError("Mã phòng ban phải giữ ổn định", {
          code: "Không được thay đổi mã phòng ban",
        });
      await d
        .collection("departments")
        .updateOne({ _id: existing._id }, { $set: { name } });
      return existing._id;
    }
    // MongoDB allocates codes atomically, independent of the display name or client payload.
    for (let attempt = 0; attempt < 10; attempt++) {
      const counter = await d
        .collection<{ _id: string; value: number }>("system_counters")
        .findOneAndUpdate(
          { _id: "department_code" },
          { $inc: { value: 1 } },
          { upsert: true, returnDocument: "after" },
        );
      if (!counter)
        throw new AdminInputError(
          "Không thể tạo mã phòng ban. Vui lòng thử lại.",
        );
      const code = "PB-" + String(counter.value).padStart(6, "0");
      try {
        return (
          await d
            .collection("departments")
            .insertOne({ name, code, createdAt: new Date() })
        ).insertedId;
      } catch (error: any) {
        if (error.code === 11000 && error.keyPattern?.code) continue;
        throw error;
      }
    }
    throw new AdminInputError(
      "Không thể cấp mã phòng ban duy nhất. Vui lòng thử lại.",
    );
  }
  if (input.kind !== "user")
    throw new AdminInputError("Loại dữ liệu không hợp lệ");
  const v = z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .pipe(z.email("Email không hợp lệ")),
      name: text,
      role: z.enum(["admin", "manager", "employee"]),
      departmentId: text,
      active: z.boolean(),
      password: z.string().min(10).max(200).optional(),
    })
    .parse(input);
  const departmentId = id(v.departmentId);
  const session = client().startSession();
  let savedId: any;
  try {
    await session.withTransaction(async () => {
      await d
        .collection("system_locks")
        .updateOne(
          { _id: "admins" } as any,
          { $inc: { version: 1 } },
          { upsert: true, session },
        );
      await assignment(d, departmentId, null, session);
      const existing = input._id
        ? await d
            .collection("users")
            .findOne({ _id: id(input._id) }, { session })
        : null;
      if (input._id && !existing) throw new Error("Tài khoản không tồn tại");
      if (
        existing?.active &&
        existing.role === "admin" &&
        (!v.active || v.role !== "admin") &&
        (await d
          .collection("users")
          .countDocuments({ role: "admin", active: true }, { session })) <= 1
      )
        throw new Error("Phải giữ ít nhất một Admin hoạt động");
      if (
        existing &&
        !departmentId.equals(existing.departmentId) &&
        (await d.collection("tasks").countDocuments(
          {
            assigneeId: existing._id,
            status: { $ne: "done" },
            archivedAt: null,
          },
          { session },
        ))
      )
        throw new Error("Cần xử lý phân công đang mở trước khi đổi phòng");
      if (existing && v.password)
        throw new AdminInputError(
          "Không đổi mật khẩu trong thao tác sửa tài khoản",
          { password: "Dùng thao tác mật khẩu riêng khi hệ thống hỗ trợ" },
        );
      const { password, ...fields } = v;
      const value: any = {
        ...fields,
        departmentId,
        ...(password ? { passwordHash: hashPassword(password) } : {}),
      };
      if (existing) {
        await d
          .collection("users")
          .updateOne({ _id: existing._id }, { $set: value }, { session });
        savedId = existing._id;
      } else {
        if (!password) throw new Error("Cần mật khẩu cho tài khoản mới");
        savedId = (
          await d
            .collection("users")
            .insertOne({ ...value, createdAt: new Date() }, { session })
        ).insertedId;
      }
    });
    return savedId;
  } finally {
    await session.endSession();
  }
}

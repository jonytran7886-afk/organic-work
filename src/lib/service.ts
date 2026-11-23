import { z } from "zod";
import { db, client, id } from "./db";
import {
  canView,
  canManage,
  canStatus,
  canCreateTask,
  canCreateSubtask,
} from "./model";
import { hashPassword } from "./password";
import { ObjectId } from "mongodb";
import { linkFiles } from "./attachments";
import { notifyTask } from "./notifications";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password-policy";
import { lockTask, activeChildren, recomputeParent } from "./task-hierarchy";
import { validateParticipants } from "./task-participants";
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
  startDate: date.nullable().optional(),
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
  if (!canCreateTask(u)) throw new Error("Không có quyền tạo việc");
  const v = taskSchema.parse(input);
  if (v.startDate && v.startDate > v.dueDate)
    throw new Error("Ngày kết thúc không được trước ngày bắt đầu");
  const owningDepartmentId = id(v.owningDepartmentId);
  const assigneeId = v.assigneeId ? id(v.assigneeId) : null;
  if (
    u.role === "employee" &&
    (!owningDepartmentId.equals(u.departmentId) ||
      (assigneeId && !assigneeId.equals(u._id)))
  )
    throw new Error(
      "Nhân viên chỉ được tạo việc trong phòng mình và tự nhận việc hoặc để chưa phân công",
    );
  if (
    u.role !== "admin" &&
    !owningDepartmentId.equals(u.departmentId) &&
    assigneeId
  )
    throw new Error("Yêu cầu liên phòng phải để trống người phụ trách");
  const d = await db();
  const requestId =
    input.requestId === undefined
      ? undefined
      : z.string().uuid().parse(input.requestId);
  const taskId = new ObjectId();
  const session = client().startSession();
  let task: any;
  try {
    await session.withTransaction(async () => {
      if (requestId) {
        const previous = await d
          .collection("tasks")
          .findOne({ createdById: u._id, requestId }, { session });
        if (previous) {
          if (!canView(u, previous))
            throw new Error("Không còn quyền truy cập công việc đã tạo");
          task = previous;
          return;
        }
      }
      await assignment(d, owningDepartmentId, assigneeId, session);
      let parent: any = null;
      if (input.parentTaskId) {
        parent = await lockTask(id(input.parentTaskId), session);
        if (!parent) throw new Error("Công việc cha không tồn tại");
        if (!canView(u, parent))
          throw new Error("Không có quyền thêm công việc con");
        if (parent.parentTaskId)
          throw new Error("Chỉ hỗ trợ một cấp công việc cha–con");
        if (parent.archivedAt) throw new Error("Công việc cha đã lưu trữ");
        if (parent.status === "done")
          throw new Error("Mở lại công việc cha trước khi thêm công việc con");
        if (!canCreateSubtask(u, parent))
          throw new Error("Không có quyền thêm công việc con");
        if (!owningDepartmentId.equals(parent.owningDepartmentId))
          throw new Error(
            "Công việc con phải cùng phòng phụ trách với công việc cha",
          );
      }
      task = {
        ...v,
        _id: taskId,
        ...(requestId ? { requestId } : {}),
        owningDepartmentId,
        requestingDepartmentId: parent
          ? parent.requestingDepartmentId
          : u.departmentId,
        ...(parent ? { parentTaskId: parent._id } : {}),
        assigneeId,
        createdById: u._id,
        status: "todo",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      task.participantIds = await validateParticipants(
        u,
        task,
        input.participantIds,
        assigneeId,
        session,
      );
      await d.collection("tasks").insertOne(task, { session });
      await linkFiles(u, task._id, input.attachmentIds, "brief", session);
      await notifyTask(u, null, task, task._id, session);
      await d.collection("task_activities").insertOne(
        {
          taskId: task._id,
          actorId: u._id,
          type: "created",
          createdAt: new Date(),
        },
        { session },
      );
      if (parent) await recomputeParent(u, parent._id, session);
    });
    return task;
  } catch (error: any) {
    if (requestId && error.code === 11000) {
      const previous = await d
        .collection("tasks")
        .findOne({ createdById: u._id, requestId });
      if (previous && canView(u, previous)) return previous;
    }
    throw error;
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
  const requestId =
    input.requestId === undefined
      ? undefined
      : z.string().uuid().parse(input.requestId);
  const eventId = new ObjectId();
  try {
    await session.withTransaction(async () => {
      const t = await d
        .collection("tasks")
        .findOne({ _id: id(taskId) }, { session });
      if (!t || !canView(u, t))
        throw new Error("Không có quyền truy cập công việc");
      if (requestId) {
        const previous = await d
          .collection("task_operations")
          .findOne({ actorId: u._id, requestId }, { session });
        if (previous) {
          if (String(previous.taskId) !== taskId)
            throw new Error("Mã thao tác đã được sử dụng");
          return;
        }
      }
      let parent: any = null;
      if (t.parentTaskId) {
        parent = await lockTask(t.parentTaskId, session);
        if (!parent || parent.archivedAt)
          throw new Error(
            "Khôi phục công việc cha trước khi xử lý công việc con",
          );
      } else await lockTask(t._id, session);
      const children = t.parentTaskId
        ? []
        : await activeChildren(t._id, session);
      const keys = Object.keys(input).filter(
        (k) =>
          !["requestId", "confirmArchive", "reassignmentReason"].includes(k),
      );
      if (
        input.reassignmentReason !== undefined &&
        !keys.includes("assigneeId")
      )
        throw new Error("Lý do giao lại phải đi cùng người phụ trách mới");
      const reassignmentReason = z
        .string()
        .trim()
        .max(500)
        .parse(input.reassignmentReason ?? "");
      if (input.confirmArchive !== undefined)
        z.boolean().parse(input.confirmArchive);
      if (
        !keys.length ||
        keys.some(
          (k) =>
            ![
              "title",
              "description",
              "startDate",
              "dueDate",
              "priority",
              "assigneeId",
              "status",
              "waitingReason",
              "archived",
              "result",
              "resultLinks",
              "attachmentIds",
              "reviewerId",
              "participantIds",
            ].includes(k),
        )
      )
        throw new Error("Trường cập nhật không hợp lệ");
      if (t.archivedAt && !(keys.length === 1 && input.archived === false))
        throw new Error("Việc đã lưu trữ chỉ được xem hoặc khôi phục");
      const changes: any = {};
      if (keys.includes("reviewerId") && keys.includes("status"))
        throw new Error(
          "Hãy đổi người nghiệm thu riêng trước khi cập nhật trạng thái",
        );
      if (keys.includes("status") && children.length) {
        if (input.status === "done" && t.status === "done")
          throw new Error("Công việc cha đã hoàn thành");
        const open = children.filter((c) => c.status !== "done").length;
        if (input.status === "done") {
          if (open)
            throw new Error(`Còn ${open} công việc con chưa hoàn thành`);
          if (!t.reviewerId)
            throw new Error(
              "Trạng thái công việc cha được tính tự động từ công việc con",
            );
          if (u.role !== "admin" && String(t.reviewerId) !== String(u._id))
            throw new Error(
              "Chỉ người nghiệm thu được chỉ định hoặc Admin được xác nhận hoàn thành",
            );
          const reviewer = await d
            .collection("users")
            .findOne({ _id: t.reviewerId, active: true }, { session });
          if (u.role !== "admin" && (!reviewer || !canView(reviewer, t)))
            throw new Error(
              "Người nghiệm thu không còn quyền xem công việc cha",
            );
          changes.reviewAcceptedAt = new Date();
          changes.reviewAcceptedById = u._id;
        } else if (!(
          t.status === "done" &&
          input.status === "todo" &&
          canManage(u, t)
        ))
          throw new Error(
            "Trạng thái công việc cha được tính tự động; cập nhật công việc con để thay đổi tiến độ",
          );
      }
      if (input.archived === true && children.length)
        throw new Error(
          "Cần lưu trữ các công việc con đang hoạt động trước khi lưu trữ công việc cha",
        );
      if (input.archived === true && parent && t.status !== "done") {
        const siblings = (await activeChildren(parent._id, session)).filter(
          (c) => !c._id.equals(t._id),
        );
        if (
          siblings.length &&
          siblings.every((c) => c.status === "done") &&
          input.confirmArchive !== true
        )
          throw new Error(
            "Lưu trữ việc con này sẽ khiến công việc cha đủ điều kiện hoàn thành. Cần xác nhận trước khi lưu trữ.",
          );
      }
      for (const key of keys) {
        if (key === "status") {
          if (
            !canStatus(u, t) &&
            !(
              children.length &&
              input.status === "done" &&
              String(t.reviewerId) === String(u._id)
            )
          )
            throw new Error("Không có quyền đổi trạng thái");
          changes.status = z
            .enum(["todo", "doing", "waiting", "done"])
            .parse(input.status);
          changes.completedAt = changes.status === "done" ? new Date() : null;
        } else if (["result", "resultLinks", "attachmentIds"].includes(key)) {
          if (
            (!canStatus(u, t) &&
              !(children.length && String(t.reviewerId) === String(u._id))) ||
            input.status !== "done" ||
            t.status === "done"
          )
            throw new Error("Chỉ bàn giao kết quả khi hoàn thành công việc");
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
          if (key === "startDate")
            changes.startDate = date.nullable().parse(input.startDate || null);
          if (key === "dueDate") changes.dueDate = date.parse(input.dueDate);
          if (key === "priority")
            changes.priority = z
              .enum(["low", "normal", "high", "urgent"])
              .parse(input.priority);
          if (key === "assigneeId") {
            if (t.status === "done")
              throw new Error("Mở lại công việc trước khi giao lại");
            changes.assigneeId = input.assigneeId ? id(input.assigneeId) : null;
            await assignment(
              d,
              t.owningDepartmentId,
              changes.assigneeId,
              session,
            );
          }
          if (key === "reviewerId") {
            if (t.parentTaskId)
              throw new Error(
                "Chỉ công việc cha được chỉ định người nghiệm thu",
              );
            if (t.status === "done")
              throw new Error(
                "Mở lại công việc cha trước khi đổi người nghiệm thu",
              );
            changes.reviewerId = input.reviewerId ? id(input.reviewerId) : null;
            if (changes.reviewerId) {
              const reviewer = await d
                .collection("users")
                .findOne(
                  { _id: changes.reviewerId, active: true },
                  { session },
                );
              if (!reviewer || !canView(reviewer, t))
                throw new Error(
                  "Người nghiệm thu phải đang hoạt động và có quyền xem công việc cha",
                );
            }
          }
        }
      }
      if (keys.includes("participantIds"))
        changes.participantIds = await validateParticipants(
          u,
          t,
          input.participantIds,
          "assigneeId" in changes ? changes.assigneeId : t.assigneeId,
          session,
        );
      else if ("assigneeId" in changes)
        changes.participantIds = (t.participantIds || []).filter(
          (personId: any) => String(personId) !== String(changes.assigneeId),
        );
      if (changes.status && changes.status !== "done") {
        changes.completedById = null;
        changes.reviewAcceptedAt = null;
        changes.reviewAcceptedById = null;
      }
      const startDate =
        "startDate" in changes ? changes.startDate : t.startDate;
      const dueDate = changes.dueDate || t.dueDate;
      if (startDate && dueDate && startDate > dueDate)
        throw new Error("Ngày kết thúc không được trước ngày bắt đầu");
      const nextStatus = changes.status || t.status;
      if (changes.status === "done" && t.status !== "done") {
        const cross =
          String(t.owningDepartmentId) !== String(t.requestingDepartmentId);
        const result = z
          .string()
          .trim()
          .max(5000)
          .parse(input.result ?? "");
        if (cross && !result)
          throw new Error(
            "Cần nhập kết quả thực hiện khi hoàn thành yêu cầu liên phòng",
          );
        const links = z
          .array(
            z
              .string()
              .url()
              .max(2000)
              .refine(
                (v) => /^https?:\/\//i.test(v),
                "Liên kết phải bắt đầu bằng http hoặc https",
              ),
          )
          .max(5)
          .parse(input.resultLinks ?? []);
        await linkFiles(u, t._id, input.attachmentIds, "result", session);
        changes.completedById = u._id;
        changes.result = result;
        changes.resultLinks = links;
        changes.handovers = [
          ...(t.handovers || []),
          {
            eventId,
            result,
            links,
            attachmentIds: input.attachmentIds || [],
            completedById: u._id,
            completedAt: changes.completedAt,
          },
        ];
      }
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
          ...("participantIds" in changes ? ["participantIds"] : []),
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
          after:
            k === "attachmentIds"
              ? input.attachmentIds
              : changes[k === "archived" ? "archivedAt" : k],
          createdAt: new Date(),
          ...(k === "assigneeId" && reassignmentReason
            ? { reason: reassignmentReason }
            : {}),
        })),
        { session },
      );
      if (requestId)
        await d.collection("task_operations").insertOne(
          {
            actorId: u._id,
            requestId,
            taskId: t._id,
            eventId,
            createdAt: new Date(),
          },
          { session },
        );
      await notifyTask(u, t, { ...t, ...changes }, eventId, session);
      if (parent) await recomputeParent(u, parent._id, session);
      else if (keys.includes("reviewerId"))
        await recomputeParent(u, t._id, session);
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
  if (input.kind === "reset-password") {
    const value = z
      .object({
        _id: text,
        password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
        confirmPassword: z.string(),
      })
      .parse(input);
    if (value.password !== value.confirmPassword)
      throw new AdminInputError("Mật khẩu xác nhận không khớp", {
        confirmPassword: "Nhập lại đúng mật khẩu mới",
      });
    const userId = id(value._id);
    const passwordHash = hashPassword(value.password);
    const session = client().startSession();
    try {
      await session.withTransaction(async () => {
        const result = await d
          .collection("users")
          .updateOne(
            { _id: userId },
            { $set: { passwordHash, passwordChangedAt: new Date() } },
            { session },
          );
        if (!result.matchedCount)
          throw new AdminInputError("Tài khoản không tồn tại", {}, 404);
        await d.collection("sessions").deleteMany({ userId }, { session });
      });
      return userId;
    } finally {
      await session.endSession();
    }
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
      password: z
        .string()
        .min(PASSWORD_MIN_LENGTH)
        .max(PASSWORD_MAX_LENGTH)
        .optional(),
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
          { password: "Dùng thao tác Đặt lại mật khẩu trong menu tài khoản" },
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

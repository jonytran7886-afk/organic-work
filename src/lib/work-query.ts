import { z } from "zod";
import { db, id } from "./db";
import { scope } from "./service";
import {
  counts,
  groupWork,
  sortWork,
  metricMatch,
  type WorkTask,
} from "./work-model";
export class QueryPermissionError extends Error {
  status = 403;
}
const schema = z.object({
  view: z.enum(["mine", "progress", "board"]).default("board"),
  scope: z.enum(["owned", "sent", "all", "visible"]).optional(),
  department: z.string().optional(),
  assignee: z.string().optional(),
  status: z.enum(["", "todo", "doing", "waiting", "done"]).default(""),
  priority: z.enum(["", "low", "normal", "high", "urgent"]).default(""),
  metric: z
    .enum([
      "",
      "todo",
      "doing",
      "waiting",
      "done",
      "late",
      "today",
      "unassigned",
    ])
    .default(""),
  q: z.string().max(250).default(""),
  archived: z.enum(["0", "1"]).default("0"),
  completed: z.enum(["0", "1"]).default("0"),
  open: z.enum(["0", "1"]).default("0"),
});
export async function queryWork(user: any, params: URLSearchParams) {
  const f = schema.parse(Object.fromEntries(params));
  const d = await db();
  if (f.view === "progress" && user.role === "employee")
    throw new QueryPermissionError("Bạn không có quyền xem Tiến độ");
  const selectedScope =
    f.scope ||
    (f.view === "progress"
      ? user.role === "admin"
        ? "all"
        : "owned"
      : "visible");
  if (f.view === "progress" && selectedScope === "visible")
    throw new QueryPermissionError("Phạm vi Tiến độ không hợp lệ");
  if (user.role !== "admin" && selectedScope === "all")
    throw new QueryPermissionError("Không có quyền xem tất cả phòng ban");
  if (user.role === "employee" && selectedScope === "sent")
    throw new QueryPermissionError("Không có quyền xem yêu cầu đã gửi");
  const conditions: any[] = [
    scope(user),
    { archivedAt: f.archived === "1" ? { $ne: null } : null },
  ];
  if (selectedScope === "owned")
    conditions.push({ owningDepartmentId: user.departmentId });
  if (selectedScope === "sent")
    conditions.push({
      requestingDepartmentId: user.departmentId,
      owningDepartmentId: { $ne: user.departmentId },
    });
  if (f.department) {
    const departmentId = id(f.department);
    if (!(await d.collection("departments").findOne({ _id: departmentId })))
      throw new Error("Phòng ban không tồn tại");
    if (
      user.role !== "admin" &&
      (selectedScope === "owned" || user.role === "employee") &&
      !departmentId.equals(user.departmentId)
    )
      throw new QueryPermissionError("Phòng ban nằm ngoài phạm vi được cấp");
    conditions.push({ owningDepartmentId: departmentId });
  }
  if (f.assignee) {
    const assigneeId = id(f.assignee);
    if (!(await d.collection("users").findOne({ _id: assigneeId })))
      throw new Error("Người phụ trách không tồn tại");
    if (f.view === "mine" && !assigneeId.equals(user._id))
      throw new QueryPermissionError("Chỉ được xem việc cá nhân của bạn");
    conditions.push({ assigneeId });
  }
  if (f.view === "mine")
    conditions.push({
      assigneeId: user._id,
      status: f.completed === "1" ? "done" : { $ne: "done" },
    });
  if (f.open === "1") conditions.push({ status: { $ne: "done" } });
  if (f.status) conditions.push({ status: f.status });
  if (f.priority) conditions.push({ priority: f.priority });
  if (f.q.trim())
    conditions.push({
      title: {
        $regex: f.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      },
    });
  // Permission and record filters are applied by MongoDB before counts/grouping.
  const base = (await d
    .collection("tasks")
    .find({ $and: conditions })
    .toArray()) as unknown as WorkTask[];
  const tasks = base.filter((t) => metricMatch(t, f.metric)).sort(sortWork);
  const stats = counts(base);
  const departments = await d.collection("departments").find().toArray();
  const people = await d
    .collection("users")
    .find()
    .project({ _id: 1, name: 1, departmentId: 1, active: 1 })
    .toArray();
  const byDepartment =
    selectedScope === "sent" ||
    (user.role === "admin" && !f.department && selectedScope === "all");
  const allocation = byDepartment
    ? departments.map((department) => {
        const rows = base.filter(
          (t) => String(t.owningDepartmentId) === String(department._id),
        );
        return { id: department._id, name: department.name, ...counts(rows) };
      })
    : people
        .filter(
          (person) =>
            (f.department
              ? String(person.departmentId) === f.department
              : String(person.departmentId) === String(user.departmentId)) &&
            (person.active ||
              base.some((t) => String(t.assigneeId) === String(person._id))),
        )
        .map((person) => ({
          id: person._id,
          name: person.name,
          ...counts(
            base.filter((t) => String(t.assigneeId) === String(person._id)),
          ),
        }));
  return {
    tasks,
    total: tasks.length,
    stats,
    groups: groupWork(tasks),
    scope: selectedScope,
    allocation,
    allocationType: byDepartment ? "department" : "person",
    hasAssigned:
      (await d
        .collection("tasks")
        .countDocuments({
          ...scope(user),
          assigneeId: user._id,
          archivedAt: null,
          status: { $ne: "done" },
        })) > 0,
  };
}

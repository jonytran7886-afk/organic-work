export const statuses = ["todo", "doing", "waiting", "done"] as const;
export const statusNames: Record<string, string> = {
  todo: "Cần làm",
  doing: "Đang làm",
  waiting: "Đang chờ",
  done: "Hoàn thành",
};
export const priorityNames: Record<string, string> = {
  low: "Thấp",
  normal: "Bình thường",
  high: "Cao",
  urgent: "Khẩn",
};
export const roleNames: Record<string, string> = {
  admin: "Admin",
  manager: "Trưởng bộ phận",
  employee: "Nhân viên",
};
export function today(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function overdue(t: {
  status: string;
  dueDate?: string | null;
  archivedAt?: unknown;
}) {
  return (
    !t.archivedAt &&
    t.status !== "done" &&
    Boolean(t.dueDate && t.dueDate < today())
  );
}
export function canView(u: any, t: any) {
  return (
    u.role === "admin" ||
    String(t.owningDepartmentId) === String(u.departmentId) ||
    (u.role === "manager" &&
      String(t.requestingDepartmentId) === String(u.departmentId))
  );
}
export function canManage(u: any, t: any) {
  return (
    u.role === "admin" ||
    (u.role === "manager" &&
      String(t.owningDepartmentId) === String(u.departmentId))
  );
}
export function canStatus(u: any, t: any) {
  return canManage(u, t) || String(t.assigneeId) === String(u._id);
}
export function canCreateTask(u: any) {
  return (
    u?.active === true && ["admin", "manager", "employee"].includes(u.role)
  );
}

// Creating a child does not grant permission to edit or reassign its parent.
export function canCreateSubtask(u: any, t: any) {
  return (
    !!u?.active &&
    canView(u, t) &&
    !t.parentTaskId &&
    !t.archivedAt &&
    t.status !== "done" &&
    (canManage(u, t) ||
      (u.role === "employee" &&
        String(u.departmentId) === String(t.owningDepartmentId) &&
        [t.createdById, t.assigneeId].some(
          (person) => String(person) === String(u._id),
        )))
  );
}

export type TaskStatusAction = {
  label: string;
  status: (typeof statuses)[number];
  primary?: boolean;
};
export function taskStatusActions(u: any, t: any): TaskStatusAction[] {
  if (!u?.active || !canView(u, t) || t.archivedAt) return [];
  if (t.activeChildCount > 0) {
    if (t.status === "done")
      return canManage(u, t) ? [{ label: "Mở lại", status: "todo" }] : [];
    return t.reviewerId &&
      t.completedChildCount === t.activeChildCount &&
      (u.role === "admin" || String(u._id) === String(t.reviewerId))
      ? [{ label: "Xác nhận hoàn thành", status: "done", primary: true }]
      : [];
  }
  if (!canStatus(u, t)) return [];
  if (t.status === "done") return [{ label: "Mở lại", status: "todo" }];
  const actions: TaskStatusAction[] = [];
  if (t.status === "todo" || t.status === "waiting")
    actions.push({
      label: t.status === "waiting" ? "Tiếp tục" : "Bắt đầu",
      status: "doing",
      primary: true,
    });
  actions.push({
    label: "Hoàn thành",
    status: "done",
    primary: t.status === "doing",
  });
  if (t.status !== "waiting")
    actions.push({ label: "Chuyển sang Đang chờ", status: "waiting" });
  if (t.status !== "todo")
    actions.push({ label: "Đưa về Cần làm", status: "todo" });
  return actions;
}

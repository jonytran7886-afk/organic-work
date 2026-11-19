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
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

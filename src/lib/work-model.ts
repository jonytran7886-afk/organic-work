import { today, overdue } from "./model";
export type WorkTask = Record<string, any> & {
  status: string;
  dueDate?: string | null;
  priority: string;
};
export const groupNames: Record<string, string> = {
  late: "Quá hạn",
  today: "Đến hạn hôm nay",
  week: "7 ngày tới",
  later: "Sau đó",
  undated: "Chưa có hạn",
};
export function addDays(day: string, days: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function dueGroup(task: WorkTask, day = today()) {
  if (!task.dueDate) return "undated";
  if (task.dueDate < day) return "late";
  if (task.dueDate === day) return "today";
  if (task.dueDate <= addDays(day, 7)) return "week";
  return "later";
}
export function sortWork(a: WorkTask, b: WorkTask) {
  const rank: Record<string, number> = {
    urgent: 4,
    high: 3,
    normal: 2,
    low: 1,
  };
  return (
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    (rank[b.priority] || 0) - (rank[a.priority] || 0) ||
    String(a._id).localeCompare(String(b._id))
  );
}
export function groupWork(tasks: WorkTask[], day = today()) {
  return Object.keys(groupNames)
    .map((key) => ({
      key,
      name: groupNames[key],
      tasks: tasks.filter((t) => dueGroup(t, day) === key).sort(sortWork),
    }))
    .filter((g) => g.tasks.length);
}
export function counts(tasks: WorkTask[]) {
  const open = tasks.filter((t) => t.status !== "done" && !t.archivedAt);
  return {
    todo: tasks.filter((t) => t.status === "todo").length,
    doing: tasks.filter((t) => t.status === "doing").length,
    waiting: tasks.filter((t) => t.status === "waiting").length,
    done: tasks.filter((t) => t.status === "done").length,
    late: open.filter(overdue).length,
    unassigned: open.filter((t) => !t.assigneeId).length,
    today: open.filter((t) => t.dueDate === today()).length,
    open: open.length,
  };
}
export function metricMatch(t: WorkTask, metric: string) {
  if (metric === "late") return overdue(t);
  if (metric === "today")
    return t.status !== "done" && !t.archivedAt && t.dueDate === today();
  if (metric === "unassigned")
    return t.status !== "done" && !t.archivedAt && !t.assigneeId;
  return !metric || t.status === metric;
}
export function waitingLabel(t: WorkTask) {
  return t.status === "waiting" ? t.waitingReason || "Chưa ghi lý do" : "";
}
export function safeReturnPath(value: string | null) {
  return value &&
    /^\/(my-tasks|progress|board)(\?|$)/.test(value) &&
    !value.includes("\\")
    ? value
    : "/board";
}

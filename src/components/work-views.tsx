"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  statusNames,
  priorityNames,
  overdue,
  canManage,
  canStatus,
} from "@/lib/model";
import { waitingLabel, type WorkTask } from "@/lib/work-model";
import { useWorkspace } from "./workspace-context";
import { useQueryResource } from "./use-query-resource";
type Row = Record<string, any>;
export function detailHref(taskId: string, from: string) {
  return "/tasks/" + taskId + "?" + new URLSearchParams({ from });
}
export default function WorkViews({
  mode,
  user,
  users,
  departments,
  revision,
  busy,
  change,
}: {
  mode: "mine" | "progress";
  user: Row;
  users: Row[];
  departments: Row[];
  revision: any;
  busy: boolean;
  change: (t: Row, v: Row) => Promise<boolean>;
}) {
  const params = useSearchParams(),
    path = usePathname(),
    router = useRouter();
  const query = params.toString();
  const { cache, expire } = useWorkspace();
  const requestParams = new URLSearchParams(query);
  requestParams.set("view", mode);
  if (mode === "progress" && !requestParams.has("metric"))
    requestParams.set("metric", "late");
  const resource = useQueryResource(
    "/api/work?" + requestParams,
    cache,
    revision,
    expire,
  );
  const result = resource.data,
    pending = resource.pending,
    error = resource.error;
  const scope =
    params.get("scope") || (user.role === "admin" ? "all" : "owned");
  const metric = params.get("metric") || (mode === "progress" ? "late" : "");
  const person = (id: string) =>
      users.find((u) => u._id === id)?.name || "Chưa phân công",
    dept = (id: string) => departments.find((d) => d._id === id)?.name || "—";
  function update(values: Record<string, string>, reset = false) {
    const q = reset
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value) q.set(key, value);
      else q.delete(key);
    }
    window.history.pushState(null, "", path + (q.size ? "?" + q : ""));
  }
  function drill(values: Record<string, string>) {
    const q = new URLSearchParams(query);
    q.delete("metric");
    for (const [k, v] of Object.entries(values)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    q.set("scope", scope);
    q.set("mode", "list");
    router.push("/board?" + q);
  }
  const baseFilters = Boolean(
    params.get("q") ||
    params.get("status") ||
    params.get("priority") ||
    params.get("department") ||
    params.get("assignee") ||
    params.get("metric"),
  );
  const completed = params.get("completed") === "1";
  return (
    <div className={"work-view " + mode} aria-busy={pending}>
      {mode === "progress" && user.role !== "employee" && (
        <div className="scope-tabs" aria-label="Phạm vi Tiến độ">
          {user.role === "manager" ? (
            <>
              <button
                className={scope === "owned" ? "active" : ""}
                onClick={() =>
                  update({
                    scope: "owned",
                    department: "",
                    assignee: "",
                    metric: "",
                  })
                }
              >
                Phòng tôi phụ trách
              </button>
              <button
                className={scope === "sent" ? "active" : ""}
                onClick={() =>
                  update({
                    scope: "sent",
                    department: "",
                    assignee: "",
                    metric: "",
                  })
                }
              >
                Yêu cầu đã gửi
              </button>
            </>
          ) : (
            <strong>Tất cả phòng ban</strong>
          )}
        </div>
      )}
      {mode === "mine" && (
        <div className="mine-top">
          <div className="scope-tabs" aria-label="Chế độ việc cá nhân">
            <button
              className={!completed ? "active" : ""}
              onClick={() => update({ completed: "", status: "", metric: "" })}
            >
              Đang mở
            </button>
            <button
              className={completed ? "active" : ""}
              onClick={() => update({ completed: "1", status: "", metric: "" })}
            >
              Đã hoàn thành
            </button>
          </div>
          {result && !completed && (
            <div className="mini-counts">
              {[
                ["late", "Quá hạn"],
                ["today", "Hôm nay"],
                ["waiting", "Đang chờ"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={metric === key ? "active" : ""}
                  onClick={() => update({ metric: metric === key ? "" : key })}
                >
                  {label}
                  <b>{result.stats[key]}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="work-filters">
        {mode === "progress" && (user.role === "admin" || scope === "sent") && (
          <label>
            Phòng phụ trách
            <select
              aria-label="Phòng phụ trách"
              value={params.get("department") || ""}
              onChange={(e) =>
                update({ department: e.target.value, assignee: "" })
              }
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option value={d._id} key={d._id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "progress" && (
          <label>
            Người phụ trách
            <select
              aria-label="Người phụ trách"
              value={params.get("assignee") || ""}
              onChange={(e) => update({ assignee: e.target.value })}
            >
              <option value="">Tất cả người phụ trách</option>
              {users
                .filter(
                  (u) =>
                    u.active &&
                    (params.get("department")
                      ? u.departmentId === params.get("department")
                      : user.role === "manager" && scope === "owned"
                        ? u.departmentId === user.departmentId
                        : true),
                )
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label className="work-search">
          Tìm công việc
          <input
            aria-label="Tìm công việc"
            placeholder="Tìm theo tiêu đề…"
            value={params.get("q") || ""}
            onChange={(e) => update({ q: e.target.value })}
          />
        </label>
        <label>
          Trạng thái
          <select
            aria-label="Trạng thái"
            value={params.get("status") || ""}
            onChange={(e) => update({ status: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(statusNames)
              .filter(
                ([k]) =>
                  mode === "progress" ||
                  (completed ? k === "done" : k !== "done"),
              )
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ưu tiên
          <select
            aria-label="Ưu tiên"
            value={params.get("priority") || ""}
            onChange={(e) => update({ priority: e.target.value })}
          >
            <option value="">Tất cả ưu tiên</option>
            {Object.entries(priorityNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {baseFilters && (
          <button
            className="secondary clear-filters"
            onClick={() =>
              update(
                mode === "progress"
                  ? { scope, metric: "" }
                  : { completed: completed ? "1" : "" },
                true,
              )
            }
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className="error">
          {error}{" "}
          <button className="retry" onClick={resource.retry}>
            Thử lại
          </button>
        </div>
      )}
      {pending && (
        <p role="status" className="query-loading">
          Đang cập nhật công việc…
        </p>
      )}
      {result && (
        <>
          {mode === "progress" && (
            <section className="stats progress-stats">
              {[
                ["todo", "Cần làm"],
                ["doing", "Đang làm"],
                ["waiting", "Đang chờ"],
                ["done", "Hoàn thành"],
                ["late", "Quá hạn"],
                ["unassigned", "Chưa phân công"],
              ].map(([key, label]) => (
                <button
                  className={"stat stat-" + key}
                  key={key}
                  onClick={() => drill({ metric: key })}
                  disabled={pending || busy}
                  aria-label={label + ": " + result.stats[key] + " công việc"}
                >
                  <div>
                    <span>{label}</span>
                  </div>
                  <strong>{result.stats[key]}</strong>
                  <small>
                    {key === "late" || key === "unassigned"
                      ? "việc đang mở"
                      : "công việc"}
                  </small>
                </button>
              ))}
            </section>
          )}
          {mode === "progress" && (
            <div className="attention-head">
              <div>
                <h2>
                  {["late", "waiting", "unassigned"].includes(metric)
                    ? "Cần xử lý"
                    : "Danh sách công việc"}
                </h2>
                <p className="muted">
                  {scope === "sent"
                    ? "Theo dõi yêu cầu trên cùng công việc của phòng nhận."
                    : "Nhận diện việc đang vướng và phân công ngay tại danh sách."}
                </p>
              </div>
              <div className="quick-filters">
                {[
                  ["late", "Quá hạn"],
                  ["waiting", "Đang chờ"],
                  ["unassigned", "Chưa phân công"],
                ].map(([key, label]) => (
                  <button
                    className={metric === key ? "active" : ""}
                    key={key}
                    onClick={() => update({ metric: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="results-heading">
            <span className="result-count">{result.total} công việc</span>
            {mode === "progress" && (
              <Link
                className="text-link"
                href={
                  "/board?" +
                  new URLSearchParams({
                    ...Object.fromEntries(params),
                    scope,
                    metric,
                    mode: "list",
                  })
                }
              >
                Mở danh sách đầy đủ
              </Link>
            )}
          </div>
          {!result.tasks.length ? (
            <div className="empty work-empty">
              <span>☑</span>
              <h2>
                {mode === "mine" &&
                !completed &&
                !result.hasAssigned &&
                !baseFilters
                  ? "Bạn chưa có công việc được giao"
                  : mode === "mine" && completed && !baseFilters
                    ? "Chưa có công việc đã hoàn thành"
                    : "Không tìm thấy công việc phù hợp"}
              </h2>
              <p>
                {baseFilters
                  ? "Thử thay đổi hoặc xóa bộ lọc."
                  : mode === "mine"
                    ? "Các công việc được giao sẽ xuất hiện tại đây."
                    : "Không có công việc trong nhóm đang chọn."}
              </p>
              {baseFilters && (
                <button
                  className="secondary"
                  onClick={() =>
                    update(
                      mode === "progress"
                        ? { scope }
                        : { completed: completed ? "1" : "" },
                      true,
                    )
                  }
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          ) : mode === "mine" && !completed ? (
            <div className="my-groups">
              {result.groups.map((group: Row) => (
                <section
                  className="task-group"
                  data-group={group.key}
                  key={group.key}
                >
                  <h2>
                    {group.name}
                    <span>{group.tasks.length}</span>
                  </h2>
                  {group.tasks.map(renderTask)}
                </section>
              ))}
            </div>
          ) : (
            <div className="work-task-list">{result.tasks.map(renderTask)}</div>
          )}
          {mode === "progress" && (
            <section className="panel allocation">
              <h2>
                {result.allocationType === "department"
                  ? scope === "sent"
                    ? "Theo phòng nhận"
                    : "Theo phòng phụ trách"
                  : "Theo người phụ trách"}
              </h2>
              <p className="muted">
                Số công việc đang mở trong phạm vi và bộ lọc hiện tại.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {result.allocationType === "department"
                          ? "Phòng ban"
                          : "Người phụ trách"}
                      </th>
                      <th>Đang mở</th>
                      <th>Quá hạn</th>
                      <th>Đang chờ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.allocation.map((row: Row) => (
                      <tr key={row.id}>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => {
                              if (
                                result.allocationType === "department" &&
                                user.role === "admin"
                              ) {
                                update({
                                  department: row.id,
                                  assignee: "",
                                  metric: "",
                                });
                              } else
                                drill({
                                  [result.allocationType === "department"
                                    ? "department"
                                    : "assignee"]: row.id,
                                  open: "1",
                                });
                            }}
                          >
                            {row.name}
                          </button>
                        </td>
                        {["open", "late", "waiting"].map((key) => (
                          <td key={key}>
                            <button
                              className="allocation-count"
                              aria-label={
                                row.name +
                                " " +
                                (
                                  {
                                    open: "đang mở",
                                    late: "quá hạn",
                                    waiting: "đang chờ",
                                  } as Row
                                )[key]
                              }
                              onClick={() =>
                                drill({
                                  [result.allocationType === "department"
                                    ? "department"
                                    : "assignee"]: row.id,
                                  metric: key === "open" ? "" : key,
                                  open: "1",
                                })
                              }
                            >
                              {row[key]}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
  function renderTask(t: WorkTask) {
    return (
      <article className="work-task" key={t._id} data-task-id={t._id}>
        <div className="work-task-main">
          <Link
            className="work-task-title"
            href={detailHref(t._id, path + (query ? "?" + query : ""))}
          >
            {t.title}
          </Link>
          <div className="work-task-meta">
            <span className={"status " + t.status}>
              {statusNames[t.status]}
            </span>
            <span className={overdue(t) ? "overdue-date" : ""}>
              {t.dueDate
                ? "Hạn: " + t.dueDate.split("-").reverse().join("/")
                : "Chưa có hạn"}
            </span>
            <span className={"priority " + t.priority}>
              {priorityNames[t.priority]}
            </span>
            {mode === "progress" && (
              <>
                <span>{dept(t.owningDepartmentId)}</span>
                <span>{person(t.assigneeId)}</span>
              </>
            )}
          </div>
          {t.status === "waiting" && (
            <p className="waiting-note">
              <strong>Lý do chờ:</strong> {waitingLabel(t)}
            </p>
          )}
        </div>
        <div className="work-task-actions">
          {mode === "progress" &&
            !t.assigneeId &&
            !t.archivedAt &&
            canManage(user, t) && (
              <label className="inline-assignment">
                Phân công
                <select
                  aria-label={"Phân công " + t.title}
                  disabled={busy}
                  value=""
                  onChange={(e) => change(t, { assigneeId: e.target.value })}
                >
                  <option value="">Chọn người phụ trách</option>
                  {users
                    .filter(
                      (u) =>
                        u.active && u.departmentId === t.owningDepartmentId,
                    )
                    .map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          {canStatus(user, t) && !t.archivedAt && (
            <>
              {t.status === "todo" || t.status === "waiting" ? (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => change(t, { status: "doing" })}
                >
                  Bắt đầu
                </button>
              ) : null}
              {t.status !== "done" && t.status !== "waiting" && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => change(t, { status: "waiting" })}
                >
                  Chuyển sang Đang chờ
                </button>
              )}
              {t.status !== "done" && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => change(t, { status: "done" })}
                >
                  Hoàn thành
                </button>
              )}
            </>
          )}
        </div>
      </article>
    );
  }
}

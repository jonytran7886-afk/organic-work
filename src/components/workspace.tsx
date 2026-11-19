"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  statuses,
  statusNames,
  priorityNames,
  roleNames,
  overdue,
  canManage,
  canStatus,
} from "@/lib/model";
import WorkViews, { detailHref } from "./work-views";
import { WorkspaceContext, type CacheEntry } from "./workspace-context";
import { useQueryResource } from "./use-query-resource";
import { BrandLockup, OrganicSymbol, CorporateLogo } from "./brand";
import { safeReturnPath, waitingLabel } from "@/lib/work-model";
type Row = Record<string, any>;
type Task = Row & { status: string; dueDate?: string | null };
async function api(path: string, body?: any, method?: string) {
  const r = await fetch("/api/" + path, {
    method: method || (body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const v = await r.json();
  if (!r.ok) throw new Error(v.error || "Không thể kết nối");
  return v;
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    mine: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    progress: (
      <>
        <path d="M4 4v16h16M8 15v-4m5 4V7m5 8v-6" />
      </>
    ),
    board: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M9 4v16m6-16v16M6 8v4m6-4v7m6-7v3" />
      </>
    ),
    admin: (
      <>
        <path d="m12 3 8 4v5c0 4-4 7-8 9-4-2-8-5-8-9V7z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] || paths.board}
    </svg>
  );
}
export default function Workspace({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const queryParams = useSearchParams();
  const query = queryParams.toString();
  const [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState(false),
    [waitingTask, setWaitingTask] = useState<Row | null>(null);
  const resourceCache = useRef(new Map<string, CacheEntry>()).current;
  const currentData = useRef(data);
  currentData.current = data;
  const expire = useCallback(() => {
    resourceCache.clear();
    setData(null);
    setAuth(false);
    setModal(false);
    setWaitingTask(null);
  }, [resourceCache]);
  const list = queryParams.get("mode") === "list";
  const search = queryParams.get("q") || "";
  function urlUpdate(values: Record<string, string>) {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(values)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    window.history.replaceState(null, "", path + (q.size ? "?" + q : ""));
  }
  function setList(value: boolean) {
    urlUpdate({ mode: value ? "list" : "" });
  }
  function setSearch(value: string) {
    urlUpdate({ q: value });
  }
  const filters = {
    department: queryParams.get("department") || "",
    assignee: queryParams.get("assignee") || "",
    status: queryParams.get("status") || "",
    priority: queryParams.get("priority") || "",
    late:
      queryParams.get("late") === "1" || queryParams.get("metric") === "late",
    archived: queryParams.get("archived") === "1",
  };
  function setFilters(value: typeof filters) {
    urlUpdate({
      department: value.department,
      assignee: value.assignee,
      status: value.status,
      priority: value.priority,
      late: value.late ? "1" : "",
      archived: value.archived ? "1" : "",
      metric: value.late
        ? "late"
        : filters.late ||
            (value.status !== filters.status &&
              Boolean(statusNames[queryParams.get("metric") || ""]))
          ? ""
          : queryParams.get("metric") || "",
    });
  }
  const page = path.startsWith("/tasks/")
    ? "detail"
    : path === "/my-tasks"
      ? "mine"
      : path === "/board"
        ? "board"
        : path.startsWith("/admin")
          ? "admin"
          : path === "/progress"
            ? "progress"
            : "legacy";
  const refresh = useCallback(async () => {
    try {
      const r = await api("data");
      resourceCache.clear();
      setData(r);
      setAuth(true);
      setError("");
    } catch (e: any) {
      if (e.message === "Vui lòng đăng nhập") {
        expire();
      } else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [expire, resourceCache]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  // Recheck only the session on navigation; do not reload the directory/tasks or hide the shell.
  useEffect(() => {
    if (!auth || path === "/login") return;
    const controller = new AbortController();
    fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          expire();
          return;
        }
        if (!response.ok) return;
        const value = await response.json();
        if (controller.signal.aborted) return;
        const previous = currentData.current?.user;
        if (
          previous &&
          ["_id", "role", "departmentId", "active", "name", "email"].some(
            (key) => previous[key] !== value.user[key],
          )
        )
          await refresh();
      })
      .catch(() => {});
    return () => controller.abort();
  }, [path, auth, expire, refresh]);
  useEffect(() => {
    setError("");
    setModal(false);
    setWaitingTask(null);
  }, [path]);
  useEffect(() => {
    if (auth && data && page === "legacy")
      router.replace(
        path === "/login" || data.user.role === "employee"
          ? "/my-tasks"
          : "/progress",
      );
  }, [auth, data, page, router]);
  const boardParams = new URLSearchParams(query);
  boardParams.set("view", "board");
  if (boardParams.get("late") === "1") boardParams.set("metric", "late");
  boardParams.delete("late");
  boardParams.delete("mode");
  const boardResource = useQueryResource(
    auth && page === "board" ? "/api/work?" + boardParams : null,
    resourceCache,
    data,
    expire,
  );
  const boardData = boardResource.data,
    boardPending = boardResource.pending;
  const detailResource = useQueryResource(
    auth && page === "detail" ? "/api/tasks/" + path.split("/")[2] : null,
    resourceCache,
    data,
    expire,
  );
  const detail = detailResource.data;
  useEffect(() => {
    if (!modal && !waitingTask) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(false);
        setWaitingTask(null);
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button, [role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea',
          ),
        ).filter((e) => !(e as HTMLInputElement).disabled);
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modal, waitingTask]);
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function patch(t: Row, v: Row) {
    if (v.status === "waiting" && t.status !== "waiting" && !v.waitingReason) {
      setWaitingTask(t);
      return false;
    }
    return action(() => api("tasks/" + t._id, v, "PATCH"));
  }
  const user = data?.user,
    users: Row[] = data?.users || [],
    departments: Row[] = data?.departments || [],
    all: Task[] = data?.tasks || [];
  const person = (id: string) =>
    users.find((u) => u._id === id)?.name || "Chưa phân công";
  const dept = (id: string) =>
    departments.find((d) => d._id === id)?.name || "—";
  const active = all.filter((t) => !t.archivedAt);
  const tasks: Task[] = boardData?.tasks || [];
  const backPath = safeReturnPath(queryParams.get("from"));
  const currentLocation = path + (query ? "?" + query : "");
  function field(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form));
  }
  if (loading)
    return (
      <main className="loading">
        <span className="loading-symbol">
          <OrganicSymbol />
        </span>
        <p>Đang kết nối không gian làm việc…</p>
      </main>
    );
  if (!auth)
    return (
      <main className="login">
        <section className="login-story">
          <div className="login-corporate">
            <CorporateLogo />
          </div>
          <div className="login-narrative">
            <span className="eyebrow">CÙNG ORGANIC VIỆT NAM</span>
            <h1>
              Kết nối công việc.
              <br />
              <em>Nuôi dưỡng thành công.</em>
            </h1>
            <p>
              Từ mỗi công việc nhỏ đến mục tiêu chung.
              <br />
              Một không gian để đội ngũ phối hợp và cùng phát triển.
            </p>
            <div className="brand-values">
              <span>Đồng hành</span>
              <span>Trách nhiệm</span>
              <span>Phát triển</span>
            </div>
          </div>
          <div className="login-emblem" aria-hidden="true">
            <OrganicSymbol />
          </div>
          <small className="login-signoff">
            ORGANIC VIỆT NAM <span>Gắn kết đội ngũ. Bền vững tương lai.</span>
          </small>
        </section>
        <section className="login-form">
          <div className="login-product">
            <BrandLockup />
          </div>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2>Đăng nhập Organic Work</h2>
          <p className="muted">Sử dụng tài khoản được quản trị viên cấp.</p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const v = field(e.currentTarget);
              setBusy(true);
              try {
                await api("login", v);
                await refresh();
                router.replace(
                  path.startsWith("/tasks/") || path.startsWith("/admin")
                    ? currentLocation
                    : "/my-tasks",
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="ban@organic.vn"
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
              />
            </label>
            <button disabled={busy} className="primary">
              {busy ? "Đang đăng nhập…" : "Đăng nhập"}
            </button>
          </form>
          <p className="login-note">
            Cần tài khoản? Liên hệ quản trị viên của bạn.
          </p>
        </section>
      </main>
    );
  return (
    <WorkspaceContext.Provider
      value={{ data: data!, refresh, cache: resourceCache, expire }}
    >
      <div className="app">
        <aside className="sidebar">
          <BrandLockup />
          <div className="workspace-label">
            <span className="company-logo">
              <OrganicSymbol />
            </span>
            <div>
              <strong>Organic Việt Nam</strong>
              <small>{dept(user.departmentId)}</small>
            </div>
          </div>
          <p className="nav-label">KHÔNG GIAN LÀM VIỆC</p>
          <nav>
            {[
              ["mine", "/my-tasks", "Việc của tôi"],
              ...(user.role !== "employee"
                ? [["progress", "/progress", "Tiến độ"]]
                : []),
              ["board", "/board", "Công việc phòng ban"],
              ...(user.role === "admin"
                ? [["admin", "/admin/users", "Quản trị"]]
                : []),
            ].map(([key, url, label]) => (
              <Link
                key={key}
                href={url}
                className={page === key ? "selected" : ""}
              >
                <Icon name={key} />
                {label}
                {key === "mine" && (
                  <span className="nav-count">
                    {
                      active.filter(
                        (t) => t.assigneeId === user._id && t.status !== "done",
                      ).length
                    }
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="team-note">
              <OrganicSymbol />
              <strong>
                Cùng vun đắp
                <br />
                giá trị bền vững.
              </strong>
              <p>
                Mỗi công việc hoàn thành,
                <br />
                một bước tiến cùng Organic.
              </p>
            </div>
            <div className="profile">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{roleNames[user.role]}</small>
              </div>
              <button
                className="logout"
                title="Đăng xuất"
                aria-label="Đăng xuất"
                onClick={() =>
                  action(async () => {
                    await api("logout", {});
                    expire();
                    router.push("/login");
                  })
                }
              >
                ⏻
              </button>
            </div>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <span>
              Không gian làm việc <span className="slash">/</span>{" "}
              <strong>
                {
                  (
                    {
                      progress: "Tiến độ",
                      mine: "Việc của tôi",
                      board: "Công việc phòng ban",
                      detail: "Chi tiết công việc",
                      admin:
                        path === "/admin/departments"
                          ? "Quản trị / Phòng ban"
                          : "Quản trị / Tài khoản",
                    } as Row
                  )[page]
                }
              </strong>
            </span>
            <span className="topbar-right">
              <span className="date">
                {new Intl.DateTimeFormat("vi-VN", {
                  dateStyle: "long",
                  timeZone: "Asia/Ho_Chi_Minh",
                }).format(new Date())}
              </span>
              <span className="avatar small">{user.name.slice(0, 1)}</span>
              <button
                className="mobile-logout"
                aria-label="Đăng xuất"
                onClick={() =>
                  action(async () => {
                    await api("logout", {});
                    expire();
                    router.push("/login");
                  })
                }
              >
                Đăng xuất
              </button>
            </span>
          </header>
          <main className="content">
            {(error || boardResource.error || detailResource.error) && (
              <div role="alert" className="error">
                {error || boardResource.error || detailResource.error}
                <button
                  onClick={() => {
                    setError("");
                    if (page === "board") boardResource.retry();
                    if (page === "detail") detailResource.retry();
                  }}
                >
                  Thử lại
                </button>
              </div>
            )}
            {page !== "admin" && (
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="heading-brand-line" aria-hidden="true" />{" "}
                    ORGANIC WORK <span className="heading-divider">/</span>{" "}
                    {dept(user.departmentId).toUpperCase()}
                  </div>
                  <h1>
                    {
                      (
                        {
                          progress: "Tiến độ công việc",
                          legacy: "Đang mở không gian làm việc…",
                          mine: "Việc của tôi",
                          board: "Công việc phòng ban",
                          admin: "Quản trị không gian",
                          detail: "Chi tiết công việc",
                        } as Row
                      )[page]
                    }
                  </h1>
                  <p className="muted">
                    {page === "progress"
                      ? "Biết đội đang làm đến đâu, đang vướng gì và việc nào cần phân công."
                      : page === "board"
                        ? "Mọi công việc, một góc nhìn. Phối hợp cùng nhau để đi xa hơn."
                        : page === "mine"
                          ? "Tập trung vào công việc của bạn, bắt đầu từ điều quan trọng nhất."
                          : "Thông tin, trao đổi và tiến độ được kết nối tại một nơi."}
                  </p>
                </div>
                {user.role !== "employee" && (
                  <button
                    className="primary"
                    aria-label="Tạo công việc"
                    onClick={() => setModal(true)}
                  >
                    ＋ Tạo công việc
                  </button>
                )}
              </div>
            )}
            {(page === "mine" || page === "progress") && (
              <WorkViews
                mode={page === "mine" ? "mine" : "progress"}
                user={user}
                users={users}
                departments={departments}
                revision={data}
                busy={busy}
                change={patch}
              />
            )}
            {page === "board" && (
              <>
                {boardPending && (
                  <p role="status" className="query-loading">
                    Đang cập nhật công việc…
                  </p>
                )}
                <div className="toolbar">
                  <div className="view-switch">
                    <button
                      className={!list ? "active" : ""}
                      onClick={() => setList(false)}
                    >
                      ▦ Bảng Kanban
                    </button>
                    <button
                      className={list ? "active" : ""}
                      onClick={() => setList(true)}
                    >
                      ☷ Danh sách
                    </button>
                  </div>
                  <label className="search">
                    <Icon name="search" />
                    <input
                      aria-label="Tìm công việc"
                      placeholder="Tìm theo tiêu đề…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="filters">
                  <select
                    aria-label="Phòng phụ trách"
                    value={filters.department}
                    onChange={(e) =>
                      setFilters({ ...filters, department: e.target.value })
                    }
                  >
                    <option value="">Tất cả phòng ban</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Người phụ trách"
                    value={filters.assignee}
                    onChange={(e) =>
                      setFilters({ ...filters, assignee: e.target.value })
                    }
                  >
                    <option value="">Tất cả người phụ trách</option>
                    {users
                      .filter(
                        (u) =>
                          u.active &&
                          (!filters.department ||
                            u.departmentId === filters.department),
                      )
                      .map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                  <select
                    aria-label="Trạng thái"
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                  >
                    <option value="">Tất cả trạng thái</option>
                    {statuses.map((s) => (
                      <option value={s} key={s}>
                        {statusNames[s]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Ưu tiên"
                    value={filters.priority}
                    onChange={(e) =>
                      setFilters({ ...filters, priority: e.target.value })
                    }
                  >
                    <option value="">Tất cả ưu tiên</option>
                    {Object.entries(priorityNames).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={filters.late}
                      onChange={(e) =>
                        setFilters({ ...filters, late: e.target.checked })
                      }
                    />
                    Quá hạn
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={filters.archived}
                      onChange={(e) =>
                        setFilters({ ...filters, archived: e.target.checked })
                      }
                    />
                    Đã lưu trữ
                  </label>
                  <button
                    className="secondary"
                    onClick={() => router.replace("/board")}
                  >
                    Xóa bộ lọc
                  </button>
                  <span className="result-count">
                    {boardData?.total || 0} công việc
                  </span>
                </div>
                <div className="filter-chips">
                  {queryParams.get("scope") && (
                    <span className="filter-chip">
                      Phạm vi:{" "}
                      {
                        (
                          {
                            owned: "Phòng tôi phụ trách",
                            sent: "Yêu cầu đã gửi",
                            all: "Tất cả phòng ban",
                            visible: "Theo quyền truy cập",
                          } as Row
                        )[queryParams.get("scope") || ""]
                      }
                    </span>
                  )}
                  {queryParams.get("metric") && (
                    <button
                      className="filter-chip"
                      aria-label="Xóa bộ lọc số liệu"
                      onClick={() => urlUpdate({ metric: "", late: "" })}
                    >
                      Nhóm:{" "}
                      {
                        (
                          {
                            ...statusNames,
                            late: "Quá hạn",
                            today: "Hôm nay",
                            unassigned: "Chưa phân công",
                          } as Row
                        )[queryParams.get("metric") || ""]
                      }{" "}
                      ×
                    </button>
                  )}
                  {queryParams.get("open") === "1" && (
                    <button
                      className="filter-chip"
                      aria-label="Xóa lọc việc đang mở"
                      onClick={() => urlUpdate({ open: "" })}
                    >
                      Chỉ việc đang mở ×
                    </button>
                  )}
                </div>
                <div className={list ? "list-mode" : "board-mode"}>
                  {list ? (
                    renderTable(tasks)
                  ) : (
                    <div className="kanban">
                      {statuses.map((s) => (
                        <section className={"column column-" + s} key={s}>
                          <h2>
                            <span>
                              <i className={"dot " + s} />
                              {statusNames[s]}{" "}
                              <b>
                                {tasks.filter((t) => t.status === s).length}
                              </b>
                            </span>
                            {user.role !== "employee" && (
                              <button
                                aria-label={"Tạo việc trong " + statusNames[s]}
                                onClick={() => setModal(true)}
                              >
                                ＋
                              </button>
                            )}
                          </h2>
                          <div className="cards">
                            {tasks
                              .filter((t) => t.status === s)
                              .map((t) => (
                                <article className="task-card" key={t._id}>
                                  <div className="card-top">
                                    <span className={"priority " + t.priority}>
                                      {priorityNames[t.priority]}
                                    </span>
                                    <span className="task-code">
                                      OW-{t._id.slice(-4).toUpperCase()}
                                    </span>
                                  </div>
                                  <Link
                                    className="task-title"
                                    href={detailHref(t._id, currentLocation)}
                                  >
                                    {t.title}
                                  </Link>
                                  <p className="card-dept">
                                    {dept(t.owningDepartmentId)}
                                    {t.requestingDepartmentId !==
                                      t.owningDepartmentId && (
                                      <span className="cross-dept">
                                        Liên phòng
                                      </span>
                                    )}
                                  </p>
                                  <div className="card-due">
                                    <span>
                                      ◷{" "}
                                      {t.dueDate
                                        ? t.dueDate
                                            .split("-")
                                            .reverse()
                                            .join("/")
                                        : "Chưa có hạn"}
                                    </span>
                                    {overdue(t) && (
                                      <span className="late-label">
                                        Quá hạn
                                      </span>
                                    )}
                                  </div>
                                  <div className="card-footer">
                                    <span className="assignee">
                                      <span
                                        className={
                                          "avatar tiny " +
                                          (!t.assigneeId ? "unassigned" : "")
                                        }
                                      >
                                        {t.assigneeId
                                          ? person(t.assigneeId).slice(0, 1)
                                          : "?"}
                                      </span>
                                      <span>{person(t.assigneeId)}</span>
                                    </span>
                                    {!t.archivedAt && canStatus(user, t) && (
                                      <select
                                        aria-label={"Đổi trạng thái " + t.title}
                                        value={t.status}
                                        disabled={busy}
                                        onChange={(e) =>
                                          patch(t, { status: e.target.value })
                                        }
                                      >
                                        {statuses.map((s) => (
                                          <option key={s} value={s}>
                                            {statusNames[s]}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                </article>
                              ))}
                            {!tasks.some((t) => t.status === s) && (
                              <p className="empty-column">Chưa có công việc</p>
                            )}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mobile-list">{!list && renderTable(tasks)}</div>
              </>
            )}
            {page === "detail" &&
              (detail && detail.task._id === path.split("/")[2] ? (
                <>
                  <Link className="back-link" href={backPath}>
                    ‹ Quay lại danh sách
                  </Link>
                  <div className="detail-layout">
                    <section className="panel detail-main">
                      <div className="card-top">
                        <span className="task-code">
                          OW-{detail.task._id.slice(-4).toUpperCase()}
                        </span>
                        {detail.task.archivedAt && (
                          <span className="late-label">Đã lưu trữ</span>
                        )}
                        <span className={"priority " + detail.task.priority}>
                          {priorityNames[detail.task.priority]}
                        </span>
                      </div>
                      <h2 className="detail-title">{detail.task.title}</h2>
                      {canManage(user, detail.task) &&
                      !detail.task.archivedAt ? (
                        <form
                          key={detail.task.updatedAt}
                          onSubmit={async (e) => {
                            e.preventDefault();
                            await patch(detail.task, field(e.currentTarget));
                          }}
                        >
                          <label>
                            Tiêu đề
                            <input
                              name="title"
                              defaultValue={detail.task.title}
                              required
                              maxLength={250}
                            />
                          </label>
                          <label>
                            Mô tả
                            <textarea
                              name="description"
                              defaultValue={detail.task.description}
                              rows={4}
                            />
                          </label>
                          <div className="form-grid">
                            <label>
                              Hạn hoàn thành
                              <input
                                name="dueDate"
                                type="date"
                                defaultValue={detail.task.dueDate}
                                required
                              />
                            </label>
                            <label>
                              Ưu tiên
                              <select
                                name="priority"
                                defaultValue={detail.task.priority}
                              >
                                {Object.entries(priorityNames).map(([k, v]) => (
                                  <option value={k} key={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button className="secondary" disabled={busy}>
                            Lưu thay đổi
                          </button>
                        </form>
                      ) : (
                        <p className="description">
                          {detail.task.description || "Chưa có mô tả"}
                        </p>
                      )}
                      <div className="discussion">
                        <h2>
                          Trao đổi công việc{" "}
                          <span className="counter">
                            {detail.comments.length}
                          </span>
                        </h2>
                        {detail.comments.length === 0 && (
                          <p className="muted">
                            Chưa có bình luận. Bắt đầu trao đổi cùng đồng đội.
                          </p>
                        )}
                        {detail.comments.map((c: Row) => (
                          <article className="comment" key={c._id}>
                            <span className="avatar small">
                              {person(c.authorId).slice(0, 1)}
                            </span>
                            <div>
                              <strong>{person(c.authorId)}</strong>
                              <time>
                                {new Date(c.createdAt).toLocaleString("vi-VN", {
                                  timeZone: "Asia/Ho_Chi_Minh",
                                })}
                              </time>
                              <p>{c.body}</p>
                            </div>
                          </article>
                        ))}
                        {!detail.task.archivedAt && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              if (
                                await action(() =>
                                  api(
                                    "tasks/" + detail.task._id + "/comments",
                                    field(form),
                                  ),
                                )
                              )
                                form.reset();
                            }}
                          >
                            <label>
                              Bình luận
                              <textarea
                                name="body"
                                required
                                maxLength={5000}
                                rows={3}
                                placeholder="Viết trao đổi của bạn…"
                              />
                            </label>
                            <button className="primary" disabled={busy}>
                              Gửi bình luận
                            </button>
                          </form>
                        )}
                      </div>
                      <div className="history">
                        <h2>Lịch sử hoạt động</h2>
                        {detail.activities.map((a: Row) => (
                          <div className="activity" key={a._id}>
                            <i />
                            <div>
                              <strong>{person(a.actorId)}</strong>{" "}
                              {
                                (
                                  {
                                    created: "đã tạo công việc",
                                    status: "đã đổi trạng thái",
                                    waitingReason: "đã cập nhật lý do chờ",
                                    assigneeId: "đã đổi người phụ trách",
                                    dueDate: "đã sửa ngày hạn",
                                    title: "đã sửa tiêu đề",
                                    description: "đã sửa mô tả",
                                    priority: "đã đổi ưu tiên",
                                    archived: "đã thay đổi lưu trữ",
                                  } as Row
                                )[a.type]
                              }
                              {a.type !== "created" &&
                                a.type !== "description" && (
                                  <p>
                                    {activityValue(a.type, a.before)} →{" "}
                                    {activityValue(a.type, a.after)}
                                  </p>
                                )}
                              <time>
                                {new Date(a.createdAt).toLocaleString("vi-VN", {
                                  timeZone: "Asia/Ho_Chi_Minh",
                                })}
                              </time>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                    <aside className="panel detail-meta">
                      <h2>Thông tin công việc</h2>
                      <label>
                        Trạng thái
                        {!detail.task.archivedAt &&
                        canStatus(user, detail.task) ? (
                          <select
                            aria-label="Trạng thái công việc"
                            value={detail.task.status}
                            disabled={busy}
                            onChange={(e) =>
                              patch(detail.task, { status: e.target.value })
                            }
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s}>
                                {statusNames[s]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={"status " + detail.task.status}>
                            {statusNames[detail.task.status]}
                          </span>
                        )}
                      </label>
                      {[
                        [
                          "Phòng yêu cầu",
                          dept(detail.task.requestingDepartmentId),
                        ],
                        [
                          "Phòng phụ trách",
                          dept(detail.task.owningDepartmentId),
                        ],
                        ["Người tạo", person(detail.task.createdById)],
                      ].map(([k, v]) => (
                        <div className="meta" key={k}>
                          <span>{k}</span>
                          <strong>{v}</strong>
                        </div>
                      ))}
                      <label>
                        Người phụ trách
                        {canManage(user, detail.task) &&
                        !detail.task.archivedAt ? (
                          <select
                            aria-label="Phân công người phụ trách"
                            value={detail.task.assigneeId || ""}
                            disabled={busy}
                            onChange={(e) =>
                              patch(detail.task, {
                                assigneeId: e.target.value || null,
                              })
                            }
                          >
                            <option value="">Chưa phân công</option>
                            {users
                              .filter(
                                (u) =>
                                  u.active &&
                                  u.departmentId ===
                                    detail.task.owningDepartmentId,
                              )
                              .map((u) => (
                                <option key={u._id} value={u._id}>
                                  {u.name}
                                </option>
                              ))}
                          </select>
                        ) : (
                          <strong>{person(detail.task.assigneeId)}</strong>
                        )}
                      </label>
                      {detail.task.status === "waiting" && (
                        <section className="waiting-detail">
                          <h3>Lý do chờ</h3>
                          <p>{waitingLabel(detail.task)}</p>
                          {canStatus(user, detail.task) &&
                            !detail.task.archivedAt && (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  await patch(
                                    detail.task,
                                    field(e.currentTarget),
                                  );
                                }}
                              >
                                <label>
                                  Lý do chờ hiện tại
                                  <textarea
                                    name="waitingReason"
                                    required
                                    maxLength={500}
                                    defaultValue={
                                      detail.task.waitingReason || ""
                                    }
                                  />
                                </label>
                                <button className="secondary" disabled={busy}>
                                  Lưu lý do chờ
                                </button>
                              </form>
                            )}
                        </section>
                      )}
                      <div className="meta">
                        <span>Ngày đến hạn</span>
                        <strong>
                          {detail.task.dueDate || "Chưa có hạn"}{" "}
                          {overdue(detail.task) && (
                            <span className="late-label">Quá hạn</span>
                          )}
                        </strong>
                      </div>
                      {detail.task.completedAt && (
                        <div className="meta">
                          <span>Hoàn thành lúc</span>
                          <strong>
                            {new Date(detail.task.completedAt).toLocaleString(
                              "vi-VN",
                            )}
                          </strong>
                        </div>
                      )}
                      {canManage(user, detail.task) && (
                        <button
                          className="secondary archive-button"
                          disabled={busy}
                          onClick={() =>
                            patch(detail.task, {
                              archived: !detail.task.archivedAt,
                            })
                          }
                        >
                          {detail.task.archivedAt
                            ? "Khôi phục công việc"
                            : "Lưu trữ công việc"}
                        </button>
                      )}
                    </aside>
                  </div>
                </>
              ) : (
                !error && <p className="empty">Đang tải chi tiết…</p>
              ))}
            {page === "admin" && children}
            <footer className="page-footer">
              <span>Organic Work</span>
              <span>Một đội ngũ. Cùng phát triển.</span>
            </footer>
          </main>
        </div>
        {waitingTask && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="waiting-title"
            >
              <div className="section-title">
                <h2 id="waiting-title">Chuyển sang Đang chờ</h2>
                <button
                  className="close"
                  aria-label="Đóng"
                  onClick={() => setWaitingTask(null)}
                >
                  ×
                </button>
              </div>
              <p>{waitingTask.title}</p>
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const reason = String(
                    new FormData(e.currentTarget).get("waitingReason") || "",
                  );
                  if (
                    await action(() =>
                      api(
                        "tasks/" + waitingTask._id,
                        { status: "waiting", waitingReason: reason },
                        "PATCH",
                      ),
                    )
                  )
                    setWaitingTask(null);
                }}
              >
                <label>
                  Lý do chờ
                  <textarea
                    name="waitingReason"
                    required
                    maxLength={500}
                    autoFocus
                    placeholder="Đang vướng điều gì, cần ai hỗ trợ?"
                  />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setWaitingTask(null)}
                  >
                    Hủy
                  </button>
                  <button className="primary" disabled={busy}>
                    Lưu trạng thái chờ
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
        {modal && (
          <div className="modal-backdrop">
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-title"
            >
              <div className="section-title">
                <div>
                  <span className="eyebrow">KẾT NỐI CÔNG VIỆC</span>
                  <h2 id="create-title">Tạo công việc mới</h2>
                </div>
                <button
                  className="close"
                  aria-label="Đóng"
                  onClick={() => setModal(false)}
                >
                  ×
                </button>
              </div>
              <CreateTask
                departments={departments}
                users={users}
                user={user}
                busy={busy}
                error={error}
                cancel={() => setModal(false)}
                submit={async (v: Row) => {
                  let t: any;
                  const ok = await action(async () => {
                    t = await api("tasks", v);
                  });
                  if (ok) {
                    setModal(false);
                    router.push("/tasks/" + t._id);
                  }
                }}
              />
            </section>
          </div>
        )}
      </div>
    </WorkspaceContext.Provider>
  );
  function activityValue(type: string, v: any) {
    if (v === null || v === undefined) return "Chưa có";
    if (type === "status") return statusNames[v];
    if (type === "priority") return priorityNames[v];
    if (type === "assigneeId") return person(v);
    if (type === "archived") return v ? "Đã lưu trữ" : "Đang hoạt động";
    return String(v);
  }
  function renderTable(rows: Task[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Công việc</th>
              <th>Người phụ trách</th>
              <th>Trạng thái</th>
              <th>Hạn hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id}>
                <td>
                  <Link href={detailHref(t._id, currentLocation)}>
                    {t.title}
                  </Link>
                  <small>
                    {dept(t.owningDepartmentId)} · {priorityNames[t.priority]}
                  </small>
                </td>
                <td>
                  <span className="assignee">
                    <span className="avatar tiny">
                      {t.assigneeId ? person(t.assigneeId).slice(0, 1) : "?"}
                    </span>
                    {person(t.assigneeId)}
                  </span>
                </td>
                <td>
                  {!t.archivedAt && canStatus(user, t) ? (
                    <select
                      className="list-status"
                      aria-label={"Đổi trạng thái " + t.title}
                      value={t.status}
                      disabled={busy}
                      onChange={(e) => patch(t, { status: e.target.value })}
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {statusNames[s]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={"status " + t.status}>
                      {statusNames[t.status]}
                    </span>
                  )}
                </td>
                <td>
                  <span className={overdue(t) ? "overdue-date" : ""}>
                    {t.dueDate
                      ? t.dueDate.split("-").reverse().join("/")
                      : "Chưa có hạn"}
                  </span>
                  {overdue(t) && (
                    <small className="overdue-date">Quá hạn</small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="empty">
        <span>☷</span>
        <h3>Chưa có công việc</h3>
        <p>Hãy tạo công việc hoặc thay đổi bộ lọc để tiếp tục.</p>
      </div>
    );
  }
}
function CreateTask({
  departments,
  users,
  user,
  busy,
  error,
  cancel,
  submit,
}: any) {
  const [department, setDepartment] = useState(user.departmentId);
  const canAssign = user.role === "admin" || department === user.departmentId;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        submit({ ...v, assigneeId: v.assigneeId || null });
      }}
    >
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <label>
        Tiêu đề công việc
        <input
          autoFocus
          name="title"
          placeholder="Cần hoàn thành điều gì?"
          required
          maxLength={250}
        />
      </label>
      <label>
        Mô tả
        <textarea
          name="description"
          rows={3}
          placeholder="Bổ sung bối cảnh và kết quả mong muốn…"
        />
      </label>
      <div className="form-grid">
        <label>
          Phòng phụ trách
          <select
            name="owningDepartmentId"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {departments.map((d: Row) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Người phụ trách
          <select key={department} name="assigneeId" disabled={!canAssign}>
            <option value="">Chưa phân công</option>
            {canAssign &&
              users
                .filter((u: Row) => u.active && u.departmentId === department)
                .map((u: Row) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
          </select>
        </label>
        <label>
          Hạn hoàn thành
          <input type="date" name="dueDate" required />
        </label>
        <label>
          Ưu tiên
          <select name="priority" defaultValue="normal">
            {Object.entries(priorityNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!canAssign && (
        <p className="hint">
          Yêu cầu liên phòng sẽ được trưởng phòng nhận phân công.
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary" onClick={cancel}>
          Hủy
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Tạo công việc"}
        </button>
      </div>
    </form>
  );
}

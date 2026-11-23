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
  overdue,
  canManage,
  canStatus,
  canCreateTask,
} from "@/lib/model";
import WorkViews, { detailHref } from "./work-views";
import { WorkspaceContext, type CacheEntry } from "./workspace-context";
import { useQueryResource } from "./use-query-resource";
import { BrandLockup, OrganicSymbol, CorporateLogo } from "./brand";
import SideNavigation from "./side-navigation";
import Autocomplete from "./autocomplete";
import Icon from "./ui-icon";
import Dialog from "./dialog";
import TaskDetail from "./task-detail";
import NotificationBell from "./notification-bell";
import { TaskFilePicker, useTaskFiles } from "./task-files";
import { ParentTaskLinks, ReassignTask } from "./task-hierarchy";
import { ParticipantPicker } from "./task-participants";
import { TaskRowMenu, TaskRelation } from "./task-row-menu";
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
    [waitingTask, setWaitingTask] = useState<Row | null>(null),
    [completionTask, setCompletionTask] = useState<Row | null>(null);
  const actionLock = useRef(false);
  const [creationParent, setCreationParent] = useState<Row | null>(null);
  const [reassignTask, setReassignTask] = useState<Row | null>(null);
  const [archiveTask, setArchiveTask] = useState<Row | null>(null);
  const creationOrigin = useRef<{
    location: string;
    y: number;
    offset: number | null;
  } | null>(null);
  const [restorePosition, setRestorePosition] = useState<{
    taskId: string;
    expected: number;
    location: string;
    y: number;
    offset: number | null;
  } | null>(null);
  const [creationNotice, setCreationNotice] = useState("");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleParent = useCallback((id: string) => {
    setExpandedParents((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const createChild = useCallback((task: Row) => {
    const row = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-task-id="${task._id}"]`),
    ).find((element) => element.getClientRects().length);
    creationOrigin.current = {
      location: window.location.pathname + window.location.search,
      y: window.scrollY,
      offset: row?.getBoundingClientRect().top ?? null,
    };
    setCreationParent(task);
    setError("");
    setCreationNotice("");
    setModal(true);
  }, []);
  const reassign = useCallback((task: Row) => {
    setError("");
    setReassignTask(task);
  }, []);
  useEffect(() => {
    if (
      !restorePosition ||
      restorePosition.location !==
        window.location.pathname + window.location.search
    )
      return;
    let finished = false;
    const observer = new MutationObserver(restore);
    function restore() {
      if (finished) return;
      const row = Array.from(
        document.querySelectorAll<HTMLElement>(
          `[data-task-id="${restorePosition!.taskId}"][data-child-count]`,
        ),
      ).find((element) => element.getClientRects().length);
      if (!row || Number(row.dataset.childCount) < restorePosition!.expected)
        return;
      finished = true;
      observer.disconnect();
      window.scrollTo({
        top:
          restorePosition!.offset === null
            ? restorePosition!.y
            : window.scrollY +
              row.getBoundingClientRect().top -
              restorePosition!.offset,
        behavior: "instant",
      });
      setRestorePosition(null);
    }
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    const frame = requestAnimationFrame(restore);
    const timeout = setTimeout(() => {
      if (!finished) {
        window.scrollTo({ top: restorePosition.y, behavior: "instant" });
        setRestorePosition(null);
      }
    }, 4000);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [restorePosition, data]);
  useEffect(() => {
    if (!modal) setCreationParent(null);
  }, [modal]);
  const resourceCache = useRef(new Map<string, CacheEntry>()).current;
  const currentData = useRef(data);
  const updateOwnName = useCallback((name: string) => {
    setData((previous) =>
      previous
        ? {
            ...previous,
            user: { ...previous.user, name },
            users: previous.users.map((u: Row) =>
              u._id === previous.user._id ? { ...u, name } : u,
            ),
          }
        : previous,
    );
  }, []);
  currentData.current = data;
  const expire = useCallback(() => {
    setExpandedParents(new Set());
    resourceCache.clear();
    setData(null);
    setAuth(false);
    setModal(false);
    setWaitingTask(null);
    setCompletionTask(null);
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
          : path === "/profile"
            ? "profile"
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
        if (actionLock.current) return;
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
    if (actionLock.current) return false;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      setCreationNotice("Đã cập nhật công việc");
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function patch(t: Row, v: Row) {
    if (v.archived === true) {
      try {
        const info = await api("tasks/" + t._id);
        if (info.archiveImpact) {
          setArchiveTask(t);
          setError("");
          return false;
        }
      } catch (e: any) {
        setError(e.message);
        return false;
      }
    }
    if (
      v.status === "done" &&
      t.status !== "done" &&
      t.owningDepartmentId !== t.requestingDepartmentId
    ) {
      setError("");
      setCompletionTask(t);
      return false;
    }
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
  const active = all.filter((t) => !t.archivedAt && !(t.activeChildCount > 0));
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
          {queryParams.get("passwordReset") === "success" && (
            <p role="status" className="hint">
              Đã đặt lại mật khẩu và thu hồi các phiên đăng nhập. Vui lòng đăng
              nhập bằng mật khẩu mới.
            </p>
          )}
          {queryParams.get("passwordChanged") === "success" && (
            <p role="status" className="hint">
              Đã đổi mật khẩu. Vui lòng đăng nhập lại.
            </p>
          )}
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
                  path.startsWith("/tasks/") ||
                    path.startsWith("/admin") ||
                    path === "/profile"
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
      value={{
        data: data!,
        refresh,
        cache: resourceCache,
        expire,
        updateOwnName,
        createChild,
        reassign,
        change: patch,
        busy,
        expandedParents,
        toggleParent,
      }}
    >
      <div className="app">
        <SideNavigation
          user={user}
          departmentName={dept(user.departmentId)}
          myCount={
            active.filter(
              (t) => t.assigneeId === user._id && t.status !== "done",
            ).length
          }
          onLogout={() =>
            action(async () => {
              await api("logout", {});
              expire();
              router.push("/login");
            })
          }
        />
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
                      profile: "Hồ sơ của tôi",
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
              <Link
                href="/profile"
                className="avatar small"
                aria-label="Hồ sơ của tôi"
                title="Hồ sơ của tôi"
              >
                {user.name.slice(0, 1)}
              </Link>
              <NotificationBell />
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
            {creationNotice && (
              <p className="profile-success" role="status">
                {creationNotice}
              </p>
            )}
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
            {page !== "admin" && page !== "detail" && (
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
                          profile: "Hồ sơ của tôi",
                        } as Row
                      )[page]
                    }
                  </h1>
                  <p className="muted">
                    {page === "profile"
                      ? "Cập nhật thông tin cá nhân và bảo mật tài khoản."
                      : page === "progress"
                        ? "Biết đội đang làm đến đâu, đang vướng gì và việc nào cần phân công."
                        : page === "board"
                          ? "Mọi công việc, một góc nhìn. Phối hợp cùng nhau để đi xa hơn."
                          : page === "mine"
                            ? "Tập trung vào công việc của bạn, bắt đầu từ điều quan trọng nhất."
                            : "Thông tin, trao đổi và tiến độ được kết nối tại một nơi."}
                  </p>
                </div>
                {canCreateTask(user) && page !== "profile" && (
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
                            incoming: "Yêu cầu đến",
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
                            all: "Tất cả",
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
                            {canCreateTask(user) && (
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
                                <article
                                  className="task-card"
                                  key={t._id}
                                  data-task-id={t._id}
                                  data-child-count={t.activeChildCount || 0}
                                >
                                  <div className="card-top">
                                    <TaskRowMenu
                                      task={t}
                                      from={currentLocation}
                                      busy={busy}
                                    />
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
                                  <TaskRelation
                                    task={t}
                                    from={currentLocation}
                                  />
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
                <ParentTaskLinks
                  parents={boardData?.parents}
                  from={currentLocation}
                />
              </>
            )}
            {page === "detail" &&
              (detail && detail.task._id === path.split("/")[2] ? (
                <TaskDetail
                  key={detail.task._id}
                  detail={detail}
                  user={user}
                  users={users}
                  from={backPath}
                  busy={busy}
                  change={patch}
                  create={() => createChild(detail.task)}
                  reassign={reassign}
                  comment={(values) =>
                    action(() =>
                      api("tasks/" + detail.task._id + "/comments", values),
                    )
                  }
                  complete={() => {
                    setError("");
                    setCompletionTask(detail.task);
                  }}
                  person={person}
                  dept={dept}
                  activityValue={activityValue}
                />
              ) : (
                !error && <p className="empty">Đang tải chi tiết…</p>
              ))}
            {(page === "admin" || page === "profile") && children}
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
        {completionTask && (
          <CompleteTask
            task={completionTask}
            busy={busy}
            error={error}
            cancel={() => {
              if (!busy) setCompletionTask(null);
            }}
            submit={async (values: Row, upload: () => Promise<string[]>) => {
              const ok = await action(async () =>
                api(
                  "tasks/" + completionTask._id,
                  { ...values, status: "done", attachmentIds: await upload() },
                  "PATCH",
                ),
              );
              if (ok) setCompletionTask(null);
              return ok;
            }}
          />
        )}
        {reassignTask && (
          <ReassignTask
            task={reassignTask}
            users={users}
            busy={busy}
            error={error}
            close={() => {
              if (!busy) setReassignTask(null);
            }}
            submit={async (values) => {
              const ok = await action(() =>
                api("tasks/" + reassignTask._id, values, "PATCH"),
              );
              if (ok) setReassignTask(null);
              return ok;
            }}
          />
        )}
        {archiveTask && (
          <Dialog
            title="Xác nhận lưu trữ công việc con"
            busy={busy}
            returnFocus={null}
            onRequestClose={() => {
              if (!busy) setArchiveTask(null);
            }}
            footer={
              <>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setArchiveTask(null)}
                >
                  Hủy
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await action(() =>
                        api(
                          "tasks/" + archiveTask._id,
                          { archived: true, confirmArchive: true },
                          "PATCH",
                        ),
                      )
                    )
                      setArchiveTask(null);
                  }}
                >
                  Xác nhận lưu trữ
                </button>
              </>
            }
          >
            <p>
              Lưu trữ “{archiveTask.title}” sẽ khiến công việc cha đủ điều kiện
              hoàn thành. Cha sẽ tự đóng nếu không cần nghiệm thu.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
          </Dialog>
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
                  <h2 id="create-title">
                    {creationParent
                      ? "Thêm công việc con"
                      : "Tạo công việc mới"}
                  </h2>
                </div>
                <button
                  className="close"
                  aria-label="Đóng"
                  disabled={busy}
                  onClick={() => setModal(false)}
                >
                  ×
                </button>
              </div>
              <CreateTask
                parent={creationParent}
                departments={departments}
                users={users}
                user={user}
                busy={busy}
                error={error}
                cancel={() => setModal(false)}
                submit={async (v: Row, upload: () => Promise<string[]>) => {
                  let t: any;
                  const ok = await action(async () => {
                    t = await api("tasks", {
                      ...v,
                      attachmentIds: await upload(),
                    });
                  });
                  if (ok) {
                    setModal(false);
                    if (creationParent) {
                      setCreationNotice("Đã tạo công việc con");
                      if (creationOrigin.current)
                        setRestorePosition({
                          ...creationOrigin.current,
                          taskId: creationParent._id,
                          expected: (creationParent.activeChildCount || 0) + 1,
                        });
                    } else router.push("/tasks/" + t._id);
                  }
                  return ok;
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
    if (type === "reviewerId") return person(v);
    if (type === "participantIds")
      return (Array.isArray(v) ? v : []).map(person).join(", ") || "Chưa có";
    if (type === "archived") return v ? "Đã lưu trữ" : "Đang hoạt động";
    if (type === "attachmentIds")
      return (Array.isArray(v) ? v : [])
        .map(
          (fileId: string) =>
            detail?.attachments?.find((f: Row) => f._id === fileId)?.name ||
            "Tệp kết quả",
        )
        .join(", ");
    return String(v);
  }
  function renderTable(rows: Task[]) {
    return rows.length ? (
      <div className="table-wrap task-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Công việc</th>
              <th>Người phụ trách</th>
              <th>Trạng thái</th>
              <th>Ngày kết thúc</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t._id}
                data-task-id={t._id}
                data-child-count={t.activeChildCount || 0}
              >
                <td>
                  <Link href={detailHref(t._id, currentLocation)}>
                    {t.title}
                  </Link>
                  <TaskRelation task={t} from={currentLocation} />
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
                <td>
                  <TaskRowMenu task={t} from={currentLocation} busy={busy} />
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
  parent,
  departments,
  users,
  user,
  busy,
  error,
  cancel,
  submit,
}: any) {
  const [department, setDepartment] = useState(
    parent?.owningDepartmentId || user.departmentId,
  );
  const [assignee, setAssignee] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [requestId] = useState(() => crypto.randomUUID());
  const files = useTaskFiles();
  const canAssign = user.role === "admin" || department === user.departmentId;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        submit(
          {
            ...v,
            owningDepartmentId: department,
            assigneeId: v.assigneeId || null,
            requestId,
            participantIds: participants.filter(
              (personId) => personId !== assignee,
            ),
            ...(parent ? { parentTaskId: parent._id } : {}),
          },
          files.uploadAll,
        );
      }}
    >
      {parent && (
        <p>
          Công việc cha: <strong>{parent.title}</strong>
        </p>
      )}
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
        Yêu cầu và kết quả cần bàn giao
        <textarea
          name="description"
          rows={3}
          placeholder="Bổ sung bối cảnh và kết quả mong muốn…"
        />
      </label>
      <TaskFilePicker draft={files} disabled={busy} />
      <div className="form-grid">
        <label>
          Phòng phụ trách
          <Autocomplete
            name="owningDepartmentId"
            label="Phòng phụ trách"
            disabled={!!parent || user.role === "employee"}
            value={department}
            onChange={(value: string) => {
              setDepartment(value);
              setAssignee("");
              setParticipants([]);
            }}
            options={departments.map((d: Row) => ({
              value: d._id,
              label: d.name,
            }))}
          />
        </label>
        <div className="assignee-field">
          <div className="assignee-label">
            Người đảm nhận chính
            {user.active && user.departmentId === department && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setAssignee(user._id);
                  setParticipants((values) =>
                    values.filter((personId) => personId !== user._id),
                  );
                }}
              >
                Giao cho tôi
              </button>
            )}
          </div>
          <Autocomplete
            key={department}
            label="Người đảm nhận chính"
            name="assigneeId"
            value={assignee}
            onChange={(value: string) => {
              setAssignee(value);
              setParticipants((values) =>
                values.filter((personId) => personId !== value),
              );
            }}
            disabled={!canAssign}
            options={[
              { value: "", label: "Chưa phân công" },
              ...(canAssign
                ? users
                    .filter(
                      (u: Row) =>
                        u.active &&
                        u.departmentId === department &&
                        (user.role !== "employee" || u._id === user._id),
                    )
                    .map((u: Row) => ({
                      value: u._id,
                      label: u.name + (u._id === user._id ? " (Tôi)" : ""),
                    }))
                : []),
            ]}
          />
        </div>
        <label>
          Ngày bắt đầu
          <input type="date" name="startDate" required />
        </label>
        <label>
          Ngày kết thúc
          <input type="date" name="dueDate" required />
        </label>
        <label>
          Ưu tiên
          <Autocomplete
            name="priority"
            label="Ưu tiên"
            defaultValue="normal"
            options={Object.entries(priorityNames).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </label>
      </div>
      {!canAssign && (
        <p className="hint">
          Yêu cầu liên phòng sẽ được trưởng phòng nhận phân công.
        </p>
      )}
      <ParticipantPicker
        users={users}
        departmentId={department}
        assigneeId={assignee}
        value={participants}
        onChange={setParticipants}
        disabled={busy || user.role === "employee" || !canAssign}
      />
      <div className="modal-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={cancel}
        >
          Hủy
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Đang lưu…" : "Tạo công việc"}
        </button>
      </div>
    </form>
  );
}
function CompleteTask({ task, busy, error, cancel, submit }: any) {
  const files = useTaskFiles();
  const [requestId] = useState(() => crypto.randomUUID());
  const [returnFocus] = useState(
    () => document.activeElement as HTMLElement | null,
  );
  return (
    <Dialog
      title="Bàn giao kết quả"
      busy={busy}
      returnFocus={returnFocus}
      onRequestClose={cancel}
      footer={
        <>
          <button className="secondary" disabled={busy} onClick={cancel}>
            Hủy
          </button>
          <button className="primary" form="complete-task-form" disabled={busy}>
            Hoàn thành
          </button>
        </>
      }
    >
      <p>{task.title}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        id="complete-task-form"
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          submit(
            {
              requestId,
              result: values.get("result"),
              resultLinks: String(values.get("resultLinks") || "")
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            },
            files.uploadAll,
          );
        }}
      >
        <label>
          Kết quả thực hiện
          <textarea
            name="result"
            required={task.owningDepartmentId !== task.requestingDepartmentId}
            maxLength={5000}
            rows={4}
            placeholder="Giờ đóng gói, số lượng dự kiến, đầu mối Vận hành…"
            disabled={busy}
          />
        </label>
        <label>
          Liên kết tài liệu
          <textarea
            name="resultLinks"
            rows={2}
            placeholder="Mỗi dòng một liên kết http hoặc https, tối đa 5 liên kết"
            disabled={busy}
          />
        </label>
        <TaskFilePicker draft={files} disabled={busy} />
      </form>
    </Dialog>
  );
}

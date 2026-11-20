"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Dialog from "./dialog";
import { roleNames } from "@/lib/model";
type Row = Record<string, any>;
type Editor = {
  kind: "user" | "department";
  mode: "create" | "edit" | "view" | "toggle";
  record: Row;
};
type Draft = {
  name: string;
  email: string;
  password: string;
  departmentId: string;
  role: string;
  active: boolean;
};
function initial(record: Row, departmentId = ""): Draft {
  return {
    name: record.name || "",
    email: record.email || "",
    password: "",
    departmentId: record.departmentId || departmentId,
    role: record.role || "employee",
    active: record.active ?? true,
  };
}
export default function AdminConsole({
  users,
  departments,
  onSaved,
}: {
  users: Row[];
  departments: Row[];
  onSaved: () => Promise<void>;
}) {
  const path = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const kind = path === "/admin/departments" ? "department" : "user";
  const [editor, setEditor] = useState<Editor | null>(null),
    [draft, setDraft] = useState<Draft>(initial({})),
    [baseline, setBaseline] = useState(""),
    [discard, setDiscard] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(""),
    [menu, setMenu] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null),
    savingLock = useRef(false);
  const query = params.toString();
  const depName = (id: string) =>
    departments.find((d) => d._id === id)?.name || "Phòng không còn tồn tại";
  const rows = (kind === "user" ? users : departments).filter((row) => {
    const q = (params.get("q") || "").trim().toLocaleLowerCase("vi");
    return (
      (!q ||
        (row.name + " " + (row.email || row.code || ""))
          .toLocaleLowerCase("vi")
          .includes(q)) &&
      (kind !== "user" ||
        ((!params.get("department") ||
          row.departmentId === params.get("department")) &&
          (!params.get("role") || row.role === params.get("role")) &&
          (!params.get("active") ||
            String(row.active) ===
              (params.get("active") === "active" ? "true" : "false"))))
    );
  });
  const dirty =
    editor &&
    ["create", "edit"].includes(editor.mode) &&
    JSON.stringify(draft) !== baseline;
  function filter(values: Record<string, string>) {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(values)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    window.history.replaceState(null, "", path + (q.size ? "?" + q : ""));
  }
  function open(mode: Editor["mode"], record: Row = {}, trigger?: HTMLElement) {
    opener.current = trigger || (document.activeElement as HTMLElement);
    const value = initial(record, departments[0]?._id);
    setDraft(value);
    setBaseline(JSON.stringify(value));
    setEditor({ kind, mode, record });
    setMenu(null);
    setDiscard(false);
    setError("");
    setFields({});
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function close() {
    if (savingLock.current) return;
    if (dirty) setDiscard(true);
    else setEditor(null);
  }
  useEffect(() => {
    setMenu(null);
  }, [path, query]);
  useEffect(() => {
    if (!menu) return;
    const click = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".row-actions")) setMenu(null);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [menu]);
  function update(key: keyof Draft, value: any) {
    setDraft((d) => ({ ...d, [key]: value }));
    setFields((f) => ({ ...f, [key]: "" }));
    setError("");
  }
  async function submit() {
    if (!editor || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    setFields({});
    const scroll = window.scrollY;
    try {
      const value =
        editor.mode === "toggle"
          ? {
              kind: "user",
              _id: editor.record._id,
              name: editor.record.name,
              email: editor.record.email,
              departmentId: editor.record.departmentId,
              role: editor.record.role,
              active: !editor.record.active,
            }
          : editor.kind === "department"
            ? {
                kind: "department",
                name: draft.name,
                ...(editor.mode === "edit" ? { _id: editor.record._id } : {}),
              }
            : {
                kind: "user",
                name: draft.name,
                email: draft.email,
                departmentId: draft.departmentId,
                role: draft.role,
                active: draft.active,
                ...(editor.mode === "create"
                  ? { password: draft.password }
                  : { _id: editor.record._id }),
              };
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok) {
        setFields(result.fields || {});
        throw new Error(result.error || "Không thể lưu dữ liệu");
      }
      // Fetch the server-confirmed list before closing, keeping the current route and filters.
      const listResponse = await fetch("/api/admin");
      const fresh = await listResponse.json();
      if (!listResponse.ok)
        throw new Error(
          "Đã lưu nhưng chưa tải lại được danh sách. Hãy tải lại trang để kiểm tra.",
        );
      const saved = (
        editor.kind === "user" ? fresh.users : fresh.departments
      ).find((row: Row) => row._id === result.id);
      const matches =
        saved &&
        (!params.get("q") ||
          (saved.name + " " + (saved.email || saved.code || ""))
            .toLocaleLowerCase("vi")
            .includes(
              (params.get("q") || "").trim().toLocaleLowerCase("vi"),
            )) &&
        (editor.kind !== "user" ||
          ((!params.get("department") ||
            saved.departmentId === params.get("department")) &&
            (!params.get("role") || saved.role === params.get("role")) &&
            (!params.get("active") ||
              saved.active === (params.get("active") === "active"))));
      const message =
        editor.mode === "toggle"
          ? editor.record.active
            ? "Đã vô hiệu hóa tài khoản"
            : "Đã kích hoạt lại tài khoản"
          : editor.mode === "create"
            ? editor.kind === "user"
              ? "Đã tạo tài khoản"
              : "Đã tạo phòng ban"
            : "Đã lưu thay đổi";
      await onSaved();
      setNotice(
        message +
          (matches
            ? " thành công."
            : ". Bản ghi không còn phù hợp với bộ lọc hiện tại."),
      );
      setEditor(null);
      requestAnimationFrame(() =>
        window.scrollTo({ top: scroll, behavior: "instant" }),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }
  const title = editor
    ? discard
      ? "Bỏ thay đổi chưa lưu?"
      : editor.mode === "toggle"
        ? editor.record.active
          ? "Vô hiệu hóa tài khoản"
          : "Kích hoạt lại tài khoản"
        : (
            {
              create:
                editor.kind === "user" ? "Thêm tài khoản" : "Thêm phòng ban",
              edit:
                editor.kind === "user"
                  ? "Chỉnh sửa tài khoản"
                  : "Chỉnh sửa phòng ban",
              view:
                editor.kind === "user"
                  ? "Chi tiết tài khoản"
                  : "Chi tiết phòng ban",
            } as Row
          )[editor.mode]
    : "";
  function field(label: string, key: keyof Draft, input: React.ReactNode) {
    return (
      <label className="crud-field">
        {label}
        {input}
        {fields[key] && (
          <span className="field-error" id={"error-" + key}>
            {fields[key]}
          </span>
        )}
      </label>
    );
  }
  function inputProps(key: keyof Draft) {
    return {
      "aria-invalid": Boolean(fields[key]),
      "aria-describedby": fields[key] ? "error-" + key : undefined,
    };
  }
  return (
    <section className="admin-console">
      <div className="admin-list-heading">
        <div>
          <h1>{kind === "user" ? "Tài khoản" : "Phòng ban"}</h1>
          <p className="muted">
            {kind === "user"
              ? "Quản lý tài khoản, phân quyền và quyền truy cập hệ thống."
              : "Quản lý danh mục phòng ban với mã định danh ổn định."}
          </p>
        </div>
        <button
          className="primary"
          onClick={(e) => open("create", {}, e.currentTarget)}
        >
          ＋ {kind === "user" ? "Thêm tài khoản" : "Thêm phòng ban"}
        </button>
      </div>
      {notice && (
        <div className="success-notice" role="status">
          {notice}
          <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      <div className="admin-filters">
        <label>
          Tìm kiếm
          <input
            aria-label={kind === "user" ? "Tìm tài khoản" : "Tìm phòng ban"}
            placeholder={
              kind === "user"
                ? "Tìm theo tên hoặc email…"
                : "Tìm theo tên hoặc mã phòng…"
            }
            value={params.get("q") || ""}
            onChange={(e) => filter({ q: e.target.value })}
          />
        </label>
        {kind === "user" && (
          <>
            <label>
              Phòng ban
              <select
                aria-label="Lọc phòng ban"
                value={params.get("department") || ""}
                onChange={(e) => filter({ department: e.target.value })}
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option value={d._id} key={d._id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vai trò
              <select
                aria-label="Lọc vai trò"
                value={params.get("role") || ""}
                onChange={(e) => filter({ role: e.target.value })}
              >
                <option value="">Tất cả vai trò</option>
                {Object.entries(roleNames).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select
                aria-label="Lọc trạng thái"
                value={params.get("active") || ""}
                onChange={(e) => filter({ active: e.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Đã vô hiệu hóa</option>
              </select>
            </label>
          </>
        )}
        {query && (
          <button
            className="secondary"
            onClick={() => router.replace(path, { scroll: false })}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
      <div className="admin-result-count">
        {rows.length} {kind === "user" ? "tài khoản" : "phòng ban"}
      </div>
      <div className="admin-table panel">
        <table>
          <thead>
            <tr>
              <th>{kind === "user" ? "Họ tên" : "Tên phòng ban"}</th>
              {kind === "user" ? (
                <>
                  <th>Email</th>
                  <th>Phòng ban</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                </>
              ) : (
                <th>Mã phòng</th>
              )}
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} data-record-id={row._id}>
                <td data-label={kind === "user" ? "Họ tên" : "Tên phòng ban"}>
                  <span className="record-name">
                    {kind === "user" && (
                      <span className="avatar small">
                        {row.name.slice(0, 1)}
                      </span>
                    )}
                    <strong>{row.name}</strong>
                  </span>
                </td>
                {kind === "user" ? (
                  <>
                    <td data-label="Email">{row.email}</td>
                    <td data-label="Phòng ban">{depName(row.departmentId)}</td>
                    <td data-label="Vai trò">{roleNames[row.role]}</td>
                    <td data-label="Trạng thái">
                      <span
                        className={
                          row.active ? "active-label" : "inactive-label"
                        }
                      >
                        {row.active ? "Hoạt động" : "Đã vô hiệu hóa"}
                      </span>
                    </td>
                  </>
                ) : (
                  <td data-label="Mã phòng">
                    <code>{row.code}</code>
                  </td>
                )}
                <td className="row-actions">
                  <button
                    className="row-menu-trigger secondary"
                    aria-label={"Thao tác " + row.name}
                    aria-haspopup="menu"
                    aria-expanded={menu === row._id}
                    onClick={(e) => {
                      setMenu(menu === row._id ? null : row._id);
                      const button = e.currentTarget;
                      requestAnimationFrame(() =>
                        button.parentElement
                          ?.querySelector<HTMLElement>('[role="menuitem"]')
                          ?.focus(),
                      );
                    }}
                  >
                    •••
                  </button>
                  {menu === row._id && (
                    <div
                      role="menu"
                      aria-label={"Thao tác " + row.name}
                      onKeyDown={(e) => {
                        const items = Array.from(
                          e.currentTarget.querySelectorAll<HTMLButtonElement>(
                            '[role="menuitem"]',
                          ),
                        );
                        const index = items.indexOf(
                          document.activeElement as HTMLButtonElement,
                        );
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setMenu(null);
                          e.currentTarget.parentElement
                            ?.querySelector<HTMLButtonElement>(
                              ".row-menu-trigger",
                            )
                            ?.focus();
                        }
                        if (
                          ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                            e.key,
                          )
                        ) {
                          e.preventDefault();
                          items[
                            e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? items.length - 1
                                : (index +
                                    (e.key === "ArrowDown" ? 1 : -1) +
                                    items.length) %
                                  items.length
                          ]?.focus();
                        }
                        if (e.key === "Tab") setMenu(null);
                      }}
                    >
                      {[
                        ["view", "Xem chi tiết"],
                        ["edit", "Chỉnh sửa"],
                        ...(kind === "user"
                          ? [
                              [
                                "toggle",
                                row.active ? "Vô hiệu hóa" : "Kích hoạt lại",
                              ],
                            ]
                          : []),
                      ].map(([mode, label]) => (
                        <button
                          role="menuitem"
                          key={mode}
                          onClick={(e) =>
                            open(
                              mode as Editor["mode"],
                              row,
                              e.currentTarget
                                .closest(".row-actions")
                                ?.querySelector(
                                  ".row-menu-trigger",
                                ) as HTMLElement,
                            )
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">
            <h2>
              Không tìm thấy {kind === "user" ? "tài khoản" : "phòng ban"} phù
              hợp
            </h2>
            <p>Thử thay đổi hoặc xóa bộ lọc.</p>
          </div>
        )}
      </div>
      {editor && (
        <Dialog
          title={title}
          alert={discard || editor.mode === "toggle"}
          busy={saving}
          returnFocus={opener.current}
          focusKey={editor.mode + String(discard)}
          onRequestClose={discard ? () => setDiscard(false) : close}
          footer={
            discard ? (
              <>
                <button
                  className="secondary"
                  onClick={() => setDiscard(false)}
                  data-initial-focus
                >
                  Tiếp tục chỉnh sửa
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setDiscard(false);
                    setEditor(null);
                  }}
                >
                  Bỏ thay đổi
                </button>
              </>
            ) : editor.mode === "view" ? (
              <>
                <button type="button" className="secondary" onClick={close}>
                  Đóng
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    setEditor({ ...editor, mode: "edit" });
                    setError("");
                  }}
                >
                  Chỉnh sửa
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="secondary"
                  disabled={saving}
                  onClick={close}
                >
                  Hủy
                </button>
                <button
                  className={
                    editor.mode === "toggle" && editor.record.active
                      ? "danger"
                      : "primary"
                  }
                  disabled={saving}
                  type={editor.mode === "toggle" ? "button" : "submit"}
                  form={editor.mode === "toggle" ? undefined : "crud-form"}
                  onClick={
                    editor.mode === "toggle" ? () => submit() : undefined
                  }
                >
                  {saving
                    ? "Đang lưu…"
                    : editor.mode === "toggle"
                      ? editor.record.active
                        ? "Vô hiệu hóa"
                        : "Kích hoạt lại"
                      : editor.mode === "create"
                        ? editor.kind === "user"
                          ? "Tạo tài khoản"
                          : "Tạo phòng ban"
                        : "Lưu thay đổi"}
                </button>
              </>
            )
          }
        >
          {discard ? (
            <p id="crud-confirm-message">
              Thông tin đã chỉnh sửa chưa được lưu. Bạn có muốn bỏ thay đổi và
              đóng form?
            </p>
          ) : editor.mode === "view" ? (
            <dl className="record-details">
              <dt>{editor.kind === "user" ? "Họ tên" : "Tên phòng ban"}</dt>
              <dd>{editor.record.name}</dd>
              {editor.kind === "user" ? (
                <>
                  <dt>Email</dt>
                  <dd>{editor.record.email}</dd>
                  <dt>Phòng ban</dt>
                  <dd>{depName(editor.record.departmentId)}</dd>
                  <dt>Vai trò</dt>
                  <dd>{roleNames[editor.record.role]}</dd>
                  <dt>Trạng thái</dt>
                  <dd>
                    {editor.record.active ? "Hoạt động" : "Đã vô hiệu hóa"}
                  </dd>
                </>
              ) : (
                <>
                  <dt>Mã phòng</dt>
                  <dd>{editor.record.code}</dd>
                </>
              )}
              <dt>Định danh</dt>
              <dd>
                <code>{editor.record._id}</code>
              </dd>
            </dl>
          ) : editor.mode === "toggle" ? (
            <>
              <p id="crud-confirm-message">
                {editor.record.active ? "Vô hiệu hóa" : "Kích hoạt lại"} tài
                khoản <strong>{editor.record.name}</strong> (
                {editor.record.email})?
                {editor.record.active
                  ? " Tài khoản sẽ mất quyền truy cập ở yêu cầu tiếp theo và không thể đăng nhập lại."
                  : " Tài khoản có thể đăng nhập và sử dụng quyền đã được gán."}
              </p>
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
            </>
          ) : (
            <form
              id="crud-form"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {error && (
                <div role="alert" className="error">
                  {error}
                </div>
              )}
              {field(
                editor.kind === "user" ? "Họ tên" : "Tên phòng ban",
                "name",
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={250}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                  {...inputProps("name")}
                />,
              )}
              {editor.kind === "user" ? (
                <>
                  {field(
                    "Email",
                    "email",
                    <input
                      name="email"
                      type="email"
                      required
                      value={draft.email}
                      onChange={(e) => update("email", e.target.value)}
                      {...inputProps("email")}
                    />,
                  )}
                  {editor.mode === "create" &&
                    field(
                      "Mật khẩu khởi tạo",
                      "password",
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        minLength={10}
                        maxLength={200}
                        required
                        value={draft.password}
                        onChange={(e) => update("password", e.target.value)}
                        {...inputProps("password")}
                      />,
                    )}
                  <div className="form-grid">
                    {field(
                      "Phòng ban",
                      "departmentId",
                      <select
                        name="departmentId"
                        aria-label="Phòng ban"
                        value={draft.departmentId}
                        onChange={(e) => update("departmentId", e.target.value)}
                        required
                        {...inputProps("departmentId")}
                      >
                        <option value="">Chọn phòng ban</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>,
                    )}
                    {field(
                      "Vai trò",
                      "role",
                      <select
                        name="role"
                        aria-label="Vai trò"
                        value={draft.role}
                        onChange={(e) => update("role", e.target.value)}
                        {...inputProps("role")}
                      >
                        {Object.entries(roleNames).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>,
                    )}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      disabled={editor.mode === "edit"}
                      checked={draft.active}
                      onChange={(e) => update("active", e.target.checked)}
                    />
                    Tài khoản hoạt động
                  </label>
                  {editor.mode === "edit" && (
                    <p className="hint">
                      Dùng menu tài khoản để vô hiệu hóa hoặc kích hoạt lại có
                      xác nhận.
                    </p>
                  )}
                </>
              ) : editor.mode === "edit" ? (
                <p className="hint">
                  Mã phòng: <strong>{editor.record.code}</strong> — được giữ
                  nguyên khi đổi tên.
                </p>
              ) : (
                <p className="hint">
                  Mã phòng ban được hệ thống tạo tự động khi lưu.
                </p>
              )}
            </form>
          )}
        </Dialog>
      )}
    </section>
  );
}

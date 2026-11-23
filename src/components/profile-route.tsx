"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "./dialog";
import { useWorkspace } from "./workspace-context";
import { roleNames } from "@/lib/model";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "@/lib/password-policy";
type Row = Record<string, any>;
export default function ProfileRoute() {
  const { data, expire, updateOwnName } = useWorkspace();
  const router = useRouter();
  const [profile, setProfile] = useState<Row | null>(null),
    [name, setName] = useState(""),
    [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null),
    lock = useRef(false);
  const expired = useCallback(() => {
    expire();
    router.replace("/login");
  }, [expire, router]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (response.status === 401) {
        expired();
        return;
      }
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Không tải được hồ sơ");
      setProfile(value);
      setName(value.name);
      setPhone(value.phone || "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [expired]);
  useEffect(() => {
    load();
  }, [load, data.user._id]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    setFields({});
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      if (response.status === 401) {
        expired();
        return;
      }
      const value = await response.json();
      if (!response.ok) {
        setFields(value.fields || {});
        throw new Error(value.error || "Không lưu được hồ sơ");
      }
      setProfile(value);
      setName(value.name);
      setPhone(value.phone);
      updateOwnName(value.name);
      setNotice("Đã cập nhật hồ sơ");
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  function edit(key: "name" | "phone", value: string) {
    if (key === "name") setName(value);
    else setPhone(value);
    setFields((old) => ({ ...old, [key]: "" }));
    setError("");
    setNotice("");
  }
  if (loading)
    return (
      <p role="status" className="query-loading">
        Đang tải hồ sơ…
      </p>
    );
  if (!profile)
    return (
      <div role="alert" className="error">
        {error}
        <button className="secondary" onClick={load}>
          Thử lại
        </button>
      </div>
    );
  return (
    <div className="profile-layout">
      <section
        className="panel profile-personal"
        aria-labelledby="personal-title"
      >
        <div className="profile-summary">
          <span className="avatar">{profile.name.slice(0, 1)}</span>
          <div>
            <h2 id="personal-title">Thông tin cá nhân</h2>
            <p className="muted">Thông tin hiển thị cho tài khoản của bạn.</p>
          </div>
        </div>
        {notice && (
          <p className="profile-success" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <form onSubmit={save} aria-label="Thông tin cá nhân">
          <label htmlFor="profile-name">Họ và tên</label>
          <input
            id="profile-name"
            name="name"
            autoComplete="name"
            required
            maxLength={250}
            value={name}
            disabled={saving}
            onChange={(e) => edit("name", e.target.value)}
            aria-invalid={!!fields.name}
            aria-describedby={fields.name ? "profile-name-error" : undefined}
          />
          {fields.name && (
            <small id="profile-name-error" className="field-error">
              {fields.name}
            </small>
          )}
          <label htmlFor="profile-phone">Số điện thoại liên hệ</label>
          <input
            id="profile-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            value={phone}
            disabled={saving}
            onChange={(e) => edit("phone", e.target.value)}
            aria-invalid={!!fields.phone}
            aria-describedby={
              fields.phone ? "profile-phone-error" : "profile-phone-hint"
            }
          />
          {fields.phone ? (
            <small id="profile-phone-error" className="field-error">
              {fields.phone}
            </small>
          ) : (
            <small id="profile-phone-hint" className="hint">
              Tùy chọn, chỉ hiển thị trong hồ sơ của bạn. Để trống để xóa.
            </small>
          )}
          <div className="profile-readonly">
            <label>
              Email đăng nhập
              <input readOnly value={profile.email} autoComplete="username" />
            </label>
            <label>
              Phòng ban
              <input readOnly value={profile.departmentName} />
            </label>
            <label>
              Vai trò
              <input readOnly value={roleNames[profile.role]} />
            </label>
          </div>
          <p className="hint">
            Thông tin tổ chức được cập nhật qua quản trị viên.
          </p>
          <button className="primary" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </form>
      </section>
      <section
        className="panel profile-security"
        aria-labelledby="security-title"
      >
        <h2 id="security-title">Bảo mật</h2>
        <p>
          Đổi mật khẩu để bảo vệ tài khoản. Sau khi đổi, bạn cần đăng nhập lại
          trên các thiết bị.
        </p>
        <p className="hint">
          Mật khẩu từ {PASSWORD_MIN_LENGTH} đến {PASSWORD_MAX_LENGTH} ký tự.
        </p>
        <button
          ref={opener}
          className="secondary"
          onClick={() => setPasswordOpen(true)}
        >
          Đổi mật khẩu
        </button>
      </section>
      {passwordOpen && (
        <PasswordDialog
          email={profile.email}
          returnFocus={opener.current}
          close={() => setPasswordOpen(false)}
          expired={expired}
          changed={() => {
            setPasswordOpen(false);
            expire();
            router.replace("/login?passwordChanged=success");
          }}
        />
      )}
    </div>
  );
}
function PasswordDialog({
  email,
  returnFocus,
  close,
  expired,
  changed,
}: {
  email: string;
  returnFocus: HTMLElement | null;
  close: () => void;
  expired: () => void;
  changed: () => void;
}) {
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [visible, setVisible] = useState<Record<string, boolean>>({}),
    [fields, setFields] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const lock = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setError("");
    setFields({});
    try {
      const response = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.status === 401) {
        expired();
        return;
      }
      const value = await response.json();
      if (!response.ok) {
        setFields(value.fields || {});
        throw new Error(value.error || "Không đổi được mật khẩu");
      }
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      changed();
    } catch (e: any) {
      setError(e.message);
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  const labels = {
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    confirmPassword: "Nhập lại mật khẩu mới",
  };
  return (
    <Dialog
      title="Đổi mật khẩu"
      returnFocus={returnFocus}
      busy={saving}
      onRequestClose={close}
      footer={
        <>
          <button className="secondary" disabled={saving} onClick={close}>
            Hủy
          </button>
          <button
            className="primary"
            form="change-own-password"
            disabled={saving}
          >
            {saving ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
        </>
      }
    >
      <p>
        Nhập mật khẩu hiện tại để xác nhận. Mọi phiên đăng nhập sẽ được thu hồi
        sau khi đổi thành công.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form id="change-own-password" onSubmit={submit}>
        <input
          type="hidden"
          name="username"
          value={email}
          autoComplete="username"
        />
        {(Object.keys(labels) as (keyof typeof values)[]).map((key) => (
          <div className="password-field" key={key}>
            <label htmlFor={"own-" + key}>{labels[key]}</label>
            <div className="password-control">
              <input
                id={"own-" + key}
                data-initial-focus={key === "currentPassword" ? "" : undefined}
                name={key}
                type={visible[key] ? "text" : "password"}
                autoComplete={
                  key === "currentPassword"
                    ? "current-password"
                    : "new-password"
                }
                required
                minLength={
                  key === "currentPassword" ? undefined : PASSWORD_MIN_LENGTH
                }
                maxLength={PASSWORD_MAX_LENGTH}
                value={values[key]}
                disabled={saving}
                onChange={(e) => {
                  setValues((previous) => ({
                    ...previous,
                    [key]: e.target.value,
                  }));
                  setFields((previous) => ({ ...previous, [key]: "" }));
                  setError("");
                }}
                aria-invalid={!!fields[key]}
                aria-describedby={fields[key] ? "error-" + key : undefined}
              />
              <button
                type="button"
                className="secondary"
                disabled={saving}
                aria-label={
                  (visible[key] ? "Ẩn " : "Hiện ") +
                  labels[key].toLocaleLowerCase("vi")
                }
                aria-pressed={!!visible[key]}
                onClick={() =>
                  setVisible((previous) => ({
                    ...previous,
                    [key]: !previous[key],
                  }))
                }
              >
                {visible[key] ? "Ẩn" : "Hiện"}
              </button>
            </div>
            {fields[key] && (
              <small className="field-error" id={"error-" + key}>
                {fields[key]}
              </small>
            )}
          </div>
        ))}
        <p className="hint">
          Mật khẩu mới từ {PASSWORD_MIN_LENGTH} đến {PASSWORD_MAX_LENGTH} ký tự
          và khác mật khẩu hiện tại.
        </p>
      </form>
    </Dialog>
  );
}

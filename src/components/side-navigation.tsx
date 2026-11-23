"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandLockup, OrganicSymbol } from "./brand";
import { roleNames } from "@/lib/model";
import Icon from "./ui-icon";
type Row = Record<string, any>;
export default function SideNavigation({
  user,
  myCount,
  onLogout,
}: {
  user: Row;
  departmentName: string;
  myCount: number;
  onLogout: () => void;
}) {
  const path = usePathname(),
    query = useSearchParams();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const activePath = path.startsWith("/tasks/")
    ? query.get("from")?.split("?")[0] || "/board"
    : path;
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useLayoutEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const before = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const media = window.matchMedia("(min-width:681px)");
    const resize = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", resize);
    return () => {
      element.close();
      document.body.style.overflow = before;
      media.removeEventListener("change", resize);
      requestAnimationFrame(() =>
        trigger.current?.focus({ preventScroll: true }),
      );
    };
  }, [open]);
  const work = [
    { key: "mine", href: "/my-tasks", label: "Việc của tôi" },
    { key: "board", href: "/board", label: "Công việc phòng ban" },
    ...(user.role !== "employee"
      ? [{ key: "progress", href: "/progress", label: "Tiến độ" }]
      : []),
  ];
  function content() {
    return (
      <>
        <section className="nav-group">
          <h2 className="nav-label">Công việc</h2>
          <nav aria-label="Công việc">{work.map((item) => itemLink(item))}</nav>
        </section>
        {user.role === "admin" && (
          <section className="nav-group admin-nav-group">
            <h2 className="nav-label">Quản trị</h2>
            <nav aria-label="Quản trị">
              {[
                { key: "users", href: "/admin/users", label: "Tài khoản" },
                {
                  key: "departments",
                  href: "/admin/departments",
                  label: "Phòng ban",
                },
              ].map((item) => itemLink(item))}
            </nav>
          </section>
        )}
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
            <Link
              href="/profile"
              className="profile-link"
              aria-label="Hồ sơ của tôi"
              aria-current={path === "/profile" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{roleNames[user.role]}</small>
                <small>Hồ sơ của tôi</small>
              </div>
            </Link>
            <button
              className="logout"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              ⏻
            </button>
          </div>
        </div>
      </>
    );
  }
  function itemLink(item: { key: string; href: string; label: string }) {
    const selected = activePath === item.href;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-label={item.label}
        aria-current={selected ? "page" : undefined}
        className={selected ? "selected" : ""}
        onClick={() => setOpen(false)}
      >
        <Icon name={item.key} />
        {item.label}
        {item.key === "mine" && (
          <span className="nav-count" aria-hidden="true">
            {myCount}
          </span>
        )}
      </Link>
    );
  }
  return (
    <>
      <aside className="sidebar desktop-sidebar">
        <BrandLockup compact />
        {content()}
      </aside>
      <header className="mobile-app-header">
        <BrandLockup compact />
        <button
          ref={trigger}
          type="button"
          className="drawer-trigger"
          aria-label="Mở điều hướng"
          aria-haspopup="dialog"
          aria-controls="navigation-drawer"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>
      <dialog
        id="navigation-drawer"
        ref={dialog}
        className="navigation-drawer"
        aria-label="Điều hướng"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const box = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX > box.right ||
              event.clientX < box.left ||
              event.clientY < box.top ||
              event.clientY > box.bottom
            )
              setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not([disabled]),a[href]",
            ),
          ).filter((e) => e.getClientRects().length);
          const first = items[0],
            last = items.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <aside className="sidebar drawer-sidebar">
          <div className="drawer-heading">
            <BrandLockup compact />
            <button
              ref={closeButton}
              className="drawer-close"
              type="button"
              aria-label="Đóng điều hướng"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          {content()}
        </aside>
      </dialog>
    </>
  );
}

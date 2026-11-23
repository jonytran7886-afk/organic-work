"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "./workspace-context";
export default function NotificationBell() {
  const { data, expire } = useWorkspace();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState<any>({ items: [], unread: 0 }),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const load = useCallback(
    async (id?: string) => {
      try {
        const response = await fetch(
          "/api/notifications" + (id ? "/" + id : ""),
          { method: id ? "PATCH" : "GET", cache: "no-store" },
        );
        if (response.status === 401) {
          expire();
          return;
        }
        if (!response.ok)
          throw new Error("Không tải được thông báo. Vui lòng thử lại.");
        setValue(await response.json());
        setError("");
      } catch (e: any) {
        setError(e.message);
      }
    },
    [expire],
  );
  useEffect(() => {
    load();
  }, [data, load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const labels: Record<string, string> = {
    assigned: "Bạn được giao công việc",
    participating: "Bạn được thêm vào người tham gia",
    request: "Yêu cầu liên phòng mới",
    due: "Hạn hoàn thành đã thay đổi",
    completed: "Yêu cầu đã có kết quả",
  };
  return (
    <div
      ref={root}
      className="notification-bell"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          root.current?.querySelector("button")?.focus();
        }
      }}
    >
      <button
        className="secondary"
        type="button"
        aria-label={`Thông báo, ${value.unread} chưa đọc`}
        aria-expanded={open}
        onClick={() => {
          if (!open) load();
          setOpen(!open);
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" />
        </svg>
        {value.unread > 0 && <b>{value.unread}</b>}
      </button>
      {open && (
        <section
          className="notification-popover"
          aria-label="Danh sách thông báo"
        >
          <div className="section-title">
            <h3>Thông báo</h3>
            <button
              type="button"
              className="secondary"
              onClick={() => load("all")}
            >
              Đọc tất cả
            </button>
          </div>
          {error && (
            <p role="alert">
              {error} <button onClick={() => load()}>Thử lại</button>
            </p>
          )}
          {!value.items.length && (
            <p className="hint">Bạn chưa có thông báo.</p>
          )}
          <ul>
            {value.items.map((item: any) => (
              <li className={!item.readAt ? "unread" : ""} key={item._id}>
                <div>
                  <small>
                    {item.types.map((t: string) => labels[t]).join(" · ")}
                  </small>
                  <Link
                    href={"/tasks/" + item.taskId}
                    onClick={() => {
                      load(item._id);
                      setOpen(false);
                    }}
                  >
                    {item.title}
                  </Link>
                  <time>
                    {new Date(item.createdAt).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </time>
                </div>
                {!item.readAt && (
                  <button
                    type="button"
                    className="secondary"
                    aria-label={"Đánh dấu đã đọc " + item.title}
                    onClick={() => load(item._id)}
                  >
                    Đã đọc
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

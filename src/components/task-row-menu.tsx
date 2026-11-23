"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  canManage,
  canCreateSubtask,
  taskStatusActions,
  statusNames,
} from "@/lib/model";
import { detailHref } from "@/lib/work-model";
import { useWorkspace } from "./workspace-context";
type Row = Record<string, any>;
export function TaskRowMenu({
  task,
  from,
  busy = false,
}: {
  task: Row;
  from: string;
  busy?: boolean;
}) {
  const { data, createChild, reassign, change, busy: working } = useWorkspace();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const id = useId(),
    locked = busy || working;
  const manager = canManage(data.user, task);
  const allowed = manager && !task.archivedAt && task.status !== "done";
  function close(focus = false) {
    setOpen(false);
    if (focus) trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const panel = menu.current;
    panel.showPopover();
    const position = () => {
      const rect = trigger.current!.getBoundingClientRect();
      panel.style.left =
        Math.max(
          8,
          Math.min(
            rect.right - panel.offsetWidth,
            innerWidth - panel.offsetWidth - 8,
          ),
        ) + "px";
      panel.style.top =
        Math.max(
          8,
          Math.min(rect.bottom + 5, innerHeight - panel.offsetHeight - 8),
        ) + "px";
    };
    position();
    const outside = (event: PointerEvent) => {
      if (
        !panel.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      panel.hidePopover();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open]);
  useEffect(() => {
    setOpen(false);
  }, [task.updatedAt, from]);
  function run(action: () => void) {
    close(true);
    action();
  }
  return (
    <details className="subtask-actions task-row-menu" open={open}>
      <summary
        ref={trigger}
        title={"Thao tác " + task.title}
        aria-label={"Thao tác " + task.title}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const last = event.key === "ArrowUp";
            requestAnimationFrame(() => {
              const items = menu.current?.querySelectorAll<HTMLElement>(
                "a,button:not(:disabled)",
              );
              items?.[last ? items.length - 1 : 0]?.focus();
            });
          }
        }}
      >
        ⋯
      </summary>
      {open && (
        <div
          ref={menu}
          id={id}
          popover="manual"
          className="task-menu-popover"
          role="group"
          aria-label="Thao tác công việc"
          onBlur={(event) => {
            if (
              event.relatedTarget &&
              !event.currentTarget.contains(event.relatedTarget as Node)
            )
              close();
          }}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const items = Array.from(
              menu.current!.querySelectorAll<HTMLElement>(
                "a,button:not(:disabled)",
              ),
            );
            const index = items.indexOf(document.activeElement as HTMLElement);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (index +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }}
        >
          <Link href={detailHref(task._id, from)} onClick={() => close()}>
            Mở chi tiết
          </Link>
          {manager && !task.archivedAt && (
            <Link
              href={detailHref(task._id, from) + "#edit-task"}
              onClick={() => close()}
            >
              Chỉnh sửa công việc
            </Link>
          )}
          {canCreateSubtask(data.user, task) && (
            <button
              type="button"
              disabled={locked}
              onClick={() => run(() => createChild(task))}
            >
              + Thêm công việc con
            </button>
          )}
          {allowed && (
            <>
              <hr />
              <button
                type="button"
                disabled={locked}
                onClick={() => run(() => reassign(task))}
              >
                {task.assigneeId ? "Giao lại" : "Phân công"}
              </button>
            </>
          )}
          <Link
            href={detailHref(task._id, from) + "#task-history"}
            onClick={() => close()}
          >
            Xem lịch sử
          </Link>
          {manager && (
            <>
              <hr />
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  run(() => {
                    if (
                      task.archivedAt ||
                      window.confirm("Lưu trữ công việc “" + task.title + "”?")
                    )
                      void change(task, { archived: !task.archivedAt });
                  })
                }
              >
                {task.archivedAt ? "Khôi phục" : "Lưu trữ"}
              </button>
            </>
          )}
        </div>
      )}
    </details>
  );
}
export function TaskStatusDropdown({
  task,
  busy = false,
}: {
  task: Row;
  busy?: boolean;
}) {
  const { data, change, busy: working } = useWorkspace();
  const actions = taskStatusActions(data.user, task);
  return (
    <select
      className={"inline-task-status " + task.status}
      aria-label={"Trạng thái " + task.title}
      title={task.waitingReason || statusNames[task.status]}
      value={task.status}
      disabled={busy || working || !actions.length}
      onChange={(event) => {
        const status = event.currentTarget.value;
        event.currentTarget.value = task.status;
        void change(task, { status });
      }}
    >
      <option value={task.status}>{statusNames[task.status]}</option>
      {actions
        .filter((action) => action.status !== task.status)
        .map((action) => (
          <option key={action.status} value={action.status}>
            {statusNames[action.status]}
          </option>
        ))}
    </select>
  );
}
export function TaskRelation({ task, from }: { task: Row; from: string }) {
  const { data } = useWorkspace();
  const parent = task.parentTaskId
    ? data.tasks.find((row: Row) => row._id === task.parentTaskId)
    : null;
  return (
    <>
      {task.parentTaskId && (
        <span className="task-relation">
          <span className="subtask-badge">Công việc con</span>
          {parent && (
            <Link href={detailHref(parent._id, from)}>Cha: {parent.title}</Link>
          )}
        </span>
      )}
      {task.activeChildCount > 0 && (
        <Link className="child-progress" href={detailHref(task._id, from)}>
          {task.completedChildCount || 0}/{task.activeChildCount} hoàn thành
        </Link>
      )}
    </>
  );
}

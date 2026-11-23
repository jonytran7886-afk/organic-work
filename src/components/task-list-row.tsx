"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { canCreateSubtask, overdue, priorityNames } from "@/lib/model";
import { detailHref } from "@/lib/work-model";
import { useWorkspace } from "./workspace-context";
import { useQueryResource } from "./use-query-resource";
import { TaskStatusDropdown, TaskRelation, TaskRowMenu } from "./task-row-menu";
type Row = Record<string, any>;

export function TaskListHeading() {
  return (
    <div className="compact-task-heading" aria-hidden="true">
      <span>Tên công việc</span>
      <span>Trạng thái</span>
      <span>Người được giao</span>
      <span>Hạn hoàn thành</span>
      <span>Ưu tiên</span>
      <span>Menu</span>
    </div>
  );
}

export function TaskListRow({
  task,
  from,
  nested = false,
}: {
  task: Row;
  from: string;
  nested?: boolean;
}) {
  const {
    data,
    cache,
    expire,
    busy,
    createChild,
    expandedParents,
    toggleParent,
  } = useWorkspace();
  const expanded = expandedParents.has(task._id);
  const [after, setAfter] = useState("");
  const [previous, setPrevious] = useState<Row[]>([]);
  const region = useId();
  useEffect(() => {
    setAfter("");
    setPrevious([]);
  }, [data]);
  const resource = useQueryResource(
    expanded ? "/api/tasks/" + task._id + "/children?after=" + after : null,
    cache,
    data,
    expire,
  );
  const children = [...previous, ...(resource.data?.items || [])];
  const users = data.users as Row[];
  return (
    <div
      className={
        nested ? "compact-task-branch nested-task" : "compact-task-branch"
      }
    >
      <article
        className={
          "compact-task-row" + (task.activeChildCount > 0 ? "" : " work-task")
        }
        data-task-id={task._id}
        data-child-count={task.activeChildCount || 0}
      >
        <div className="compact-task-name">
          {task.activeChildCount > 0 && !nested ? (
            <button
              className="task-expand"
              type="button"
              title={(expanded ? "Thu gọn " : "Mở ") + task.title}
              aria-label={
                (expanded
                  ? "Thu gọn công việc con của "
                  : "Mở công việc con của ") + task.title
              }
              aria-expanded={expanded}
              aria-controls={region}
              onClick={() => toggleParent(task._id)}
            >
              {expanded ? "⌄" : "›"}
            </button>
          ) : (
            <span className="task-expand-spacer" />
          )}
          <div className="compact-task-title-block">
            <Link className="work-task-title" href={detailHref(task._id, from)}>
              {task.title}
            </Link>
            {task.activeChildCount > 0 ? (
              <small className="child-progress">
                {task.completedChildCount || 0}/{task.activeChildCount} hoàn
                thành
              </small>
            ) : task.parentTaskId && !nested ? (
              <TaskRelation task={task} from={from} />
            ) : null}
          </div>
        </div>
        <div className="compact-task-status">
          <TaskStatusDropdown task={task} busy={busy} />
          {task.status === "waiting" && (
            <small
              className="compact-waiting-reason waiting-note"
              title={task.waitingReason || "Chưa ghi lý do"}
            >
              {task.waitingReason || "Chưa ghi lý do"}
            </small>
          )}
        </div>
        <div
          className="compact-task-assignee"
          title={
            users.find((user) => user._id === task.assigneeId)?.name ||
            "Chưa phân công"
          }
        >
          {users.find((user) => user._id === task.assigneeId)?.name ||
            "Chưa phân công"}
        </div>
        <div
          className={
            "compact-task-date" + (overdue(task as any) ? " overdue-date" : "")
          }
        >
          <span className="mobile-field-label">Hạn: </span>
          {task.dueDate
            ? task.dueDate.split("-").reverse().join("/")
            : "Chưa có hạn"}
        </div>
        <div className="compact-task-priority">
          <span className={"priority " + task.priority}>
            {priorityNames[task.priority]}
          </span>
        </div>
        <div className="compact-task-actions">
          <TaskRowMenu task={task} from={from} busy={busy} />
        </div>
      </article>
      {expanded && (
        <section
          id={region}
          className="expanded-task-children"
          aria-label={"Công việc con của " + task.title}
          aria-busy={resource.pending}
        >
          {children.map((child: Row) => (
            <TaskListRow key={child._id} task={child} from={from} nested />
          ))}
          {resource.pending && (
            <p role="status" className="hint">
              Đang tải công việc con…
            </p>
          )}
          {resource.error && (
            <p role="alert" className="error">
              {resource.error}{" "}
              <button type="button" onClick={resource.retry}>
                Thử lại
              </button>
            </p>
          )}
          {resource.data?.nextCursor && (
            <button
              type="button"
              className="secondary"
              disabled={resource.pending}
              onClick={() => {
                setPrevious(children);
                setAfter(resource.data!.nextCursor);
              }}
            >
              Xem thêm công việc con
            </button>
          )}
          {canCreateSubtask(data.user, task) && (
            <button
              type="button"
              className="text-link"
              disabled={busy}
              onClick={() => createChild(task)}
            >
              + Thêm công việc con
            </button>
          )}
        </section>
      )}
    </div>
  );
}

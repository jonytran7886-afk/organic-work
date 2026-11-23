"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Dialog from "./dialog";
import { TaskStatusDropdown, TaskRowMenu } from "./task-row-menu";
import { canManage, canCreateSubtask } from "@/lib/model";
import { TaskListRow } from "./task-list-row";
import { detailHref } from "@/lib/work-model";
import { ParticipantPicker } from "./task-participants";
type Row = Record<string, any>;
export function ParentTaskLinks({
  parents = [],
  from,
}: {
  parents?: Row[];
  from: string;
}) {
  if (!parents.length) return null;
  return (
    <section className="parent-task-links" aria-label="Công việc cha theo dõi">
      <h3>Công việc cha theo dõi · {parents.length}</h3>
      <p className="hint">
        Tiến độ tổng hợp; không cộng thêm vào số đầu việc thực hiện.
      </p>
      {parents.map((parent) => (
        <TaskListRow key={parent._id} task={parent} from={from} />
      ))}
    </section>
  );
}
export function TaskHierarchy({
  task,
  children,
  user,
  users,
  from,
  busy,
  change,
  create,
  reassign,
}: {
  task: Row;
  children: Row[];
  user: Row;
  users: Row[];
  from: string;
  busy: boolean;
  change: (task: Row, values: Row) => Promise<boolean>;
  create: () => void;
  reassign: (task: Row) => void;
}) {
  if (task.parentTaskId) return null;
  const active = children.filter((t) => !t.archivedAt),
    done = active.filter((t) => t.status === "done").length;
  const ready = active.length > 0 && done === active.length;
  const manager = canManage(user, task);
  return (
    <section
      className="subtasks-section"
      aria-label="Công việc con"
      id="subtasks"
      data-task-id={task._id}
      data-child-count={active.length}
    >
      <div className="section-title">
        <h3>Công việc con</h3>
        {active.length > 0 && (
          <strong>
            {done}/{active.length} hoàn thành
          </strong>
        )}
        {(canCreateSubtask(user, task) ||
          (manager && task.status === "done")) &&
          !task.archivedAt &&
          (task.status === "done" ? (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => change(task, { status: "todo" })}
            >
              Mở lại để thêm việc con
            </button>
          ) : (
            <button className="secondary" disabled={busy} onClick={create}>
              + Thêm công việc con
            </button>
          ))}
      </div>
      {ready && task.reviewerId && task.status !== "done" && (
        <p className="review-ready">
          Đủ điều kiện nghiệm thu · {done}/{active.length} hoàn thành
        </p>
      )}
      {active.length > 0 && (
        <p className="hint">
          {task.reviewerId
            ? "Hoàn thành sau khi người nghiệm thu hoặc Admin xác nhận."
            : "Tự động hoàn thành khi tất cả công việc con hoàn thành."}
        </p>
      )}
      {ready &&
        task.reviewerId &&
        task.status !== "done" &&
        !task.archivedAt &&
        (user.role === "admin" || user._id === task.reviewerId) && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => change(task, { status: "done" })}
          >
            Xác nhận hoàn thành
          </button>
        )}
      {!children.length && <p className="hint">Chưa có công việc con</p>}
      <details open className="detail-child-list">
        <summary>
          Danh sách công việc con ({done}/{active.length})
        </summary>
        <div className="detail-child-heading" aria-hidden="true">
          <span>Tên</span>
          <span>Trạng thái</span>
          <span>Người được giao</span>
          <span>Hạn hoàn thành</span>
          <span>Menu</span>
        </div>
        <ul className="subtask-list detail-child-rows">
          {children.map((child) => (
            <li
              key={child._id}
              className={child.archivedAt ? "archived-subtask" : ""}
            >
              <div>
                <Link href={detailHref(child._id, from)}>{child.title}</Link>
                {child.archivedAt && <small>Đã lưu trữ</small>}
              </div>
              <TaskStatusDropdown
                task={child}
                busy={busy || !!task.archivedAt}
              />
              <span>
                {users.find((value) => value._id === child.assigneeId)?.name ||
                  "Chưa phân công"}
              </span>
              <span>{child.dueDate || "Chưa có hạn"}</span>
              <TaskRowMenu
                task={child}
                from={from}
                busy={busy || !!task.archivedAt}
              />
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
export function ReassignTask({
  task,
  users,
  busy,
  error,
  close,
  submit,
}: {
  task: Row;
  users: Row[];
  busy: boolean;
  error: string;
  close: () => void;
  submit: (values: Row) => Promise<boolean>;
}) {
  const [assignee, setAssignee] = useState(task.assigneeId || ""),
    [reason, setReason] = useState("");
  const [participants, setParticipants] = useState<string[]>(
    task.participantIds || [],
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const opener = useRef(document.activeElement as HTMLElement | null);
  return (
    <Dialog
      title={task.assigneeId ? "Giao lại công việc" : "Phân công công việc"}
      returnFocus={opener.current}
      busy={busy}
      onRequestClose={close}
      footer={
        <>
          <button className="secondary" disabled={busy} onClick={close}>
            Hủy
          </button>
          <button className="primary" form="reassign-task" disabled={busy}>
            {task.assigneeId ? "Giao lại" : "Phân công"}
          </button>
        </>
      }
    >
      <p>{task.title}</p>
      <p>
        Người đang đảm nhận:{" "}
        <strong>
          {users.find((u) => u._id === task.assigneeId)?.name ||
            "Chưa phân công"}
        </strong>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form
        id="reassign-task"
        onSubmit={(e) => {
          e.preventDefault();
          submit({
            assigneeId: assignee,
            reassignmentReason: reason,
            requestId,
            participantIds: participants.filter(
              (personId) => personId !== assignee,
            ),
          });
        }}
      >
        <label>
          Người đảm nhận chính
          <select
            required
            aria-label="Người đảm nhận chính"
            value={assignee}
            disabled={busy}
            onChange={(e) => {
              setAssignee(e.target.value);
              setParticipants((values) =>
                values.filter((personId) => personId !== e.target.value),
              );
            }}
          >
            <option value="">Chọn người đảm nhận</option>
            {users
              .filter(
                (u) => u.active && u.departmentId === task.owningDepartmentId,
              )
              .map((u) => (
                <option value={u._id} key={u._id}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <ParticipantPicker
          users={users}
          departmentId={task.owningDepartmentId}
          assigneeId={assignee}
          value={participants}
          onChange={setParticipants}
          disabled={busy}
        />
        <label>
          Lý do giao lại
          <textarea
            name="reason"
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tùy chọn"
          />
        </label>
      </form>
    </Dialog>
  );
}

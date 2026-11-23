"use client";
import { useEffect, useState } from "react";
import { canManage } from "@/lib/model";
type Row = Record<string, any>;
export function ParticipantPicker({
  users,
  departmentId,
  assigneeId,
  value,
  onChange,
  disabled = false,
}: {
  users: Row[];
  departmentId: string;
  assigneeId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value.filter((personId) => personId !== assigneeId));
  const options = users.filter(
    (user) =>
      user._id !== assigneeId &&
      ((user.active && user.departmentId === departmentId) ||
        selected.has(user._id)),
  );
  return (
    <fieldset className="participant-picker" disabled={disabled}>
      <legend>Người tham gia</legend>
      <p className="hint">
        Chọn nhiều người trong phòng phụ trách. Mỗi việc có một người đảm nhận
        chính.
      </p>
      <div className="participant-options">
        {options.map((person) => (
          <label className="check" key={person._id}>
            <input
              type="checkbox"
              checked={selected.has(person._id)}
              disabled={
                !selected.has(person._id) &&
                (!person.active || person.departmentId !== departmentId)
              }
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(person._id);
                else next.delete(person._id);
                onChange([...next]);
              }}
            />
            {person.name}
            {(!person.active || person.departmentId !== departmentId) && (
              <small> (không còn đủ điều kiện)</small>
            )}
          </label>
        ))}
        {!options.length && (
          <p className="hint">Không có người tham gia đủ điều kiện.</p>
        )}
      </div>
    </fieldset>
  );
}
export function TaskParticipants({
  task,
  users,
  user,
  busy,
  change,
}: {
  task: Row;
  users: Row[];
  user: Row;
  busy: boolean;
  change: (task: Row, values: Row) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<string[]>(task.participantIds || []);
  useEffect(() => {
    setSelected(task.participantIds || []);
  }, [task._id, task.updatedAt]);
  return (
    <section
      className="task-participants"
      aria-label="Người tham gia công việc"
    >
      <h3>Người tham gia</h3>
      <p>
        {(task.participantIds || [])
          .map(
            (personId: string) =>
              users.find((person) => person._id === personId)?.name ||
              "Tài khoản không còn trong danh sách",
          )
          .join(", ") || "Chưa có người tham gia"}
      </p>
      {canManage(user, task) &&
        !task.archivedAt &&
        (editing ? (
          <>
            <ParticipantPicker
              users={users}
              departmentId={task.owningDepartmentId}
              assigneeId={task.assigneeId || ""}
              value={selected}
              onChange={setSelected}
              disabled={busy}
            />
            <div className="participant-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setSelected(task.participantIds || []);
                  setEditing(false);
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await change(task, { participantIds: selected }))
                    setEditing(false);
                }}
              >
                Lưu người tham gia
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Quản lý người tham gia
          </button>
        ))}
    </section>
  );
}

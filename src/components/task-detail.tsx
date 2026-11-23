"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { canManage, canStatus, canView, priorityNames } from "@/lib/model";
import { detailHref, waitingLabel } from "@/lib/work-model";
import { TaskRowMenu, TaskStatusDropdown } from "./task-row-menu";
import { TaskHierarchy } from "./task-hierarchy";
import { TaskAttachments } from "./task-files";
import { TaskParticipants } from "./task-participants";

type Row = Record<string, any>;
const activityNames: Record<string, string> = {
  created: "đã tạo công việc",
  status: "đã đổi trạng thái",
  waitingReason: "đã cập nhật lý do chờ",
  assigneeId: "đã đổi người phụ trách",
  startDate: "đã sửa ngày bắt đầu",
  dueDate: "đã sửa ngày hạn",
  title: "đã sửa tiêu đề",
  description: "đã sửa mô tả",
  priority: "đã đổi ưu tiên",
  archived: "đã thay đổi lưu trữ",
  result: "đã bàn giao kết quả",
  resultLinks: "đã thêm liên kết kết quả",
  attachmentIds: "đã đính kèm tệp kết quả",
  reviewerId: "đã đổi người nghiệm thu",
  participantIds: "đã cập nhật người tham gia",
};
const tabs = ["Hoạt động", "Tệp đính kèm", "Kết quả thực hiện"];
export default function TaskDetail({
  detail,
  user,
  users,
  from,
  busy,
  change,
  create,
  reassign,
  comment,
  complete,
  person,
  dept,
  activityValue,
}: {
  detail: Row;
  user: Row;
  users: Row[];
  from: string;
  busy: boolean;
  change: (task: Row, values: Row) => Promise<boolean>;
  create: () => void;
  reassign: (task: Row) => void;
  comment: (values: Row) => Promise<boolean>;
  complete: () => void;
  person: (id: any) => string;
  dept: (id: any) => string;
  activityValue: (type: string, value: any) => string;
}) {
  const task = detail.task;
  const [tab, setTab] = useState(0),
    [filter, setFilter] = useState("all");
  const editor = useRef<HTMLDetailsElement>(null);
  const properties = useRef<HTMLDetailsElement>(null);
  const [draft, setDraft] = useState("");
  const editable = canManage(user, task) && !task.archivedAt;
  const canComplete =
    !task.archivedAt &&
    !task.activeChildCount &&
    task.status !== "done" &&
    canStatus(user, task);
  useEffect(() => {
    if (properties.current && matchMedia("(max-width: 800px)").matches)
      properties.current.open = false;
    const navigate = () => {
      if (location.hash === "#task-history") {
        setTab(0);
        setFilter("history");
      }
      if (location.hash === "#edit-task" && editor.current)
        editor.current.open = true;
    };
    navigate();
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const timeline = [
    ...(detail.comments || []).map((value: Row) => ({
      kind: "comment",
      value,
    })),
    ...(detail.activities || []).map((value: Row) => ({
      kind: "history",
      value,
    })),
  ]
    .filter((entry) => filter === "all" || entry.kind === filter)
    .sort(
      (a, b) =>
        new Date(b.value.createdAt).getTime() -
          new Date(a.value.createdAt).getTime() ||
        String(b.value._id).localeCompare(String(a.value._id)),
    );
  const date = (value: any) =>
    new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return (
    <div
      className="task-detail-view"
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest("a");
        if (!link) return;
        const target = new URL(link.href);
        if (target.pathname !== location.pathname) return;
        if (target.hash === "#task-history") {
          setTab(0);
          setFilter("history");
        }
        if (target.hash === "#edit-task" && editor.current)
          editor.current.open = true;
      }}
    >
      <nav className="detail-breadcrumb" aria-label="Điều hướng công việc">
        <Link className="back-link" href={from}>
          ‹ Quay lại danh sách
        </Link>
        {detail.parent && (
          <Link
            className="parent-task-backlink"
            href={detailHref(detail.parent._id, from)}
          >
            Công việc cha: {detail.parent.title}
          </Link>
        )}
      </nav>
      <div className="task-detail-grid">
        <header className="panel task-detail-header">
          <div className="detail-header-top">
            <span className="task-code">
              OW-{task._id.slice(-4).toUpperCase()}
            </span>
            {task.archivedAt && <span className="late-label">Đã lưu trữ</span>}
            <TaskRowMenu task={task} from={from} busy={busy} />
          </div>
          <h1 className="detail-title">{task.title}</h1>
          <div className="detail-header-fields">
            <TaskStatusDropdown task={task} busy={busy} />
            <span className={"priority " + task.priority}>
              {priorityNames[task.priority]}
            </span>
            {task.dueDate && (
              <span>Hạn: {task.dueDate.split("-").reverse().join("/")}</span>
            )}
          </div>
          {task.status === "waiting" && (
            <p className="waiting-note">{waitingLabel(task)}</p>
          )}
        </header>
        <div className="task-detail-content">
          <section className="panel detail-description">
            <h2>Mô tả công việc</h2>
            <p className="description">
              {task.description || "Chưa có mô tả."}
            </p>
            {editable && (
              <details ref={editor} id="edit-task" className="detail-editor">
                <summary>Chỉnh sửa tiêu đề và mô tả</summary>
                <form
                  key={task.updatedAt}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const values = Object.fromEntries(
                      new FormData(event.currentTarget),
                    );
                    if ((await change(task, values)) && editor.current)
                      editor.current.open = false;
                  }}
                >
                  <label>
                    Tiêu đề
                    <input
                      name="title"
                      defaultValue={task.title}
                      required
                      maxLength={250}
                    />
                  </label>
                  <label>
                    Mô tả
                    <textarea
                      name="description"
                      defaultValue={task.description}
                      rows={3}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    Lưu thay đổi
                  </button>
                </form>
              </details>
            )}
          </section>
          {!task.parentTaskId && (
            <div className="panel detail-subtasks">
              <TaskHierarchy
                task={task}
                children={detail.children || []}
                user={user}
                users={users}
                from={from}
                busy={busy}
                change={change}
                create={create}
                reassign={reassign}
              />
            </div>
          )}
          <section className="panel detail-tabs">
            <div
              role="tablist"
              aria-label="Nội dung công việc"
              className="detail-tablist"
            >
              {tabs.map((name, index) => (
                <button
                  key={name}
                  id={"detail-tab-" + index}
                  type="button"
                  role="tab"
                  aria-selected={tab === index}
                  aria-controls={"detail-panel-" + index}
                  tabIndex={tab === index ? 0 : -1}
                  onClick={() => setTab(index)}
                  onKeyDown={(event) => {
                    if (
                      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    )
                      return;
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : (index +
                              (event.key === "ArrowRight" ? 1 : -1) +
                              3) %
                            3;
                    setTab(next);
                    document.getElementById("detail-tab-" + next)?.focus();
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={"detail-panel-" + tab}
              aria-labelledby={"detail-tab-" + tab}
              tabIndex={0}
            >
              {tab === 0 && (
                <div className="detail-activity" id="task-history">
                  {!task.archivedAt && (
                    <form
                      className="detail-comment-form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        if (
                          await comment(Object.fromEntries(new FormData(form)))
                        ) {
                          form.reset();
                          setDraft("");
                        }
                      }}
                    >
                      <label>
                        Bình luận
                        <textarea
                          name="body"
                          aria-label="Bình luận"
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          required
                          maxLength={5000}
                          rows={2}
                          placeholder="Viết trao đổi của bạn…"
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Gửi bình luận
                      </button>
                    </form>
                  )}
                  <div
                    className="detail-activity-filters"
                    role="group"
                    aria-label="Lọc hoạt động"
                  >
                    {[
                      ["all", "Tất cả"],
                      ["comment", "Bình luận"],
                      ["history", "Lịch sử"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {!timeline.length && (
                    <p className="hint">Chưa có hoạt động.</p>
                  )}
                  <div className="detail-timeline">
                    {timeline.map(({ kind, value: item }) => (
                      <article
                        className={kind === "comment" ? "comment" : "activity"}
                        key={kind + item._id}
                      >
                        <span className="avatar small">
                          {person(
                            kind === "comment" ? item.authorId : item.actorId,
                          ).slice(0, 1)}
                        </span>
                        <div>
                          <strong>
                            {person(
                              kind === "comment" ? item.authorId : item.actorId,
                            )}
                          </strong>
                          {kind === "history" &&
                            " " +
                              (activityNames[item.type] ||
                                "đã cập nhật công việc")}
                          <time>{date(item.createdAt)}</time>
                          {kind === "comment" ? (
                            <p>{item.body}</p>
                          ) : (
                            <>
                              {!["created", "description"].includes(
                                item.type,
                              ) && (
                                <p>
                                  {activityValue(item.type, item.before)} →{" "}
                                  {activityValue(item.type, item.after)}
                                </p>
                              )}
                              {item.reason && (
                                <p>Lý do giao lại: {item.reason}</p>
                              )}
                              {item.source === "subtasks" && (
                                <small>Tự động từ công việc con</small>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {tab === 1 && (
                <>
                  <TaskAttachments files={detail.attachments || []} />
                  {canComplete && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={complete}
                    >
                      Thêm tệp khi bàn giao kết quả
                    </button>
                  )}
                </>
              )}
              {tab === 2 && (
                <section className="handover-results">
                  {canComplete && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={complete}
                    >
                      Bàn giao kết quả
                    </button>
                  )}
                  {!(task.handovers || []).length && (
                    <p className="hint">Chưa có kết quả bàn giao.</p>
                  )}
                  {(task.handovers || []).map(
                    (handover: Row, index: number) => (
                      <article key={handover.eventId || index}>
                        <strong>{person(handover.completedById)}</strong>
                        <time>{date(handover.completedAt)}</time>
                        <p>{handover.result || "Đã hoàn thành"}</p>
                        {(handover.links || []).map((link: string) => (
                          <p key={link}>
                            <a href={link} target="_blank" rel="noreferrer">
                              {link}
                            </a>
                          </p>
                        ))}
                        {(handover.attachmentIds || []).map((id: string) => (
                          <p key={id}>
                            <a href={"/api/files/" + id}>
                              {detail.attachments?.find(
                                (file: Row) => file._id === id,
                              )?.name || "Tệp kết quả"}
                            </a>
                          </p>
                        ))}
                      </article>
                    ),
                  )}
                  {task.reviewerId && (
                    <p className="hint">
                      {task.reviewAcceptedById
                        ? "Đã nghiệm thu bởi " + person(task.reviewAcceptedById)
                        : "Người nghiệm thu: " + person(task.reviewerId)}
                    </p>
                  )}
                  {task.completedAt && (
                    <p className="hint">
                      Hoàn thành lúc {date(task.completedAt)}
                    </p>
                  )}
                </section>
              )}
            </div>
          </section>
        </div>
        <details
          ref={properties}
          open
          className="panel detail-meta task-detail-properties"
        >
          <summary>Thông tin công việc</summary>
          <div className="detail-property-fields">
            <label>
              Người được giao
              {editable ? (
                <select
                  aria-label="Phân công người phụ trách"
                  value={task.assigneeId || ""}
                  disabled={busy || task.status === "done"}
                  onChange={(event) =>
                    change(task, { assigneeId: event.target.value || null })
                  }
                >
                  <option value="">Chưa phân công</option>
                  {users
                    .filter(
                      (value) =>
                        value.active &&
                        value.departmentId === task.owningDepartmentId,
                    )
                    .map((value) => (
                      <option key={value._id} value={value._id}>
                        {value.name}
                      </option>
                    ))}
                </select>
              ) : (
                <strong>{person(task.assigneeId)}</strong>
              )}
            </label>
            <div className="meta">
              <span>Phòng phụ trách</span>
              <strong>{dept(task.owningDepartmentId)}</strong>
            </div>
            {task.requestingDepartmentId !== task.owningDepartmentId && (
              <div className="meta">
                <span>Phòng yêu cầu</span>
                <strong>{dept(task.requestingDepartmentId)}</strong>
              </div>
            )}
            {[
              ["startDate", "Ngày bắt đầu"],
              ["dueDate", "Ngày kết thúc"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                {editable ? (
                  <input
                    aria-label={label}
                    type="date"
                    value={task[key] || ""}
                    required={key === "dueDate"}
                    disabled={busy}
                    onChange={(event) => {
                      if (key !== "dueDate" || event.target.value)
                        void change(task, { [key]: event.target.value });
                    }}
                  />
                ) : (
                  <span>{task[key] || "Chưa có"}</span>
                )}
              </label>
            ))}
            <label>
              Ưu tiên
              {editable ? (
                <select
                  aria-label="Ưu tiên công việc"
                  value={task.priority}
                  disabled={busy}
                  onChange={(event) =>
                    change(task, { priority: event.target.value })
                  }
                >
                  {Object.entries(priorityNames).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{priorityNames[task.priority]}</span>
              )}
            </label>
            {!task.parentTaskId &&
              ((detail.children || []).length > 0 || task.reviewerId) && (
                <label>
                  Người nghiệm thu
                  <select
                    aria-label="Người nghiệm thu"
                    value={task.reviewerId || ""}
                    disabled={!editable || busy || task.status === "done"}
                    onChange={(event) =>
                      change(task, { reviewerId: event.target.value || null })
                    }
                  >
                    <option value="">
                      Không chỉ định — hoàn thành tự động
                    </option>
                    {users
                      .filter((value) => value.active && canView(value, task))
                      .map((value) => (
                        <option key={value._id} value={value._id}>
                          {value.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            <div className="meta">
              <span>Người tạo</span>
              <strong>{person(task.createdById)}</strong>
            </div>
            <TaskParticipants
              task={task}
              users={users}
              user={user}
              busy={busy}
              change={change}
            />
            {task.status === "waiting" &&
              canStatus(user, task) &&
              !task.archivedAt && (
                <details className="detail-waiting-editor">
                  <summary>Sửa lý do chờ</summary>
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      await change(
                        task,
                        Object.fromEntries(new FormData(event.currentTarget)),
                      );
                    }}
                  >
                    <label>
                      Lý do chờ hiện tại
                      <textarea
                        name="waitingReason"
                        required
                        maxLength={500}
                        defaultValue={task.waitingReason || ""}
                      />
                    </label>
                    <button className="secondary" disabled={busy}>
                      Lưu lý do chờ
                    </button>
                  </form>
                </details>
              )}
          </div>
        </details>
      </div>
    </div>
  );
}

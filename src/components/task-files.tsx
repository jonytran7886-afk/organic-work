"use client";
import { useEffect, useRef, useState } from "react";

type PickedFile = {
  key: string;
  file: File;
  id?: string;
  state: string;
  error?: string;
};
type Limits = { maxFiles: number; maxBytes: number; accept: string };
export function useTaskFiles() {
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [configError, setConfigError] = useState("");
  const current = useRef(files);
  current.current = files;
  const staged = useRef(new Set<string>());
  async function loadConfig() {
    try {
      const response = await fetch("/api/attachment-config");
      if (!response.ok)
        throw new Error("Không tải được giới hạn tệp. Vui lòng thử lại.");
      setLimits(await response.json());
      setConfigError("");
    } catch (e: any) {
      setConfigError(e.message);
    }
  }
  useEffect(() => {
    loadConfig();
    return () => {
      for (const id of staged.current)
        void fetch("/api/uploads/" + id, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => {});
    };
  }, []);
  function add(values: FileList | File[]) {
    if (!limits) return;
    const selected = Array.from(values);
    setFiles((previous) => [
      ...previous,
      ...selected.map((file, i) => {
        const extension = "." + file.name.toLowerCase().split(".").at(-1);
        const error =
          previous.length + i >= limits.maxFiles
            ? `Tối đa ${limits.maxFiles} tệp; hãy bỏ tệp dư.`
            : !file.size || file.size > limits.maxBytes
              ? `Dung lượng phải từ 1 byte đến ${limits.maxBytes / 1024 / 1024} MB.`
              : !limits.accept.split(",").includes(extension)
                ? "Chỉ hỗ trợ ảnh, PDF, Word và Excel."
                : "";
        return {
          key: crypto.randomUUID(),
          file,
          state: error ? "Lỗi" : "Chờ tải",
          error,
        };
      }),
    ]);
  }
  function update(key: string, patch: Partial<PickedFile>) {
    setFiles((list) =>
      list.map((f) => (f.key === key ? { ...f, ...patch } : f)),
    );
  }
  function remove(key: string) {
    const entry = current.current.find((f) => f.key === key);
    if (entry?.id)
      void fetch("/api/uploads/" + entry.id, { method: "DELETE" }).catch(
        () => {},
      );
    setFiles((list) => list.filter((f) => f.key !== key));
  }
  async function uploadAll() {
    if (!limits)
      throw new Error(
        configError || "Đang tải cấu hình tệp, vui lòng thử lại.",
      );
    if (current.current.length > limits.maxFiles)
      throw new Error(`Chỉ chọn tối đa ${limits.maxFiles} tệp.`);
    const ids: string[] = [];
    for (const entry of current.current) {
      if (entry.id) {
        ids.push(entry.id);
        continue;
      }
      const form = new FormData();
      form.set("file", entry.file);
      form.set("uploadKey", entry.key);
      update(entry.key, { state: "Đang tải…", error: "" });
      try {
        const response = await fetch("/api/uploads", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Tải tệp thất bại");
        staged.current.add(result._id);
        entry.id = result._id;
        update(entry.key, { id: result._id, state: "Đã tải" });
        ids.push(result._id);
      } catch (e: any) {
        update(entry.key, { state: "Lỗi", error: e.message });
        throw new Error(
          `${entry.file.name}: ${e.message}. Bấm lưu để thử lại hoặc bỏ tệp này.`,
        );
      }
    }
    return ids;
  }
  return { files, limits, configError, add, remove, uploadAll, loadConfig };
}
export function TaskFilePicker({
  draft,
  disabled,
}: {
  draft: ReturnType<typeof useTaskFiles>;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <section
      className="task-file-picker"
      aria-label="Tệp đính kèm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (!disabled) draft.add(e.dataTransfer.files);
      }}
    >
      <strong>Tệp đính kèm</strong>
      <p className="hint">
        {draft.limits
          ? `Tối đa ${draft.limits.maxFiles} tệp, ${draft.limits.maxBytes / 1024 / 1024} MB mỗi tệp. Ảnh, PDF, Word, Excel. Có thể kéo thả tệp vào đây.`
          : "Đang tải giới hạn tệp…"}
      </p>
      {draft.configError && (
        <p role="alert">
          {draft.configError}{" "}
          <button type="button" onClick={draft.loadConfig}>
            Thử lại
          </button>
        </p>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={draft.limits?.accept}
        aria-label="Chọn tệp đính kèm"
        hidden
        onChange={(e) => {
          if (e.target.files) draft.add(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        className="secondary"
        type="button"
        disabled={disabled || !draft.limits}
        onClick={() => input.current?.click()}
      >
        Chọn tệp
      </button>
      <ul className="task-file-list">
        {draft.files.map((entry) => (
          <li key={entry.key}>
            <div>
              <strong>{entry.file.name}</strong>
              <small>
                {(entry.file.size / 1024).toFixed(1)} KB · {entry.state}
              </small>
              {entry.error && (
                <p role="alert" className="overdue-date">
                  {entry.error}
                </p>
              )}
            </div>
            <button
              className="secondary"
              type="button"
              disabled={disabled}
              aria-label={"Bỏ tệp " + entry.file.name}
              onClick={() => draft.remove(entry.key)}
            >
              Bỏ
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
export function TaskAttachments({ files }: { files: Record<string, any>[] }) {
  return (
    <section className="task-attachments">
      <h3>Tệp đính kèm</h3>
      {!files.length && <p className="hint">Chưa có tệp đính kèm.</p>}
      {[
        ["brief", "Tài liệu giao việc"],
        ["result", "Tài liệu bàn giao"],
      ].map(([purpose, label]) => {
        const group = files.filter((f) => f.purpose === purpose);
        return group.length ? (
          <div key={purpose}>
            <h4>{label}</h4>
            <ul className="task-file-list">
              {group.map((file) => (
                <li key={file._id}>
                  <div>
                    <a href={"/api/files/" + file._id}>{file.name}</a>
                    <small>{(file.size / 1024).toFixed(1)} KB</small>
                  </div>
                  {/^(image\/|application\/pdf$)/.test(file.type) && (
                    <a
                      href={"/api/files/" + file._id + "?preview=1"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Xem
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null;
      })}
    </section>
  );
}

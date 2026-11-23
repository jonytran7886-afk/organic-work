import { GridFSBucket, ObjectId, type ClientSession } from "mongodb";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { db, id } from "./db";
import { canView } from "./model";

export class FileInputError extends Error {
  status = 400;
}
export function attachmentLimits() {
  const positive = (
    value: string | undefined,
    fallback: number,
    cap: number,
  ) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0
      ? Math.min(parsed, cap)
      : fallback;
  };
  return {
    maxFiles: positive(process.env.ATTACHMENT_MAX_FILES, 5, 20),
    maxBytes: positive(process.env.ATTACHMENT_MAX_MB, 20, 100) * 1024 * 1024,
    accept: ".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx",
  };
}
function fileType(name: string, bytes: Buffer) {
  const ext = name.toLowerCase().split(".").at(-1);
  const starts = (...values: number[]) =>
    values.every((v, i) => bytes[i] === v);
  if (ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  if (["jpg", "jpeg"].includes(ext || "") && starts(255, 216, 255))
    return "image/jpeg";
  if (ext === "png" && starts(137, 80, 78, 71, 13, 10, 26, 10))
    return "image/png";
  if (ext === "gif" && /^GIF8[79]a/.test(bytes.subarray(0, 6).toString()))
    return "image/gif";
  if (
    ext === "webp" &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (
    ["doc", "xls"].includes(ext || "") &&
    starts(208, 207, 17, 224, 161, 177, 26, 225)
  )
    return ext === "doc" ? "application/msword" : "application/vnd.ms-excel";
  // Office Open XML must contain the package and the correct document family.
  if (
    ["docx", "xlsx"].includes(ext || "") &&
    starts(80, 75, 3, 4) &&
    bytes.includes(Buffer.from("[Content_Types].xml")) &&
    bytes.includes(
      Buffer.from(ext === "docx" ? "word/document.xml" : "xl/workbook.xml"),
    )
  )
    return ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  throw new FileInputError(
    "Định dạng hoặc nội dung tệp không hợp lệ. Chọn ảnh, PDF, Word hoặc Excel.",
  );
}
export async function cleanupUploads() {
  const d = await db(),
    bucket = new GridFSBucket(d);
  const stale = await d
    .collection("attachments")
    .find({
      state: { $in: ["uploading", "staged", "deleting"] },
      expiresAt: { $lt: new Date() },
    })
    .limit(50)
    .toArray();
  for (const file of stale) {
    // Claim cleanup before deleting; a concurrent task transaction cannot link it.
    const claimed = await d
      .collection("attachments")
      .findOneAndUpdate(
        {
          _id: file._id,
          state: { $in: ["uploading", "staged", "deleting"] },
          expiresAt: { $lt: new Date() },
        },
        { $set: { state: "deleting" } },
      );
    if (!claimed) continue;
    await bucket.delete(file._id).catch((e) => {
      if (!String(e.message).startsWith("File not found for id")) throw e;
    });
    await d
      .collection("attachments")
      .deleteOne({ _id: file._id, state: "deleting" });
  }
}
export async function stageFile(u: any, file: File, key: string) {
  if (!/^[\w-]{16,100}$/.test(key))
    throw new FileInputError("Mã tải tệp không hợp lệ");
  const limits = attachmentLimits();
  if (!file.size || file.size > limits.maxBytes)
    throw new FileInputError(
      `Tệp phải có dung lượng từ 1 byte đến ${limits.maxBytes / 1024 / 1024} MB`,
    );
  const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 250);
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = fileType(name, bytes),
    digest = createHash("sha256").update(bytes).digest("hex");
  await cleanupUploads();
  const d = await db(),
    bucket = new GridFSBucket(d);
  const existing = await d
    .collection("attachments")
    .findOne({ uploadedById: u._id, uploadKey: key });
  if (existing) {
    if (
      existing.digest === digest &&
      ["staged", "linked"].includes(existing.state)
    )
      return existing;
    throw new FileInputError(
      "Tệp đang được tải hoặc mã tải đã dùng cho tệp khác. Vui lòng thử lại.",
    );
  }
  const record = {
    _id: new ObjectId(),
    name,
    size: file.size,
    type,
    digest,
    uploadedById: u._id,
    uploadKey: key,
    state: "uploading",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
  };
  await d.collection("attachments").insertOne(record);
  try {
    const stream = bucket.openUploadStreamWithId(record._id, name, {
      metadata: { uploadedById: u._id, type },
    });
    await pipeline(Readable.from(bytes), stream);
    await d
      .collection("attachments")
      .updateOne(
        { _id: record._id, state: "uploading" },
        { $set: { state: "staged" } },
      );
    return { ...record, state: "staged" };
  } catch (error) {
    await bucket.delete(record._id).catch(() => {});
    await d.collection("attachments").deleteOne({ _id: record._id });
    throw error;
  }
}
export async function discardFile(u: any, fileId: string) {
  const d = await db();
  const file = await d
    .collection("attachments")
    .findOneAndUpdate(
      { _id: id(fileId), uploadedById: u._id, state: "staged" },
      { $set: { state: "deleting", expiresAt: new Date(0) } },
    );
  if (file) {
    await new GridFSBucket(d).delete(file._id);
    await d
      .collection("attachments")
      .deleteOne({ _id: file._id, state: "deleting" });
  }
}
export async function linkFiles(
  u: any,
  taskId: ObjectId,
  values: unknown,
  purpose: "brief" | "result",
  session: ClientSession,
) {
  const refs = values ?? [];
  if (
    !Array.isArray(refs) ||
    refs.length > attachmentLimits().maxFiles ||
    refs.some((v) => typeof v !== "string") ||
    new Set(refs).size !== refs.length
  )
    throw new FileInputError("Danh sách tệp vượt giới hạn hoặc không hợp lệ");
  const d = await db();
  for (const value of refs) {
    const result = await d
      .collection("attachments")
      .updateOne(
        {
          _id: id(value),
          uploadedById: u._id,
          state: "staged",
          expiresAt: { $gt: new Date() },
        },
        {
          $set: { state: "linked", taskId, purpose },
          $unset: { expiresAt: "" },
        },
        { session },
      );
    if (result.modifiedCount !== 1)
      throw new FileInputError(
        "Tệp chưa tải xong, hết hạn hoặc không thuộc tài khoản. Hãy bỏ tệp và chọn lại.",
      );
    await d
      .collection("fs.files")
      .updateOne(
        { _id: id(value) },
        { $set: { "metadata.taskId": taskId, "metadata.purpose": purpose } },
        { session },
      );
  }
}
export async function readFile(u: any, fileId: string) {
  const d = await db(),
    file = await d
      .collection("attachments")
      .findOne({ _id: id(fileId), state: "linked" });
  const task =
    file && (await d.collection("tasks").findOne({ _id: file.taskId }));
  if (!file || !task || !canView(u, task)) return null;
  return {
    file,
    stream: Readable.toWeb(
      new GridFSBucket(d).openDownloadStream(file._id),
    ) as ReadableStream,
  };
}

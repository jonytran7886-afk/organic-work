import { cleanupUploads } from "../src/lib/attachments";
import { client, db } from "../src/lib/db";
try {
  const d = await db();
  // Drain batches while expired uploads remain; linked task files are never matched.
  while (
    await d
      .collection("attachments")
      .countDocuments({
        state: { $in: ["uploading", "staged", "deleting"] },
        expiresAt: { $lt: new Date() },
      })
  ) {
    await cleanupUploads();
  }
  console.log("Đã dọn các tệp tạm hết hạn.");
} finally {
  await client().close();
}

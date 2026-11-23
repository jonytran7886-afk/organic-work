import { z } from "zod";
import { client, db } from "./db";
import { hashPassword, tokenHash, verifyPassword } from "./password";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password-policy";

export class ProfileInputError extends Error {
  constructor(
    message: string,
    public fields: Record<string, string> = {},
    public status = 400,
  ) {
    super(message);
  }
}
export function publicAccount(user: any) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    departmentId: user.departmentId,
    role: user.role,
    active: user.active,
  };
}
function allowFields(input: unknown, allowed: string[]) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !allowed.includes(key))
  )
    throw new ProfileInputError(
      "Thông tin gửi lên chứa trường không được phép chỉnh sửa",
    );
}
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[String(issue.path[0] || "form")] ??= issue.message;
    throw new ProfileInputError("Vui lòng kiểm tra thông tin đã nhập", fields);
  }
  return parsed.data;
}
export async function ownProfile(user: any) {
  const d = await db();
  const current = await d
    .collection("users")
    .findOne({ _id: user._id, active: true });
  if (!current) throw new ProfileInputError("Vui lòng đăng nhập", {}, 401);
  const department = await d
    .collection("departments")
    .findOne({ _id: current.departmentId });
  return {
    ...publicAccount(current),
    phone: typeof current.phone === "string" ? current.phone : "",
    departmentName: department?.name || "Phòng không còn tồn tại",
  };
}
export async function updateOwnProfile(user: any, input: unknown) {
  allowFields(input, ["name", "phone"]);
  const value = parse(
    z.object({
      name: z
        .string({ error: "Vui lòng nhập họ và tên" })
        .trim()
        .min(1, "Vui lòng nhập họ và tên")
        .max(250, "Họ và tên tối đa 250 ký tự"),
      phone: z
        .string({ error: "Số điện thoại phải là chuỗi ký tự" })
        .trim()
        .max(40, "Số điện thoại quá dài")
        .refine(
          (v) => !v || /^\+?\d{7,15}$/.test(v.replace(/[\s().-]/g, "")),
          "Nhập số điện thoại hợp lệ gồm 7–15 chữ số, có thể bắt đầu bằng +",
        )
        .transform((v) => v.replace(/[\s().-]/g, ""))
        .optional(),
    }),
    input,
  );
  const d = await db();
  const result = await d.collection("users").updateOne(
    { _id: user._id, active: true },
    {
      $set: {
        name: value.name,
        ...(value.phone !== undefined ? { phone: value.phone } : {}),
        updatedAt: new Date(),
      },
    },
  );
  if (!result.matchedCount)
    throw new ProfileInputError("Vui lòng đăng nhập", {}, 401);
  return ownProfile(user);
}
export async function changeOwnPassword(
  user: any,
  input: unknown,
  failAfterWrite = false,
) {
  allowFields(input, ["currentPassword", "newPassword", "confirmPassword"]);
  const value = parse(
    z.object({
      currentPassword: z
        .string({ error: "Vui lòng nhập mật khẩu hiện tại" })
        .min(1, "Vui lòng nhập mật khẩu hiện tại")
        .max(PASSWORD_MAX_LENGTH, "Mật khẩu hiện tại quá dài"),
      newPassword: z
        .string({ error: "Vui lòng nhập mật khẩu mới" })
        .min(
          PASSWORD_MIN_LENGTH,
          `Mật khẩu mới phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`,
        )
        .max(
          PASSWORD_MAX_LENGTH,
          `Mật khẩu mới tối đa ${PASSWORD_MAX_LENGTH} ký tự`,
        ),
      confirmPassword: z
        .string({ error: "Vui lòng nhập lại mật khẩu mới" })
        .max(PASSWORD_MAX_LENGTH, "Mật khẩu xác nhận quá dài"),
    }),
    input,
  );
  if (value.newPassword !== value.confirmPassword)
    throw new ProfileInputError("Mật khẩu xác nhận không khớp", {
      confirmPassword: "Nhập lại đúng mật khẩu mới",
    });
  if (value.newPassword === value.currentPassword)
    throw new ProfileInputError("Mật khẩu mới phải khác mật khẩu hiện tại", {
      newPassword: "Chọn mật khẩu khác mật khẩu hiện tại",
    });
  const d = await db(),
    now = new Date();
  const key = tokenHash("change-password:" + user._id);
  // One atomic increment per attempt across all sessions; re-use the TTL-backed auth limiter.
  const attempts = d.collection<{
    _id: string;
    count: number;
    expiresAt: Date;
  }>("login_attempts");
  const counter = await attempts.findOneAndUpdate(
    { _id: key },
    [
      {
        $set: {
          count: {
            $cond: [
              { $gt: ["$expiresAt", now] },
              { $add: [{ $ifNull: ["$count", 0] }, 1] },
              1,
            ],
          },
          expiresAt: {
            $cond: [
              { $gt: ["$expiresAt", now] },
              "$expiresAt",
              new Date(now.getTime() + 15 * 60000),
            ],
          },
        },
      },
    ],
    { upsert: true, returnDocument: "after" },
  );
  if (counter && counter.count > 5)
    throw new ProfileInputError(
      "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      { currentPassword: "Tạm khóa thao tác đổi mật khẩu trong 15 phút" },
      429,
    );
  const session = client().startSession();
  try {
    await session.withTransaction(async () => {
      const current = await d
        .collection("users")
        .findOne({ _id: user._id, active: true }, { session });
      if (!current) throw new ProfileInputError("Vui lòng đăng nhập", {}, 401);
      if (!verifyPassword(value.currentPassword, current.passwordHash))
        throw new ProfileInputError("Mật khẩu hiện tại không đúng", {
          currentPassword: "Mật khẩu hiện tại không đúng",
        });
      await d.collection("users").updateOne(
        { _id: current._id },
        {
          $set: {
            passwordHash: hashPassword(value.newPassword),
            passwordChangedAt: new Date(),
          },
        },
        { session },
      );
      if (failAfterWrite) throw new Error("TEST_PASSWORD_WRITE_FAILURE");
      await d
        .collection("sessions")
        .deleteMany({ userId: current._id }, { session });
      await attempts.deleteOne({ _id: key }, { session });
    });
  } finally {
    await session.endSession();
  }
}

import { randomBytes } from "node:crypto";
import { verifyPassword, tokenHash } from "./password";
export { tokenHash } from "./password";
import { cookies } from "next/headers";
import { db, client } from "./db";
export async function currentUser() {
  const token = (await cookies()).get("organic_session")?.value;
  if (!token) return null;
  const d = await db();
  const s = await d
    .collection("sessions")
    .findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  return s
    ? d.collection("users").findOne({ _id: s.userId, active: true })
    : null;
}
export async function login(email: string, password: string) {
  const d = await db();
  const token = randomBytes(32).toString("hex");
  const hours = Number(process.env.SESSION_TTL_HOURS || 24);
  let u: any;
  const session = client().startSession();
  try {
    await session.withTransaction(async () => {
      u = await d
        .collection("users")
        .findOne(
          { email: email.trim().toLowerCase(), active: true },
          { session },
        );
      if (!u || !verifyPassword(password, u.passwordHash))
        throw new Error("Email hoặc mật khẩu không đúng");
      // Serialize session creation with password changes/resets on the same user document.
      await d
        .collection("users")
        .updateOne(
          { _id: u._id },
          { $inc: { sessionRevision: 1 } },
          { session },
        );
      await d
        .collection("sessions")
        .insertOne(
          {
            userId: u._id,
            tokenHash: tokenHash(token),
            expiresAt: new Date(Date.now() + hours * 3600000),
          },
          { session },
        );
    });
  } finally {
    await session.endSession();
  }
  (await cookies()).set("organic_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: hours * 3600,
  });
  return u;
}

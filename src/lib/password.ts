import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(p: string, h: string) {
  try {
    const [s, key] = h.split(":");
    return timingSafeEqual(Buffer.from(key, "hex"), scryptSync(p, s, 64));
  } catch {
    return false;
  }
}
export function tokenHash(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

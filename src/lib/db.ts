import { MongoClient, ObjectId } from "mongodb";
const g = globalThis as unknown as { mongo?: MongoClient };
export function client() {
  if (!process.env.MONGODB_URI) throw new Error("Chưa cấu hình MONGODB_URI");
  return (g.mongo ??= new MongoClient(process.env.MONGODB_URI));
}
export async function db() {
  return (await client().connect()).db(
    process.env.MONGODB_DB || "organic_work",
  );
}
export function id(v: unknown) {
  if (typeof v !== "string" || !/^[a-f0-9]{24}$/i.test(v))
    throw new Error("ID không hợp lệ");
  return new ObjectId(v);
}
export function serialize(v: any): any {
  if (v instanceof ObjectId) return v.toHexString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serialize);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => k !== "passwordHash" && k !== "tokenHash")
        .map(([k, x]) => [k, serialize(x)]),
    );
  return v;
}

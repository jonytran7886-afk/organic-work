import { ZodError } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser, login, tokenHash } from "@/lib/auth";
import { db, id, serialize } from "@/lib/db";
import {
  scope,
  createTask,
  changeTask,
  comment,
  adminWrite,
  AdminInputError,
} from "@/lib/service";
import { canView } from "@/lib/model";
import { queryWork, QueryPermissionError } from "@/lib/work-query";
export const runtime = "nodejs";
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path;
    const d = await db();
    if (
      req.method !== "GET" &&
      req.headers.get("origin") !==
        new URL(process.env.APP_ORIGIN || req.url).origin
    )
      return NextResponse.json(
        { error: "Nguồn yêu cầu không hợp lệ" },
        { status: 403 },
      );
    if (path[0] === "login" && req.method === "POST") {
      const ip = req.headers.get("x-forwarded-for") || "local";
      const key = tokenHash(ip);
      const a = await d
        .collection("login_attempts")
        .findOne({ _id: key } as any);
      if (a && a.count >= 15 && a.expiresAt > new Date())
        return NextResponse.json(
          { error: "Thử lại sau 15 phút" },
          { status: 429 },
        );
      const b = await req.json();
      if (
        typeof b.email !== "string" ||
        typeof b.password !== "string" ||
        b.password.length > 200
      )
        throw new Error("Thông tin đăng nhập không hợp lệ");
      try {
        const u = await login(b.email, b.password);
        await d.collection("login_attempts").deleteOne({ _id: key } as any);
        return NextResponse.json({ user: serialize(u) });
      } catch (e) {
        await d.collection("login_attempts").updateOne(
          { _id: key } as any,
          {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt: new Date(Date.now() + 900000) },
          },
          { upsert: true },
        );
        throw e;
      }
    }
    const u = await currentUser();
    if (!u)
      return NextResponse.json(
        { error: "Vui lòng đăng nhập" },
        { status: 401 },
      );
    if (path[0] === "session" && req.method === "GET")
      return NextResponse.json(
        { user: serialize(u) },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    if (path[0] === "logout" && req.method === "POST") {
      const c = await cookies();
      const token = c.get("organic_session")?.value;
      if (token)
        await d
          .collection("sessions")
          .deleteOne({ tokenHash: tokenHash(token) });
      c.delete("organic_session");
      return NextResponse.json({ ok: true });
    }
    if (path[0] === "work" && req.method === "GET")
      return NextResponse.json(
        serialize(await queryWork(u, req.nextUrl.searchParams)),
      );
    if (path[0] === "data" && req.method === "GET") {
      const departments = await d.collection("departments").find().toArray();
      const users = await d
        .collection("users")
        .find()
        .project(
          u.role === "admin"
            ? { passwordHash: 0 }
            : { _id: 1, name: 1, departmentId: 1, active: 1 },
        )
        .toArray();
      const tasks = await d
        .collection("tasks")
        .find(scope(u))
        .sort({ dueDate: 1 })
        .toArray();
      return NextResponse.json(
        serialize({ user: u, departments, users, tasks }),
      );
    }
    if (path[0] === "tasks") {
      if (path.length === 1 && req.method === "POST")
        return NextResponse.json(
          serialize(await createTask(u, await req.json())),
        );
      if (path[1]) {
        if (req.method === "PATCH") {
          await changeTask(u, path[1], await req.json());
          return NextResponse.json({ ok: true });
        }
        if (path[2] === "comments" && req.method === "POST") {
          await comment(u, path[1], (await req.json()).body);
          return NextResponse.json({ ok: true });
        }
        if (req.method === "GET") {
          const t = await d.collection("tasks").findOne({ _id: id(path[1]) });
          if (!t || !canView(u, t))
            return NextResponse.json(
              { error: "Không có quyền truy cập công việc" },
              { status: 403 },
            );
          return NextResponse.json(
            serialize({
              task: t,
              comments: await d
                .collection("task_comments")
                .find({ taskId: t._id })
                .sort({ createdAt: 1 })
                .toArray(),
              activities: await d
                .collection("task_activities")
                .find({ taskId: t._id })
                .sort({ createdAt: 1 })
                .toArray(),
            }),
          );
        }
      }
    }
    if (path[0] === "admin") {
      if (u.role !== "admin")
        return NextResponse.json(
          { error: "Chỉ Admin được truy cập" },
          { status: 403 },
        );
      if (req.method === "GET")
        return NextResponse.json(
          serialize({
            users: await d
              .collection("users")
              .find()
              .project({ passwordHash: 0 })
              .sort({ name: 1 })
              .toArray(),
            departments: await d
              .collection("departments")
              .find()
              .sort({ name: 1 })
              .toArray(),
          }),
        );
      if (req.method === "POST") {
        const savedId = await adminWrite(u, await req.json());
        return NextResponse.json({ ok: true, id: String(savedId) });
      }
    }
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  } catch (e: any) {
    if (e instanceof AdminInputError)
      return NextResponse.json(
        { error: e.message, fields: e.fields },
        { status: e.status },
      );
    if (e instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of e.issues) {
        const key = String(issue.path[0] || "form");
        fields[key] =
          (
            {
              email: "Email không hợp lệ",
              name: "Vui lòng nhập tên hợp lệ (tối đa 250 ký tự)",
              password: "Mật khẩu phải có từ 10 đến 200 ký tự",
              code: "Mã phòng gồm 2–40 chữ, số, dấu gạch ngang hoặc gạch dưới",
              departmentId: "Vui lòng chọn phòng ban",
              role: "Vai trò không hợp lệ",
              active: "Trạng thái không hợp lệ",
            } as Record<string, string>
          )[key] || issue.message;
      }
      return NextResponse.json(
        { error: "Vui lòng kiểm tra thông tin đã nhập", fields },
        { status: 400 },
      );
    }
    if (e.code === 11000) {
      const key = e.keyPattern?.email
        ? "email"
        : e.keyPattern?.code
          ? "code"
          : null;
      const error =
        key === "email"
          ? "Email đã tồn tại"
          : key === "code"
            ? "Mã phòng đã tồn tại"
            : "Dữ liệu đã tồn tại";
      return NextResponse.json(
        { error, fields: key ? { [key]: error } : {} },
        { status: 409 },
      );
    }
    const message =
      e.code === 11000
        ? "Email hoặc mã phòng đã tồn tại"
        : e.message || "Không thể lưu dữ liệu";
    return NextResponse.json(
      { error: message },
      { status: e instanceof QueryPermissionError ? 403 : 400 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;

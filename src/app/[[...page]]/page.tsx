import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminRoute from "@/components/admin-route";
export const runtime = "nodejs";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const segments = (await params).page || [];
  if (segments[0] === "admin") {
    const user = await currentUser();
    if (user && user.role !== "admin")
      return (
        <main className="access-denied">
          <h1>Không có quyền truy cập</h1>
          <p role="alert">Chỉ Admin được truy cập trang quản trị.</p>
          <Link className="primary" href="/my-tasks">
            Về Việc của tôi
          </Link>
        </main>
      );
    const query = await searchParams;
    const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
    if (
      user &&
      (segments.length !== 2 ||
        !["users", "departments"].includes(segments[1]) ||
        tab !== undefined)
    ) {
      const section =
        tab === "departments"
          ? "departments"
          : tab === "users"
            ? "users"
            : segments[1] === "departments"
              ? "departments"
              : "users";
      const remaining = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (key !== "tab" && typeof value === "string")
          remaining.set(key, value);
      }
      redirect("/admin/" + section + (remaining.size ? "?" + remaining : ""));
    }
  }
  return segments[0] === "admin" ? <AdminRoute /> : null;
}

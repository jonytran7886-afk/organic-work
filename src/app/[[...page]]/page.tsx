import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AdminRoute from "@/components/admin-route";
export const runtime = "nodejs";
export default async function Page({
  params,
}: {
  params: Promise<{ page?: string[] }>;
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
    if (
      user &&
      (segments.length === 1 || !["users", "departments"].includes(segments[1]))
    )
      redirect("/admin/users");
  }
  return segments[0] === "admin" ? <AdminRoute /> : null;
}

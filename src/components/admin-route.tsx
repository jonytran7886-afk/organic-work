"use client";
import dynamic from "next/dynamic";
import { useWorkspace } from "./workspace-context";
const AdminConsole = dynamic(() => import("./admin-console"), {
  loading: () => (
    <p className="query-loading" role="status">
      Đang tải trang quản trị…
    </p>
  ),
});
export default function AdminRoute() {
  const { data, refresh } = useWorkspace();
  if (data.user.role !== "admin")
    return (
      <p role="alert" className="error">
        Chỉ Admin được truy cập trang quản trị.
      </p>
    );
  return (
    <AdminConsole
      users={data.users}
      departments={data.departments}
      onSaved={refresh}
    />
  );
}

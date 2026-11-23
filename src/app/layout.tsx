import { Suspense } from "react";
import Workspace from "@/components/workspace";
import "./globals.css";
import "./brand.css";
import "./admin.css";
import "./navigation.css";
import "./task-features.css";
import "./profile.css";
import "./subtasks.css";
import "./my-tasks.css";
import "./task-detail.css";
export const metadata = {
  title: "Organic Work — Không gian làm việc",
  description:
    "Không gian kết nối công việc và đội ngũ Tập đoàn Organic Việt Nam",
  icons: {
    icon: "/brand/organicvn-symbol-color.svg",
    apple: "/brand/organicvn-apple-touch.png",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Suspense
          fallback={<main className="loading">Đang kết nối Organic Work…</main>}
        >
          <Workspace>{children}</Workspace>
        </Suspense>
      </body>
    </html>
  );
}

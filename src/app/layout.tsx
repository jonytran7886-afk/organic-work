import "./globals.css";
import "./brand.css";
import "./admin.css";
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
      <body>{children}</body>
    </html>
  );
}

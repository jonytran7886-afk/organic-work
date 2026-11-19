"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="loading">
      <h1>Không thể tải trang</h1>
      <button onClick={reset}>Thử lại</button>
    </main>
  );
}

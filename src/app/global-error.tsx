"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="container">
          <div className="card empty-state" style={{ marginTop: "var(--space-8)" }}>
            <span className="empty-state-icon">⚠️</span>
            <h1 className="empty-state-title">应用发生错误</h1>
            <p className="empty-state-text">
              {error.message || "发生了未知错误，请刷新页面重试。"}
            </p>
            <div className="link-row">
              <button className="link-button" onClick={reset}>
                重试
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}

"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面错误:", error);
  }, [error]);

  return (
    <main className="container fade-in">
      <div className="card empty-state">
        <span className="empty-state-icon">⚠️</span>
        <h1 className="empty-state-title">页面加载出错</h1>
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
  );
}

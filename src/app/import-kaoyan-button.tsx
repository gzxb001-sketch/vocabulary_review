"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportKaoyanButton() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleImport() {
    setImporting(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/words/import-kaoyan", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "导入失败，请稍后重试");
        return;
      }
      const data = await res.json();
      setResult(`已导入 ${data.imported} 个考研核心词${data.skipped > 0 ? `（${data.skipped} 个已存在）` : ""}`);
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="stack" style={{ alignItems: "center" }}>
      <button className="button" onClick={handleImport} disabled={importing}>
        {importing ? "导入中..." : "一键导入考研核心词"}
      </button>
      {result && <p className="muted" style={{ color: "var(--color-success)", fontSize: "var(--text-sm)", margin: 0 }}>{result}</p>}
      {error && <p className="muted" style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", margin: 0 }}>{error}</p>}
    </div>
  );
}

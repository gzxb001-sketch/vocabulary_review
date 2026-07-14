"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!email || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "操作失败");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container fade-in">
      <div className="card stack" style={{ maxWidth: 420, margin: "var(--space-8) auto" }}>
        <h1 className="title" style={{ textAlign: "center" }}>竹墨词库</h1>
        <p className="subtitle" style={{ textAlign: "center" }}>
          {mode === "login" ? "登录你的账号" : "注册新账号"}
        </p>

        <div className="stack">
          <input
            className="input"
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}

          <button className="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: "var(--space-2)" }}>
          <button
            className="link-button"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          >
            {mode === "login" ? "没有账号？点击注册" : "已有账号？点击登录"}
          </button>
        </div>
      </div>
    </main>
  );
}

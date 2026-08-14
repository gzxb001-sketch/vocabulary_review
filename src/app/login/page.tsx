"use client";

import { useState, useEffect } from "react";
import { migrateDraftWords } from "@/lib/draft-migrate";

type Mode = "login" | "register" | "forgot";
type ForgotStep = "request" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checking, setChecking] = useState(true);
  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) window.location.href = "/";
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  function resetMessages() {
    setError("");
    setNotice("");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setCode("");
    setNewPassword("");
    setForgotStep("request");
    resetMessages();
  }

  async function handleAuth() {
    resetMessages();
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

      // 登录/注册成功后，迁移游客时期录入的草稿词到账号（失败不阻塞登录）
      try {
        await migrateDraftWords();
      } catch {}

      window.location.href = "/";
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest() {
    resetMessages();
    if (!email) {
      setError("请填写邮箱");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "发送失败");
        return;
      }

      setNotice(data.message || "验证码已发送，请查收邮箱");
      setForgotStep("reset");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotReset() {
    resetMessages();
    if (!email) {
      setError("请填写邮箱");
      return;
    }
    if (!code) {
      setError("请填写验证码");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "重置失败");
        return;
      }

      setNotice("密码已重置，请用新密码登录");
      setPassword("");
      setNewPassword("");
      setCode("");
      setMode("login");
      setForgotStep("request");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="container fade-in">
        <div className="card stack" style={{ maxWidth: 420, margin: "var(--space-8) auto", textAlign: "center" }}>
          <h1 className="title">竹墨词库</h1>
          <p className="muted">检查登录状态...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container fade-in">
      <div className="card stack" style={{ maxWidth: 420, margin: "var(--space-8) auto" }}>
        <h1 className="title" style={{ textAlign: "center" }}>竹墨词库</h1>
        <p className="subtitle" style={{ textAlign: "center" }}>
          {mode === "login" && "登录你的账号"}
          {mode === "register" && "注册新账号"}
          {mode === "forgot" && "重置密码"}
        </p>

        {mode === "forgot" ? (
          <div className="auth-stack">
            <input
              className="input"
              type="email"
              placeholder="邮箱"
              aria-label="邮箱"
              value={email}
              onChange={(e) => { setEmail(e.target.value); resetMessages(); }}
              autoComplete="email"
              disabled={forgotStep === "reset"}
            />

            {forgotStep === "request" ? (
              <>
                {error ? <p className="auth-error">{error}</p> : null}
                {notice ? <p className="auth-notice">{notice}</p> : null}
                <button className="button" onClick={handleForgotRequest} disabled={loading}>
                  {loading ? "发送中..." : "发送验证码"}
                </button>
              </>
            ) : (
              <>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="6 位验证码"
                  aria-label="验证码"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); resetMessages(); }}
                  autoComplete="one-time-code"
                />
                <input
                  className="input"
                  type="password"
                  placeholder="新密码（至少 6 位）"
                  aria-label="新密码"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); resetMessages(); }}
                  autoComplete="new-password"
                />

                {error ? <p className="auth-error">{error}</p> : null}
                {notice ? <p className="auth-notice">{notice}</p> : null}

                <button className="button" onClick={handleForgotReset} disabled={loading}>
                  {loading ? "重置中..." : "重置密码"}
                </button>

                <div style={{ textAlign: "center" }}>
                  <button className="auth-text-link" onClick={handleForgotRequest} disabled={loading}>
                    没收到？重新发送验证码
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="auth-stack">
            <input
              className="input"
              type="email"
              placeholder="邮箱"
              aria-label="邮箱"
              value={email}
              onChange={(e) => { setEmail(e.target.value); resetMessages(); }}
              autoComplete="email"
            />
            <input
              className="input"
              type="password"
              placeholder="密码（至少 6 位）"
              aria-label="密码"
              value={password}
              onChange={(e) => { setPassword(e.target.value); resetMessages(); }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {mode === "login" ? (
              <div className="auth-forgot-row">
                <button className="auth-text-link" onClick={() => switchMode("forgot")}>
                  忘记密码？
                </button>
              </div>
            ) : null}

            {error ? <p className="auth-error">{error}</p> : null}

            <button className="button" onClick={handleAuth} disabled={loading}>
              {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
            </button>
          </div>
        )}

        <p className="auth-switch">
          {mode === "login" && (
            <>
              还没有账号？{" "}
              <button className="auth-text-link strong" onClick={() => switchMode("register")}>
                立即注册
              </button>
            </>
          )}
          {mode === "register" && (
            <>
              已有账号？{" "}
              <button className="auth-text-link strong" onClick={() => switchMode("login")}>
                登录
              </button>
            </>
          )}
          {mode === "forgot" && (
            <>
              想起密码了？{" "}
              <button className="auth-text-link strong" onClick={() => switchMode("login")}>
                返回登录
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

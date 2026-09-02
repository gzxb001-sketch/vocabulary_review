"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics";

type Mode = "login" | "register";

/**
 * 页内注册/登录模态：游客在保存词库等动作被 401 拦截时，
 * 不跳转离开当前页即可完成注册/登录，成功后由调用方续接原动作。
 */
export default function AuthModal({
  open,
  onClose,
  onSuccess,
  title,
  description,
  source,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  title?: string;
  description?: string;
  /** 唤起模态的页面，用于漏斗归因 */
  source?: string;
}) {
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Escape 关闭 + 打开期间锁定背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // 每次打开重置输入与错误状态
  useEffect(() => {
    if (open) {
      setError("");
      setPassword("");
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || (mode === "login" ? "登录失败" : "注册失败"));
        return;
      }

      trackEvent(ANALYTICS_EVENTS.authSuccess, {
        mode,
        source: source || "auth_modal",
      });
      await onSuccess();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={mode === "login" ? "登录" : "注册"}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <h2 className="modal-title">{title ?? (mode === "login" ? "登录你的账号" : "创建免费账号")}</h2>
        {description && <p className="modal-description">{description}</p>}

        <div className="auth-stack">
          <input
            className="input"
            type="email"
            placeholder="邮箱"
            aria-label="邮箱"
            value={email}
            autoFocus
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(); }}
            autoComplete="email"
          />
          <input
            className="input"
            type="password"
            placeholder="密码（至少 6 位）"
            aria-label="密码"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(); }}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error ? <p className="auth-error">{error}</p> : null}

          <button className="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "免费注册"}
          </button>
        </div>

        <p className="auth-switch">
          {mode === "login" ? (
            <>
              还没有账号？{" "}
              <button className="auth-text-link strong" onClick={() => { setMode("register"); setError(""); }}>
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？{" "}
              <button className="auth-text-link strong" onClick={() => { setMode("login"); setError(""); }}>
                直接登录
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

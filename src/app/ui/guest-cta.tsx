"use client";

import Link from "next/link";

/**
 * 游客引导条：由调用方在确认是游客（useAuth().isGuest）时渲染。
 * 提示登录后可用完整功能，并给出登录/注册与返回首页的入口。
 * 传入 onAuth 时走页内模态（不离开当前页），否则跳转 /login。
 */
export default function GuestCta({
  message,
  onAuth,
}: {
  message?: string;
  onAuth?: () => void;
}) {
  return (
    <div className="alert alert-info" style={{ textAlign: "center" }}>
      <p className="muted" style={{ margin: "0 0 var(--space-2)" }}>
        {message ?? "登录后即可保存到自己的专属词库"}
      </p>
      <div className="link-row">
        {onAuth ? (
          <button className="link-button" onClick={onAuth}>
            登录 / 注册
          </button>
        ) : (
          <Link href="/login" className="link-button">
            登录 / 注册
          </Link>
        )}
        <Link href="/" className="link-button secondary">
          返回首页
        </Link>
      </div>
    </div>
  );
}

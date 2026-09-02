"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

/**
 * 客户端轻量鉴权 Hook：挂载时调用 /api/auth/me 判断当前是否已登录。
 * - user: 已登录用户信息，未登录为 null，请求未完成时为 undefined
 * - loading: 是否仍在请求中
 * - isGuest: 是否确认是游客（请求完成且未登录）
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user: AuthUser | null }) => {
        if (cancelled) return;
        setUser(data.user ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, isGuest: !loading && !user };
}

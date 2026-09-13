"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

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
 *
 * 凭证过期时（服务端返回 expired 标记）自动引导到登录页并回跳当前页，
 * 避免静默降级为游客（如复习页回落到演示词库）造成困惑。
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    async function fetchMe(): Promise<Response | null> {
      try {
        return await fetch("/api/auth/me");
      } catch {
        return null; // 网络不可用
      }
    }

    (async () => {
      let res = await fetchMe();
      if (!res) {
        // 网络抖动重试一次，避免瞬断把已登录用户误判为游客
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (cancelled) return;
        res = await fetchMe();
      }
      if (cancelled) return;

      if (!res || !res.ok) {
        setLoading(false);
        return;
      }

      const data: { user: AuthUser | null; expired?: boolean } = await res.json();
      if (cancelled) return;
      setUser(data.user ?? null);
      setLoading(false);

      // 凭证过期：除登录页外，引导到登录页并回跳当前页
      if (data.expired && !data.user && pathname && pathname !== "/login") {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}&expired=1`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return { user, loading, isGuest: !loading && !user };
}

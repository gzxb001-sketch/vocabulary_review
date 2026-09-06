"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconFlame, IconBookOpen, IconSparkles } from "./icons";

// 移动端底部 Tab 导航：核心动线（首页/词库/复习）放进拇指热区。
// 桌面端（>640px）隐藏，由顶部导航承担。
const tabs = [
  { href: "/", label: "首页", Icon: IconFlame },
  { href: "/words", label: "词库", Icon: IconBookOpen },
  { href: "/review", label: "复习", Icon: IconSparkles },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {tabs.map(({ href, label, Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`bottom-nav-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

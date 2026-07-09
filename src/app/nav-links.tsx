"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/words", label: "词库" },
  { href: "/review", label: "复习" },
] as const;

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="topnav-links">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`topnav-link${isActive ? " active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import NavLinks from "./nav-links";
import ServiceWorkerRegister from "./ui/service-worker-register";

export const metadata: Metadata = {
  title: "竹墨词库",
  description: "个人词汇复习工具 — 竹林主题",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "竹墨词库",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#4d7c0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <nav className="topnav" aria-label="主导航">
          <div className="topnav-inner">
            <Link href="/" className="topnav-brand" aria-label="回到首页">
              竹墨词库
            </Link>
            <NavLinks />
          </div>
        </nav>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import NavLinks from "./nav-links";
import ServiceWorkerRegister from "./ui/service-worker-register";

export const metadata: Metadata = {
  title: "竹墨词库 — 碎片化词汇复习",
  description: "个人词汇复习工具，支持拍照录词、间隔重复记忆。竹韵清幽，碎片时间轻松背单词。",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "竹墨词库",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "竹墨词库 — 碎片化词汇复习",
    description: "拍照录词 · 间隔记忆 · 考研复习利器",
    type: "website",
    locale: "zh_CN",
    siteName: "竹墨词库",
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

import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import NavLinks from "./nav-links";
import BottomNav from "./ui/bottom-nav";
import ServiceWorkerRegister from "./ui/service-worker-register";

export const metadata: Metadata = {
  title: "竹墨词库 — 考研生词速记与间隔复习",
  description:
    "为考研人打造的生词本：拍照 OCR 速录生词，自动补全词义例句，间隔重复科学记忆，按考试日期自动进入考前冲刺计划。竹韵清幽，碎片时间轻松背单词。",
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
        {/* 主题初始化：跟随系统暗色偏好，在首帧前挂载 html.dark 避免闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
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
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}

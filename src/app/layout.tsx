import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vocabulary Review",
  description: "Personal vocabulary capture and review tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <nav className="topnav">
          <div className="topnav-inner">
            <Link href="/" className="topnav-brand">
              VocabReview
            </Link>
            <div className="topnav-links">
              <Link href="/words" className="topnav-link">
                词库
              </Link>
              <Link href="/review" className="topnav-link">
                复习
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}

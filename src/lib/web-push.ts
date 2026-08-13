import webpush from "web-push";

let initialized = false;

export function getWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  if (!initialized) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      publicKey,
      privateKey,
    );
    initialized = true;
  }
  return webpush;
}

// 供前端订阅使用的公钥（NEXT_PUBLIC_ 前缀变量会被内联到客户端）
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 能力探测专用订阅：浏览器能力在页面生命周期内不变，无需真正的订阅
const subscribeNoop = () => () => {};

export default function NotificationSubscribe() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [time, setTime] = useState("20:00");
  // SSR 首帧按支持处理（与原初值 true 一致），hydration 后按客户端实际能力裁剪
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => true,
  );

  useEffect(() => {
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("通知权限被拒绝，请在浏览器设置里允许通知");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setMessage("推送未配置（缺少 VAPID 公钥）");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const [hour, minute] = time.split(":").map((n) => parseInt(n, 10));
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          remindHour: hour,
          remindMinute: minute,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
        }),
      });

      if (res.ok) {
        setSubscribed(true);
        setMessage("已开启每日复习提醒");
      } else {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "订阅失败，请先登录");
      }
    } catch (e) {
      setMessage("订阅失败：" + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMessage("已关闭提醒");
    } catch {
      setMessage("关闭失败");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return null;
  }

  return (
    <div className="notify-card">
      <span className="notify-icon">🔔</span>
      <div className="notify-body">
        <div className="notify-title">每日复习提醒</div>
        {subscribed ? (
          <div className="notify-row">
            <span className="notify-status">已开启 {time}</span>
            <button className="notify-btn secondary" onClick={handleUnsubscribe} disabled={loading}>
              关闭
            </button>
          </div>
        ) : (
          <div className="notify-row">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="notify-time"
            />
            <button className="notify-btn" onClick={handleSubscribe} disabled={loading}>
              {loading ? "开启中…" : "开启提醒"}
            </button>
          </div>
        )}
        {message && <div className="notify-msg">{message}</div>}
      </div>
    </div>
  );
}

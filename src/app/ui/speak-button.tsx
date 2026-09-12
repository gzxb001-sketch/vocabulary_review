"use client";

import { useSyncExternalStore } from "react";

// 能力探测专用订阅：浏览器能力在页面生命周期内不变，无需真正的订阅
const subscribeNoop = () => () => {};

export default function SpeakButton({ text, className }: { text: string; className?: string }) {
  // SSR 首帧返回 false（渲染为空），hydration 后按客户端能力显示；替代 effect 里同步 setState
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => "speechSynthesis" in window,
    () => false,
  );

  if (!supported) return null;

  function speak() {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("speech synthesis failed:", e);
    }
  }

  return (
    <button
      type="button"
      onClick={speak}
      className={className || "speak-btn"}
      aria-label={`朗读 ${text}`}
      title="朗读"
    >
      🔊
    </button>
  );
}

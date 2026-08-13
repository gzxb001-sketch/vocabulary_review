"use client";

import { useEffect, useState } from "react";

export default function SpeakButton({ text, className }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

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

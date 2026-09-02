"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  email: string;
  enabled: boolean;
  hour: number;
  minute: number;
};

function toTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function EmailReminder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("20:00");

  useEffect(() => {
    let active = true;
    fetch("/api/email/settings")
      .then(async (res) => {
        if (!res.ok) throw new Error("请先登录");
        return res.json();
      })
      .then((d: Settings) => {
        if (!active) return;
        setEmail(d.email || "");
        setEnabled(!!d.enabled);
        setTime(toTimeValue(d.hour ?? 20, d.minute ?? 0));
      })
      .catch((e) => {
        if (active) setMessage((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (next: { enabled?: boolean; hour?: number; minute?: number }) => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setMessage(d.error || "保存失败");
        return;
      }
      setMessage("已保存");
    } catch (e) {
      setMessage("保存失败：" + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, []);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    save({ enabled: next });
  }

  function handleTimeChange(value: string) {
    setTime(value);
    const [h, m] = value.split(":").map((n) => parseInt(n, 10));
    if (Number.isFinite(h) && Number.isFinite(m)) {
      save({ hour: h, minute: m });
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage("");
    try {
      const res = await fetch("/api/email/test", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(`测试邮件已发送至 ${d.sentTo}`);
      } else {
        setMessage(d.error || "发送失败，请检查 SMTP 配置");
      }
    } catch (e) {
      setMessage("发送失败：" + (e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="notify-card">
      <span className="notify-icon">📧</span>
      <div className="notify-body">
        <div className="notify-title">邮件复习提醒</div>
        {email && (
          <div className="notify-msg" style={{ marginTop: "-4px" }}>
            发送至 {email}
          </div>
        )}

        <div className="notify-row">
          <label className="email-switch">
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              disabled={saving}
            />
            <span className="email-switch-track" />
            <span className="email-switch-label">{enabled ? "已开启" : "未开启"}</span>
          </label>
        </div>

        {enabled && (
          <>
            <div className="notify-row">
              <span className="notify-msg">每天</span>
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="notify-time"
              />
              <span className="notify-msg">起提醒（北京时间）</span>
            </div>
            <div className="notify-row">
              <span className="notify-msg" style={{ opacity: 0.7 }}>
                到点后若暂时没发出（如服务繁忙），恢复后会当天补发，每天最多一封。
              </span>
            </div>
          </>
        )}

        <div className="notify-row">
          <button className="notify-btn secondary" onClick={handleTest} disabled={testing}>
            {testing ? "发送中…" : "发送测试邮件"}
          </button>
        </div>

        {message && <div className="notify-msg">{message}</div>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SourceType = "manual" | "exam" | "reading" | "lecture" | "other";
type EnrichItem = {
  text: string;
  lemma?: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  found?: boolean;
};

export default function ManualPage() {
  const router = useRouter();
  const [displayText, setDisplayText] = useState("");
  const [lemma, setLemma] = useState("");
  const [meaningZh, setMeaningZh] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [exampleSentence, setExampleSentence] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [sourceNote, setSourceNote] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  async function handleEnrich() {
    if (!displayText.trim()) {
      setError("请先输入单词或短语");
      return;
    }

    setError("");
    setHint("");
    setEnriching(true);

    try {
      const res = await fetch("/api/words/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ text: displayText.trim() }],
        }),
      });

      if (!res.ok) {
        setError("自动补全失败，请稍后重试");
        return;
      }

      const data = await res.json();
      const item: EnrichItem | undefined = data.items?.[0];

      if (!item) {
        setError("没有拿到补全结果");
        return;
      }

      setDisplayText(item.text || displayText.trim());
      setLemma(item.lemma || displayText.trim().toLowerCase());
      setMeaningZh((prev) => prev || item.meaningZh || "");
      setPhonetic(item.phonetic || "");
      setPartOfSpeech(item.partOfSpeech || "");
      setExampleSentence(item.exampleSentence || "");

      if (!item.found) {
        setHint("未查到完整词典结果，已保留基础词形，可手动补充释义后保存。");
      }
    } finally {
      setEnriching(false);
    }
  }

  async function handleSave() {
    if (!displayText.trim()) {
      setError("请先输入单词或短语");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/words/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              displayText: displayText.trim(),
              lemma: (lemma || displayText).trim().toLowerCase(),
              meaningZh: meaningZh.trim(),
              phonetic: phonetic.trim(),
              partOfSpeech: partOfSpeech.trim(),
              exampleSentence: exampleSentence.trim(),
              source: {
                sourceType,
                sourceNote: sourceNote.trim(),
              },
            },
          ],
        }),
      });

      if (!res.ok) {
        setError("保存失败，请稍后重试");
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container">
      <div className="card stack">
        <h1 className="title">手动录词</h1>
        <p className="subtitle">先输入最少信息，确保今天能开始复习。</p>

        <div>
          <label className="label">单词或短语</label>
          <input
            className="input"
            placeholder="例如 abandon / derive from"
            value={displayText}
            onChange={(e) => setDisplayText(e.target.value)}
          />
        </div>

        <button className="button button-secondary" onClick={handleEnrich} disabled={enriching}>
          {enriching ? "补全中..." : "自动补全"}
        </button>

        <div>
          <label className="label">Lemma</label>
          <input
            className="input"
            placeholder="自动生成"
            value={lemma}
            onChange={(e) => setLemma(e.target.value)}
          />
        </div>

        <div>
          <label className="label">最短中文义</label>
          <input
            className="input"
            placeholder="例如 放弃"
            value={meaningZh}
            onChange={(e) => setMeaningZh(e.target.value)}
          />
        </div>

        <div>
          <label className="label">音标</label>
          <input
            className="input"
            placeholder="例如 /əˈbændən/"
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
          />
        </div>

        <div>
          <label className="label">词性</label>
          <input
            className="input"
            placeholder="例如 verb"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
          />
        </div>

        <div>
          <label className="label">例句</label>
          <textarea
            className="textarea"
            placeholder="可选"
            value={exampleSentence}
            onChange={(e) => setExampleSentence(e.target.value)}
          />
        </div>

        <div>
          <label className="label">来源</label>
          <select
            className="select"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
          >
            <option value="manual">手动</option>
            <option value="exam">真题</option>
            <option value="reading">阅读</option>
            <option value="lecture">听课</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div>
          <label className="label">来源备注</label>
          <input
            className="input"
            placeholder="例如 2024 英语一阅读"
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
          />
        </div>

        {hint ? <p className="muted">{hint}</p> : null}
        {error ? <p className="muted">{error}</p> : null}

        <button className="button" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存到词库"}
        </button>
      </div>
    </main>
  );
}

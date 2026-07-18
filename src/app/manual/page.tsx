"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SourceType = "manual" | "exam" | "reading" | "lecture" | "other";

type MeaningEntry = {
  partOfSpeech: string;
  meaningZh: string;
  exampleSentence?: string;
  exampleTranslation?: string;
  isObscure: boolean;
  isHighFreq: boolean;
};

type EnrichItem = {
  text: string;
  lemma?: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  meanings?: MeaningEntry[];
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
  const [meanings, setMeanings] = useState<MeaningEntry[]>([]);
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [sourceNote, setSourceNote] = useState("");
  const [enriching, setEnriching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  async function handleEnrich() {
    if (!displayText.trim()) { setError("请先输入单词或短语"); return; }
    setError(""); setHint(""); setEnriching(true);
    try {
      const res = await fetch("/api/words/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ text: displayText.trim() }] }),
      });
      if (!res.ok) { setError("自动补全失败，请稍后重试"); return; }
      const data = await res.json();
      const item: EnrichItem | undefined = data.items?.[0];
      if (!item) { setError("没有拿到补全结果"); return; }

      setDisplayText(item.text || displayText.trim());
      setLemma(item.lemma || displayText.trim().toLowerCase());
      setMeaningZh(item.meaningZh || "");
      setPhonetic(item.phonetic || "");
      setPartOfSpeech(item.partOfSpeech || "");
      setExampleSentence(item.exampleSentence || "");
      setMeanings(item.meanings || []);
      if (!item.found) setHint("未查到完整词典结果，已保留基础词形，可手动补充后保存。");
    } finally { setEnriching(false); }
  }

  async function handleSave() {
    if (!displayText.trim()) { setError("请先输入单词或短语"); return; }
    setError(""); setSaving(true);
    try {
      const res = await fetch("/api/words/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            displayText: displayText.trim(),
            lemma: (lemma || displayText).trim().toLowerCase(),
            meaningZh: meaningZh.trim(),
            phonetic: phonetic.trim(),
            partOfSpeech: partOfSpeech.trim(),
            exampleSentence: exampleSentence.trim(),
            meanings: meanings.length > 0 ? meanings : undefined,
            source: { sourceType, sourceNote: sourceNote.trim() },
          }],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || data.message || "保存失败，请稍后重试");
        return;
      }
      router.push("/"); router.refresh();
    } finally { setSaving(false); }
  }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">手动录词</h1>
        <p className="subtitle">输入单词，系统会自动补全完整义项（含词性、释义、例句、熟词僻义）。</p>

        <div>
          <label className="label">单词或短语</label>
          <input className="input" placeholder="例如 abandon" value={displayText} onChange={(e) => setDisplayText(e.target.value)} />
        </div>

        <button className="button button-secondary" onClick={handleEnrich} disabled={enriching}>
          {enriching ? "补全中..." : "自动补全"}
        </button>

        {/* 补全结果预览（可编辑） */}
        {meanings.length > 0 && (
          <div className="meaning-preview">
            <h3 className="section-title" style={{ marginBottom: "var(--space-2)" }}>
              识别的义项（{meanings.length} 条）— 可修改
            </h3>
            {meanings.map((m, i) => (
              <div key={i} className={`meaning-item${m.isObscure ? " meaning-obscure" : ""}`}>
                <div className="meaning-header">
                  <span className="meta-chip">{m.partOfSpeech}</span>
                  <input
                    className="input"
                    style={{ flex: 1, fontSize: "var(--text-sm)", padding: "var(--space-1) var(--space-2)" }}
                    value={m.meaningZh}
                    onChange={(e) => {
                      const next = [...meanings];
                      next[i] = { ...next[i], meaningZh: e.target.value };
                      setMeanings(next);
                    }}
                    placeholder="释义"
                  />
                  {m.isHighFreq && <span className="highfreq-tag">高频</span>}
                  {m.isObscure && <span className="obscure-tag">僻义</span>}
                </div>
                {m.exampleSentence !== undefined && (
                  <div style={{ marginTop: "var(--space-1)" }}>
                    <input
                      className="input"
                      style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-2)", color: "var(--color-text-secondary)" }}
                      value={m.exampleSentence}
                      onChange={(e) => {
                        const next = [...meanings];
                        next[i] = { ...next[i], exampleSentence: e.target.value };
                        setMeanings(next);
                      }}
                      placeholder="例句"
                    />
                    {m.exampleTranslation !== undefined && (
                      <input
                        className="input"
                        style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-2)", color: "var(--color-text-muted)" }}
                        value={m.exampleTranslation}
                        onChange={(e) => {
                          const next = [...meanings];
                          next[i] = { ...next[i], exampleTranslation: e.target.value };
                          setMeanings(next);
                        }}
                        placeholder="例句翻译"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="label">最短中文义</label>
          <input className="input" placeholder="如在列表中快速展示的意思" value={meaningZh} onChange={(e) => setMeaningZh(e.target.value)} />
        </div>

        <div>
          <label className="label">音标</label>
          <input className="input" placeholder="例如 /əˈbændən/" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} />
        </div>

        <div>
          <label className="label">来源</label>
          <select className="select" value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
            <option value="manual">手动</option>
            <option value="exam">真题</option>
            <option value="reading">阅读</option>
            <option value="lecture">听课</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div>
          <label className="label">来源备注</label>
          <input className="input" placeholder="例如 2024 英语一阅读" value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} />
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraftWordStore } from "@/store/draft-words";

type EnrichItem = {
  text: string;
  lemma?: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
};

export default function CaptureReviewPage() {
  const router = useRouter();
  const { items, updateItem, removeItem, clear, addItems } = useDraftWordStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bulkSourceType, setBulkSourceType] = useState<"exam" | "reading" | "lecture" | "manual" | "other">("exam");
  const [bulkSourceNote, setBulkSourceNote] = useState("");
  const [manualInput, setManualInput] = useState("");

  function setAllSelected(selected: boolean) {
    items.forEach((item) => { updateItem(item.tempId, { selected }); });
  }

  function applyBulkSource() {
    items.filter((item) => item.selected).forEach((item) => {
      updateItem(item.tempId, { sourceType: bulkSourceType, sourceNote: bulkSourceNote });
    });
  }

  function handleAddManual() {
    const words = manualInput
      .split(/[\n,,\uFF0C]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && /^[A-Za-z]+$/.test(w));

    if (words.length === 0) {
      setError("请输入至少一个英文单词，每行一个或用逗号分隔");
      return;
    }

    setError("");
    const now = Date.now();
    const newItems = words.map((text, i) => ({
      tempId: "man_" + now + "_" + i,
      text,
      selected: true,
      sourceType: bulkSourceType,
      sourceNote: bulkSourceNote,
    }));
    addItems(newItems);
    setManualInput("");
  }

  async function handleEnrichAndSave() {
    const selectedItems = items.filter((item) => item.selected && item.text.trim());
    if (!selectedItems.length) { setError("请至少保留一个候选词"); return; }

    setError("");
    setLoading(true);

    try {
      const enrichRes = await fetch("/api/words/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: selectedItems.map((item) => ({ text: item.text })) }),
      });

      if (!enrichRes.ok) { setError("自动补全失败"); return; }

      const enrichData = await enrichRes.json();
      const enrichedItems: EnrichItem[] = enrichData.items || [];

      const saveItems = selectedItems.map((item) => {
        const enriched = enrichedItems.find((entry) => entry.text === item.text);
        return {
          displayText: item.text.trim(),
          lemma: (enriched?.lemma || item.text).trim().toLowerCase(),
          meaningZh: enriched?.meaningZh || "",
          phonetic: enriched?.phonetic || "",
          partOfSpeech: enriched?.partOfSpeech || "",
          exampleSentence: enriched?.exampleSentence || "",
          source: { sourceType: item.sourceType, sourceNote: item.sourceNote || "" },
        };
      });

      const saveRes = await fetch("/api/words/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: saveItems }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setError(data.detail || data.message || "保存失败");
        return;
      }

      clear();
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">确认识别结果</h1>
        <p className="subtitle">
          OCR 识别结果如下。识别不准时，可在下方手动输入单词补充。
        </p>

        {items.length > 0 && (
          <div className="stack">
            <div className="card">
              <h2 className="section-title">批量操作</h2>
              <div className="stack">
                <div className="action-row-inline action-row">
                  <button className="button button-secondary" onClick={() => setAllSelected(true)}>全选</button>
                  <button className="button button-secondary" onClick={() => setAllSelected(false)}>全不选</button>
                </div>

                <select className="select" value={bulkSourceType} onChange={(e) => setBulkSourceType(e.target.value as typeof bulkSourceType)}>
                  <option value="exam">真题</option>
                  <option value="reading">阅读</option>
                  <option value="lecture">听课</option>
                  <option value="manual">手动</option>
                  <option value="other">其他</option>
                </select>

                <input className="input" placeholder="批量来源备注，可选" value={bulkSourceNote} onChange={(e) => setBulkSourceNote(e.target.value)} />
                <button className="button button-secondary" onClick={applyBulkSource}>应用到已勾选项</button>
              </div>
            </div>

            {items.map((item) => (
              <div key={item.tempId} className="card">
                <div className="stack">
                  <label className="checkbox-row">
                    <input type="checkbox" checked={item.selected} onChange={(e) => updateItem(item.tempId, { selected: e.target.checked })} />
                    <span>保留该词</span>
                  </label>

                  <input className="input" value={item.text} onChange={(e) => updateItem(item.tempId, { text: e.target.value })} />

                  <select className="select" value={item.sourceType} onChange={(e) => updateItem(item.tempId, { sourceType: e.target.value as typeof bulkSourceType })}>
                    <option value="exam">真题</option>
                    <option value="reading">阅读</option>
                    <option value="lecture">听课</option>
                    <option value="manual">手动</option>
                    <option value="other">其他</option>
                  </select>

                  <input className="input" placeholder="来源备注，可选" value={item.sourceNote || ""} onChange={(e) => updateItem(item.tempId, { sourceNote: e.target.value })} />

                  <button className="button button-secondary" onClick={() => removeItem(item.tempId)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h2 className="section-title">手动添加单词</h2>
          <textarea
            className="input"
            rows={3}
            placeholder={"输入英文单词，每行一个或用逗号分隔。例如：\nabandon\nderive\ncompulsory"}
            value={manualInput}
            onChange={(e) => { setManualInput(e.target.value); setError(""); }}
            style={{ resize: "vertical", minHeight: 80 }}
          />
          <button
            className="button button-secondary"
            onClick={handleAddManual}
            disabled={!manualInput.trim()}
            style={{ marginTop: "var(--space-2)" }}
          >
            添加到列表
          </button>
        </div>

        {items.length === 0 && (
          <div className="card empty-state">
            <p className="muted">当前没有候选词。请拍照识别或在上方手动输入单词。</p>
          </div>
        )}

        {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}

        <button className="button" onClick={handleEnrichAndSave} disabled={loading || items.length === 0}>
          {loading ? "处理中..." : "自动补全并保存"}
        </button>

        <button className="button button-secondary" onClick={() => router.push("/capture")}>
          返回拍照
        </button>
      </div>
    </main>
  );
}

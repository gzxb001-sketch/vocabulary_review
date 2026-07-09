"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type WordActionsProps = {
  id: string;
  displayText: string;
  lemma: string;
  meaningZh?: string | null;
  phonetic?: string | null;
  partOfSpeech?: string | null;
  exampleSentence?: string | null;
  note?: string | null;
};

export default function WordActions(props: WordActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [displayText, setDisplayText] = useState(props.displayText);
  const [lemma, setLemma] = useState(props.lemma);
  const [meaningZh, setMeaningZh] = useState(props.meaningZh || "");
  const [phonetic, setPhonetic] = useState(props.phonetic || "");
  const [partOfSpeech, setPartOfSpeech] = useState(props.partOfSpeech || "");
  const [exampleSentence, setExampleSentence] = useState(props.exampleSentence || "");
  const [note, setNote] = useState(props.note || "");

  async function handleSave() {
    if (!displayText.trim()) {
      setError("单词或短语不能为空");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/words/${props.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayText, lemma, meaningZh, phonetic, partOfSpeech, exampleSentence, note }),
      });

      if (!res.ok) {
        setError("保存失败，请稍后重试");
        return;
      }

      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("确定删除这个词条吗？删除后相关来源和复习记录也会一起删除。");
    if (!confirmed) return;

    setError("");
    setDeleting(true);

    try {
      const res = await fetch(`/api/words/${props.id}`, { method: "DELETE" });

      if (!res.ok) {
        setError("删除失败，请稍后重试");
        return;
      }

      router.push("/words");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card stack">
      <h2 className="section-title">编辑词条</h2>

      {!editing ? (
        <div className="action-row-inline action-row">
          <button className="button button-secondary" onClick={() => setEditing(true)}>编辑</button>
          <button className="button button-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "删除中..." : "删除"}
          </button>
        </div>
      ) : (
        <div className="stack">
          <div>
            <label className="label">单词或短语</label>
            <input className="input" value={displayText} onChange={(e) => setDisplayText(e.target.value)} />
          </div>
          <div>
            <label className="label">Lemma</label>
            <input className="input" value={lemma} onChange={(e) => setLemma(e.target.value)} />
          </div>
          <div>
            <label className="label">中文义</label>
            <input className="input" value={meaningZh} onChange={(e) => setMeaningZh(e.target.value)} />
          </div>
          <div>
            <label className="label">音标</label>
            <input className="input" value={phonetic} onChange={(e) => setPhonetic(e.target.value)} />
          </div>
          <div>
            <label className="label">词性</label>
            <input className="input" value={partOfSpeech} onChange={(e) => setPartOfSpeech(e.target.value)} />
          </div>
          <div>
            <label className="label">例句</label>
            <textarea className="textarea" value={exampleSentence} onChange={(e) => setExampleSentence(e.target.value)} />
          </div>
          <div>
            <label className="label">备注</label>
            <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error ? <p className="muted">{error}</p> : null}

          <div className="action-row-inline action-row">
            <button className="button" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存修改"}</button>
            <button className="button button-secondary" onClick={() => { setEditing(false); setError(""); }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

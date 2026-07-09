"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDraftWordStore } from "@/store/draft-words";

type OcrCandidate = {
  tempId: string;
  text: string;
};

export default function CapturePage() {
  const router = useRouter();
  const { setItems } = useDraftWordStore();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!file) {
      setError("请先选择一张图片");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("识别失败，请稍后重试");
        return;
      }

      const data = await res.json();

      setItems(
        (data.candidates || []).map((item: OcrCandidate) => ({
          tempId: item.tempId,
          text: item.text,
          selected: true,
          sourceType: "exam",
          imageId: data.imageId,
        })),
      );

      router.push("/capture-review");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">拍照录词</h1>
        <p className="subtitle">上传你的手写或印刷生词图片，系统自动提取候选词条。</p>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        {file ? (
          <p className="muted">已选择：{file.name}</p>
        ) : null}

        <p className="muted">尽量平拍，避免阴影。建议一次只拍几行词。</p>

        {error ? <p className="muted">{error}</p> : null}

        <button className="button" onClick={handleSubmit} disabled={loading || !file}>
          {loading ? "识别中..." : "开始识别"}
        </button>
      </div>
    </main>
  );
}

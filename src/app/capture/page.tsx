"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { useRouter } from "next/navigation";
import { useDraftWordStore } from "@/store/draft-words";

function cleanOcrText(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .map((line) =>
      line
        .replace(/[|]/g, " ")
        .replace(/[\""\""\""']/g, "")
        .replace(/[，。；：？！,.;:!?()[\]{}<>]/g, " ")
        .replace(/\d+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((text) => text.length >= 2 && /^[A-Za-z][A-Za-z\s-]*[A-Za-z]$/.test(text))
    .filter((text, i, arr) => arr.map((t) => t.toLowerCase()).indexOf(text.toLowerCase()) === i);
}

export default function CapturePage() {
  const router = useRouter();
  const { setItems } = useDraftWordStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function handleOcr() {
    if (!file) { setError("请先选择一张图片"); return; }
    setError("");
    setLoading(true);
    setProgress("正在加载识别引擎...");

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setProgress("识别中... " + Math.round((m.progress || 0) * 100) + "%");
          } else if (m.status === "loading tesseract core") {
            setProgress("加载核心引擎...");
          } else if (m.status === "loading language traineddata") {
            setProgress("下载英文语言包...");
          } else if (m.status === "initializing tesseract") {
            setProgress("初始化识别...");
          }
        },
      });

      const { data } = await worker.recognize(file);
      await worker.terminate();

      const candidates = cleanOcrText(data.text || "");
      const now = Date.now();

      if (candidates.length === 0) {
        setError("未识别到英文单词，请确认图片中包含清晰的英文文本。");
        setLoading(false);
        return;
      }

      setItems(
        candidates.map((text, i) => ({
          tempId: "tmp_" + now + "_" + i,
          text,
          selected: true,
          sourceType: "exam" as const,
          imageId: "img_" + now,
        }))
      );

      router.push("/capture-review");
    } catch (e: any) {
      setError("识别失败：" + (e.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError("");
    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview("");
    }
  }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">拍照录词</h1>
        <p className="subtitle">上传包含英文单词的图片，系统自动提取候选词条。</p>

        {preview && (
          <div style={{ textAlign: "center" }}>
            <img
              src={preview}
              alt="预览"
              style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8, border: "1px solid var(--color-primary-border)" }}
            />
          </div>
        )}

        <div className="file-upload">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
          />
          <p style={{ textAlign: "center", marginTop: "var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            点击拍照或从相册选择
          </p>
        </div>

        {file ? <p className="muted">已选择：{file.name}</p> : null}

        <p className="muted">尽量平拍，确保英文文字清晰可见。</p>

        {error ? <p className="muted" style={{ color: "var(--color-error, #dc2626)" }}>{error}</p> : null}
        {loading && progress ? <p className="muted">{progress}</p> : null}

        <button className="button" onClick={handleOcr} disabled={loading || !file}>
          {loading ? "识别中..." : "开始识别"}
        </button>
      </div>
    </main>
  );
}
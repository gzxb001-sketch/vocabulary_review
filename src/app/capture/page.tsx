"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { useRouter } from "next/navigation";
import { useDraftWordStore } from "@/store/draft-words";
import { extractCandidatesFromRawText } from "@/lib/ocr-cleaner";

// 图片预处理：灰度化 + 增强对比度，提高 OCR 准确率
function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      // 获取像素数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 灰度化 + 对比度增强
      for (let i = 0; i < data.length; i += 4) {
        // 加权灰度
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        // 对比度增强：将亮度向两极推
        const enhanced = gray < 128 ? gray * 0.8 : Math.min(255, gray * 1.3);
        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
      }

      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("convert failed")), "image/jpeg", 0.9);
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = URL.createObjectURL(file);
  });
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
    setProgress("正在预处理图片...");

    try {
      // 图片预处理：灰度化 + 对比度增强
      setProgress("正在增强图片清晰度...");
      const processed = await preprocessImage(file);

      setProgress("正在加载识别引擎...");
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

      const { data } = await worker.recognize(processed);
      await worker.terminate();

      const candidates = extractCandidatesFromRawText(data.text || "");
      const now = Date.now();

      if (candidates.length === 0) {
        setError("未识别到英文单词，请确认图片中包含清晰的英文文本。");
        setLoading(false);
        return;
      }

      // 已校验的词排在前面
      const sorted = [...candidates].sort((a, b) => (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0));

      setItems(
        sorted.map((item, i) => ({
          tempId: "tmp_" + now + "_" + i,
          text: item.text,
          selected: item.isVerified || i === 0,
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

        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
          <label className="button button-secondary" style={{ cursor: "pointer", flex: 1, textAlign: "center" }}>
            拍照
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
          <label className="button button-secondary" style={{ cursor: "pointer", flex: 1, textAlign: "center" }}>
            相册选择
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {file ? <p className="muted">已选择：{file.name}</p> : null}

        <p className="muted">尽量平拍，确保英文文字清晰可见。</p>

        {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}
        {loading && progress ? <p className="muted">{progress}</p> : null}

        <button className="button" onClick={handleOcr} disabled={loading || !file}>
          {loading ? "识别中..." : "开始识别"}
        </button>
      </div>
    </main>
  );
}

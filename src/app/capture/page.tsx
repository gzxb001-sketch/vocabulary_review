"use client";

import { useState } from "react";
import { createWorker, PSM } from "tesseract.js";
import { useRouter } from "next/navigation";
import { useDraftWordStore } from "@/store/draft-words";
import { extractCandidatesFromRawText } from "@/lib/ocr-cleaner";
import { useAuth } from "@/lib/use-auth";
import GuestCta from "../ui/guest-cta";

// 图片预处理：小图放大 + 灰度化 + 直方图百分位自动色阶。
// LSTM 引擎对低分辨率文字极敏感（短边放大到 ≥1400px）；
// 百分位拉伸比固定阈值更能适应阴影与反光。
function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MIN_WIDTH = 1400;
      const scale = Math.max(1, MIN_WIDTH / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 灰度化 + 直方图统计
      const grays = new Uint8Array(data.length / 4);
      const hist = new Array(256).fill(0);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        grays[p] = gray;
        hist[Math.round(gray)]++;
      }

      // 2%/98% 百分位自动色阶
      const total = grays.length;
      let acc = 0;
      let lo = 0;
      let hi = 255;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (acc >= total * 0.02) { lo = v; break; }
      }
      acc = 0;
      for (let v = 255; v >= 0; v--) {
        acc += hist[v];
        if (acc >= total * 0.02) { hi = v; break; }
      }
      const range = Math.max(1, hi - lo);
      for (let p = 0; p < grays.length; p++) {
        const stretched = Math.max(0, Math.min(255, ((grays[p] - lo) / range) * 255));
        data[p * 4] = stretched;
        data[p * 4 + 1] = stretched;
        data[p * 4 + 2] = stretched;
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
  const { isGuest } = useAuth();

  type Candidate = { text: string; isMarked?: boolean; lowConfidence?: boolean; sourceContext?: string };

  // 将识别出的候选词写入草稿，标记词默认勾选（低置信词默认不勾，交由人工核对），并进入校对页
  function applyCandidates(candidates: Candidate[], now: number) {
    if (candidates.length === 0) {
      setError("未识别到英文单词，请确认图片中包含清晰的英文文本。");
      return;
    }
    const sorted = [...candidates].sort((a, b) => (b.isMarked ? 1 : 0) - (a.isMarked ? 1 : 0));
    setItems(
      sorted.map((item, i) => ({
        tempId: "tmp_" + now + "_" + i,
        text: item.text,
        selected: item.lowConfidence ? false : item.isMarked || i === 0,
        lowConfidence: item.lowConfidence,
        sourceType: "exam" as const,
        sourceContext: item.sourceContext,
        imageId: "img_" + now,
      }))
    );
    router.push("/capture-review");
  }

  // 从识别结果块中提取词级置信度映射（小写词 → 最高置信度）
  function buildWordConfidence(data: {
    blocks?: Array<{
      paragraphs?: Array<{ lines?: Array<{ words?: Array<{ text?: string; confidence?: number }> }> }>;
    }> | null;
  }): Map<string, number> {
    const map = new Map<string, number>();
    for (const block of data.blocks || []) {
      for (const p of block.paragraphs || []) {
        for (const line of p.lines || []) {
          for (const w of line.words || []) {
            const token = (w.text || "").toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
            if (!token) continue;
            const prev = map.get(token);
            map.set(token, Math.max(prev ?? 0, w.confidence ?? 0));
          }
        }
      }
    }
    return map;
  }

  // 本地 Tesseract 识别：白名单 + 双通道（整块/稀疏）按置信度择优 + 词级置信度
  async function recognizeWithTesseract(file: File) {
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

    // 白名单：只输出字母/连字符/空格，从源头减少数字与符号污染
    await worker.setParameters({
      tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'- ",
      preserve_interword_spaces: "1",
    });

    setProgress("识别中（整块模式）...");
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const blockRun = await worker.recognize(processed, {}, { blocks: true, text: true });

    setProgress("识别中（稀疏模式）...");
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const sparseRun = await worker.recognize(processed, {}, { blocks: true, text: true });
    await worker.terminate();

    const best = (sparseRun.data.confidence ?? 0) > (blockRun.data.confidence ?? 0) ? sparseRun : blockRun;
    const confidence = best.data.confidence ?? 0;
    const wordConf = buildWordConfidence(best.data as never);

    const candidates = extractCandidatesFromRawText(best.data.text || "", wordConf);
    applyCandidates(
      candidates.map((item) => ({
        text: item.text,
        isMarked: item.isVerified,
        lowConfidence: item.lowConfidence,
        sourceContext: item.sourceContext,
      })),
      Date.now(),
    );
  }

  async function handleOcr() {
    if (!file) { setError("请先选择一张图片"); return; }
    setError("");
    setLoading(true);

    try {
      await recognizeWithTesseract(file);
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

        {isGuest && <GuestCta message="可先体验 OCR 识别，登录后即可保存到词库" />}

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

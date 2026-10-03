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
  // 本地 tesseract 识别结果（文本 + 预处理图 base64），供「云端精识」复用
  const [ocrText, setOcrText] = useState("");
  const [ocrImageB64, setOcrImageB64] = useState("");
  // PDF 导入：提取出的全文（可编辑），用于生成候选词
  const [pdfText, setPdfText] = useState("");
  const [pdfPages, setPdfPages] = useState(0);
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
    try {
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

      const best = (sparseRun.data.confidence ?? 0) > (blockRun.data.confidence ?? 0) ? sparseRun : blockRun;
      const wordConf = buildWordConfidence(best.data as never);

      setOcrText(best.data.text || "");
      // 预处理图转 base64（不带 data: 前缀），供「云端精识」复用
      const b64Final = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = () => reject(new Error("图片转换失败"));
        reader.readAsDataURL(processed);
      });
      setOcrImageB64(b64Final);

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
    } finally {
      // 任一步抛错也要释放 WASM worker，避免占用数百 MB 内存
      await worker.terminate();
    }
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
    setOcrText("");
    setOcrImageB64("");
    setPdfText("");
    setPdfPages(0);
    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview("");
    }
  }

  // PDF 导入：pdf.js 提取文字版全文（每页一段），用户可编辑后一键生成候选词
  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setError("");
    setPdfText("");
    setPdfPages(0);
    if (!f) return;
    setLoading(true);
    setProgress("解析 PDF...");
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const maxPages = Math.min(doc.numPages, 30);
      const pages: string[] = [];
      for (let p = 1; p <= maxPages; p++) {
        setProgress(`解析 PDF... 第 ${p}/${maxPages} 页`);
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const text = content.items
          .map((it: unknown) => (it as { str?: string }).str ?? "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (text) pages.push(`【第 ${p} 页】\n${text}`);
      }
      if (pages.length === 0) {
        setError("未能从 PDF 提取出文本——可能是扫描版 PDF（图片型），请改用拍照识别。");
        return;
      }
      setPdfPages(pages.length);
      setPdfText(pages.join("\n\n"));
    } catch (err: unknown) {
      setError("PDF 解析失败：" + ((err as Error)?.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }

  // PDF 全文 → 候选词（生僻词默认勾选，基础词默认取消，进入确认页）
  function applyPdfCandidates() {
    if (!pdfText.trim()) return;
    const candidates = extractCandidatesFromRawText(pdfText).map((c) => ({
      text: c.text,
      isMarked: !c.isVerified, // 语义：常见基础词默认不选，生僻词默认选中
      sourceContext: c.sourceContext,
    }));
    applyCandidates(candidates, Date.now());
  }

  // 云端精识：同一张预处理图交给百度 OCR（免费额度内），替换本地识别结果
  async function handleCloudOcr() {
    if (!ocrImageB64) return;
    setError("");
    setLoading(true);
    setProgress("云端精识中...");
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: ocrImageB64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "云端识别失败，请稍后重试");
        return;
      }
      const candidates = extractCandidatesFromRawText(data.text || "").map((c) => ({
        text: c.text,
        isMarked: !c.isVerified,
        lowConfidence: c.lowConfidence,
        sourceContext: c.sourceContext,
      }));
      applyCandidates(candidates, Date.now());
    } catch {
      setError("云端识别失败，请检查网络后重试");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <main className="container fade-in">
      <div className="card stack">
        <h1 className="title">拍照 / PDF 录词</h1>
        <p className="subtitle">上传包含英文单词的图片或文字版 PDF，自动提取候选词条。</p>

        {isGuest && <GuestCta message="可先体验 OCR 识别，登录后即可保存到词库" />}

        {preview && (
          <div style={{ textAlign: "center" }}>
            {/* 本地 blob 预览：next/image 的远程优化无收益，直接用 img */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <label className="button button-secondary" style={{ cursor: "pointer", flex: 1, textAlign: "center" }}>
            导入 PDF（文字版）
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handlePdfChange}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {file ? <p className="muted">已选择图片：{file.name}</p> : null}
        {pdfPages > 0 && (
          <p className="muted">已从 PDF 提取 {pdfPages} 页文本（可编辑下方内容后提取候选词）：</p>
        )}
        {pdfText ? (
          <textarea
            className="input"
            rows={6}
            value={pdfText}
            onChange={(e) => setPdfText(e.target.value)}
            style={{ resize: "vertical", fontSize: "var(--text-xs)" }}
          />
        ) : null}

        <p className="muted">拍照请尽量平拍，确保英文文字清晰可见；PDF 支持文字版（扫描版请拍照）。</p>

        {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}
        {loading && progress ? <p className="muted">{progress}</p> : null}

        {!pdfText && (
          <button className="button" onClick={handleOcr} disabled={loading || !file}>
            {loading ? "识别中..." : "开始识别"}
          </button>
        )}
        {ocrText && ocrImageB64 && !pdfText && (
          <button className="button button-secondary" onClick={handleCloudOcr} disabled={loading}>
            云端精识（更准确）
          </button>
        )}
        {pdfText && (
          <button className="button" onClick={applyPdfCandidates} disabled={loading}>
            从 PDF 提取候选词 →
          </button>
        )}
      </div>
    </main>
  );
}

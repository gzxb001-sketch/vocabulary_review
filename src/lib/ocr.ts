import { createWorker } from "tesseract.js";
import { extractCandidatesFromRawText } from "@/lib/ocr-cleaner";

export type OcrCandidate = {
  text: string;
  confidence?: number;
};

export type OcrResult = {
  provider: "tesseract" | "mock";
  rawText: string;
  candidates: OcrCandidate[];
};

async function runMockOcr(): Promise<OcrResult> {
  const mockLines = ["abandon", "derive from", "compulsory"];
  const rawText = mockLines.join("\n");

  return {
    provider: "mock",
    rawText,
    candidates: extractCandidatesFromRawText(rawText).map((item) => ({
      text: item.text,
      confidence: 0.99,
    })),
  };
}

async function runTesseractOcr(fileBuffer: Buffer): Promise<OcrResult> {
  const worker = await createWorker("eng");

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(fileBuffer);

    const rawText = text || "";
    const normalizedConfidence =
      typeof confidence === "number" ? Number((confidence / 100).toFixed(2)) : undefined;
    const candidates = extractCandidatesFromRawText(rawText).map((item) => ({
      text: item.text,
      confidence: normalizedConfidence,
    }));

    return {
      provider: "tesseract",
      rawText,
      candidates,
    };
  } finally {
    await worker.terminate();
  }
}

export async function runOcr(fileBuffer: Buffer): Promise<OcrResult> {
  // 仅显式指定 mock 时才使用假数据（本地开发/联调用）
  if (process.env.OCR_PROVIDER === "mock") {
    return runMockOcr();
  }

  // 失败时向上抛出，由调用方返回明确错误，绝不静默回退到硬编码假数据
  return runTesseractOcr(fileBuffer);
}

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
  if (process.env.OCR_PROVIDER === "mock") {
    return runMockOcr();
  }

  try {
    return await runTesseractOcr(fileBuffer);
  } catch (error) {
    console.error("tesseract ocr failed, fallback to mock", error);
    return runMockOcr();
  }
}

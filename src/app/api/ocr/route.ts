import { NextRequest, NextResponse } from "next/server";
import { runOcr } from "@/lib/ocr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "file is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const result = await runOcr(fileBuffer);
    const now = Date.now();

    return NextResponse.json({
      imageId: `img_${now}`,
      provider: result.provider,
      rawText: result.rawText,
      candidates: result.candidates.map((item, index) => ({
        tempId: `tmp_${now}_${index}`,
        text: item.text,
        confidence: item.confidence,
      })),
    });
  } catch (error) {
    console.error("ocr failed", error);
    return NextResponse.json({ message: "ocr failed" }, { status: 500 });
  }
}

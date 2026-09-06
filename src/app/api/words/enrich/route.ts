import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichWords } from "@/lib/dictionary";
import { normalizeText } from "@/lib/normalize";

const requestSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1),
        // 用户遇到该词的原句（可选）：用于语境选义排序
        sourceContext: z.string().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "invalid request body" }, { status: 400 });
    }

    const items = parsed.data.items
      .map((item) => ({
        text: normalizeText(item.text),
        sourceContext: item.sourceContext || undefined,
      }))
      .filter((item) => Boolean(item.text));

    if (!items.length) {
      return NextResponse.json({ message: "no valid items" }, { status: 400 });
    }

    const enriched = await enrichWords(items);

    return NextResponse.json({ items: enriched });
  } catch (error) {
    console.error("enrich failed", error);
    return NextResponse.json({ message: "enrich failed" }, { status: 500 });
  }
}

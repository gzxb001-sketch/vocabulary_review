import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichWords } from "@/lib/dictionary";
import { normalizeText } from "@/lib/normalize";

const requestSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1),
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

    const texts = parsed.data.items.map((item) => normalizeText(item.text)).filter(Boolean);

    if (!texts.length) {
      return NextResponse.json({ message: "no valid items" }, { status: 400 });
    }

    const items = await enrichWords(texts);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("enrich failed", error);
    return NextResponse.json({ message: "enrich failed" }, { status: 500 });
  }
}

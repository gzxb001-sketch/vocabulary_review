import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichWords } from "@/lib/dictionary";
import { normalizeText } from "@/lib/normalize";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const requestSchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(100),
        // 用户遇到该词的原句（可选）：用于语境选义排序
        sourceContext: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  // 匿名可用的词典代理：按 IP 限流，防止脚本刷量消耗外部词典/翻译服务
  const ip = getClientIp(req);
  const rl = rateLimit(`enrich:${ip}`, { max: 20, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { message: "请求过于频繁，请稍后再试" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

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

import { NextRequest, NextResponse } from "next/server";
import { requireUserId, authError } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

type RawCandidate = { word: string; isMarked: boolean; context?: string };

function parseCandidates(content: string): RawCandidate[] {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  const json = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => Boolean(x) && typeof (x as { word?: unknown }).word === "string")
      .map((x) => {
        const raw = x as { word: string; isMarked?: unknown; context?: unknown };
        return {
          word: raw.word.trim(),
          isMarked: Boolean(raw.isMarked),
          context: typeof raw.context === "string" ? raw.context.trim() : undefined,
        };
      });
  } catch {
    return [];
  }
}

const PROMPT = `你是英语学习辅助工具。请识别图片中的所有英文单词或短语，尤其注意被红笔、荧光笔、下划线或圈出的单词（这些是用户标记的生词）。

要求：
1. 提取所有英文单词/短语（可包含连字符，如 "self-esteem"）。
2. 被标记（红笔/荧光笔/圈出/下划线）的单词，isMarked 设为 true，并排在前面。
3. 忽略中文、页码、无关符号和重复项。
4. 对每个单词，若能从图片中找到其所在的英文句子，填入 context（原句，可截断）。
5. 只输出 JSON 数组，不要输出任何解释、markdown 代码块或额外文字。

输出格式：
[{"word":"compulsory","isMarked":true,"context":"Education is compulsory for children."}]`;

export async function POST(req: NextRequest) {
  // 仅登录用户可使用 AI 识别，避免公网滥用消耗 API 额度；游客由前端降级到本地识别
  try {
    await requireUserId();
  } catch {
    return authError();
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ message: "未配置 DEEPSEEK_API_KEY" }, { status: 503 });
  }

  const formData = await req.formData().catch(() => null);
  const file = (formData?.get("file") as File | null) || null;
  if (!file || typeof (file as { arrayBuffer?: unknown }).arrayBuffer !== "function") {
    return NextResponse.json({ message: "缺少图片文件" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const base64 = buffer.toString("base64");
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

  let res: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    console.error("deepseek request failed", error);
    return NextResponse.json({ message: "AI 服务连接失败" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    console.error("deepseek api error", res.status, await res.text());
    return NextResponse.json({ message: "AI 识别失败" }, { status: 502 });
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return NextResponse.json({ message: "AI 返回内容异常" }, { status: 502 });
  }

  const candidates = parseCandidates(content);
  return NextResponse.json({
    candidates: candidates.map((c) => ({
      text: c.word,
      isMarked: c.isMarked,
      sourceContext: c.context,
    })),
  });
}

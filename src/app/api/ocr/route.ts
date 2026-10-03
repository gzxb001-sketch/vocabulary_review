import { NextRequest, NextResponse } from "next/server";
import { requireUserId, authError } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

// 百度 OCR 云端识别代理：拍照图片的高精度识别（本地 tesseract 的增强通道）。
// 密钥只存服务端环境变量；登录 + 限流双门槛防止免费额度被滥用。
// 未配置密钥时返回 503，客户端保留本地 tesseract 结果即可（功能无损）。

const TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const OCR_URL = "https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic";

// access_token 30 天有效，模块级缓存
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const apiKey = process.env.BAIDU_OCR_API_KEY;
  const secretKey = process.env.BAIDU_OCR_SECRET_KEY;
  if (!apiKey || !secretKey) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  try {
    const res = await fetch(`${TOKEN_URL}?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 2_592_000) * 1000 };
    return cachedToken.token;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return authError();
  }

  // 免费额度 1000 次/月：按用户限流每小时 30 次，防止脚本刷爆额度
  const rl = rateLimit(`ocr:${userId}`, { max: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { message: `云端识别次数已达上限（每小时 30 次），${Math.ceil(rl.retryAfterSec / 60)} 分钟后再试` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { image?: unknown } | null;
  const image = body?.image;
  if (typeof image !== "string" || image.length < 100 || image.length > 12_000_000) {
    return NextResponse.json({ message: "图片数据无效" }, { status: 400 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { message: "云端识别未配置：请在环境变量中设置 BAIDU_OCR_API_KEY 与 BAIDU_OCR_SECRET_KEY" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${OCR_URL}?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image, detect_direction: "true" }),
    });
    const data = (await res.json()) as {
      error_code?: number;
      error_msg?: string;
      words_result?: Array<{ words: string }>;
    };

    if (data.error_code) {
      // 额度用尽/QPS 超限等业务错误：透传信息，客户端回退本地识别
      return NextResponse.json({ message: `云端识别失败：${data.error_msg || data.error_code}` }, { status: 502 });
    }

    const text = (data.words_result ?? []).map((w) => w.words).join("\n");
    return NextResponse.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "云端识别服务暂时不可用" }, { status: 502 });
  }
}

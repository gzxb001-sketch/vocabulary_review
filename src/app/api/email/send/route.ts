import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/email-reminder";

// 定时发送入口：由外部 cron（如 Vercel Cron / cron-job.org）每分钟调用一次。
// 鉴权规则：
// - 配置了 CRON_SECRET：请求必须携带 Authorization: Bearer <CRON_SECRET>；
// - 生产环境未配置 CRON_SECRET：直接拒绝（403）——此接口会触发全量提醒发送，
//   绝不允许裸奔；本地开发（NODE_ENV !== production）放行以便调试。
// 同时支持 GET 与 POST，兼容 cron-job.org 默认的 GET 请求。
async function handleSend(req: Request) {
  const secret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (!secret && isProduction) {
    return NextResponse.json(
      {
        error:
          "forbidden: CRON_SECRET is not configured. Set it in production environment variables and send it as 'Authorization: Bearer <CRON_SECRET>'.",
      },
      { status: 403 },
    );
  }

  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await sendDueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: (e as Error)?.message || String(e) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handleSend(req);
}

export async function POST(req: Request) {
  return handleSend(req);
}

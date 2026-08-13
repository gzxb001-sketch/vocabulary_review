import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailReminderEnabled: true,
      emailReminderHour: true,
      emailReminderMinute: true,
    },
  });

  if (!user) return authError();

  return NextResponse.json({
    email: user.email,
    enabled: user.emailReminderEnabled,
    hour: user.emailReminderHour,
    minute: user.emailReminderMinute,
  });
}

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  let body: { enabled?: boolean; hour?: number; minute?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const hour = clampInt(body.hour, 0, 23);
  const minute = clampInt(body.minute, 0, 59);

  const data: Record<string, unknown> = {};
  if (enabled !== undefined) data.emailReminderEnabled = enabled;
  if (hour !== null) data.emailReminderHour = hour;
  if (minute !== null) data.emailReminderMinute = minute;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: userId }, data });

  return NextResponse.json({ ok: true });
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

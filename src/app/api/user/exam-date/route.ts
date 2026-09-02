import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";
import { z } from "zod";

const bodySchema = z.object({
  // null 表示清除考试日期，回到常规节奏
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function PUT(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ message: "日期格式应为 YYYY-MM-DD" }, { status: 400 });
    }

    let examDate: Date | null = null;
    if (parsed.data.examDate) {
      examDate = new Date(`${parsed.data.examDate}T00:00:00Z`);
      if (Number.isNaN(examDate.getTime())) {
        return NextResponse.json({ message: "无效的日期" }, { status: 400 });
      }
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      if (examDate.getTime() < now.getTime()) {
        return NextResponse.json({ message: "考试日期不能早于今天" }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { examDate },
      select: { examDate: true },
    });

    return NextResponse.json({ ok: true, examDate: user.examDate });
  } catch (error) {
    console.error("update exam date failed:", error);
    return NextResponse.json({ message: "保存失败，请稍后重试" }, { status: 500 });
  }
}

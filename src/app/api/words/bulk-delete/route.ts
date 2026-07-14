import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

const requestSchema = z.object({ ids: z.array(z.string().min(1)).min(1) });

export async function POST(req: NextRequest) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "invalid request body" }, { status: 400 });
    }

    const ids = Array.from(new Set(parsed.data.ids));
    const result = await prisma.word.deleteMany({
      where: { id: { in: ids }, userId },
    });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error("bulk delete failed", error);
    return NextResponse.json({ message: "bulk delete failed" }, { status: 500 });
  }
}

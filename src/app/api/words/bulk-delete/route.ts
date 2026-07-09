import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const requestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ message: "invalid request body" }, { status: 400 });
    }

    const ids = Array.from(new Set(parsed.data.ids));
    const result = await prisma.word.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("bulk delete words failed", error);
    return NextResponse.json({ message: "bulk delete failed" }, { status: 500 });
  }
}

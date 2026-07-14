import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId, authError } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const { id } = await params;
    const body = await req.json();

    const displayText = typeof body.displayText === "string" ? body.displayText.trim() : "";

    if (!displayText) {
      return NextResponse.json({ message: "displayText is required" }, { status: 400 });
    }

    const updated = await prisma.word.update({
      where: { id, userId },
      data: {
        displayText,
        lemma: (typeof body.lemma === "string" ? body.lemma.trim().toLowerCase() : "") || displayText.toLowerCase(),
        meaningZh: typeof body.meaningZh === "string" ? body.meaningZh.trim() : "",
        phonetic: typeof body.phonetic === "string" ? body.phonetic.trim() : "",
        partOfSpeech: typeof body.partOfSpeech === "string" ? body.partOfSpeech.trim() : "",
        exampleSentence: typeof body.exampleSentence === "string" ? body.exampleSentence.trim() : "",
        note: typeof body.note === "string" ? body.note.trim() : "",
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("update word failed", error);
    return NextResponse.json({ message: "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return authError(); }

  try {
    const { id } = await params;

    await prisma.word.delete({ where: { id, userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("delete word failed", error);
    return NextResponse.json({ message: "delete failed" }, { status: 500 });
  }
}

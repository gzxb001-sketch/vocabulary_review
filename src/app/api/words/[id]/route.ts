import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const displayText = typeof body.displayText === "string" ? body.displayText.trim() : "";
    const meaningZh = typeof body.meaningZh === "string" ? body.meaningZh.trim() : "";
    const phonetic = typeof body.phonetic === "string" ? body.phonetic.trim() : "";
    const partOfSpeech = typeof body.partOfSpeech === "string" ? body.partOfSpeech.trim() : "";
    const exampleSentence =
      typeof body.exampleSentence === "string" ? body.exampleSentence.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const lemmaInput = typeof body.lemma === "string" ? body.lemma.trim().toLowerCase() : "";

    if (!displayText) {
      return NextResponse.json({ message: "displayText is required" }, { status: 400 });
    }

    const updated = await prisma.word.update({
      where: { id },
      data: {
        displayText,
        lemma: lemmaInput || displayText.toLowerCase(),
        meaningZh,
        phonetic,
        partOfSpeech,
        exampleSentence,
        note,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error("update word failed", error);
    return NextResponse.json({ message: "update failed" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.word.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("delete word failed", error);
    return NextResponse.json({ message: "delete failed" }, { status: 500 });
  }
}

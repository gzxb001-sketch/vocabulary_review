import { useDraftWordStore } from "@/store/draft-words";

// 游客/未登录时录入的草稿词，在登录/注册成功后迁移到服务端账号。
// 失败时返回 null（草稿仍保留在 localStorage，下次登录会再尝试），不阻塞登录跳转。
export async function migrateDraftWords(): Promise<number | null> {
  const { items, clear } = useDraftWordStore.getState();
  const selected = items.filter((item) => item.selected && item.text.trim());
  if (selected.length === 0) return null;

  try {
    const enrichRes = await fetch("/api/words/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: selected.map((item) => ({ text: item.text })) }),
    });
    if (!enrichRes.ok) return null;

    const enrichData = await enrichRes.json();
    const enrichedItems: Array<{
      text: string;
      lemma?: string;
      meaningZh?: string;
      phonetic?: string;
      partOfSpeech?: string;
      exampleSentence?: string;
      synonyms?: string[];
      meanings?: unknown[];
    }> = enrichData.items || [];

    const saveItems = selected.map((item) => {
      const enriched = enrichedItems.find((entry) => entry.text === item.text);
      return {
        displayText: item.text.trim(),
        lemma: (enriched?.lemma || item.text).trim().toLowerCase(),
        meaningZh: enriched?.meaningZh || "",
        phonetic: enriched?.phonetic || "",
        partOfSpeech: enriched?.partOfSpeech || "",
        exampleSentence: enriched?.exampleSentence || "",
        synonyms: enriched?.synonyms || [],
        meanings: enriched?.meanings || [],
        source: {
          sourceType: item.sourceType,
          sourceNote: item.sourceNote || "",
          sourceContext: item.sourceContext,
        },
      };
    });

    const saveRes = await fetch("/api/words/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: saveItems }),
    });
    if (!saveRes.ok) return null;

    clear();
    return saveItems.length;
  } catch {
    return null;
  }
}

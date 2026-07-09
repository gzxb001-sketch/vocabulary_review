import { create } from "zustand";

export type DraftWord = {
  tempId: string;
  text: string;
  selected: boolean;
  lemma?: string;
  meaningZh?: string;
  phonetic?: string;
  partOfSpeech?: string;
  exampleSentence?: string;
  sourceType: "exam" | "reading" | "lecture" | "manual" | "other";
  sourceNote?: string;
  imageId?: string;
};

type DraftWordStore = {
  items: DraftWord[];
  setItems: (items: DraftWord[]) => void;
  updateItem: (tempId: string, patch: Partial<DraftWord>) => void;
  removeItem: (tempId: string) => void;
  clear: () => void;
};

export const useDraftWordStore = create<DraftWordStore>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  updateItem: (tempId, patch) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.tempId === tempId ? { ...item, ...patch } : item,
      ),
    })),
  removeItem: (tempId) =>
    set((state) => ({
      items: state.items.filter((item) => item.tempId !== tempId),
    })),
  clear: () => set({ items: [] }),
}));

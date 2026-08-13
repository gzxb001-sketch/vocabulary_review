import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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
  sourceContext?: string;
  imageId?: string;
};

type DraftWordStore = {
  items: DraftWord[];
  setItems: (items: DraftWord[]) => void;
  addItems: (items: DraftWord[]) => void;
  updateItem: (tempId: string, patch: Partial<DraftWord>) => void;
  removeItem: (tempId: string) => void;
  clear: () => void;
};

// 持久化到 localStorage：游客/未登录时录入的草稿词刷新后不丢，
// 登录后再由 draft-migrate 迁移到服务端账号。
export const useDraftWordStore = create<DraftWordStore>()(
  persist(
    (set) => ({
      items: [],
      setItems: (items) => set({ items }),
      addItems: (newItems) => set((state) => ({ items: [...state.items, ...newItems] })),
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
    }),
    {
      name: "zhumo-draft-words",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// 离线复习工具 — 基于 IndexedDB
// 在地铁/电梯等网络不稳定场景下仍可继续复习，连网后自动同步答题结果

const DB_NAME = "zhumo-offline";
const DB_VERSION = 1;
const STORE_REVIEW = "reviewItems";
const STORE_QUEUE = "submitQueue";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_REVIEW)) {
        db.createObjectStore(STORE_REVIEW, { keyPath: "wordId" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 缓存复习词条
export async function saveReviewItems(items: unknown[]) {
  if (!items.length) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_REVIEW, "readwrite");
    const store = tx.objectStore(STORE_REVIEW);
    store.clear(); // 每次覆盖最新数据
    for (const item of items) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB 不可用时静默失败
  }
}

// 读取缓存的复习词条
export async function getCachedReviewItems(): Promise<unknown[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_REVIEW, "readonly");
      const req = tx.objectStore(STORE_REVIEW).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// 将答题结果加入提交队列
export async function enqueueSubmit(entry: {
  wordId: string;
  result: "known" | "vague" | "forgot";
}) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).add({
      ...entry,
      createdAt: Date.now(),
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 静默失败
  }
}

// 获取所有待提交的队列
async function getQueue(): Promise<
  { id: number; wordId: string; result: string; createdAt: number }[]
> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_QUEUE, "readonly");
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// 删除已成功提交的队列项
async function removeFromQueue(id: number) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).delete(id);
  } catch {
    // 静默
  }
}

// 同步队列中的答题结果到服务器
export async function syncQueue(): Promise<{
  synced: number;
  remaining: number;
}> {
  const queue = await getQueue();
  if (!queue.length) return { synced: 0, remaining: 0 };

  let synced = 0;

  for (const entry of queue) {
    try {
      const res = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: entry.wordId, result: entry.result }),
      });
      if (res.ok) {
        await removeFromQueue(entry.id);
        synced++;
      }
    } catch {
      // 网络不可用，停止同步
      break;
    }
  }

  const remaining = queue.length - synced;
  return { synced, remaining };
}

// 获取队列长度（用于显示待同步数量）
export async function getQueueSize(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

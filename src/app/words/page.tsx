"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/use-auth";
import GuestCta from "../ui/guest-cta";

type WordItem = {
  id: string;
  displayText: string;
  meaningZh?: string;
  phonetic?: string;
  nextReviewAt?: string | null;
  sourceType?: string | null;
};

type FilterValue = "all" | "due" | "exam" | "reading" | "lecture" | "manual" | "longSentence" | "translation" | "other";
type SortValue = "created_desc" | "created_asc" | "review_asc" | "alpha_asc";

export default function WordsPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [sort, setSort] = useState<SortValue>("created_desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { user, loading: authLoading, isGuest } = useAuth();

  async function handleAddToReview(wordId: string, displayText: string) {
    try {
      const res = await fetch(`/api/words/${wordId}/review-now`, { method: "PATCH" });
      if (res.ok) {
        setHint(`「${displayText}」已加入今日复习`);
      } else {
        setHint("操作失败，请重试");
      }
    } catch {
      setHint("网络错误，请重试");
    }
  }

  const exportHref = `/api/words/export?${new URLSearchParams({
    q: query,
    filter,
    sort,
  }).toString()}`;

  async function fetchPage(search: string, nextFilter: FilterValue, nextSort: SortValue, offset: number) {
    const params = new URLSearchParams({
      q: search,
      filter: nextFilter,
      sort: nextSort,
      offset: String(offset),
      limit: "50",
    });
    const res = await fetch(`/api/words/search?${params.toString()}`);
    if (res.status === 401) {
      return { items: [] as WordItem[], total: 0, hasMore: false };
    }
    const data = await res.json();
    return {
      items: (data.items || []) as WordItem[],
      total: data.total ?? 0,
      hasMore: Boolean(data.hasMore),
    };
  }

  async function loadWords(search = query, nextFilter = filter, nextSort = sort) {
    setLoading(true);
    setError("");

    const page = await fetchPage(search, nextFilter, nextSort, 0);

    setItems(page.items);
    setTotal(page.total);
    setHasMore(page.hasMore);
    setSelectedIds((prev) => prev.filter((id) => page.items.some((item) => item.id === id)));
    setLoading(false);
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const page = await fetchPage(query, filter, sort, items.length);
    setItems((prev) => [...prev, ...page.items]);
    setTotal(page.total);
    setHasMore(page.hasMore);
    setLoadingMore(false);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function selectAllVisible() {
    setSelectedIds(items.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) {
      setError("请先选择要删除的词条");
      return;
    }

    const confirmed = window.confirm(
      `确定删除选中的 ${selectedIds.length} 个词条吗？删除后相关来源和复习记录也会一起删除。`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const res = await fetch("/api/words/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: selectedIds,
        }),
      });

      if (!res.ok) {
        setError("批量删除失败，请稍后重试");
        return;
      }

      await loadWords();
      setSelectedIds([]);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    if (user) loadWords();
  }, [isGuest, user]);

  if (authLoading) {
    return (
      <main className="container">
        <div className="card">
          <p className="muted">加载中...</p>
        </div>
      </main>
    );
  }

  if (isGuest) {
    return (
      <main className="container fade-in">
        <div className="card empty-state">
          <h1 className="empty-state-title">词库需要登录</h1>
          <p className="empty-state-text">
            登录后即可查看、搜索和管理你录入过的单词。<br />
            拍照录词、手动录入、间隔复习，数据云端永久保存。
          </p>
          <GuestCta message="注册账号，拥有自己的专属词库" />
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="card stack">
        <h1 className="title">词库</h1>
        <p className="subtitle">搜索你录过的单词、短语或中文义。</p>

        <div className="search-row">
          <input
            className="input"
            placeholder="搜索单词、短语或中文义"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button search-button" onClick={() => loadWords()}>
            搜索
          </button>
        </div>

        <div className="filters-grid">
          <div>
            <label className="label">筛选</label>
            <select
              className="select"
              value={filter}
              onChange={(e) => {
                const nextFilter = e.target.value as FilterValue;
                setFilter(nextFilter);
                loadWords(query, nextFilter, sort);
              }}
            >
              <option value="all">全部</option>
              <option value="due">待复习</option>
              <option value="exam">真题</option>
              <option value="reading">阅读</option>
              <option value="lecture">听课</option>
              <option value="manual">手动</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div>
            <label className="label">排序</label>
            <select
              className="select"
              value={sort}
              onChange={(e) => {
                const nextSort = e.target.value as SortValue;
                setSort(nextSort);
                loadWords(query, filter, nextSort);
              }}
            >
              <option value="created_desc">最近新增</option>
              <option value="created_asc">最早新增</option>
              <option value="review_asc">最先复习</option>
              <option value="alpha_asc">字母排序</option>
            </select>
          </div>
        </div>

        <div className="action-row">
          <a href={exportHref} className="link-button secondary" download>
            导出当前结果 CSV
          </a>
          <p className="muted">会导出当前搜索、筛选和排序下的全部词条，便于备份或迁移。</p>
        </div>
      </div>

      <div className="page-block" />

      <div className="card">
        <h2 className="section-title">
          词条列表
          {!loading && total > 0 ? <span className="muted">（已显示 {items.length} / 共 {total} 条）</span> : null}
        </h2>

        <div className="action-row">
          <div className="action-row-inline">
            <button className="button button-secondary" onClick={selectAllVisible} disabled={!items.length}>
              全选当前显示
            </button>
            <button
              className="button button-secondary"
              onClick={clearSelection}
              disabled={!selectedIds.length}
            >
              清空选择
            </button>
          </div>
          <button
            className="button button-danger"
            onClick={handleBulkDelete}
            disabled={!selectedIds.length || deleting}
          >
            {deleting ? "删除中..." : `批量删除已选 ${selectedIds.length} 条`}
          </button>
          <p className="muted">适合 OCR 批量导入后快速清理无效词条，点击词条标题仍可进入详情页。</p>
          {error ? <p className="muted">{error}</p> : null}
          {hint ? <p className="muted" style={{ color: "var(--color-success)" }}>{hint}</p> : null}
        </div>

        {loading ? <p className="muted">加载中...</p> : null}
        {!loading && items.length === 0 ? (
          <p className="muted">暂无词条，先去录入几个词吧。</p>
        ) : null}

        <div className="stack">
          {items.map((item) => (
            <div key={item.id} className="list-card">
              <div className="list-card-top">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelected(item.id)}
                  />
                  <span className="muted">选择</span>
                </label>
                <Link href={`/words/${item.id}`} className="list-card-link">
                  查看详情
                </Link>
                <button
                  className="link-button secondary"
                  style={{ padding: "2px 8px", fontSize: "var(--text-xs)", background: "transparent" }}
                  onClick={(e) => {
                    e.preventDefault();
                    handleAddToReview(item.id, item.displayText);
                  }}
                >
                  📅 加入复习
                </button>
              </div>
              <strong>{item.displayText}</strong>
              <span className="muted">{item.meaningZh || "暂无释义"}</span>
              {item.phonetic ? <span className="muted">{item.phonetic}</span> : null}
              {item.sourceType ? <span className="muted">来源：{item.sourceType}</span> : null}
              <span className="muted">
                下次复习：
                {item.nextReviewAt ? new Date(item.nextReviewAt).toLocaleString() : "未安排"}
              </span>
            </div>
          ))}
        </div>

        {hasMore ? (
          <div className="action-row">
            <button className="button button-secondary" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "加载中..." : `加载更多（还剩 ${Math.max(total - items.length, 0)} 条）`}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

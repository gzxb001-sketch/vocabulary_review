"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WordItem = {
  id: string;
  displayText: string;
  meaningZh?: string;
  phonetic?: string;
  nextReviewAt?: string | null;
  sourceType?: string | null;
};

type FilterValue = "all" | "due" | "exam" | "reading" | "lecture" | "manual" | "other";
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

  const exportHref = `/api/words/export?${new URLSearchParams({
    q: query,
    filter,
    sort,
  }).toString()}`;

  async function loadWords(search = query, nextFilter = filter, nextSort = sort) {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      q: search,
      filter: nextFilter,
      sort: nextSort,
    });

    const res = await fetch(`/api/words/search?${params.toString()}`);
    const data = await res.json();

    const nextItems = data.items || [];
    setItems(nextItems);
    setSelectedIds((prev) => prev.filter((id) => nextItems.some((item: WordItem) => item.id === id)));
    setLoading(false);
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
    loadWords();
  }, []);

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

      <div style={{ height: 16 }} />

      <div className="card">
        <h2 className="section-title">词条列表</h2>

        <div className="action-row">
          <div className="action-row-inline">
            <button className="button button-secondary" onClick={selectAllVisible} disabled={!items.length}>
              全选当前结果
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
      </div>
    </main>
  );
}

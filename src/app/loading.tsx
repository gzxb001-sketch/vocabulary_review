// 根级跳转骨架屏：App Router 导航时目标段渲染完成前，旧页面会一直停留。
// 有了这段 loading，点击底部导航的瞬间就能看到骨架反馈，
// 首页（十余个统计查询）等慢渲染页不再表现为「按了没反应」。
export default function Loading() {
  return (
    <main className="container fade-in">
      <div className="card stack">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-text" />
      </div>
    </main>
  );
}

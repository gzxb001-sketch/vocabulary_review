import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container fade-in">
      <div className="card empty-state">
        <span className="empty-state-icon">📭</span>
        <h1 className="empty-state-title">页面不存在</h1>
        <p className="empty-state-text">
          你访问的页面不存在或已被移除。
        </p>
        <div className="link-row">
          <Link href="/" className="link-button">
            返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}

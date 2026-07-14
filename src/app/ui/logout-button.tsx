"use client";

export default function LogoutButton() {
  return (
    <form method="post" action="/api/auth/login" onSubmit={async (e) => {
      e.preventDefault();
      await fetch("/api/auth/login", { method: "DELETE" });
      window.location.href = "/login";
    }}>
      <button type="submit" className="link-button">退出</button>
    </form>
  );
}

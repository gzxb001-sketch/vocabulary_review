import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 无需登录即可访问的页面路径
const PUBLIC_PAGE_PATHS = [
  "/login",
  "/capture",
  "/capture-review",
  "/manual",
  "/words",
  "/review",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 首页 "/" 始终公开
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 公开页面：登录、拍照录词、手动录词、词库、复习
  if (PUBLIC_PAGE_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API 请求由各自的 requireUserId 控制在路由层鉴权
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("vocab-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|manifest.json).*)",
  ],
};

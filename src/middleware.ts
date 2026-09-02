import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/token";

// 无需登录即可访问的页面路径
const PUBLIC_PAGE_PATHS = [
  "/login",
  "/capture",
  "/capture-review",
  "/manual",
  "/words",
  "/review",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 首页 "/" 始终公开
  if (pathname === "/") {
    return NextResponse.next();
  }

  // 公开页面：登录、拍照录词、手动录词、词库列表、复习。
  // 用精确匹配（而非 startsWith），避免 /words/recent、/words/stubborn、
  // /words/[id] 等个人数据页面被误放行为公开页。
  if (PUBLIC_PAGE_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // API 请求由各自的 requireUserId 控制在路由层鉴权
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 校验 token 有效性（而非仅存在性）：过期/伪造 token 会被拦截并清除，
  // 避免用户进入个人页面后才发现会话失效。
  const userId = await verifyToken(token);
  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-192.png|icon-512.png|manifest.json|sw.js).*)",
  ],
};

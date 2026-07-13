import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const nodeEnv = process.env.NODE_ENV;

  // 列出所有 DATABASE 和 TURSO 相关环境变量
  const envKeys = Object.keys(process.env).filter(k =>
    k.toUpperCase().includes("DATABASE") || k.toUpperCase().includes("TURSO") || k === "NODE_ENV"
  );
  const envSnapshot: Record<string, string> = {};
  for (const k of envKeys) {
    const v = process.env[k] || "";
    envSnapshot[k] = v.length > 30 ? v.substring(0, 30) + "..." : v;
  }

  return NextResponse.json({
    hasDatabaseUrl: !!dbUrl,
    databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + "..." : "NOT SET",
    hasAuthToken: !!authToken,
    nodeEnv,
    envKeysFound: envKeys,
    envSnapshot,
    timestamp: new Date().toISOString(),
  });
}

import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const nodeEnv = process.env.NODE_ENV;

  return NextResponse.json({
    hasDatabaseUrl: !!dbUrl,
    databaseUrlPrefix: dbUrl ? dbUrl.substring(0, 15) + "..." : "NOT SET",
    hasAuthToken: !!authToken,
    nodeEnv,
    timestamp: new Date().toISOString(),
  });
}

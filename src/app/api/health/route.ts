import { NextResponse } from "next/server";

export async function GET() {
  // 只暴露存活状态。环境细节（连接串、密钥前缀、变量名清单）绝不外泄——
  // 此前曾返回 env 快照，等于向公网公开数据库主机与部署信息。
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}

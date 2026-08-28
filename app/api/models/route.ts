import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    connected: true,
  });
}
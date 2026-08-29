import { NextResponse } from "next/server";

const DEFAULT_MODEL = "qwen/qwen3.8-27b";

export async function GET() {
  const model = process.env.GROQ_MODEL_NAME || DEFAULT_MODEL;

  return NextResponse.json({
    models: [model],
    connected: true,
  });
}

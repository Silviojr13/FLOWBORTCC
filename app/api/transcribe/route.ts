import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

// POST (multipart, campo "audio"): transcreve a fala pelo Whisper do Groq. É o caminho dos
// navegadores sem reconhecimento de voz próprio; Chrome e Edge transcrevem no navegador.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Transcrição indisponível no servidor." }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Nenhum áudio recebido." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Áudio longo demais. Grave até 2 minutos por vez." }, { status: 413 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "fala.webm");
  upstream.append("model", process.env.GROQ_TRANSCRIBE_MODEL || "whisper-large-v3-turbo");
  upstream.append("language", "pt");
  upstream.append("response_format", "json");
  upstream.append("temperature", "0");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upstream,
  }).catch(() => null);

  if (!res) return NextResponse.json({ error: "Não foi possível falar com o serviço de transcrição." }, { status: 503 });
  if (!res.ok) {
    // O erro bruto (com ids da conta) fica só no log do servidor.
    console.log("[ERROR] Transcrição do Groq:", res.status, await res.text());
    const error =
      res.status === 403
        ? "A transcrição de áudio está desativada no projeto do Groq. Use o Chrome ou o Edge, que transcrevem no navegador."
        : res.status === 429
          ? "Limite de transcrição atingido. Aguarde um pouco e tente de novo."
          : "Não foi possível transcrever o áudio.";
    return NextResponse.json({ error }, { status: res.status });
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ text: typeof data.text === "string" ? data.text.trim() : "" });
}

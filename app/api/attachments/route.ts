import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  isAcceptedAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_CHARS,
  MAX_ATTACHMENT_CHARS_OWN_KEY,
  type ChatAttachment,
} from "@/lib/chat-attachments";
import { compactText, condenseText, DocumentFormatError, extractDocumentText } from "@/lib/document-text";
import { assistantAiKey } from "@/lib/user-ai-keys";

export const runtime = "nodejs";

// POST: lê um arquivo anexado ao chat ou ao assistente e devolve o texto pronto para a IA.
// Nada fica guardado aqui: o texto vai junto da mensagem, como os anexos de texto já iam.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Escolha um arquivo." }, { status: 400 });
  if (!isAcceptedAttachment(file.name)) {
    return NextResponse.json({ error: "Formato não aceito. Envie PDF, Word (.docx), Markdown, texto ou código." }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Arquivo grande demais. Envie um arquivo de até 10 MB." }, { status: 400 });
  }

  let text: string;
  try {
    text = compactText(await extractDocumentText(file.name, new Uint8Array(await file.arrayBuffer())));
  } catch (error) {
    if (error instanceof DocumentFormatError) {
      return NextResponse.json({ error: "Formato não aceito. Envie PDF, Word (.docx), Markdown, texto ou código." }, { status: 400 });
    }
    console.error("Erro ao ler anexo:", error);
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo. Se for um PDF escaneado (imagem), envie a versão em Word ou texto." },
      { status: 422 }
    );
  }
  if (!text) {
    return NextResponse.json(
      { error: "Não encontrei texto no arquivo. Se for um PDF escaneado (imagem), envie a versão em Word ou texto." },
      { status: 422 }
    );
  }

  // Com a chave própria (fora do Groq gratuito), o anexo pode ser bem maior.
  const ownKey = await assistantAiKey(user.id);
  const roomy = Boolean(ownKey?.target && ownKey.target.provider !== "groq");
  const { text: content, condensed } = condenseText(text, roomy ? MAX_ATTACHMENT_CHARS_OWN_KEY : MAX_ATTACHMENT_CHARS);

  const attachment: ChatAttachment = { name: file.name.slice(0, 120), content, truncated: condensed };
  return NextResponse.json({ attachment, originalChars: text.length, roomy });
}

import { NextRequest, NextResponse } from "next/server";
import { authorizeProject } from "@/lib/project-access";
import { tursoDb } from "@/lib/turso-db";
import { isDevNoteKind, type DevNoteView } from "@/lib/dev-notes";

type Params = { params: Promise<{ id: string }> };

const PAGE_SIZE = 50;

// GET: andamento do desenvolvimento registrado pelo Claude Code (aba Desenvolvimento).
// Quem vê o projeto vê o andamento.
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const gate = await authorizeProject(projectId);
  if (gate instanceof Response) return gate;

  const before = req.nextUrl.searchParams.get("antes");
  const beforeDate = before ? new Date(before) : null;

  const rows = await tursoDb.devNote.findMany({
    where: {
      projectId,
      ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    include: { task: { select: { id: true, title: true } } },
  });

  const authorIds = Array.from(new Set(rows.map((r) => r.authorId).filter((id): id is string => !!id)));
  const authors = authorIds.length
    ? await tursoDb.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const authorName = new Map(authors.map((a) => [a.id, a.name?.trim() || a.email?.split("@")[0] || null]));

  const notes: DevNoteView[] = rows.slice(0, PAGE_SIZE).map((r) => ({
    id: r.id,
    kind: isDevNoteKind(r.kind) ? r.kind : "progresso",
    message: r.message,
    link: r.link,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    task: r.task,
    author: r.authorId ? authorName.get(r.authorId) ?? null : null,
  }));
  return NextResponse.json({ notes, hasMore: rows.length > PAGE_SIZE });
}

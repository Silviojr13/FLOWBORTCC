import Image from "next/image"
import Link from "next/link"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { InviteResponse, InviteSignIn } from "@/components/sharing/invite-response"
import { describeInvitation } from "@/lib/project-sharing"
import { tursoDb } from "@/lib/turso-db"

export const metadata = { title: "Convite para projeto · FlowBot" }

// Página do convite para um projeto. Funciona antes do login: mostra o projeto e guarda o
// convite no navegador; depois de entrar, a pessoa aceita e vira visitante.
export default async function ProjectInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const session = await auth()
  const user = session?.user?.id
    ? await tursoDb.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true } })
    : null
  const invite = await describeInvitation(code, user)
  const owner = invite?.ownerName?.trim() || "Uma pessoa"

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <Image src="/images/robo-flowbot.png" alt="" width={48} height={48} />
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Convite para projeto</p>
            <h1 className="truncate text-xl font-semibold text-foreground">
              {invite ? invite.projectName : "Convite não encontrado"}
            </h1>
          </div>
        </div>

        {!invite ? (
          <p className="text-sm text-muted-foreground">
            Este link de convite não existe. Confira se o endereço foi copiado inteiro ou peça um novo a
            quem compartilhou o projeto.
          </p>
        ) : invite.status === "membro" ? (
          <>
            <p className="text-sm text-muted-foreground">Você já participa deste projeto.</p>
            <Button asChild size="lg">
              <Link href={`/dashboard/projects/${invite.projectId}`}>Abrir o projeto</Link>
            </Button>
          </>
        ) : invite.status === "encerrado" ? (
          <p className="text-sm text-muted-foreground">
            Este convite não vale mais: expirou, foi cancelado ou já foi respondido. Peça um novo a quem
            compartilhou o projeto.
          </p>
        ) : invite.status === "outra-conta" ? (
          <p className="text-sm text-muted-foreground">
            Este convite foi enviado para <strong className="font-medium text-foreground">{invite.sentTo}</strong>.
            Saia desta conta e entre com esse e-mail para aceitar.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground">
              <p>
                {owner} convidou você para acompanhar o projeto <strong>{invite.projectName}</strong> no FlowBot.
              </p>
              <p className="text-muted-foreground">
                Você entra como <strong className="font-medium text-foreground">visitante</strong>: vê o
                andamento, as tarefas, os requisitos e os relatórios, sem editar nada. Quem compartilhou
                pode mudar seu cargo depois.
              </p>
            </div>
            {user ? (
              <InviteResponse code={invite.code} canDecline={invite.kind === "email"} />
            ) : (
              <>
                <p className="-mb-2 text-xs text-muted-foreground">
                  Entre ou crie sua conta. O convite fica guardado e aparece em Projetos.
                </p>
                <InviteSignIn code={invite.code} />
              </>
            )}
          </>
        )}

        <Link href="/" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          flowbottcc.vercel.app
        </Link>
      </div>
    </main>
  )
}

import Image from "next/image"
import Link from "next/link"
import { auth } from "@/auth"
import { findInvite } from "@/lib/study-server"
import { InviteActions } from "@/components/study/invite-actions"

export const metadata = { title: "Convite para avaliação · FlowBot" }

// Página pública do convite: apresenta a avaliação e guarda o código no navegador. O aceite
// do termo acontece dentro do FlowBot, no painel do participante, depois do login.
export default async function StudyInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [invite, session] = await Promise.all([findInvite(code), auth()])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <Image src="/images/robo-flowbot.png" alt="" width={48} height={48} />
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Convite para avaliação</p>
            <h1 className="text-xl font-semibold text-foreground">
              {invite ? invite.title : "Convite não encontrado"}
            </h1>
          </div>
        </div>

        {!invite ? (
          <p className="text-sm text-muted-foreground">
            Este link de convite não existe. Confira se o endereço foi copiado inteiro ou peça um novo
            link à equipe.
          </p>
        ) : invite.status !== "aberta" ? (
          <p className="text-sm text-muted-foreground">
            Esta avaliação já foi encerrada. Obrigado pelo interesse!
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground">
              {invite.intro.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <ol className="flex flex-col gap-1.5 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <li>
                1. {session?.user ? "Continue para o FlowBot." : "Crie sua conta (ou entre, se já tiver uma)."}
              </li>
              <li>2. Aceite o termo de participação no painel “Guia do participante”, à direita.</li>
              <li>3. Siga as tarefas e, no fim, responda ao questionário no mesmo painel.</li>
            </ol>
            <InviteActions code={invite.code} loggedIn={Boolean(session?.user)} />
            {invite.contact && <p className="text-xs text-muted-foreground">{invite.contact}</p>}
          </>
        )}

        <Link href="/" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          flowbottcc.vercel.app
        </Link>
      </div>
    </main>
  )
}

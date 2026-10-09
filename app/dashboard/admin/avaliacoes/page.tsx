import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Workspace } from "@/components/layout/workspace"
import { AdminStudies } from "@/components/study/admin-studies"
import { isAdmin } from "@/lib/study-server"
import { tursoDb } from "@/lib/turso-db"

export const metadata = { title: "Avaliações de usabilidade · FlowBot" }

// Área do admin: cria avaliações, gera o link de convite e acompanha os resultados (RNF01).
export default async function AdminStudiesPage() {
  const session = await auth()
  if (!session?.user?.id || !(await isAdmin(session.user.id))) redirect("/dashboard")

  // As avaliações agora ficam na aba Avaliação do projeto avaliado. Esta tela só continua
  // para as que ainda não têm projeto.
  const [linked, unlinked] = await Promise.all([
    tursoDb.study.findFirst({ where: { projectId: { not: null } }, orderBy: { createdAt: "desc" }, select: { projectId: true } }),
    tursoDb.study.count({ where: { projectId: null } }),
  ])
  if (linked?.projectId && unlinked === 0) redirect(`/dashboard/projects/${linked.projectId}/avaliacao`)

  return (
    <Workspace width="wide">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Avaliações de usabilidade</h1>
          <p className="text-sm text-muted-foreground">
            Convide participantes, acompanhe as tarefas do roteiro e a nota do questionário SUS.
          </p>
        </div>
        <AdminStudies />
      </div>
    </Workspace>
  )
}

import { Workspace } from "@/components/layout/workspace"

/** Moldura das telas de criação de projeto (conversa com a IA, criação manual e etapas). */
export function ProjectCreationLayout({ children }: { children: React.ReactNode }) {
  return (
    <Workspace width="creation" className="mx-auto flex w-full flex-1 flex-col gap-8 pt-4 lg:pt-8">
      <div className="min-w-0 flex-1">{children}</div>
    </Workspace>
  )
}

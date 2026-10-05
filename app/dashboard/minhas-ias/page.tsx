import { Workspace } from "@/components/layout/workspace"
import { MyAiKeys } from "@/components/ai/my-ai-keys"

export const metadata = { title: "Minhas IAs · FlowBot" }

// Minhas IAs: conectar IAs pagas com a própria chave e escolher quem responde no assistente.
export default function MyAiKeysPage() {
  return (
    <Workspace width="focused">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Minhas IAs</h1>
          <p className="text-sm text-muted-foreground">
            Conecte as IAs que você já paga e o Claude Code para trabalharem junto com o FlowBot.
          </p>
        </div>
        <MyAiKeys />
      </div>
    </Workspace>
  )
}

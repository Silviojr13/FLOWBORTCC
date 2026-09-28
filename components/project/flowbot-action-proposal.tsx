"use client"

import { useState } from "react"
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  CircleXIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  MoveRightIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  describeAction,
  type ActionResult,
  type FlowbotAction,
} from "@/lib/flowbot-actions"
import { cn } from "@/lib/utils"

function ActionIcon({ type }: { type: FlowbotAction["type"] }) {
  if (type.startsWith("create")) return <PlusIcon className="size-3.5 text-primary" aria-hidden />
  if (type.startsWith("update")) return <PencilIcon className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
  if (type.startsWith("delete")) return <Trash2Icon className="size-3.5 text-destructive" aria-hidden />
  return <MoveRightIcon className="size-3.5 text-primary" aria-hidden />
}

/**
 * Card de confirmação das alterações propostas pelo assistente.
 * Nada é gravado até o usuário revisar a lista e clicar em "Confirmar alterações".
 */
export function FlowbotActionProposal({
  actions,
  results,
  isApplying,
  onConfirm,
  onDiscard,
}: {
  actions: FlowbotAction[]
  results: ActionResult[] | null
  isApplying: boolean
  onConfirm: (actions: FlowbotAction[]) => void
  onDiscard: () => void
}) {
  // Todas marcadas por padrão; o usuário pode desmarcar o que não quiser aplicar.
  const [selected, setSelected] = useState<boolean[]>(() => actions.map(() => true))

  const hasDestructive = actions.some((a) => a.type.startsWith("delete"))
  const chosen = actions.filter((_, i) => selected[i])

  if (results) {
    const okCount = results.filter((r) => r.ok).length
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-3 text-[13px]">
        <p className="mb-2 flex items-center gap-1.5 font-medium">
          <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          {okCount} de {results.length} alteração(ões) aplicada(s)
        </p>
        <ul className="flex flex-col gap-1">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5">
              {r.ok ? (
                <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <CircleXIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden />
              )}
              <span className={cn(!r.ok && "text-destructive")}>{r.message}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-[13px]">
      <p className="mb-1 font-medium text-foreground">
        O FlowBot quer alterar o projeto ({actions.length})
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        Revise antes de confirmar. Nada é salvo sem a sua autorização.
      </p>

      <ul className="mb-3 flex flex-col gap-1.5">
        {actions.map((action, i) => {
          const { verb, target, details } = describeAction(action)
          return (
            <li key={i}>
              <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-background/60">
                <input
                  type="checkbox"
                  className="mt-1 size-3.5 shrink-0 accent-[var(--color-primary)]"
                  checked={selected[i]}
                  disabled={isApplying}
                  onChange={(e) =>
                    setSelected((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <ActionIcon type={action.type} />
                    <span className="font-medium">{verb}</span>
                  </span>
                  <span className="block break-words">{target}</span>
                  {details.length > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      {details.join(" · ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {hasDestructive && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Há exclusões nesta proposta. Confira antes de confirmar.
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={isApplying} onClick={onDiscard}>
          <XIcon className="size-3.5" />
          Descartar
        </Button>
        <Button
          size="sm"
          disabled={isApplying || chosen.length === 0}
          onClick={() => onConfirm(chosen)}
        >
          <CheckIcon className="size-3.5" />
          {isApplying ? "Aplicando..." : `Confirmar (${chosen.length})`}
        </Button>
      </div>
    </div>
  )
}

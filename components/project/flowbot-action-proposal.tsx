"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangleIcon,
  CopyIcon,
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
  ACTION_GROUPS,
  actionGroup,
  describeAction,
  type ActionResult,
  type FlowbotAction,
} from "@/lib/flowbot-actions"
import { findDuplicateHints, type DuplicateHint, type ExistingProjectItems } from "@/lib/flowbot-duplicates"
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
  projectId,
}: {
  actions: FlowbotAction[]
  results: ActionResult[] | null
  isApplying: boolean
  onConfirm: (actions: FlowbotAction[]) => void
  onDiscard: () => void
  /** Com o projeto, o card confere se o que vai ser criado já existe. */
  projectId?: string
}) {
  // Todas marcadas por padrão; o usuário pode desmarcar o que não quiser aplicar.
  const [selected, setSelected] = useState<boolean[]>(() => actions.map(() => true))
  const [hints, setHints] = useState<Map<number, DuplicateHint>>(() => new Map())

  // Confere as criações contra o que o projeto já tem (inclusive tarefas concluídas). O que
  // quase certamente repete algo vem desmarcado; a pessoa pode marcar de novo.
  useEffect(() => {
    if (!projectId || !actions.some((a) => a.type.startsWith("create"))) return
    let cancelled = false
    const get = (path: string): Promise<Partial<ExistingProjectItems>> =>
      fetch(`/api/projects/${projectId}/${path}`).then((r) => (r.ok ? r.json() : {}))
    Promise.all([get("tasks"), get("features"), get("requirements")])
      .then(([t, f, r]) => {
        if (cancelled) return
        const found = findDuplicateHints(actions, {
          tasks: t.tasks ?? [],
          features: f.features ?? [],
          requirements: r.requirements ?? [],
        })
        setHints(found)
        setSelected((prev) => prev.map((v, i) => (found.get(i)?.level === "duplicate" ? false : v)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [actions, projectId])
  const duplicates = [...hints.values()].filter((h) => h.level === "duplicate").length

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
        <ul className="flex max-h-[45vh] flex-col gap-1 overflow-y-auto pr-1">
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
        Revise antes de confirmar: desmarque o que não quiser. Nada é salvo sem a sua autorização, e
        tudo pode ser editado depois nas telas do projeto.
      </p>

      {/* Agrupado na ordem em que um projeto se estrutura: requisito, funcionalidade, sprint, tarefa. */}
      <div className="mb-3 flex max-h-[45vh] flex-col gap-3 overflow-y-auto pr-1">
        {ACTION_GROUPS.map((group) => {
          const items = actions.map((action, index) => ({ action, index })).filter(({ action }) => actionGroup(action.type) === group)
          if (items.length === 0) return null
          const allChecked = items.every(({ index }) => selected[index])
          return (
            <section key={group} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 px-1.5">
                <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group} ({items.length})
                </h4>
                {items.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                    disabled={isApplying}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.map((v, idx) => (items.some((it) => it.index === idx) ? !allChecked : v))
                      )
                    }
                  >
                    {allChecked ? "Desmarcar todos" : "Marcar todos"}
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {items.map(({ action, index }) => {
                  const { verb, target, details } = describeAction(action)
                  return (
                    <li key={index}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 hover:bg-background/60">
                        <input
                          type="checkbox"
                          className="mt-1 size-3.5 shrink-0 accent-[var(--color-primary)]"
                          checked={selected[index]}
                          disabled={isApplying}
                          onChange={(e) =>
                            setSelected((prev) => prev.map((v, idx) => (idx === index ? e.target.checked : v)))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <ActionIcon type={action.type} />
                            <span className="font-medium">{verb}</span>
                          </span>
                          <span className="block break-words">{target}</span>
                          {details.length > 0 && (
                            <span className="block text-xs text-muted-foreground">{details.join(" · ")}</span>
                          )}
                          {hints.get(index) && (
                            <span
                              className={cn(
                                "mt-0.5 flex items-start gap-1 text-xs",
                                hints.get(index)!.level === "duplicate"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-muted-foreground"
                              )}
                            >
                              <CopyIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                              {hints.get(index)!.message}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      {duplicates > 0 && (
        <p className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <CopyIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {duplicates} item(ns) parece(m) repetir o que o projeto já tem e veio(vieram) desmarcado(s). Marque de
          novo se for mesmo algo novo.
        </p>
      )}

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

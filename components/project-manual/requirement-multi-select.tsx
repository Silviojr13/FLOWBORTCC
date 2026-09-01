"use client"

import { useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface RequirementOption {
  id: string
  code: string
  description: string
}

export function RequirementMultiSelect({
  requirements,
  selectedIds,
  onChange,
  disabled,
}: {
  requirements: RequirementOption[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = requirements.filter((r) => selectedIds.includes(r.id))

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Requisitos relacionados</span>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((req) => (
            <span
              key={req.id}
              className="inline-flex max-w-full items-start gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
            >
              <span className="min-w-0">
                <span className="font-mono text-[10px] text-muted-foreground">{req.code}</span>
                <span className="block leading-snug text-foreground">{req.description}</span>
              </span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(req.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label={`Remover ${req.code}`}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5">
              <PlusIcon className="size-3.5" />
              Selecionar requisitos
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 max-h-72 overflow-y-auto p-2">
            {requirements.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Cadastre requisitos antes de vincular.
              </p>
            ) : (
              requirements.map((req) => {
                const checked = selectedIds.includes(req.id)
                return (
                  <label
                    key={req.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/60",
                      checked && "bg-muted/40"
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggle(req.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug text-foreground">
                        {req.description}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {req.code}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

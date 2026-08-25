"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getNextRequirementId,
  type Requirement,
} from "@/lib/requirement-ids"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

const NEW_ROW_ID = "__new__"

export function RequirementsTable() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId !== null) {
      inputRef.current?.focus()
    }
  }, [editingId])

  function startCreate() {
    setEditingId(NEW_ROW_ID)
    setEditText("")
  }

  function startEdit(requirement: Requirement) {
    setEditingId(requirement.id)
    setEditText(requirement.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText("")
  }

  function confirmEdit() {
    const trimmed = editText.trim()
    if (!trimmed) return

    if (editingId === NEW_ROW_ID) {
      setRequirements((prev) => [
        ...prev,
        { id: getNextRequirementId(prev), text: trimmed },
      ])
    } else if (editingId) {
      setRequirements((prev) =>
        prev.map((requirement) =>
          requirement.id === editingId
            ? { ...requirement, text: trimmed }
            : requirement
        )
      )
    }

    cancelEdit()
  }

  function deleteRequirement(id: string) {
    setRequirements((prev) => prev.filter((requirement) => requirement.id !== id))
    if (editingId === id) {
      cancelEdit()
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      confirmEdit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancelEdit()
    }
  }

  const isCreating = editingId === NEW_ROW_ID
  const showEmptyState = requirements.length === 0 && !isCreating

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="w-24 text-muted-foreground">ID</TableHead>
              <TableHead className="text-muted-foreground">Requisito</TableHead>
              <TableHead className="w-32 text-right text-muted-foreground">
                Ações
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requirements.map((requirement) => {
              const isEditing = editingId === requirement.id

              return (
                <TableRow
                  key={requirement.id}
                  className="border-white/6 hover:bg-white/4"
                >
                  <TableCell className="font-mono text-sm text-primary/90">
                    {requirement.id}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {isEditing ? (
                      <Input
                        ref={inputRef}
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        onKeyDown={handleInputKeyDown}
                        onBlur={() => {
                          if (editText.trim()) {
                            confirmEdit()
                          } else {
                            cancelEdit()
                          }
                        }}
                        className="h-9 border-white/10 bg-white/5"
                        aria-label={`Editar requisito ${requirement.id}`}
                      />
                    ) : (
                      <span className="text-foreground">{requirement.text}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!isEditing && (
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => startEdit(requirement)}
                              aria-label={`Editar ${requirement.id}`}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <PencilIcon className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => deleteRequirement(requirement.id)}
                              aria-label={`Excluir ${requirement.id}`}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2Icon className="size-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}

            {isCreating && (
              <TableRow className="border-white/6 hover:bg-white/4">
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {getNextRequirementId(requirements)}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <Input
                    ref={inputRef}
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    onBlur={() => {
                      if (!editText.trim()) {
                        cancelEdit()
                      }
                    }}
                    placeholder="Descreva o requisito..."
                    className="h-9 border-white/10 bg-white/5"
                    aria-label="Novo requisito"
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            )}

            {showEmptyState && (
              <TableRow className="border-white/6 hover:bg-transparent">
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum requisito cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <Button
          onClick={startCreate}
          disabled={editingId !== null}
          className="gap-2 rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_-6px_oklch(0.65_0.2_250/40%)] hover:bg-primary/90"
        >
          <PlusIcon className="size-4" />
          Criar requisito
        </Button>
      </div>
    </div>
  )
}

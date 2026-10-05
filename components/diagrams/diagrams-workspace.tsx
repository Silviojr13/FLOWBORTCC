"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CopyIcon,
  DatabaseIcon,
  FileImageIcon,
  FileCodeIcon,
  LoaderCircleIcon,
  NetworkIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { MermaidView, type MermaidViewHandle } from "@/components/diagrams/mermaid-view"
import {
  DIAGRAM_GROUPS,
  DIAGRAM_TYPES,
  getDiagramType,
  type Diagram,
  type DiagramSource,
} from "@/lib/diagrams"
import { cn } from "@/lib/utils"
import { useProjectPermissions } from "@/components/project/project-permissions-context"

const SOURCE_LABEL: Record<DiagramSource, string> = {
  ia: "Gerado pela IA",
  dados: "Dados do projeto",
  manual: "Editado à mão",
}

function slug(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  const box = svg.viewBox.baseVal
  if (box?.width) {
    clone.setAttribute("width", String(box.width))
    clone.setAttribute("height", String(box.height))
    clone.style.width = ""
  }
  return new XMLSerializer().serializeToString(clone)
}

async function svgToPng(svg: SVGSVGElement): Promise<Blob> {
  const box = svg.viewBox.baseVal
  const width = box?.width || svg.getBoundingClientRect().width
  const height = box?.height || svg.getBoundingClientRect().height
  const scale = 2
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializeSvg(svg))}`

  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("Falha ao preparar a imagem"))
    image.src = url
  })

  const canvas = document.createElement("canvas")
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  const ctx = canvas.getContext("2d")!
  // Fundo sólido: PNG transparente fica ilegível em documentos com tema escuro.
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#ffffff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar o PNG"))), "image/png")
  )
}

export function DiagramsWorkspace({ projectId, projectName }: { projectId: string; projectName: string }) {
  // Quem só vê abre e exporta os diagramas salvos; gerar, corrigir e editar usam a IA e gravam.
  const editable = useProjectPermissions().canEdit.diagramas
  const [diagrams, setDiagrams] = useState<Diagram[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [newType, setNewType] = useState("c4-context")
  const [instructions, setInstructions] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const [tab, setTab] = useState("diagrama")
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState<null | "salvar" | "regenerar" | "corrigir">(null)
  // Falha de desenho ligada ao código que falhou: só vale enquanto esse código estiver na tela.
  const [renderFailure, setRenderFailure] = useState<{ code: string; message: string } | null>(null)

  const viewRef = useRef<MermaidViewHandle>(null)
  // Cada diagrama ganha uma correção automática por sessão; depois disso o usuário decide.
  const autoRepaired = useRef(new Set<string>())

  const selected = diagrams.find((d) => d.id === selectedId) ?? null
  const newTypeInfo = getDiagramType(newType)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${projectId}/diagrams`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const list: Diagram[] = data.diagrams ?? []
        setDiagrams(list)
        setSelectedId((current) => current ?? list[0]?.id ?? null)
      })
      .catch(() => toast.error("Não foi possível carregar os diagramas."))
      .finally(() => !cancelled && setIsLoading(false))
    return () => {
      cancelled = true
    }
  }, [projectId])

  const upsert = useCallback((diagram: Diagram) => {
    setDiagrams((list) => [diagram, ...list.filter((d) => d.id !== diagram.id)])
  }, [])

  function select(diagram: Diagram) {
    setSelectedId(diagram.id)
    setDraft(diagram.code)
    setTab("diagrama")
  }

  async function generate() {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/diagrams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, instructions }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível gerar o diagrama.")
      upsert(data.diagram)
      select(data.diagram)
      setInstructions("")
      toast.success(`${data.diagram.title} gerado.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o diagrama.")
    } finally {
      setIsGenerating(false)
    }
  }

  const regenerate = useCallback(
    async (diagram: Diagram, error?: string) => {
      setBusy(error ? "corrigir" : "regenerar")
      try {
        const res = await fetch(`/api/projects/${projectId}/diagrams/${diagram.id}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Não foi possível gerar o diagrama.")
        upsert(data.diagram)
        setDraft(data.diagram.code)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível gerar o diagrama.")
      } finally {
        setBusy(null)
      }
    },
    [projectId, upsert]
  )

  async function saveCode() {
    if (!selected) return
    setBusy("salvar")
    try {
      const res = await fetch(`/api/projects/${projectId}/diagrams/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Não foi possível salvar.")
      upsert(data.diagram)
      setTab("diagrama")
      toast.success("Código salvo.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.")
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!selected) return
    if (!window.confirm(`Excluir o diagrama "${selected.title}"?`)) return
    const res = await fetch(`/api/projects/${projectId}/diagrams/${selected.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Não foi possível excluir o diagrama.")
      return
    }
    const rest = diagrams.filter((d) => d.id !== selected.id)
    setDiagrams(rest)
    if (rest[0]) select(rest[0])
    else setSelectedId(null)
  }

  const handleRenderError = useCallback(
    (message: string, code: string) => {
      setRenderFailure({ code, message })
      if (!editable || !selected || selected.code !== code) return
      if (selected.source !== "ia" || autoRepaired.current.has(selected.id)) return
      autoRepaired.current.add(selected.id)
      void regenerate(selected, message)
    },
    [editable, selected, regenerate]
  )

  function exportFile(kind: "svg" | "png" | "mmd") {
    if (!selected) return
    const base = slug(`${projectName}-${selected.title}`) || "diagrama"
    if (kind === "mmd") {
      download(new Blob([selected.code], { type: "text/plain" }), `${base}.mmd`)
      return
    }
    const svg = viewRef.current?.getSvg()
    if (!svg) {
      toast.error("O diagrama ainda não foi desenhado.")
      return
    }
    if (kind === "svg") {
      download(new Blob([serializeSvg(svg)], { type: "image/svg+xml" }), `${base}.svg`)
      return
    }
    svgToPng(svg)
      .then((blob) => download(blob, `${base}.png`))
      .catch(() => toast.error("Não foi possível exportar em PNG. Use o SVG."))
  }

  async function copyCode() {
    if (!selected) return
    await navigator.clipboard.writeText(selected.code)
    toast.success("Código Mermaid copiado.")
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Novo diagrama */}
      {editable && (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-none" data-tour="diagrams-new">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-foreground">Novo diagrama</h2>
            <p className="text-xs text-muted-foreground">
              Escolha o tipo. Rastreabilidade e cronograma saem direto dos dados do projeto; os
              demais são escritos pela IA a partir dos requisitos, funcionalidades e componentes.
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="w-full lg:w-64" aria-label="Tipo de diagrama">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAGRAM_GROUPS.map((group) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {DIAGRAM_TYPES.filter((t) => t.group === group).map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {newTypeInfo?.engine === "ia" && (
              <Input
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={newTypeInfo.placeholder ?? "Instruções opcionais para a IA"}
                className="lg:flex-1"
                maxLength={500}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) void generate()
                }}
              />
            )}
            <Button onClick={() => void generate()} disabled={isGenerating} className="lg:ml-auto">
              {isGenerating ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : newTypeInfo?.engine === "ia" ? (
                <SparklesIcon />
              ) : (
                <DatabaseIcon />
              )}
              {isGenerating ? "Gerando…" : "Gerar diagrama"}
            </Button>
          </div>
          {newTypeInfo && <p className="text-xs text-muted-foreground">{newTypeInfo.description}</p>}
        </section>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Lista */}
        <aside className="flex flex-col gap-2 lg:w-64 lg:shrink-0" data-tour="diagrams-list">
          <h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Diagramas do projeto
          </h2>
          {isLoading && <p className="px-1 text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && diagrams.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              Nenhum diagrama ainda. Gere o primeiro acima.
            </p>
          )}
          {diagrams.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => select(d)}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                d.id === selectedId
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card hover:bg-accent"
              )}
            >
              <span className="truncate font-medium text-foreground">{d.title}</span>
              {d.instructions && (
                <span className="truncate text-xs text-foreground/70" title={d.instructions}>
                  {d.instructions}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {SOURCE_LABEL[d.source as DiagramSource] ?? d.source} ·{" "}
                {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
              </span>
            </button>
          ))}
        </aside>

        {/* Visualização */}
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          {!selected && !isLoading && (
            <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center text-sm text-muted-foreground">
              <NetworkIcon className="size-8" aria-hidden />
              Selecione ou gere um diagrama para visualizar.
            </div>
          )}

          {selected && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-foreground">{selected.title}</h2>
                  <Badge variant="secondary">
                    {SOURCE_LABEL[selected.source as DiagramSource] ?? selected.source}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {editable && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void regenerate(selected)}
                    >
                      {busy === "regenerar" ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
                      {getDiagramType(selected.type)?.engine === "dados" ? "Atualizar" : "Gerar de novo"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportFile("svg")}>
                    <FileCodeIcon />
                    SVG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportFile("png")}>
                    <FileImageIcon />
                    PNG
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void copyCode()}>
                    <CopyIcon />
                    Mermaid
                  </Button>
                  {editable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Excluir diagrama"
                      onClick={() => void remove()}
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>
              </div>

              {busy === "corrigir" && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                  A sintaxe gerada tinha um erro; a IA está corrigindo o diagrama…
                </p>
              )}
              {editable && renderFailure?.code === selected.code && busy === null && (
                <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-destructive">O diagrama não pôde ser desenhado.</span>
                  <div className="flex gap-2">
                    {selected.source !== "dados" && (
                      <Button size="sm" variant="outline" onClick={() => void regenerate(selected, renderFailure.message)}>
                        <WandSparklesIcon />
                        Corrigir com IA
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraft(selected.code)
                        setTab("codigo")
                      }}
                    >
                      <PencilIcon />
                      Editar código
                    </Button>
                  </div>
                </div>
              )}

              <Tabs
                value={tab}
                onValueChange={(value) => {
                  if (value === "codigo") setDraft(selected.code)
                  setTab(value)
                }}
              >
                <TabsList>
                  <TabsTrigger value="diagrama">Diagrama</TabsTrigger>
                  <TabsTrigger value="codigo">Código Mermaid</TabsTrigger>
                </TabsList>
                <TabsContent value="diagrama" className="mt-3">
                  <MermaidView
                    key={selected.id}
                    ref={viewRef}
                    code={selected.code}
                    onError={handleRenderError}
                    onRendered={() => setRenderFailure(null)}
                  />
                </TabsContent>
                <TabsContent value="codigo" className="mt-3 flex flex-col gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    readOnly={!editable}
                    spellCheck={false}
                    className="min-h-80 font-mono text-xs"
                    aria-label="Código Mermaid do diagrama"
                  />
                  {editable && (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        Sintaxe em mermaid.js.org. Ao salvar, o diagrama passa a ser “Editado à mão”.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void saveCode()}
                        disabled={busy !== null || draft.trim() === "" || draft === selected.code}
                      >
                        {busy === "salvar" && <LoaderCircleIcon className="animate-spin" />}
                        Salvar código
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

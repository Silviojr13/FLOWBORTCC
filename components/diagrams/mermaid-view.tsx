"use client"

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { LoaderCircleIcon, MinusIcon, PlusIcon, ScanIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface MermaidViewHandle {
  /** SVG pronto para exportar, ou null se o diagrama não renderizou. */
  getSvg: () => SVGSVGElement | null
}

// O Mermaid guarda estado global durante a renderização: uma de cada vez.
let queue: Promise<unknown> = Promise.resolve()
let counter = 0

export async function renderMermaid(code: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import("mermaid")
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: dark ? "dark" : "default",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    // Rótulos em SVG puro (sem foreignObject): a exportação para PNG funciona em qualquer navegador.
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: "basis" },
  })

  const id = `mermaid-${++counter}`
  try {
    await mermaid.parse(code)
    const { svg } = await mermaid.render(id, code)
    return svg
  } finally {
    // Em caso de erro o Mermaid deixa um elemento temporário no body.
    document.getElementById(`d${id}`)?.remove()
    document.getElementById(id)?.remove()
  }
}

/** Largura natural do desenho, lida do viewBox do SVG gerado. */
function viewBoxWidth(svg: string | null): number | null {
  const match = svg?.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)/)
  return match ? Number(match[1]) : null
}

function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.split("\n").slice(0, 6).join("\n")
}

export const MermaidView = forwardRef<
  MermaidViewHandle,
  {
    code: string
    /** Recebe também o código que falhou, para o aviso não valer para outra versão. */
    onError?: (message: string, code: string) => void
    onRendered?: () => void
  }
>(function MermaidView({ code, onError, onRendered }, ref) {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  const hostRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null)
  // null = ajustar à largura da área; número = escala escolhida pelo usuário.
  const [zoom, setZoom] = useState<number | null>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const [areaWidth, setAreaWidth] = useState(0)

  // Os callbacks mudam a cada render do pai; a renderização só depende do código e do tema.
  const callbacks = useRef({ onError, onRendered })
  useEffect(() => {
    callbacks.current = { onError, onRendered }
  })

  useImperativeHandle(ref, () => ({
    getSvg: () => hostRef.current?.querySelector("svg") ?? null,
  }))

  useEffect(() => {
    let cancelled = false
    const job = queue.then(async () => {
      try {
        const result = await renderMermaid(code, dark)
        if (cancelled) return
        setSvg(result)
        setFailure(null)
        callbacks.current.onRendered?.()
      } catch (error) {
        if (cancelled) return
        const message = errorMessage(error)
        setSvg(null)
        setFailure({ code, message })
        callbacks.current.onError?.(message, code)
      }
    })
    queue = job.catch(() => {})
    return () => {
      cancelled = true
    }
  }, [code, dark])

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const observer = new ResizeObserver(([entry]) => setAreaWidth(entry.contentRect.width))
    observer.observe(area)
    return () => observer.disconnect()
  }, [])

  const naturalWidth = useMemo(() => viewBoxWidth(svg), [svg])
  const fit = naturalWidth && areaWidth ? Math.min(1, areaWidth / naturalWidth) : 1
  const scale = zoom ?? fit

  // Dimensiona o SVG pela escala: acima da largura da área, ela passa a rolar.
  useEffect(() => {
    const el = hostRef.current?.querySelector("svg")
    if (!el || !naturalWidth) return
    el.style.maxWidth = "none"
    el.style.height = "auto"
    el.style.width = `${Math.round(naturalWidth * scale)}px`
  }, [svg, naturalWidth, scale])

  const step = (delta: number) =>
    setZoom(Math.min(3, Math.max(0.2, Math.round((scale + delta) * 10) / 10)))

  const isLoading = !svg && failure?.code !== code

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Diminuir zoom"
          onClick={() => step(-0.2)}
        >
          <MinusIcon className="size-4" />
        </Button>
        <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Aumentar zoom"
          onClick={() => step(0.2)}
        >
          <PlusIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Ajustar à largura"
          title="Ajustar à largura"
          onClick={() => setZoom(null)}
        >
          <ScanIcon className="size-4" />
        </Button>
      </div>

      <div className="relative min-h-80 overflow-auto rounded-xl border border-border bg-card p-4">
        <div ref={areaRef} className="w-full" aria-hidden />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
            Desenhando o diagrama…
          </div>
        )}
        {failure && failure.code === code && (
          <pre className="whitespace-pre-wrap rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {failure.message}
          </pre>
        )}
        {svg && (
          <div
            ref={hostRef}
            className="mx-auto w-max [&_svg]:block"
            // O SVG vem do Mermaid com securityLevel "strict", que sanitiza rótulos e links.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  )
})

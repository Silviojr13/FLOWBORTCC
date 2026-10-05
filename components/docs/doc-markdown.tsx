"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { MermaidView } from "@/components/diagrams/mermaid-view"

/** Markdown de documento técnico: tabelas, listas, títulos e diagramas Mermaid desenhados. */
export function DocMarkdown({ content }: Readonly<{ content: string }>) {
  return (
    <div className="text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h4>,
          h4: ({ children }) => <h5 className="mt-2 mb-1 text-sm font-medium">{children}</h5>,
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-2.5 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-2.5 py-1.5 align-top">{children}</td>,
          code: ({ className, children }) => {
            const text = String(children ?? "")
            if (className === "language-mermaid") {
              return (
                <div className="my-3 rounded-lg border border-border bg-card p-2">
                  <MermaidView code={text.trim()} />
                </div>
              )
            }
            return className ? (
              <code className="block overflow-x-auto font-mono text-xs">{text}</code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{text}</code>
            )
          },
          pre: ({ children, node }) => {
            // O diagrama não fica dentro de <pre>: o desenho tem os próprios controles.
            const first = node?.children?.[0]
            const classes = first && first.type === "element" ? first.properties?.className : undefined
            if (Array.isArray(classes) && classes.includes("language-mermaid")) return <>{children}</>
            return <pre className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3">{children}</pre>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

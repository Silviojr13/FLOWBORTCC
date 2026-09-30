import { cn } from "@/lib/utils"

/** Lateral padding shared by the header and page content so the left edge lines up. */
export const workspaceGutter = "px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"

const workspaceWidth = {
  /** Forms, features, components and other focused reading. */
  focused: "max-w-6xl",
  /** Dashboards, reports and wider tables. */
  wide: "max-w-7xl",
  /** Manual creation: content column plus the step rail. */
  creation: "max-w-[90rem]",
  /** Kanban keeps room for columns, then stops on ultrawide screens. */
  kanban: "max-w-[100rem]",
} as const

export type WorkspaceWidth = keyof typeof workspaceWidth

export function Workspace({
  width = "wide",
  className,
  children,
}: {
  width?: WorkspaceWidth
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("w-full", workspaceGutter, workspaceWidth[width], className)}>
      {children}
    </div>
  )
}

import { FolderIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function ProjectCover({
  imageUrl,
  className,
  iconClassName,
}: {
  imageUrl?: string | null
  className?: string
  iconClassName?: string
}) {
  if (imageUrl) {
    return (
      // Data URLs are stored only in this browser; next/image does not handle them reliably.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className={cn("size-full object-cover", className)} />
    )
  }

  return (
    <div
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-muted",
        className
      )}
      aria-hidden
    >
      <div className="absolute -top-6 -right-4 size-24 rounded-full bg-primary/15" />
      <div className="absolute -bottom-8 -left-6 size-28 rounded-full bg-primary/10" />
      <FolderIcon className={cn("relative text-primary/80", iconClassName ?? "size-8")} />
    </div>
  )
}

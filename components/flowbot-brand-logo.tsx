import Image from "next/image"
import { cn } from "@/lib/utils"

export function FlowbotMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block bg-primary", className)}
      style={{
        WebkitMaskImage: "url(/flowbot_bot.svg)",
        maskImage: "url(/flowbot_bot.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  )
}

type FlowbotBrandLogoProps = {
  variant?: "sidebar" | "auth"
  className?: string
  priority?: boolean
}

export function FlowbotBrandLogo({
  variant = "auth",
  className,
  priority = false,
}: FlowbotBrandLogoProps) {
  const lightLogoClass =
    variant === "sidebar"
      ? "h-auto w-auto max-w-[180px] object-contain"
      : "h-9 w-auto max-w-full object-contain sm:h-10"

  const darkLogoClass =
    variant === "sidebar"
      ? "h-auto w-auto max-w-[180px] object-contain"
      : "h-9 w-auto max-w-full object-contain sm:h-10"

  return (
    <>
      <Image
        src="/flowbot_name.svg"
        alt="Flowbot"
        width={variant === "sidebar" ? 180 : 220}
        height={variant === "sidebar" ? 60 : 37}
        priority={priority}
        className={cn("dark:hidden", lightLogoClass, className)}
      />
      <Image
        src="/flowbot_name.svg"
        alt="Flowbot"
        width={variant === "sidebar" ? 180 : 220}
        height={variant === "sidebar" ? 60 : 37}
        priority={priority}
        className={cn(
          "hidden dark:block dark:brightness-0 dark:invert",
          darkLogoClass,
          className
        )}
      />
    </>
  )
}

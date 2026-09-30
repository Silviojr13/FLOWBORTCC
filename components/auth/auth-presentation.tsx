import Image from "next/image"
import {
  ChartColumnIcon,
  ClipboardListIcon,
  KanbanIcon,
  SparklesIcon,
} from "lucide-react"

const JOURNEY = [
  {
    title: "Estruture",
    icon: ClipboardListIcon,
  },
  {
    title: "Desenvolva",
    icon: KanbanIcon,
  },
  {
    title: "Acompanhe",
    icon: ChartColumnIcon,
  },
] as const

export function AuthPresentation() {
  return (
    <aside
      aria-labelledby="flowbot-presentation-title"
      className="relative hidden overflow-hidden bg-primary lg:flex dark:bg-[oklch(0.20_0.05_258)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,oklch(1_0_0/0.12),transparent_52%)] dark:bg-[radial-gradient(120%_80%_at_100%_0%,oklch(0.55_0.14_258/0.22),transparent_55%)]"
      />

      <div className="relative z-10 flex min-h-full flex-1 flex-col justify-center gap-10 p-8 xl:gap-12 xl:p-12">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <h2
              id="flowbot-presentation-title"
              className="max-w-[16ch] text-[1.85rem] leading-tight font-semibold tracking-tight text-white xl:text-[2.25rem]"
            >
              Da ideia à{" "}
              <span className="text-[#8ec5ff] dark:text-[oklch(0.78_0.12_258)]">
                execução
              </span>
              , tudo em{" "}
              <span className="text-[#8ec5ff] dark:text-[oklch(0.78_0.12_258)]">
                um só lugar
              </span>
              .
            </h2>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/90 xl:mt-6 xl:text-[0.95rem]">
              Planeje, desenvolva e acompanhe seus projetos de robótica com o
              apoio da inteligência artificial.
            </p>
          </div>

          <div className="relative shrink-0 pt-1">
            <Image
              src="/images/robo-flowbot.png"
              alt="Mascote Flowbot, um robô assistente"
              width={200}
              height={200}
              priority
              className="animate-float-soft h-auto w-28 object-contain drop-shadow-sm xl:w-36"
            />
          </div>
        </div>

        <ol className="m-0 flex list-none flex-col p-0">
          {JOURNEY.map((step, index) => {
            const Icon = step.icon
            const isLast = index === JOURNEY.length - 1

            return (
              <li
                key={step.title}
                className="relative flex items-center gap-3 pb-4 last:pb-0"
              >
                {!isLast ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-8 left-[15px] h-[calc(100%-1rem)] w-px bg-white/40"
                  />
                ) : null}

                <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>

                <p className="text-sm font-medium text-white">{step.title}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </aside>
  )
}

"use client";

import { Button } from "@/components/ui/button";
import { BotIcon, RadioIcon, LeafIcon, CarIcon } from "lucide-react";
import Image from "next/image";

const suggestions = [
  { label: "Robô Autônomo", icon: <BotIcon className="size-3.5" /> },
  { label: "Monitoramento IoT", icon: <RadioIcon className="size-3.5" /> },
  { label: "Estufa Inteligente", icon: <LeafIcon className="size-3.5" /> },
  { label: "Veículo Robótico", icon: <CarIcon className="size-3.5" /> },
];

export function WelcomeScreen({
  onSuggestionClick,
}: {
  onSuggestionClick: (text: string) => void;
}) {
  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-12">
      {/* Image placeholder — replace with your own image later */}
      <div className="mb-6 sm:mb-8">
        <Image
          src="/images/robo-flowbot.png"
          alt="Mascote Flowbot"
          width={120}
          height={120}
          className="h-auto max-h-[200px] w-auto max-w-[200px] object-contain"
          priority
        />
      </div>

      {/* Title */}
      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-navy dark:text-foreground sm:mb-3 sm:text-3xl">
        O que você deseja criar?
      </h2>

      {/* Subtitle */}
      <p className="mb-8 max-w-md text-sm leading-relaxed text-muted-foreground sm:mb-10 sm:text-base">
        Descreva sua ideia de projeto de sistema embarcado ou robótica e eu vou te ajudar a levantar os requisitos.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {suggestions.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(s.label)}
      className="rounded-full border-border bg-input-bg px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-blue-light hover:text-primary dark:hover:bg-accent sm:px-4 sm:py-2 sm:text-sm"
          >
            {s.icon}
            <span>{s.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

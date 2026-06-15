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
          src="/images/robo3.png"
          alt="Robô"
          width={180}
          height={180}
          className="object-contain"
          priority
        />
      </div>

      {/* Title */}
      <h2 className="mb-2 text-2xl font-medium tracking-tight text-foreground sm:mb-3 sm:text-3xl md:text-4xl">
        O que você deseja criar?
      </h2>

      {/* Subtitle */}
      <p className="mb-8 max-w-md text-sm text-muted-foreground sm:mb-10 sm:text-base">
        Descreva sua ideia de projeto.
      </p>

      {/* Suggestion chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {suggestions.map((s) => (
          <Button
            key={s.label}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(s.label)}
            className="rounded-full border-white/8 bg-white/3 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:bg-primary/8 hover:text-foreground hover:shadow-[0_0_20px_-8px_oklch(0.65_0.2_250/30%)] sm:px-4 sm:py-2 sm:text-sm"
          >
            {s.icon}
            <span>{s.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

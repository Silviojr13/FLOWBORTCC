import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gemma Chat",
  description: "AI chatbot powered by Gemma 4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
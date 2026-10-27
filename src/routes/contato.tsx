import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: `${legalPages.contato.title} — MagicSats` },
      { name: "description", content: "Fale com a equipe MagicSats." },
      { property: "og:title", content: `${legalPages.contato.title} — MagicSats` },
      { property: "og:description", content: "Fale com a equipe MagicSats." },
    ],
  }),
  component: () => <LegalPage slug="contato" />,
});

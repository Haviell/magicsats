import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: `${legalPages.sobre.title} — MagicSats` },
      { name: "description", content: "Conheça a MagicSats, a rifa de Bitcoin transparente do Brasil." },
      { property: "og:title", content: `${legalPages.sobre.title} — MagicSats` },
      { property: "og:description", content: "Conheça a MagicSats, a rifa de Bitcoin transparente do Brasil." },
    ],
  }),
  component: () => <LegalPage slug="sobre" />,
});

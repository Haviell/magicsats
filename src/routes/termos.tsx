import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: `${legalPages.termos.title} — MagicSats` },
      { name: "description", content: "Termos de uso da plataforma MagicSats." },
      { property: "og:title", content: `${legalPages.termos.title} — MagicSats` },
      { property: "og:description", content: "Termos de uso da plataforma MagicSats." },
    ],
  }),
  component: () => <LegalPage slug="termos" />,
});

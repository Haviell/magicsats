import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/transparencia")({
  head: () => ({
    meta: [
      { title: `${legalPages.transparencia.title} — MagicSats` },
      { name: "description", content: "Transparência e auditoria dos sorteios MagicSats." },
      { property: "og:title", content: `${legalPages.transparencia.title} — MagicSats` },
      { property: "og:description", content: "Transparência e auditoria dos sorteios MagicSats." },
    ],
  }),
  component: () => <LegalPage slug="transparencia" />,
});

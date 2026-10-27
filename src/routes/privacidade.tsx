import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: `${legalPages.privacidade.title} — MagicSats` },
      { name: "description", content: "Política de privacidade da MagicSats." },
      { property: "og:title", content: `${legalPages.privacidade.title} — MagicSats` },
      { property: "og:description", content: "Política de privacidade da MagicSats." },
    ],
  }),
  component: () => <LegalPage slug="privacidade" />,
});

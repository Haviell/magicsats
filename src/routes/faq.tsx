import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `${legalPages.faq.title} — MagicSats` },
      { name: "description", content: "Perguntas frequentes sobre a rifa de Bitcoin MagicSats." },
      { property: "og:title", content: `${legalPages.faq.title} — MagicSats` },
      { property: "og:description", content: "Perguntas frequentes sobre a rifa de Bitcoin MagicSats." },
    ],
  }),
  component: () => <LegalPage slug="faq" />,
});

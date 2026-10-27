import { createFileRoute } from "@tanstack/react-router";
import LegalPage from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/lgpd")({
  head: () => ({
    meta: [
      { title: `${legalPages.lgpd.title} — MagicSats` },
      { name: "description", content: "Como a MagicSats cumpre a LGPD." },
      { property: "og:title", content: `${legalPages.lgpd.title} — MagicSats` },
      { property: "og:description", content: "Como a MagicSats cumpre a LGPD." },
    ],
  }),
  component: () => <LegalPage slug="lgpd" />,
});

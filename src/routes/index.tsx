import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/rifa" });
  },
  head: () => ({
    meta: [
      { title: "MagicSats ✨ Rifa de Bitcoin" },
      { name: "description", content: "A primeira rifa de Bitcoin 100% transparente do Brasil" },
      { property: "og:title", content: "MagicSats ✨ Rifa de Bitcoin" },
      { property: "og:description", content: "A primeira rifa de Bitcoin 100% transparente do Brasil" },
    ],
  }),
});

import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { BitcoinRaffleImproved } from "@/components/raffle/bitcoin-raffle-improved";

export const Route = createFileRoute("/rifa")({
  head: () => ({
    meta: [
      { title: "Rifa de Bitcoin — MagicSats" },
      { name: "description", content: "Escolha seus números e concorra a prêmios em Bitcoin na rifa mais transparente do Brasil." },
      { property: "og:title", content: "Rifa de Bitcoin — MagicSats" },
      { property: "og:description", content: "Escolha seus números e concorra a prêmios em Bitcoin." },
    ],
  }),
  component: RifaPage,
});

function RifaPage() {
  return (
    <main className="container mx-auto p-4">
      <ClientOnly fallback={<div className="min-h-[60vh]" />}>
        <BitcoinRaffleImproved />
      </ClientOnly>
    </main>
  );
}

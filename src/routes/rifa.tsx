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
    <main className="container mx-auto px-2 py-4 sm:p-4 overflow-x-hidden">
      <ClientOnly fallback={<div className="min-h-[60vh]" />}>
        <BitcoinRaffleImproved />
      </ClientOnly>
    </main>
  );
}

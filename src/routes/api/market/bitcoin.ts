import { createFileRoute } from '@tanstack/react-router'
import { getBitcoinQuote } from '@/lib/market/bitcoin-quote'

export const Route = createFileRoute('/api/market/bitcoin')({
  server: {
    handlers: {
      GET: async () => {
        const quote = await getBitcoinQuote({
          fetch,
          now: Date.now,
          apiKey: process.env['COINGECKO_API_KEY'] || undefined,
          keyType: process.env['COINGECKO_API_KEY_TYPE'] || 'demo',
          ttlMs: Number(process.env['COINGECKO_CACHE_SECONDS'] || 45) * 1000,
        })
        if (!quote) return Response.json({ error: 'Cotação temporariamente indisponível' }, { status: 503 })
        return Response.json(quote, { headers: { 'cache-control': 'public, max-age=30' } })
      },
    },
  },
})

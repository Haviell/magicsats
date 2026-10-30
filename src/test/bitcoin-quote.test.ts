import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { getBitcoinQuote, resetQuoteCache, satToBrl, balanceToBrl } from '@/lib/market/bitcoin-quote'

const ok = (brl: number) => new Response(JSON.stringify({ bitcoin: { brl, brl_24h_change: 1.25, last_updated_at: 1800000000 } }), { status: 200 })
const deps = (f: () => Response, now = () => 0) => ({ fetch: (async () => f()) as unknown as typeof fetch, now, sleep: async () => {} })

beforeEach(() => resetQuoteCache())

describe('bitcoin quote', () => {
  it('parses a normal response', async () => {
    const q = await getBitcoinQuote(deps(() => ok(428887)))
    expect(q?.btc_brl).toBe(428887); expect(q?.stale).toBe(false); expect(q?.change_24h_percent).toBe(1.25)
  })
  it('computes sat_brl', () => expect(satToBrl(428887)).toBeCloseTo(0.00428887, 10))
  it('computes balance in BRL for 0, 1 and 100M sats', () => {
    expect(balanceToBrl(0, 428887)).toBe(0)
    expect(balanceToBrl(1, 428887)).toBeCloseTo(0.00428887, 10)
    expect(balanceToBrl(100_000_000, 428887)).toBe(428887)
  })
  it('handles very high and very low prices', () => {
    expect(balanceToBrl(100_000_000, 1e9)).toBe(1e9)
    expect(satToBrl(0.01)).toBeCloseTo(1e-10, 15)
  })
  it('returns null when price missing and no cache', async () => {
    expect(await getBitcoinQuote(deps(() => new Response('{}')))).toBeNull()
  })
  it('returns null on upstream error / 429 without cache', async () => {
    expect(await getBitcoinQuote(deps(() => new Response('', { status: 500 })))).toBeNull()
    expect(await getBitcoinQuote(deps(() => new Response('', { status: 429 })))).toBeNull()
  })
  it('uses cache within TTL', async () => {
    let calls = 0
    const d = { ...deps(() => { calls++; return ok(1) }) }
    await getBitcoinQuote(d); await getBitcoinQuote(d)
    expect(calls).toBe(1)
  })
  it('returns stale cached price when upstream fails after TTL', async () => {
    let t = 0, fail = false
    const d = { ...deps(() => (fail ? new Response('', { status: 429 }) : ok(500000)), () => t) }
    const first = await getBitcoinQuote(d)
    t = 120_000; fail = true
    const q = await getBitcoinQuote(d)
    expect(q?.stale).toBe(true); expect(q?.btc_brl).toBe(500000); expect(q?.updated_at).toBe(first?.updated_at)
  })
  it('works without API key (no auth header)', async () => {
    let headers: Record<string, string> = {}
    await getBitcoinQuote({ fetch: (async (_u: string, i: RequestInit) => { headers = i.headers as Record<string, string>; return ok(1) }) as unknown as typeof fetch, now: () => 0 })
    expect(headers['x-cg-demo-api-key']).toBeUndefined()
  })
  it('frontend never references the key or CoinGecko directly', () => {
    const src = readFileSync('src/components/raffle/bitcoin-raffle-improved.tsx', 'utf8')
    expect(src).not.toMatch(/COINGECKO_API_KEY|api\.coingecko\.com/)
  })
  it('formats pt-BR', () => {
    expect(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(428887)).toBe('R$\u00a0428.887,00')
  })
})

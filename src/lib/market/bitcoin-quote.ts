// Server-side Bitcoin quote (CoinGecko) with in-memory cache and stale fallback.
// Display-only: never use this price to change a user's satoshi balance.
export const SATS_PER_BTC = 100_000_000

export type BitcoinQuote = {
  asset: 'BTC'
  currency: 'BRL'
  btc_brl: number
  sat_brl: number
  change_24h_percent: number | null
  source: 'coingecko'
  updated_at: string
  stale: boolean
}

type Deps = { fetch: typeof fetch; now: () => number; apiKey?: string | undefined; keyType?: string | undefined; ttlMs?: number | undefined; sleep?: (ms: number) => Promise<void> }

let cache: { quote: BitcoinQuote; fetchedAt: number } | null = null
export function resetQuoteCache() { cache = null }

export function satToBrl(btcBrl: number) { return btcBrl / SATS_PER_BTC }
export function balanceToBrl(sats: number, btcBrl: number) { return (Math.trunc(sats) * btcBrl) / SATS_PER_BTC }

const URL_ = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true&include_24hr_change=true'

async function fetchOnce(d: Deps): Promise<Response> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (d.apiKey) headers[d.keyType === 'pro' ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key'] = d.apiKey
  const url = d.keyType === 'pro' && d.apiKey ? URL_.replace('api.coingecko.com', 'pro-api.coingecko.com') : URL_
  return d.fetch(url, { headers, signal: AbortSignal.timeout(5000) })
}

export async function getBitcoinQuote(d: Deps): Promise<BitcoinQuote | null> {
  const ttl = Math.min(60_000, Math.max(30_000, d.ttlMs ?? 45_000))
  if (cache && d.now() - cache.fetchedAt < ttl) return cache.quote
  const sleep = d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchOnce(d)
      if (res.status === 429 || res.status >= 500) throw new Error(`upstream ${res.status}`)
      if (!res.ok) throw new Error(`upstream ${res.status}`)
      const data = (await res.json()) as { bitcoin?: { brl?: number; brl_24h_change?: number; last_updated_at?: number } }
      const price = data.bitcoin?.brl
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error('missing price')
      const quote: BitcoinQuote = {
        asset: 'BTC', currency: 'BRL', btc_brl: price, sat_brl: satToBrl(price),
        change_24h_percent: typeof data.bitcoin?.brl_24h_change === 'number' ? data.bitcoin.brl_24h_change : null,
        source: 'coingecko',
        updated_at: new Date(data.bitcoin?.last_updated_at ? data.bitcoin.last_updated_at * 1000 : d.now()).toISOString(),
        stale: false,
      }
      cache = { quote, fetchedAt: d.now() }
      return quote
    } catch (e) {
      console.warn('[market] CoinGecko attempt failed:', (e as Error).message)
      if (attempt < 2) await sleep(300 * 2 ** attempt)
    }
  }
  return cache ? { ...cache.quote, stale: true } : null
}

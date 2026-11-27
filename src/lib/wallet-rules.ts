import { z } from 'zod'

export const TOTAL_RAFFLE_NUMBERS = 99
export const purchaseSchema = z.object({
  roundNumber: z.number().int().min(0).max(1_000_000),
  numbers: z.array(z.number().int().min(1).max(TOTAL_RAFFLE_NUMBERS)).min(1).max(TOTAL_RAFFLE_NUMBERS)
    .refine(numbers => new Set(numbers).size === numbers.length, 'Números repetidos.'),
  idempotencyKey: z.string().uuid(),
})
export type PurchaseInput = z.infer<typeof purchaseSchema>

export const withdrawalSchema = z.object({
  amountSats: z.number().int().safe().min(2_000).max(100_000_000),
  destination: z.string().trim().min(14).max(120),
  idempotencyKey: z.string().uuid(),
})

// Exact decimal parsing: reject extra precision rather than silently rounding money.
export function parseSats(value: string, unit: 'sats' | 'btc'): number | null {
  const input = value.trim().replace(',', '.')
  if (unit === 'sats') return /^\d+$/.test(input) && Number.isSafeInteger(Number(input)) ? Number(input) : null
  if (!/^\d+(\.\d{1,8})?$/.test(input)) return null
  const [whole = '0', fraction = ''] = input.split('.')
  const result = Number(whole) * 100_000_000 + Number(fraction.padEnd(8, '0'))
  return Number.isSafeInteger(result) ? result : null
}

export function internalWalletEnabled(env: Record<string, string | undefined>): boolean {
  return env['ENABLE_INTERNAL_WALLET'] === 'true' && env['ENABLE_MOCK_PAYMENTS'] !== 'true'
}
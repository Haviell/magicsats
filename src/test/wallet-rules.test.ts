import { describe, expect, it } from 'vitest'
import { internalWalletEnabled, parseSats, purchaseSchema, TOTAL_RAFFLE_NUMBERS, withdrawalSchema } from '@/lib/wallet-rules'

const key = '00000000-0000-4000-8000-000000000001'
describe('wallet rules', () => {
  it('preserves the existing 99 numbers, from 1 to 99', () => {
    expect(TOTAL_RAFFLE_NUMBERS).toBe(99)
    expect(purchaseSchema.safeParse({ roundNumber: 0, numbers: [1, 99], idempotencyKey: key }).success).toBe(true)
    expect(purchaseSchema.safeParse({ roundNumber: 0, numbers: [100], idempotencyKey: key }).success).toBe(false)
  })
  it('starts at round zero and rejects negative rounds', () => {
    expect(purchaseSchema.safeParse({ roundNumber: 0, numbers: [1], idempotencyKey: key }).success).toBe(true)
    expect(purchaseSchema.safeParse({ roundNumber: -1, numbers: [1], idempotencyKey: key }).success).toBe(false)
  })
  it('rejects repeated numbers', () => expect(purchaseSchema.safeParse({ roundNumber: 0, numbers: [1, 1], idempotencyKey: key }).success).toBe(false))
  it('rejects fractional satoshis', () => expect(parseSats('1.5', 'sats')).toBeNull())
  it('converts exactly one BTC to 100 million satoshis', () => expect(parseSats('1', 'btc')).toBe(100_000_000))
  it('converts the sole round-zero prize to 44000 satoshis', () => expect(parseSats('0.00044000', 'btc')).toBe(44_000))
  it('rejects precision smaller than one satoshi', () => expect(parseSats('0.000000001', 'btc')).toBeNull())
  it('does not accept a partial number', () => expect(parseSats('2000abc', 'sats')).toBeNull())
  it('requires at least 2000 sats for a withdrawal', () => {
    const input = { destination: 'bc1qexampleaddress', idempotencyKey: key }
    expect(withdrawalSchema.safeParse({ ...input, amountSats: 1999 }).success).toBe(false)
    expect(withdrawalSchema.safeParse({ ...input, amountSats: 2000 }).success).toBe(true)
  })
  it('keeps internal spending off by default', () => expect(internalWalletEnabled({})).toBe(false))
  it('never enables spending with mock deposits enabled', () => expect(internalWalletEnabled({ ENABLE_INTERNAL_WALLET: 'true', ENABLE_MOCK_PAYMENTS: 'true' })).toBe(false))
})
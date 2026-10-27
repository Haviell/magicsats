export type LuckyNumber = {
  number: number
  victories: number
  reservationsLeft: number
}

type LuckyUser = {
  victories: Record<string, number>
  reservationsLeft: Record<string, number>
  tickets: Array<{ round: number; numbers: number[] }>
}

type LuckyStore = {
  users: Record<string, LuckyUser>
  scheduled: Record<string, Record<string, { userId: string; userName: string }>>
}

const STORE_KEY = 'ms_lucky_store'

function emptyUser(): LuckyUser {
  return { victories: {}, reservationsLeft: {}, tickets: [] }
}

export function readLuckyStore(): LuckyStore {
  if (typeof window === 'undefined') return { users: {}, scheduled: {} }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '') as LuckyStore
    return {
      users: parsed.users || {},
      scheduled: parsed.scheduled || {},
    }
  } catch {
    return { users: {}, scheduled: {} }
  }
}

function writeLuckyStore(store: LuckyStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

export function getUserLuckyNumbers(userId: string): LuckyNumber[] {
  const user = readLuckyStore().users[userId]
  if (!user) return []
  const numbers = new Set([
    ...Object.keys(user.victories),
    ...Object.keys(user.reservationsLeft),
  ])
  return Array.from(numbers)
    .map((key) => ({
      number: Number(key),
      victories: user.victories[key] || 0,
      reservationsLeft: user.reservationsLeft[key] || 0,
    }))
    .filter((item) => item.victories > 0 || item.reservationsLeft > 0)
    .sort((a, b) => a.number - b.number)
}

export function awardWin(userId: string, number: number, _fromRound: number) {
  const store = readLuckyStore()
  const user = store.users[userId] || emptyUser()
  const key = String(number)
  user.victories[key] = (user.victories[key] || 0) + 1
  user.reservationsLeft[key] = (user.reservationsLeft[key] || 0) + 1
  store.users[userId] = user
  writeLuckyStore(store)
}

export function recordRoundWinner(input: {
  userId: string
  number: number
  roundNumber: number
}) {
  awardWin(input.userId, input.number, input.roundNumber)
}

export function addUserTickets(userId: string, round: number, numbers: number[]) {
  const store = readLuckyStore()
  const user = store.users[userId] || emptyUser()
  user.tickets.push({ round, numbers })
  store.users[userId] = user
  writeLuckyStore(store)
}

export function getScheduledForRound(roundNumber: number) {
  return readLuckyStore().scheduled[String(roundNumber)] || {}
}

export function scheduleWinnerNumber(input: {
  userId: string
  userName: string
  number: number
  targetRound: number
}) {
  const store = readLuckyStore()
  const user = store.users[input.userId] || emptyUser()
  const key = String(input.number)
  const remaining = user.reservationsLeft[key] || 0
  if (remaining < 1) {
    throw new Error('Você não tem reservas disponíveis para este número.')
  }

  const roundKey = String(input.targetRound)
  store.scheduled[roundKey] = store.scheduled[roundKey] || {}
  if (store.scheduled[roundKey][key]) {
    throw new Error('Este número já está agendado nesta rodada.')
  }

  store.scheduled[roundKey][key] = {
    userId: input.userId,
    userName: input.userName,
  }
  user.reservationsLeft[key] = remaining - 1
  store.users[input.userId] = user
  writeLuckyStore(store)
}

export type ScheduledSlot = { userId: string; userName: string }

export function applyScheduledToNumbers<T extends {
  number: number
  status: 'available' | 'reserved' | 'sold'
  purchasedBy?: string | null
  legacyPurchase?: { name: string; ddd: string; whatsapp?: string } | null
}>(roundNumber: number, numbers: T[]): T[] {
  const scheduled = getScheduledForRound(roundNumber)
  return numbers.map((item) => {
    const slot = scheduled[String(item.number)]
    if (!slot || item.status === 'sold') return item
    return {
      ...item,
      status: 'reserved' as const,
      purchasedBy: slot.userId,
      legacyPurchase: {
        name: slot.userName,
        ddd: 'WIN',
      },
    }
  })
}

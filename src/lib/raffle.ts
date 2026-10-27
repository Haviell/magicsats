import type { RaffleNumber, RaffleRound, RaffleStats, RaffleTransaction, LegacyPurchase } from '@/types/raffle'

// Configurações do Round Zero
const ROUND_ZERO_SETTINGS = {
  requiresRegistration: false,
  allowsWhatsappPurchase: true,
  allowsCryptoPayment: true,
  allowsPixPayment: true,
  maxNumbersPerUser: undefined
} as const

// Dados iniciais do Round Zero (vazio para integração com backend)
const INITIAL_LEGACY_PURCHASES: LegacyPurchase[] = []

// Função para inicializar o Round Zero
export function initializeRoundZero(): RaffleRound {
  const round = createNewRound(
    'zero',
    99, // total de números
    4, // preço por número em reais
    [
      {
        position: 1,
        amount: 40000, // 0.00040000 BTC em satoshis
        description: "1º Lugar - 0.00040000 BTC"
      },
      {
        position: 2,
        amount: 4000, // 0.00004000 BTC em satoshis
        description: "2º Lugar - 0.00004000 BTC"
      }
    ]
  )

  // Importa as compras legadas
  return importLegacyPurchases(round, INITIAL_LEGACY_PURCHASES)
}

// Função para criar um novo round
export function createNewRound(
  roundNumber: number | 'zero',
  totalNumbers: number,
  numberPrice: number,
  prizes: { position: number; amount: number; description: string }[]
): RaffleRound {
  const isRoundZero = roundNumber === 'zero'
  
  return {
    id: `round-${roundNumber}`,
    roundNumber,
    status: 'active',
    startDate: new Date(),
    totalNumbers,
    numberPrice,
    prizes,
    numbers: generateRaffleNumbers(totalNumbers),
    settings: isRoundZero ? ROUND_ZERO_SETTINGS : {
      requiresRegistration: true,
      allowsWhatsappPurchase: false,
      allowsCryptoPayment: true,
      allowsPixPayment: true,
      maxNumbersPerUser: 10
    },
    metadata: {
      isLegacyRound: isRoundZero,
      totalPrizePool: prizes.reduce((total, prize) => total + prize.amount, 0)
    }
  }
}

// Função para gerar números da rifa
export function generateRaffleNumbers(total: number): RaffleNumber[] {
  return Array.from({ length: total }, (_, i) => ({
    number: i + 1,
    status: 'available' as const
  }))
}

// Função para importar compras legadas do Round Zero
export function importLegacyPurchases(
  round: RaffleRound,
  legacyPurchases: LegacyPurchase[]
): RaffleRound {
  if (round.roundNumber !== 'zero') {
    throw new Error('Importação de compras legadas só é permitida no Round Zero')
  }

  const updatedNumbers = round.numbers.map(num => {
    const legacyPurchase = legacyPurchases.find(lp => 
      lp.numbers.includes(num.number)
    )

    if (legacyPurchase && legacyPurchase.confirmed) {
      return {
        ...num,
        status: 'sold' as const,
        legacyPurchase: {
          name: legacyPurchase.name,
          ddd: legacyPurchase.ddd,
          whatsapp: legacyPurchase.whatsapp
        },
        purchaseDate: legacyPurchase.purchaseDate || new Date()
      }
    }
    return num
  })

  return {
    ...round,
    numbers: updatedNumbers
  }
}

// Função para reservar números
export function reserveNumbers(
  round: RaffleRound,
  numbers: number[],
  userId: string,
  reservationTime: number = 15 * 60 * 1000 // 15 minutos em milissegundos
): RaffleRound {
  // Verifica limites do usuário para rounds não-zero
  if (round.roundNumber !== 'zero' && round.settings.maxNumbersPerUser) {
    const userNumbers = round.numbers.filter(n => 
      (n.status === 'sold' || n.status === 'reserved') && 
      n.purchasedBy === userId
    ).length

    if (userNumbers + numbers.length > round.settings.maxNumbersPerUser) {
      throw new Error(`Limite máximo de ${round.settings.maxNumbersPerUser} números por usuário`)
    }
  }

  const reservedUntil = new Date(Date.now() + reservationTime)
  
  const updatedNumbers = round.numbers.map(num => {
    if (numbers.includes(num.number) && num.status === 'available') {
      return {
        ...num,
        status: 'reserved' as const,
        purchasedBy: userId,
        reservedUntil
      }
    }
    return num
  })

  return {
    ...round,
    numbers: updatedNumbers
  }
}

// Função para confirmar compra de números
export function confirmPurchase(
  round: RaffleRound,
  transaction: RaffleTransaction
): RaffleRound {
  const updatedNumbers = round.numbers.map(num => {
    if (
      transaction.numbers.includes(num.number) && 
      ((num.status === 'reserved' && num.purchasedBy === transaction.userId) ||
       (round.roundNumber === 'zero' && num.status === 'available'))
    ) {
      return {
        ...num,
        status: 'sold' as const,
        purchaseDate: new Date(),
        reservedUntil: undefined,
        transactionId: transaction.id,
        purchasedBy: transaction.userId
      }
    }
    return num
  })

  return {
    ...round,
    numbers: updatedNumbers
  }
}

// Função para calcular estatísticas da rifa
export function calculateRaffleStats(round: RaffleRound): RaffleStats {
  const totalSold = round.numbers.filter(n => n.status === 'sold').length
  const totalReserved = round.numbers.filter(n => n.status === 'reserved').length
  const totalAvailable = round.numbers.filter(n => n.status === 'available').length

  // Calcula top compradores
  const buyerCounts = round.numbers
    .filter(n => n.status === 'sold')
    .reduce((acc, curr) => {
      const buyerName = curr.legacyPurchase?.name || curr.purchasedBy || 'Anônimo'
      acc[buyerName] = (acc[buyerName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

  const topBuyers = Object.entries(buyerCounts)
    .map(([name, count]) => ({
      name,
      count,
      percentage: (count / totalSold) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Últimas compras
  const lastPurchases = round.numbers
    .filter(n => n.status === 'sold' && n.purchaseDate)
    .sort((a, b) => (b.purchaseDate as Date).getTime() - (a.purchaseDate as Date).getTime())
    .slice(0, 10)
    .map(n => ({
      name: n.legacyPurchase?.name || n.purchasedBy || 'Anônimo',
      number: n.number,
      date: n.purchaseDate as Date
    }))

  // Estatísticas específicas do Round Zero
  const legacyStats = round.roundNumber === 'zero' ? {
    whatsappPurchases: round.numbers.filter(n => n.legacyPurchase).length,
    totalParticipants: new Set(
      round.numbers
        .filter(n => n.status === 'sold')
        .map(n => n.legacyPurchase?.name || n.purchasedBy)
    ).size,
    uniqueDDDs: Array.from(new Set(
      round.numbers
        .filter(n => n.legacyPurchase?.ddd)
        .map(n => n.legacyPurchase?.ddd as string)
    ))
  } : undefined

  return {
    totalSold,
    totalAvailable,
    totalReserved,
    percentageSold: (totalSold / round.totalNumbers) * 100,
    topBuyers,
    lastPurchases,
    legacyStats
  }
}

// Função para verificar se um número está disponível
export function isNumberAvailable(round: RaffleRound, number: number): boolean {
  const raffleNumber = round.numbers.find(n => n.number === number)
  if (!raffleNumber) return false
  
  if (raffleNumber.status === 'available') return true
  if (
    raffleNumber.status === 'reserved' && 
    raffleNumber.reservedUntil && 
    raffleNumber.reservedUntil < new Date()
  ) {
    return true
  }
  
  return false
}

// Função para limpar reservas expiradas
export function clearExpiredReservations(round: RaffleRound): RaffleRound {
  const now = new Date()
  
  const updatedNumbers = round.numbers.map(num => {
    if (
      num.status === 'reserved' &&
      num.reservedUntil &&
      num.reservedUntil < now
    ) {
      return {
        ...num,
        status: 'available' as const,
        purchasedBy: undefined,
        reservedUntil: undefined
      }
    }
    return num
  })

  return {
    ...round,
    numbers: updatedNumbers
  }
}

// Função para validar uma transação
export function validateTransaction(
  round: RaffleRound,
  transaction: RaffleTransaction
): boolean {
  // Verifica se o método de pagamento é permitido
  if (
    (transaction.paymentMethod === 'whatsapp' && !round.settings.allowsWhatsappPurchase) ||
    (transaction.paymentMethod === 'lightning' && !round.settings.allowsCryptoPayment) ||
    (transaction.paymentMethod === 'onchain' && !round.settings.allowsCryptoPayment) ||
    (transaction.paymentMethod === 'pix' && !round.settings.allowsPixPayment)
  ) {
    return false
  }

  // Verifica se todos os números estão disponíveis ou reservados para o usuário
  const allNumbersValid = transaction.numbers.every(number => {
    const raffleNumber = round.numbers.find(n => n.number === number)
    return (
      raffleNumber &&
      (
        (raffleNumber.status === 'reserved' && raffleNumber.purchasedBy === transaction.userId) ||
        (round.roundNumber === 'zero' && raffleNumber.status === 'available')
      )
    )
  })

  // Verifica se o valor total está correto
  const expectedAmount = transaction.numbers.length * round.numberPrice
  const amountValid = transaction.amount === expectedAmount

  return allNumbersValid && amountValid
}

// Função para calcular tempo restante da reserva
export function getReservationTimeLeft(reservedUntil: Date): number {
  const now = new Date()
  const timeLeft = reservedUntil.getTime() - now.getTime()
  return Math.max(0, Math.floor(timeLeft / 1000)) // retorna segundos restantes
} 
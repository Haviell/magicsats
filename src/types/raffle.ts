export interface RaffleNumber {
  number: number
  status: 'available' | 'reserved' | 'sold'
  purchasedBy?: string
  purchaseDate?: Date
  reservedUntil?: Date
  transactionId?: string
  legacyPurchase?: {
    name: string
    ddd: string
    whatsapp?: string
  }
}

export interface RafflePrize {
  position: number
  amount: number // em satoshis
  description: string
}

export interface RaffleRound {
  id: string
  roundNumber: number | 'zero'
  status: 'active' | 'completed' | 'cancelled'
  startDate: Date
  endDate?: Date
  totalNumbers: number
  numberPrice: number // em reais
  prizes: RafflePrize[]
  numbers: RaffleNumber[]
  winningNumbers?: number[]
  blockHash?: string
  blockHeight?: number
  settings: {
    requiresRegistration: boolean
    allowsWhatsappPurchase: boolean
    allowsCryptoPayment: boolean
    allowsPixPayment: boolean
    maxNumbersPerUser?: number
  }
  metadata: {
    isLegacyRound: boolean
    totalPrizePool: number
    estimatedEndDate?: Date
    minimumPurchase?: number
  }
}

export interface RaffleStats {
  totalSold: number
  totalAvailable: number
  totalReserved: number
  percentageSold: number
  topBuyers: {
    name: string
    count: number
    percentage: number
  }[]
  lastPurchases: {
    name: string
    number: number
    date: Date
  }[]
  legacyStats?: {
    whatsappPurchases: number
    totalParticipants: number
    uniqueDDDs: string[]
  }
}

export interface RaffleTransaction {
  id: string
  userId: string
  numbers: number[]
  amount: number
  status: 'pending' | 'completed' | 'failed'
  paymentMethod: 'pix' | 'lightning' | 'onchain' | 'whatsapp'
  paymentDetails: {
    pixCode?: string
    lightningInvoice?: string
    btcAddress?: string
    whatsappConfirmation?: {
      adminId: string
      confirmationDate: Date
      notes?: string
    }
  }
  createdAt: Date
  completedAt?: Date
}

export interface LegacyPurchase {
  name: string
  ddd: string
  whatsapp?: string
  numbers: number[]
  purchaseDate?: Date
  confirmed: boolean
  notes?: string
}

export const DEFAULT_ROUND_SETTINGS = {
  requiresRegistration: true,
  allowsWhatsappPurchase: false,
  allowsCryptoPayment: true,
  allowsPixPayment: true,
  maxNumbersPerUser: 10
}

export const ROUND_ZERO_SETTINGS = {
  requiresRegistration: false,
  allowsWhatsappPurchase: true,
  allowsCryptoPayment: true,
  allowsPixPayment: true,
  maxNumbersPerUser: undefined
} 
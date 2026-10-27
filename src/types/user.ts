export interface User {
  id: string
  username: string
  displayName?: string
  email: string
  walletAddress?: string
  balance: number // em satoshis
  createdAt: Date
  stats: UserStats
  preferences: UserPreferences
  profile: UserProfile
  location: UserLocation
}

export interface UserProfile {
  avatar?: string
  bio?: string
  location?: string
  twitter?: string
  telegram?: string
  discord?: string
  achievements: Achievement[]
  badges: Badge[]
  level: number
  xp: number
  lastSeen: Date
  status: 'online' | 'offline' | 'playing' | 'away'
}

export interface Achievement {
  id: string
  name: string
  description: string
  unlockedAt: Date
  icon: string
}

export interface Badge {
  id: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  icon: string
}

export interface UserStats {
  totalGames: number
  gamesWon: number
  totalBet: number // em satoshis
  totalWon: number // em satoshis
  rifasParticipated: number
  rifasWon: number
  notasPublished: number
  rank: UserRank
  winRate: number
  bestWin: number // em satoshis
  longestStreak: number
  currentStreak: number
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  soundEffects: boolean
  language: 'pt-BR' | 'en'
  privacy: {
    showBalance: boolean
    showStats: boolean
    showActivity: boolean
  }
}

export type UserRank = 
  | 'Iniciante'     // 0-10 jogos
  | 'Apostador'     // 11-50 jogos
  | 'Veterano'      // 51-100 jogos
  | 'Expert'        // 101-500 jogos
  | 'Mestre'        // 501+ jogos
  | 'Lenda'         // top 10 no ranking geral

export interface UserSession {
  user: User
  token: string
  expiresAt: Date
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface UsernameAvailability {
  username: string
  available: boolean
  suggestion?: string[]
}

export interface UserLocation {
  country: string
  countryCode: string
  state?: string
  city?: string
  latitude: number
  longitude: number
  lastUpdated: Date
  isPublic: boolean
} 
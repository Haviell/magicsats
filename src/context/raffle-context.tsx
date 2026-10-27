
import { createContext, useContext, useState, ReactNode } from 'react'
import type { RaffleRound } from '@/types/raffle'

interface RaffleContextType {
  currentRound: RaffleRound | null
  setCurrentRound: (round: RaffleRound) => void
  selectedNumbers: number[]
  setSelectedNumbers: (numbers: number[]) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const RaffleContext = createContext<RaffleContextType | undefined>(undefined)

export function RaffleProvider({ children }: { children: ReactNode }) {
  const [currentRound, setCurrentRound] = useState<RaffleRound | null>(null)
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)

  return (
    <RaffleContext.Provider 
      value={{
        currentRound,
        setCurrentRound,
        selectedNumbers,
        setSelectedNumbers,
        isLoading,
        setIsLoading
      }}
    >
      {children}
    </RaffleContext.Provider>
  )
}

export function useRaffle() {
  const context = useContext(RaffleContext)
  if (context === undefined) {
    throw new Error('useRaffle must be used within a RaffleProvider')
  }
  return context
} 
import { useEffect, useState, useCallback } from 'react'
import { supabase as sbClient } from '@/integrations/supabase/client'
const createClient = () => sbClient

export interface UserProfile {
  id: string
  username: string
  balance: number
  in_game_balance: number
  created_at?: string
}

export function useSupabaseData() {
  const supabase = createClient()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, balance, in_game_balance, created_at')
          .eq('id', user.id)
          .single()

        if (data) {
          setUserProfile({
            id: data.id,
            username: data.username || user.email?.split('@')[0] || 'Usuário',
            balance: Number(data.balance) || 0,
            in_game_balance: Number(data.in_game_balance) || 0,
            created_at: data.created_at,
          })
        } else if (error) {
          // Perfil ainda não sincronizado ou recém-criado: saldo real inicial é 0
          setUserProfile({
            id: user.id,
            username:
              (user.user_metadata?.username as string) ||
              (user.user_metadata?.name as string) ||
              user.email?.split('@')[0] ||
              'Usuário',
            balance: 0,
            in_game_balance: 0,
            created_at: user.created_at,
          })
        }
      } else {
        setUserProfile(null)
      }
    } catch (error) {
      console.error('Supabase fetch error:', error)
      setUserProfile(null)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchUserData()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        fetchUserData()
      } else if (event === 'SIGNED_OUT') {
        setUserProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserData, supabase])

  return { userProfile, loading, supabase, refreshProfile: fetchUserData }
}

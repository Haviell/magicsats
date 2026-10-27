import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { loginWithIdentifier, registerWithIdentifier } from '@/lib/auth.functions'

export type AuthUser = {
  id: string
  name: string
  username: string
  email: string
  createdAt?: string | undefined
}

async function toAuthUser(u: { id: string; email?: string; created_at?: string; user_metadata?: Record<string, unknown> }): Promise<AuthUser> {
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', u.id).maybeSingle()
  const username =
    profile?.username || (u.user_metadata?.['username'] as string) || 'Anon'
  return { id: u.id, email: u.email || '', name: username, username, createdAt: u.created_at }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // defer the DB call outside the auth callback
        setTimeout(() => { toAuthUser(session.user).then(setUser) }, 0)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      setUser(authUser ? await toAuthUser(authUser) : null)
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  /** Login por E-mail OU Nickname + Senha (resolução do nick acontece no servidor). */
  const login = useCallback(async (identifier: string, password: string) => {
    const tokens = await loginWithIdentifier({ data: { identifier, password } })
    const { data, error } = await supabase.auth.setSession(tokens)
    if (error || !data.user) throw new Error('Falha ao autenticar.')
    const sessionUser = await toAuthUser(data.user)
    setUser(sessionUser)
    return sessionUser
  }, [])

  /** Cadastro por Nickname, E-mail e Senha. */
  const register = useCallback(async (
    nickname: string,
    email: string,
    password: string,
    marketingOptIn = false,
  ) => {
    const result = await registerWithIdentifier({
      data: {
        nickname,
        email,
        password,
        marketingOptIn,
        origin: window.location.origin,
      },
    })

    if (result.access_token && result.refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      })
      if (error || !data.user) throw new Error('Não foi possível iniciar sua sessão.');
      const sessionUser = await toAuthUser(data.user)
      setUser(sessionUser)
      return { user: sessionUser, needsConfirmation: false }
    }
    return { user: null, needsConfirmation: true }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return { user, loading, isLoggedIn: Boolean(user), login, register, logout }
}

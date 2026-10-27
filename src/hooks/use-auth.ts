import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { loginWithIdentifier } from '@/lib/auth.functions'

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
  const register = useCallback(async (nickname: string, email: string, password: string) => {
    const cleanNick = nickname.trim().replace(/^@/, '')
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(cleanNick)) {
      throw new Error('O nickname deve ter de 3 a 20 caracteres (letras, números, _ ou .).')
    }
    if (!cleanEmail.includes('@')) throw new Error('Informe um e-mail válido.')
    if (password.length < 8) throw new Error('A senha deve ter no mínimo 8 caracteres.')

    const { data: available } = await supabase.rpc('is_username_available', { uname: cleanNick })
    if (available === false) throw new Error('Este nickname já está em uso. Por favor, escolha outro.')

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/rifa`,
        data: { username: cleanNick },
      },
    })
    if (error) throw new Error(error.message.includes('registered') ? 'Não foi possível criar a conta com esses dados.' : error.message)

    if (data.session && data.user) {
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

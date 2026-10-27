// @ts-nocheck -- ported as-is from the original MagicSats code

import { useCallback, useEffect, useState } from 'react'
import { supabase as sbClient } from '@/integrations/supabase/client'
const createClient = () => sbClient

export type AuthUser = {
  id: string
  name: string
  username: string
  email: string
  createdAt?: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Carregar usuário ativo do Supabase
    supabase.auth.getUser().then(async ({ data: { user: authUser }, error }) => {
      if (authUser && !error) {
        // Tentar obter o nickname atualizado da tabela profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', authUser.id)
          .single()

        const username =
          profile?.username ||
          (authUser.user_metadata?.username as string) ||
          authUser.email?.split('@')[0] ||
          'Anon'

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: username,
          username,
          createdAt: authUser.created_at,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    // Ouvir alterações em tempo real de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', session.user.id)
          .single()

        const username =
          profile?.username ||
          (session.user.user_metadata?.username as string) ||
          session.user.email?.split('@')[0] ||
          'Anon'

        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: username,
          username,
          createdAt: session.user.created_at,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Login flexível por E-mail OU Nickname + Senha
   */
  const login = useCallback(async (identifier: string, password: string) => {
    const supabase = createClient()
    const cleanIdentifier = identifier.trim()
    let loginEmail = cleanIdentifier.toLowerCase()

    // Se o usuário digitou um Nickname (sem '@'), resolve para o e-mail cadastrado
    if (!cleanIdentifier.includes('@')) {
      try {
        const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
          'get_auth_email_by_username',
          { uname: cleanIdentifier }
        )

        if (!rpcError && resolvedEmail) {
          loginEmail = resolvedEmail.toLowerCase()
        } else {
          // Fallback caso a RPC ainda não esteja ativa: busca na tabela profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username')
            .ilike('username', cleanIdentifier)
            .single()

          if (!profile) {
            throw new Error('Nickname não encontrado. Verifique a ortografia ou entre com seu e-mail.')
          }
          // Se não tiver RPC para expor email, tenta login direto caso o email siga o padrão ou solicita o email
          throw new Error('Para entrar com este nickname, por favor informe seu e-mail correspondente.')
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('Nickname') || err.message.includes('e-mail'))) {
          throw err
        }
        throw new Error('Não foi possível localizar este nickname.')
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      throw new Error(error.message === 'Invalid login credentials' ? 'E-mail/Nickname ou senha incorretos.' : error.message)
    }

    if (data.user) {
      const username = (data.user.user_metadata?.username as string) || cleanIdentifier.replace('@', '')
      const sessionUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || loginEmail,
        name: username,
        username,
        createdAt: data.user.created_at,
      }
      setUser(sessionUser)
      return sessionUser
    }
    throw new Error('Falha ao autenticar.')
  }, [])

  /**
   * Cadastro por Nickname, E-mail e Senha
   */
  const register = useCallback(async (nickname: string, email: string, password: string) => {
    const supabase = createClient()
    const cleanNick = nickname.trim().replace(/^@/, '')
    const cleanEmail = email.trim().toLowerCase()

    // Validações de Nickname anônimo
    if (cleanNick.length < 3 || cleanNick.length > 20) {
      throw new Error('O nickname deve ter entre 3 e 20 caracteres.')
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanNick)) {
      throw new Error('O nickname só pode conter letras, números e underline (_).')
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Informe um e-mail válido.')
    }
    if (password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres.')
    }

    // Verificar se o nickname já existe no Supabase
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', cleanNick)
        .single()

      if (existingUser) {
        throw new Error('Este nickname já está em uso. Por favor, escolha outro.')
      }
    } catch (checkErr: any) {
      if (checkErr.message && checkErr.message.includes('em uso')) {
        throw checkErr
      }
    }

    // Criar conta no Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/rifa' : undefined,
        data: {
          username: cleanNick,
          name: cleanNick,
        },
      },
    })

    if (error) {
      throw new Error(error.message)
    }

    if (data.user) {
      // Registrar no profiles público
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: cleanNick,
          balance: 0,
          in_game_balance: 0,
        })
      } catch {
        // Ignora se o trigger do banco já tiver criado
      }

      const sessionUser: AuthUser = {
        id: data.user.id,
        email: data.user.email || cleanEmail,
        name: cleanNick,
        username: cleanNick,
        createdAt: data.user.created_at,
      }
      setUser(sessionUser)
      return sessionUser
    }
    return null
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  return { user, loading, isLoggedIn: Boolean(user), login, register, logout }
}

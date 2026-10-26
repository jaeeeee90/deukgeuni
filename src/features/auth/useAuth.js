import { useCallback, useEffect, useState } from 'react'
import { supabase, supabaseConfig } from '../../lib/supabaseClient.js'

const initialState = {
  error: null,
  loading: true,
  profileError: null,
  session: null,
  user: null,
}

function mapAuthError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  if (message.includes('invalid login credentials')) return '이메일 또는 비밀번호를 확인해 주세요.'
  if (message.includes('user already registered')) return '이미 가입된 이메일이에요.'
  if (message.includes('password')) return '비밀번호 조건을 확인해 주세요.'
  if (message.includes('email')) return '이메일 주소를 확인해 주세요.'
  if (message.includes('rate limit')) return '요청이 잠시 많아요. 조금 후 다시 시도해 주세요.'
  return '인증 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}

async function verifyProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (error) return { error: '프로필을 확인하지 못했어요. Supabase SQL 설정을 확인해 주세요.' }
  if (!data) return { error: '프로필이 자동으로 생성되지 않았어요. profiles SQL 설정을 확인해 주세요.' }
  return { error: null }
}

export function useAuth() {
  const [state, setState] = useState(() => supabaseConfig.isConfigured
    ? initialState
    : { ...initialState, error: 'Supabase 환경변수가 설정되지 않았어요.', loading: false })

  const applySession = useCallback(async (session) => {
    const user = session?.user ?? null
    let profileError = null
    if (user && supabase) profileError = (await verifyProfile(user.id)).error
    setState({ error: null, loading: false, profileError, session, user })
  }, [])

  useEffect(() => {
    if (!supabaseConfig.isConfigured || !supabase) return undefined

    let mounted = true
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!mounted) return
      if (error) {
        setState({ ...initialState, error: mapAuthError(error), loading: false })
        return
      }
      await applySession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        setState({ error: null, loading: false, profileError: null, session: null, user: null })
        return
      }
      setState((current) => ({ ...current, error: null, loading: false, session, user: session?.user ?? null }))
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(async ({ email, password }) => {
    if (!supabase) return { error: 'Supabase 환경변수가 설정되지 않았어요.' }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: mapAuthError(error) }
    const profile = await verifyProfile(data.user.id)
    if (profile.error) {
      setState((current) => ({ ...current, profileError: profile.error }))
      return { error: profile.error }
    }
    return { error: null }
  }, [])

  const signUp = useCallback(async ({ displayName, email, password }) => {
    if (!supabase) return { error: 'Supabase 환경변수가 설정되지 않았어요.' }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error: mapAuthError(error) }
    if (!data.session) return { error: null, needsEmailConfirmation: true }
    const profile = await verifyProfile(data.user.id)
    if (profile.error) {
      setState((current) => ({ ...current, profileError: profile.error }))
      return { error: profile.error }
    }
    return { error: null, needsEmailConfirmation: false }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return { error: null }
    const { error } = await supabase.auth.signOut()
    if (error) return { error: mapAuthError(error) }
    return { error: null }
  }, [])

  return { ...state, isConfigured: supabaseConfig.isConfigured, signIn, signUp, signOut }
}

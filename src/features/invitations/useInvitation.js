import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getFirstRpcRow, mapInvitationError } from './invitationData.js'

function normalizePreview(data) {
  const row = getFirstRpcRow(data)
  if (!row || typeof row !== 'object'
    || typeof row.room_id !== 'string'
    || typeof row.room_name !== 'string'
    || typeof row.room_symbol !== 'string'
    || typeof row.room_color !== 'string') return null

  return {
    roomId: row.room_id,
    name: row.room_name,
    description: typeof row.room_description === 'string' ? row.room_description : '',
    symbol: row.room_symbol,
    color: row.room_color,
    memberCount: Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : 0,
    expiresAt: row.expires_at ?? null,
  }
}

export function useInvitation(token) {
  const [state, setState] = useState(() => ({
    accepting: false,
    error: token ? (supabase ? null : 'Supabase 환경변수를 확인해 주세요.') : '초대 링크가 없어요.',
    loading: Boolean(token && supabase),
    preview: null,
  }))

  useEffect(() => {
    let mounted = true
    if (!token || !supabase) return undefined

    supabase.rpc('get_room_invitation_preview', { p_token: token }).then(({ data, error }) => {
      if (!mounted) return
      const preview = error ? null : normalizePreview(data)
      setState({
        accepting: false,
        error: error ? mapInvitationError(error) : preview ? null : '초대 링크 정보를 읽지 못했어요.',
        loading: false,
        preview,
      })
    }).catch((error) => {
      if (mounted) setState({ accepting: false, error: mapInvitationError(error), loading: false, preview: null })
    })

    return () => { mounted = false }
  }, [token])

  const accept = useCallback(async () => {
    if (!supabase || !token) return { data: null, error: '초대 링크를 확인해 주세요.' }
    if (state.accepting) return { data: null, error: '처리 중이에요. 잠시만 기다려 주세요.' }

    setState((current) => ({ ...current, accepting: true, error: null }))
    try {
      const { data, error } = await supabase.rpc('accept_room_invitation', { p_token: token })
      if (error) {
        const message = mapInvitationError(error)
        setState((current) => ({ ...current, accepting: false, error: message }))
        return { data: null, error: message }
      }
      const result = getFirstRpcRow(data)
      if (!result?.room_id) {
        const message = '운동방 참여 결과를 확인하지 못했어요. 다시 시도해 주세요.'
        setState((current) => ({ ...current, accepting: false, error: message }))
        return { data: null, error: message }
      }
      setState((current) => ({ ...current, accepting: false, error: null }))
      return { data: result, error: null }
    } catch (error) {
      const message = mapInvitationError(error)
      setState((current) => ({ ...current, accepting: false, error: message }))
      return { data: null, error: message }
    }
  }, [state.accepting, token])

  return { ...state, accept }
}

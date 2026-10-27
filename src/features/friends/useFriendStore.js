import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getFirstRpcRow } from '../invitations/invitationData.js'
import {
  mapFriendError,
  normalizeFriendCode,
  normalizeFriendList,
  normalizeFriendRequests,
} from './friendData.js'
import { normalizeReceivedRoomFriendInvitations } from './roomFriendInvitationData.js'

const emptyRequests = () => ({ incoming: [], outgoing: [] })

export function useFriendStore(user) {
  const userId = user?.id ?? null
  const requestId = useRef(0)
  const mutationInFlight = useRef(false)
  const [state, setState] = useState(() => ({
    code: null,
    error: null,
    friends: [],
    loading: Boolean(userId),
    roomInvitations: [],
    requests: emptyRequests(),
    saving: false,
    searchError: null,
    searchLoading: false,
    searchResult: null,
  }))

  const loadAll = useCallback(async () => {
    if (!supabase || !userId) {
      setState({
        code: null,
        error: null,
        friends: [],
        loading: false,
        roomInvitations: [],
        requests: emptyRequests(),
        saving: false,
        searchError: null,
        searchLoading: false,
        searchResult: null,
      })
      return { error: null }
    }

    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const [codeResult, friendsResult, requestsResult, roomInvitationsResult] = await Promise.all([
        supabase.rpc('get_my_friend_code'),
        supabase.rpc('list_friends'),
        supabase.rpc('list_friend_requests'),
        supabase.rpc('list_received_room_friend_invitations'),
      ])
      if (currentRequestId !== requestId.current) return { error: null, stale: true }

      const firstError = codeResult.error || friendsResult.error || requestsResult.error || roomInvitationsResult.error
      if (firstError) {
        const message = mapFriendError(firstError)
        setState((current) => ({ ...current, error: message, loading: false }))
        return { error: message }
      }

      setState((current) => ({
        ...current,
        code: typeof codeResult.data === 'string' ? codeResult.data : getFirstRpcRow(codeResult.data),
        error: null,
        friends: normalizeFriendList(friendsResult.data),
        loading: false,
        roomInvitations: normalizeReceivedRoomFriendInvitations(roomInvitationsResult.data),
        requests: normalizeFriendRequests(requestsResult.data),
      }))
      return { error: null }
    } catch (error) {
      const message = mapFriendError(error)
      setState((current) => ({ ...current, error: message, loading: false }))
      return { error: message }
    }
  }, [userId])

  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadAll() }, 0)
    return () => {
      clearTimeout(timeoutId)
      requestId.current += 1
    }
  }, [loadAll])

  const searchByCode = useCallback(async (value) => {
    const code = normalizeFriendCode(value)
    if (!code) {
      setState((current) => ({ ...current, searchError: '친구 코드를 DG-XXXXXX 형식으로 입력해 주세요.', searchResult: null }))
      return { data: null, error: 'invalid_friend_code' }
    }
    if (!supabase || !userId) return { data: null, error: 'not_authenticated' }

    setState((current) => ({ ...current, searchError: null, searchLoading: true, searchResult: null }))
    try {
      const { data, error } = await supabase.rpc('find_profile_by_friend_code', { p_friend_code: code })
      if (error) {
        const message = mapFriendError(error)
        setState((current) => ({ ...current, searchError: message, searchLoading: false }))
        return { data: null, error: message }
      }
      const row = getFirstRpcRow(data)
      const result = row?.user_id && row?.display_name
        ? { id: row.user_id, name: row.display_name, avatarUrl: row.avatar_url ?? null }
        : null
      setState((current) => ({ ...current, searchError: result ? null : '검색 결과를 확인하지 못했어요.', searchLoading: false, searchResult: result }))
      return { data: result, error: result ? null : 'friend_not_found' }
    } catch (error) {
      const message = mapFriendError(error)
      setState((current) => ({ ...current, searchError: message, searchLoading: false }))
      return { data: null, error: message }
    }
  }, [userId])

  const runMutation = useCallback(async (operation) => {
    if (!supabase || !userId) return { error: '로그인 상태를 확인해 주세요.' }
    if (mutationInFlight.current) return { error: '처리 중이에요. 잠시만 기다려 주세요.' }

    mutationInFlight.current = true
    setState((current) => ({ ...current, error: null, saving: true }))
    try {
      const { data, error } = await operation()
      if (error) {
        const message = mapFriendError(error)
        setState((current) => ({ ...current, error: message, saving: false }))
        return { data: null, error: message }
      }

      const refreshed = await loadAll()
      if (refreshed.error) {
        setState((current) => ({ ...current, error: refreshed.error, saving: false }))
        return { data, error: refreshed.error }
      }
      setState((current) => ({ ...current, saving: false, error: null, searchError: null, searchResult: null }))
      return { data, error: null }
    } catch (error) {
      const message = mapFriendError(error)
      setState((current) => ({ ...current, error: message, saving: false }))
      return { data: null, error: message }
    } finally {
      mutationInFlight.current = false
    }
  }, [loadAll, userId])

  const sendRequest = useCallback((recipientId) => runMutation(() => supabase.rpc('send_friend_request', { p_recipient_id: recipientId })), [runMutation])
  const respondRequest = useCallback((friendshipId, action) => runMutation(() => supabase.rpc('respond_friend_request', { p_friendship_id: friendshipId, p_action: action })), [runMutation])
  const cancelRequest = useCallback((friendshipId) => runMutation(() => supabase.rpc('cancel_friend_request', { p_friendship_id: friendshipId })), [runMutation])
  const removeFriend = useCallback((friendshipId) => runMutation(() => supabase.rpc('remove_friend', { p_friendship_id: friendshipId })), [runMutation])
  const acceptRoomInvitation = useCallback((invitationId) => runMutation(() => supabase.rpc('accept_room_friend_invitation', { p_invitation_id: invitationId })), [runMutation])
  const rejectRoomInvitation = useCallback((invitationId) => runMutation(() => supabase.rpc('reject_room_friend_invitation', { p_invitation_id: invitationId })), [runMutation])

  return {
    actions: { acceptRoomInvitation, cancelRequest, loadAll, rejectRoomInvitation, removeFriend, respondRequest, searchByCode, sendRequest },
    code: state.code,
    error: state.error,
    friends: state.friends,
    loading: state.loading,
    roomInvitations: state.roomInvitations,
    requests: state.requests,
    saving: state.saving,
    searchError: state.searchError,
    searchLoading: state.searchLoading,
    searchResult: state.searchResult,
  }
}

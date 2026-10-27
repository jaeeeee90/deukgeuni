import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import {
  mapRoomFriendInvitationError,
  normalizeRoomFriendInvitationStatuses,
  normalizeSendRoomFriendInvitationResults,
} from './roomFriendInvitationData.js'
import { normalizeFriendList } from './friendData.js'

function getActiveMemberIds(members) {
  return new Set((Array.isArray(members) ? members : [])
    .filter((member) => member?.status === 'active' && typeof member.id === 'string')
    .map((member) => member.id))
}

export function useRoomFriendInvitationStore(room, user) {
  const roomId = room?.id ?? null
  const userId = user?.id ?? null
  const requestId = useRef(0)
  const mutationInFlight = useRef(false)
  const [state, setState] = useState(() => ({
    error: null,
    friends: [],
    invitationStatuses: {},
    loading: Boolean(roomId && userId),
    saving: false,
    lastResults: [],
  }))

  const load = useCallback(async () => {
    if (!supabase || !roomId || !userId) {
      setState({ error: null, friends: [], invitationStatuses: {}, loading: false, saving: false, lastResults: [] })
      return { error: null }
    }

    const currentRequestId = requestId.current + 1
    requestId.current = currentRequestId
    setState((current) => ({ ...current, loading: true, error: null }))

    try {
      const [friendsResult, statusesResult] = await Promise.all([
        supabase.rpc('list_friends'),
        supabase.rpc('list_room_friend_invitation_statuses', { p_room_id: roomId }),
      ])
      if (currentRequestId !== requestId.current) return { error: null, stale: true }
      const firstError = friendsResult.error || statusesResult.error
      if (firstError) {
        const message = mapRoomFriendInvitationError(firstError)
        setState((current) => ({ ...current, error: message, loading: false }))
        return { error: message }
      }

      setState((current) => ({
        ...current,
        error: null,
        friends: normalizeFriendList(friendsResult.data),
        invitationStatuses: normalizeRoomFriendInvitationStatuses(statusesResult.data),
        loading: false,
      }))
      return { error: null }
    } catch (error) {
      const message = mapRoomFriendInvitationError(error)
      setState((current) => ({ ...current, error: message, loading: false }))
      return { error: message }
    }
  }, [roomId, userId])

  useEffect(() => {
    const timeoutId = setTimeout(() => { void load() }, 0)
    return () => {
      clearTimeout(timeoutId)
      requestId.current += 1
    }
  }, [load])

  const options = useMemo(() => {
    const activeMemberIds = getActiveMemberIds(room?.members)
    return state.friends.map((friend) => ({
      ...friend,
      isMember: activeMemberIds.has(friend.userId),
      isPending: Boolean(state.invitationStatuses[friend.userId]),
    }))
  }, [room?.members, state.friends, state.invitationStatuses])

  const sendInvitations = useCallback(async (inviteeIds) => {
    if (!supabase || !roomId || !userId) return { data: null, error: '로그인 상태를 확인해 주세요.' }
    if (mutationInFlight.current) return { data: null, error: '처리 중이에요. 잠시만 기다려 주세요.' }
    if (!Array.isArray(inviteeIds) || inviteeIds.length === 0) return { data: null, error: '초대할 친구를 선택해 주세요.' }

    mutationInFlight.current = true
    setState((current) => ({ ...current, error: null, saving: true }))
    try {
      const { data, error } = await supabase.rpc('send_room_friend_invitations', {
        p_room_id: roomId,
        p_invitee_ids: inviteeIds,
      })
      if (error) {
        const message = mapRoomFriendInvitationError(error)
        setState((current) => ({ ...current, error: message, saving: false }))
        return { data: null, error: message }
      }

      const results = normalizeSendRoomFriendInvitationResults(data)
      const refreshed = await load()
      if (refreshed.error) {
        setState((current) => ({ ...current, error: refreshed.error, saving: false, lastResults: results }))
        return { data: results, error: refreshed.error }
      }
      setState((current) => ({ ...current, error: null, saving: false, lastResults: results }))
      return { data: results, error: null }
    } catch (error) {
      const message = mapRoomFriendInvitationError(error)
      setState((current) => ({ ...current, error: message, saving: false }))
      return { data: null, error: message }
    } finally {
      mutationInFlight.current = false
    }
  }, [load, roomId, userId])

  return {
    actions: { load, sendInvitations },
    error: state.error,
    lastResults: state.lastResults,
    loading: state.loading,
    options,
    saving: state.saving,
  }
}

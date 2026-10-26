import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { normalizeRemoteRooms } from './remoteRoomData.js'

const roomSelect = 'id,name,description,symbol,color,creator_id,created_at,updated_at,deleted_at,room_members(user_id,display_name,role,status)'

function mapRoomError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  if (message.includes('invalid_room_name')) return '운동방 이름은 공백 없이 1~30자로 입력해 주세요.'
  if (message.includes('invalid_room_description')) return '운동방 설명은 100자 이하로 입력해 주세요.'
  if (message.includes('invalid_room_icon')) return '운동방 아이콘을 다시 선택해 주세요.'
  if (message.includes('missing_profile')) return '프로필을 찾지 못했어요. 다시 로그인해 주세요.'
  if (message.includes('not_authenticated') || error?.code === '42501') return '로그인 상태를 확인한 뒤 다시 시도해 주세요.'
  if (error?.code === '23514') return '운동방 정보를 확인해 주세요.'
  return '운동방 정보를 불러오거나 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function useRemoteRoomStore(user) {
  const userId = user?.id ?? null
  const [state, setState] = useState(() => ({ rooms: [], loading: Boolean(userId), saving: false, error: null }))
  const requestInFlight = useRef(false)
  const loadRequest = useRef({ id: 0, userId: null, promise: null })

  const loadRooms = useCallback(async (options = {}) => {
    if (!supabase || !userId) {
      loadRequest.current = { id: loadRequest.current.id + 1, userId, promise: null }
      setState({ rooms: [], loading: false, saving: false, error: null })
      return { rooms: [], error: null }
    }

    const force = options?.force === true
    const previous = loadRequest.current
    if (!force && previous.promise && previous.userId === userId) return previous.promise

    const requestId = previous.id + 1
    if (previous.userId !== userId) {
      setState((current) => ({ ...current, rooms: [], loading: true, error: null }))
    } else {
      setState((current) => ({ ...current, loading: true, error: null }))
    }

    const promise = (async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select(roomSelect)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })

        if (loadRequest.current.id !== requestId || loadRequest.current.userId !== userId) {
          return { rooms: [], error: null, stale: true }
        }
        if (error) {
          const message = mapRoomError(error)
          setState((current) => ({ ...current, loading: false, error: message }))
          return { rooms: [], error: message }
        }

        const rooms = normalizeRemoteRooms(data)
        setState((current) => ({ ...current, rooms, loading: false, error: null }))
        return { rooms, error: null }
      } catch (error) {
        if (loadRequest.current.id !== requestId || loadRequest.current.userId !== userId) {
          return { rooms: [], error: null, stale: true }
        }
        const message = mapRoomError(error)
        setState((current) => ({ ...current, loading: false, error: message }))
        return { rooms: [], error: message }
      }
    })()

    loadRequest.current = { id: requestId, userId, promise }
    promise.then(() => {
      if (loadRequest.current.id === requestId && loadRequest.current.promise === promise) {
        loadRequest.current = { id: requestId, userId, promise: null }
      }
    }, () => {})
    return promise
  }, [userId])

  useEffect(() => {
    let mounted = true
    if (!supabase || !userId) return undefined

    const timeoutId = setTimeout(() => {
      if (mounted) void loadRooms()
    }, 0)
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [loadRooms, userId])

  const runMutation = useCallback(async (operation) => {
    if (!supabase || !userId) return { error: '로그인 상태를 확인한 뒤 다시 시도해 주세요.' }
    if (requestInFlight.current) return { error: '처리 중이에요. 잠시만 기다려 주세요.' }

    requestInFlight.current = true
    setState((current) => ({ ...current, saving: true, error: null }))
    try {
      const result = await operation()
      if (result.error) {
        const message = mapRoomError(result.error)
        setState((current) => ({ ...current, saving: false, error: message }))
        return { error: message }
      }
      const refreshed = await loadRooms({ force: true })
      if (refreshed.error) {
        setState((current) => ({ ...current, saving: false, error: refreshed.error }))
        return { data: result.data ?? null, error: refreshed.error }
      }
      setState((current) => ({ ...current, saving: false, error: null }))
      return { data: result.data ?? null, error: null }
    } catch (error) {
      const message = mapRoomError(error)
      setState((current) => ({ ...current, saving: false, error: message }))
      return { error: message }
    } finally {
      requestInFlight.current = false
    }
  }, [loadRooms, userId])

  const createRoom = useCallback((input) => runMutation(async () => {
    const { data, error } = await supabase.rpc('create_room_with_owner', {
      p_name: input.name,
      p_description: input.description,
      p_symbol: input.symbol,
      p_color: input.color,
    })
    return { data, error }
  }), [runMutation])

  const updateRoom = useCallback((roomId, input) => runMutation(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .update({
        name: input.name.trim(),
        description: input.description.trim(),
        symbol: input.symbol,
        color: input.color,
      })
      .eq('id', roomId)
      .select(roomSelect)
      .single()
    return { data, error }
  }), [runMutation])

  const deleteRoom = useCallback((roomId) => runMutation(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', roomId)
    return { data, error }
  }), [runMutation])

  return {
    actions: { createRoom, deleteRoom, loadRooms, updateRoom },
    error: state.error,
    loading: state.loading,
    rooms: state.rooms,
    saving: state.saving,
  }
}

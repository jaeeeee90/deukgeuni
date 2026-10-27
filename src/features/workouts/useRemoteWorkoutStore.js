import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import {
  addCustomExercise as addCustomExerciseState,
  createInitialWorkoutState,
} from './workoutData.js'
import { normalizeRemoteWorkoutData } from './remoteWorkoutData.js'

const entrySelect = 'id,room_id,workout_date,exercise_id,exercise_name,exercise_categories,recording_method,created_by,workout_sets(id,user_id,set_order,recorded_order,recording_method,weight,reps,duration_seconds,duration_minutes,distance_km)'

function mapWorkoutError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  if (message.includes('duplicate') || error?.code === '23505') return '이 날짜에 이미 추가한 운동 종목이에요.'
  if (message.includes('not_room_member') || error?.code === '42501') return '이 운동방의 회원만 기록을 변경할 수 있어요.'
  if (message.includes('recording_method_mismatch')) return '운동 기록 방식이 맞지 않아요.'
  if (message.includes('invalid_set_values')) return '운동 기록 값을 확인해 주세요.'
  if (message.includes('missing_workout_entry')) return '운동 종목을 찾지 못했어요.'
  return '운동 기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

function setPayload(method, input) {
  if (method === 'reps') return { p_reps: Number(input.reps) }
  if (method === 'duration') {
    const duration = Number(input.duration)
    return { p_duration_seconds: input.durationUnit === 'minutes' ? duration * 60 : duration }
  }
  if (method === 'duration-distance') {
    return { p_duration_minutes: Number(input.durationMinutes), p_distance_km: Number(input.distanceKm) }
  }
  return { p_weight: Number(input.weight), p_reps: Number(input.reps) }
}

function updatePayload(method, input) {
  if (method === 'reps') return { reps: Number(input.reps) }
  if (method === 'duration') {
    const duration = Number(input.duration)
    return { duration_seconds: input.durationUnit === 'minutes' ? duration * 60 : duration }
  }
  if (method === 'duration-distance') return { duration_minutes: Number(input.durationMinutes), distance_km: Number(input.distanceKm) }
  return { weight: Number(input.weight), reps: Number(input.reps) }
}

export function useRemoteWorkoutStore(roomId, userId) {
  const [state, setState] = useState(createInitialWorkoutState)
  const [loading, setLoading] = useState(Boolean(roomId && userId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const stateRef = useRef(state)
  const requestInFlight = useRef(false)
  const loadRequestId = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const loadRoomData = useCallback(async () => {
    if (!supabase || !roomId || !userId) {
      const empty = createInitialWorkoutState()
      stateRef.current = empty
      setState(empty)
      setLoading(false)
      return { error: null }
    }

    const requestId = loadRequestId.current + 1
    loadRequestId.current = requestId
    setLoading(true)
    setError(null)
    try {
      const [entriesResult, attendanceResult] = await Promise.all([
        supabase.from('workout_entries').select(entrySelect).eq('room_id', roomId).order('workout_date', { ascending: false }),
        supabase.from('workout_attendance').select('room_id,user_id,attendance_date,status').eq('room_id', roomId),
      ])
      if (requestId !== loadRequestId.current) return { error: null, stale: true }
      if (entriesResult.error) throw entriesResult.error
      if (attendanceResult.error) throw attendanceResult.error
      const nextState = normalizeRemoteWorkoutData({ entries: entriesResult.data, attendance: attendanceResult.data })
      stateRef.current = nextState
      setState(nextState)
      setLoading(false)
      return { error: null }
    } catch (loadError) {
      if (requestId !== loadRequestId.current) return { error: null, stale: true }
      const message = mapWorkoutError(loadError)
      setLoading(false)
      setError(message)
      return { error: message }
    }
  }, [roomId, userId])

  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadRoomData() }, 0)
    return () => {
      clearTimeout(timeoutId)
      loadRequestId.current += 1
    }
  }, [loadRoomData])

  const refresh = useCallback(async () => {
    const result = await loadRoomData()
    if (result.error) throw new Error(result.error)
  }, [loadRoomData])

  const runMutation = useCallback(async (operation) => {
    if (!supabase || !roomId || !userId) return { error: '로그인 상태와 운동방을 확인해 주세요.' }
    if (requestInFlight.current) return { error: '처리 중이에요. 잠시만 기다려 주세요.' }
    requestInFlight.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await operation()
      if (result.error) {
        const message = mapWorkoutError(result.error)
        setError(message)
        return { error: message }
      }
      await refresh()
      return { data: result.data ?? null, error: null }
    } catch (mutationError) {
      const message = mapWorkoutError(mutationError)
      setError(message)
      return { error: message }
    } finally {
      setSaving(false)
      requestInFlight.current = false
    }
  }, [refresh, roomId, userId])

  const addExercise = useCallback((targetRoomId, date, exerciseId, exercise) => runMutation(async () => {
    const { data, error: insertError } = await supabase
      .from('workout_entries')
      .insert({
        room_id: targetRoomId,
        workout_date: date,
        exercise_id: exerciseId,
        exercise_name: exercise?.name ?? exerciseId,
        exercise_categories: exercise?.categories ?? [],
        recording_method: exercise?.recordingMethod ?? 'weight-reps',
        created_by: userId,
      })
      .select('id')
      .single()
    return { data, error: insertError }
  }), [runMutation, userId])

  const addCustomExercise = useCallback((input) => {
    const result = addCustomExerciseState(stateRef.current, input)
    if (!result.error) {
      stateRef.current = result.state
      setState(result.state)
    }
    return result
  }, [])

  const removeExercise = useCallback((entryId) => runMutation(async () => {
    const { error: deleteError } = await supabase.from('workout_entries').delete().eq('id', entryId)
    return { data: null, error: deleteError }
  }), [runMutation])

  const addSet = useCallback((entryId, targetUserId, currentUserId, input, recordingMethod) => {
    if (targetUserId !== currentUserId || currentUserId !== userId) return Promise.resolve({ error: '본인의 기록만 추가할 수 있어요.' })
    return runMutation(async () => {
      const { data, error: insertError } = await supabase.rpc('add_workout_set', {
        p_entry_id: entryId,
        p_recording_method: recordingMethod,
        ...setPayload(recordingMethod, input),
      })
      return { data, error: insertError }
    })
  }, [runMutation, userId])

  const updateSet = useCallback((setId, currentUserId, input) => {
    const existing = stateRef.current.sets.find((set) => set.id === setId)
    if (!existing || existing.userId !== currentUserId || currentUserId !== userId) return Promise.resolve({ error: '본인의 기록만 수정할 수 있어요.' })
    return runMutation(async () => {
      const { data, error: updateError } = await supabase
        .from('workout_sets')
        .update(updatePayload(existing.recordingMethod, input))
        .eq('id', setId)
        .eq('user_id', userId)
        .select('id')
        .single()
      return { data, error: updateError }
    })
  }, [runMutation, userId])

  const removeSet = useCallback((setId, currentUserId) => {
    if (currentUserId !== userId) return Promise.resolve({ error: '본인의 기록만 삭제할 수 있어요.' })
    return runMutation(async () => {
      const { error: deleteError } = await supabase.from('workout_sets').delete().eq('id', setId).eq('user_id', userId)
      return { data: null, error: deleteError }
    })
  }, [runMutation, userId])

  const setAttendance = useCallback((targetRoomId, date, targetUserId, status) => {
    if (targetUserId !== userId) return Promise.resolve({ error: '본인의 참여 상태만 변경할 수 있어요.' })
    return runMutation(async () => {
      const { data, error: upsertError } = await supabase
        .from('workout_attendance')
        .upsert({ room_id: targetRoomId, user_id: userId, attendance_date: date, status }, { onConflict: 'room_id,user_id,attendance_date' })
        .select('room_id')
        .single()
      return { data, error: upsertError }
    })
  }, [runMutation, userId])

  return {
    actions: useMemo(() => ({ addCustomExercise, addExercise, addSet, loadRoomData, removeExercise, removeRoomData: () => ({ error: null }), removeSet, setAttendance, updateSet }), [addCustomExercise, addExercise, addSet, loadRoomData, removeExercise, removeSet, setAttendance, updateSet]),
    error,
    loading,
    saving,
    state,
    storageError: error,
  }
}

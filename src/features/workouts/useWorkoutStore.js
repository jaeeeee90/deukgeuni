import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addCustomExercise,
  addExercise,
  addSet,
  createInitialWorkoutState,
  removeRoomData,
  removeExercise,
  removeSet,
  setAttendance,
  updateSet,
} from './workoutData.js'
import { loadWorkoutState, saveWorkoutState } from './workoutStorage.js'

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function useWorkoutStore() {
  const [loadResult] = useState(() =>
    getBrowserStorage()
      ? loadWorkoutState(getBrowserStorage())
      : { state: createInitialWorkoutState(), error: 'workout-storage-read-failed', shouldPersist: false },
  )
  const [state, setState] = useState(loadResult.state)
  const stateRef = useRef(loadResult.state)

  useEffect(() => {
    stateRef.current = state
    if (loadResult.shouldPersist) saveWorkoutState(state, getBrowserStorage())
  }, [loadResult.shouldPersist, state])

  const mutate = useCallback((operation) => {
    if (!loadResult.shouldPersist) return { state: stateRef.current, error: 'workout-storage-protected' }
    const result = operation(stateRef.current)
    if (!result.error) {
      stateRef.current = result.state
      setState(result.state)
    }
    return result
  }, [loadResult.shouldPersist])

  const actions = useMemo(() => ({
    addExercise: (roomId, date, exerciseId) => mutate((current) => addExercise(current, roomId, date, exerciseId)),
    addCustomExercise: (input) => mutate((current) => addCustomExercise(current, input)),
    removeExercise: (entryId) => mutate((current) => ({ state: removeExercise(current, entryId), error: null })),
    removeRoomData: (roomId) => mutate((current) => ({ state: removeRoomData(current, roomId), error: null })),
    addSet: (entryId, userId, currentUserId, input, recordingMethod) => mutate((current) => addSet(current, entryId, userId, currentUserId, input, recordingMethod)),
    updateSet: (setId, currentUserId, input) => mutate((current) => updateSet(current, setId, currentUserId, input)),
    removeSet: (setId, currentUserId) => mutate((current) => removeSet(current, setId, currentUserId)),
    setAttendance: (roomId, date, userId, status) => mutate((current) => ({ state: setAttendance(current, roomId, date, userId, status), error: null })),
  }), [mutate])

  return { state, actions, storageError: loadResult.error }
}

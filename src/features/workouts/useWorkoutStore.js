import { useCallback, useEffect, useMemo, useState } from 'react'
import {
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
  const [state, setState] = useState(() =>
    getBrowserStorage()
      ? loadWorkoutState(getBrowserStorage())
      : createInitialWorkoutState(),
  )

  useEffect(() => {
    saveWorkoutState(state, getBrowserStorage())
  }, [state])

  const addRoomExercise = useCallback((roomId, date, exerciseId) => {
    setState((current) => addExercise(current, roomId, date, exerciseId).state)
  }, [])
  const deleteRoomExercise = useCallback((entryId) => {
    setState((current) => removeExercise(current, entryId))
  }, [])
  const deleteRoomData = useCallback((roomId) => {
    setState((current) => removeRoomData(current, roomId))
  }, [])
  const recordSet = useCallback((entryId, userId, currentUserId, input) => {
    setState((current) => addSet(current, entryId, userId, currentUserId, input).state)
  }, [])
  const editSet = useCallback((setId, currentUserId, input) => {
    setState((current) => updateSet(current, setId, currentUserId, input).state)
  }, [])
  const deleteSet = useCallback((setId, currentUserId) => {
    setState((current) => removeSet(current, setId, currentUserId).state)
  }, [])
  const changeAttendance = useCallback((roomId, date, userId, status) => {
    setState((current) => setAttendance(current, roomId, date, userId, status))
  }, [])

  const actions = useMemo(() => ({
    addExercise: addRoomExercise,
    removeExercise: deleteRoomExercise,
    removeRoomData: deleteRoomData,
    addSet: recordSet,
    updateSet: editSet,
    removeSet: deleteSet,
    setAttendance: changeAttendance,
  }), [addRoomExercise, deleteRoomExercise, deleteRoomData, recordSet, editSet, deleteSet, changeAttendance])

  return { state, actions }
}

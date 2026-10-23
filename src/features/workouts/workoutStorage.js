import { createInitialWorkoutState, parseWorkoutState } from './workoutData.js'

export const STORAGE_KEY = 'deukgeuni:workout-demo:v1'

export function loadWorkoutState(storage, key = STORAGE_KEY) {
  try {
    const serialized = storage?.getItem(key)
    if (!serialized) return createInitialWorkoutState()
    return parseWorkoutState(JSON.parse(serialized))
  } catch {
    return createInitialWorkoutState()
  }
}

export function saveWorkoutState(state, storage, key = STORAGE_KEY) {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

import { createInitialWorkoutState, migrateWorkoutState } from './workoutData.js'

export const STORAGE_KEY = 'deukgeuni:workout-demo:v1'

export function loadWorkoutState(storage, key = STORAGE_KEY) {
  try {
    const serialized = storage?.getItem(key)
    if (serialized === null) return { state: createInitialWorkoutState(), error: null, migrated: false, shouldPersist: true }
    const result = migrateWorkoutState(JSON.parse(serialized))
    if (result.error) return { state: createInitialWorkoutState(), error: result.error, migrated: false, shouldPersist: false }
    return { ...result, shouldPersist: true }
  } catch {
    return { state: createInitialWorkoutState(), error: 'workout-storage-read-failed', migrated: false, shouldPersist: false }
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

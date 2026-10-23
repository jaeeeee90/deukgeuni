import { createInitialRoomState, parseRoomState } from './roomData.js'

export const ROOM_STORAGE_KEY = 'deukgeuni:custom-rooms:v1'

export function loadRoomState(storage, key = ROOM_STORAGE_KEY) {
  try {
    const serialized = storage?.getItem(key)
    if (!serialized) return createInitialRoomState()
    return parseRoomState(JSON.parse(serialized))
  } catch {
    return createInitialRoomState()
  }
}

export function saveRoomState(state, storage, key = ROOM_STORAGE_KEY) {
  try {
    if (!storage) return false
    storage.setItem(key, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

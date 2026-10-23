import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createInitialRoomState,
  createRoom as createRoomState,
  deleteRoom as deleteRoomState,
  updateRoom as updateRoomState,
} from './roomData.js'
import { loadRoomState, saveRoomState } from './roomStorage.js'
import { applyRoomMutation } from './roomStateController.js'

function getBrowserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function useRoomStore() {
  const [state, setState] = useState(() =>
    getBrowserStorage() ? loadRoomState(getBrowserStorage()) : createInitialRoomState(),
  )
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
    saveRoomState(state, getBrowserStorage())
  }, [state])

  const createRoom = useCallback((input, creator) => {
    return applyRoomMutation(stateRef, setState, (current) => createRoomState(current, input, creator))
  }, [])

  const updateRoom = useCallback((roomId, currentUserId, input) => {
    return applyRoomMutation(stateRef, setState, (current) => updateRoomState(current, roomId, currentUserId, input))
  }, [])

  const deleteRoom = useCallback((roomId, currentUserId) => {
    return applyRoomMutation(stateRef, setState, (current) => deleteRoomState(current, roomId, currentUserId))
  }, [])

  const actions = useMemo(() => ({ createRoom, updateRoom, deleteRoom }), [createRoom, updateRoom, deleteRoom])
  return { state, actions }
}

const ROOM_STORAGE_VERSION = 1

export const roomIconOptions = [
  { symbol: '💪', color: 'peach', label: '근력 운동' },
  { symbol: '🏋️', color: 'lavender', label: '웨이트 운동' },
  { symbol: '🏃', color: 'mint', label: '달리기' },
  { symbol: '🚴', color: 'peach', label: '사이클' },
  { symbol: '🧘', color: 'lavender', label: '요가' },
  { symbol: '🥊', color: 'mint', label: '복싱' },
]

const validIcons = new Set(roomIconOptions.map(({ symbol, color }) => `${symbol}:${color}`))
const customRoomIdPattern = /^custom-room-.+$/

function createId() {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `custom-room-${id}`
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function normalizeRoomFields(input, current = {}) {
  const name = input.name === undefined ? current.name : normalizeText(input.name)
  const description = input.description === undefined ? current.description : normalizeText(input.description)
  const symbol = input.symbol === undefined ? current.symbol : input.symbol
  const color = input.color === undefined ? current.color : input.color

  if (!name || name.length > 30) return { error: 'invalid-name' }
  if (description.length > 100) return { error: 'invalid-description' }
  if (!validIcons.has(`${symbol}:${color}`)) return { error: 'invalid-icon' }
  return { name, description, symbol, color }
}

function validMember(member) {
  return member && typeof member === 'object'
    && typeof member.id === 'string' && member.id.length > 0
    && typeof member.name === 'string' && member.name.length > 0
}

function validRoom(room) {
  return room && typeof room === 'object'
    && typeof room.id === 'string' && customRoomIdPattern.test(room.id)
    && typeof room.name === 'string' && room.name.length > 0 && room.name.length <= 30
    && typeof room.description === 'string' && room.description.length <= 100
    && typeof room.symbol === 'string' && typeof room.color === 'string'
    && validIcons.has(`${room.symbol}:${room.color}`)
    && typeof room.creatorId === 'string' && room.creatorId.length > 0
    && Array.isArray(room.members) && room.members.length > 0 && room.members.every(validMember)
    && Array.isArray(room.exercises) && room.exercises.every((exercise) => typeof exercise === 'string')
}

export function createInitialRoomState() {
  return { version: ROOM_STORAGE_VERSION, rooms: [] }
}

export function createRoom(state, input, creator, idFactory = createId) {
  if (!validMember(creator)) return { state, room: null, error: 'invalid-creator' }
  const fields = normalizeRoomFields(input)
  if (fields.error) return { state, room: null, error: fields.error }

  const id = idFactory()
  if (typeof id !== 'string' || !customRoomIdPattern.test(id)) {
    return { state, room: null, error: 'invalid-id' }
  }
  if (state.rooms.some((room) => room.id === id)) {
    return { state, room: null, error: 'duplicate-id' }
  }

  const room = {
    id,
    ...fields,
    creatorId: creator.id,
    members: [{ id: creator.id, name: creator.name }],
    exercises: [],
  }
  return { state: { ...state, rooms: [room, ...state.rooms] }, room, error: null }
}

export function updateRoom(state, roomId, currentUserId, input) {
  const current = state.rooms.find((room) => room.id === roomId)
  if (!current) return { state, room: null, error: 'missing-room' }
  if (current.creatorId !== currentUserId) return { state, room: null, error: 'unauthorized' }

  const fields = normalizeRoomFields(input, current)
  if (fields.error) return { state, room: null, error: fields.error }
  const room = { ...current, ...fields }
  return {
    state: { ...state, rooms: state.rooms.map((item) => item.id === roomId ? room : item) },
    room,
    error: null,
  }
}

export function deleteRoom(state, roomId, currentUserId) {
  const room = state.rooms.find((item) => item.id === roomId)
  if (!room) return { state, removedRoom: null, error: 'missing-room' }
  if (room.creatorId !== currentUserId) return { state, removedRoom: null, error: 'unauthorized' }
  return {
    state: { ...state, rooms: state.rooms.filter((item) => item.id !== roomId) },
    removedRoom: room,
    error: null,
  }
}

export function parseRoomState(value) {
  const hasUniqueIds = Array.isArray(value?.rooms)
    && new Set(value.rooms.map((room) => room?.id)).size === value.rooms.length
  if (!value || value.version !== ROOM_STORAGE_VERSION
    || !Array.isArray(value.rooms) || !value.rooms.every(validRoom) || !hasUniqueIds) {
    return createInitialRoomState()
  }
  return value
}

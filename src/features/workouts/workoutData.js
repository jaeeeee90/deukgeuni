const STORAGE_VERSION = 1

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  if (!Number.isInteger(days) || !year || !month || !day) {
    throw new RangeError('날짜와 이동 일수가 올바르지 않습니다.')
  }

  const date = new Date(year, month - 1, day + days)
  return getLocalDateKey(date)
}

export function createInitialWorkoutState() {
  return { version: STORAGE_VERSION, exercises: [], sets: [], attendance: [] }
}

export function addExercise(state, roomId, date, exerciseId) {
  const duplicate = state.exercises.some((entry) =>
    entry.roomId === roomId && entry.date === date && entry.exerciseId === exerciseId,
  )
  if (duplicate) return { state, entry: null, error: 'duplicate' }

  const entry = { id: createId('room-exercise'), roomId, date, exerciseId }
  return {
    state: { ...state, exercises: [...state.exercises, entry] },
    entry,
    error: null,
  }
}

export function removeExercise(state, entryId) {
  if (!state.exercises.some((entry) => entry.id === entryId)) return state
  return {
    ...state,
    exercises: state.exercises.filter((entry) => entry.id !== entryId),
    sets: state.sets.filter((set) => set.entryId !== entryId),
  }
}

export function removeRoomData(state, roomId) {
  const removedEntryIds = new Set(
    state.exercises
      .filter((entry) => entry.roomId === roomId)
      .map((entry) => entry.id),
  )
  return {
    ...state,
    exercises: state.exercises.filter((entry) => entry.roomId !== roomId),
    sets: state.sets.filter((set) => !removedEntryIds.has(set.entryId)),
    attendance: state.attendance.filter((item) => item.roomId !== roomId),
  }
}

export function setAttendance(state, roomId, date, userId, status) {
  if (!['attending', 'not_attending'].includes(status)) return state

  const existing = state.attendance.find((item) =>
    item.roomId === roomId && item.date === date && item.userId === userId,
  )
  if (existing) {
    return {
      ...state,
      attendance: state.attendance.map((item) =>
        item.id === existing.id ? { ...item, status } : item,
      ),
    }
  }

  const attendance = {
    id: createId('attendance'),
    roomId,
    date,
    userId,
    status,
  }
  return { ...state, attendance: [...state.attendance, attendance] }
}

function validateSetInput(input) {
  const weightText = String(input.weight ?? '').trim()
  const repsText = String(input.reps ?? '').trim()
  const weight = Number(weightText)
  const reps = Number(repsText)

  if (!weightText || !Number.isFinite(weight) || weight < 0) {
    return { error: 'invalid-weight' }
  }
  if (!repsText || !Number.isInteger(reps) || reps < 1) {
    return { error: 'invalid-reps' }
  }
  return { weight, reps }
}

function reorderSets(sets, entryId, userId) {
  let order = 0
  return sets.map((set) => {
    if (set.entryId !== entryId || set.userId !== userId) return set
    order += 1
    return set.order === order ? set : { ...set, order }
  })
}

export function addSet(state, entryId, userId, currentUserId, input) {
  if (userId !== currentUserId) return { state, set: null, error: 'unauthorized' }
  const entry = state.exercises.find((item) => item.id === entryId)
  if (!entry) return { state, set: null, error: 'missing-exercise' }

  const values = validateSetInput(input)
  if (values.error) return { state, set: null, error: values.error }

  const order = state.sets.filter((set) => set.entryId === entryId && set.userId === userId).length + 1
  const set = {
    id: createId('set'),
    entryId,
    userId,
    order,
    weight: values.weight,
    reps: values.reps,
  }
  const nextState = {
    ...state,
    sets: [...state.sets, set],
  }
  return {
    state: setAttendance(nextState, entry.roomId, entry.date, userId, 'attending'),
    set,
    error: null,
  }
}

export function updateSet(state, setId, currentUserId, input) {
  const existing = state.sets.find((set) => set.id === setId)
  if (!existing) return { state, set: null, error: 'missing-set' }
  if (existing.userId !== currentUserId) return { state, set: null, error: 'unauthorized' }

  const values = validateSetInput(input)
  if (values.error) return { state, set: null, error: values.error }

  const set = { ...existing, weight: values.weight, reps: values.reps }
  return {
    state: { ...state, sets: state.sets.map((item) => item.id === setId ? set : item) },
    set,
    error: null,
  }
}

export function removeSet(state, setId, currentUserId) {
  const existing = state.sets.find((set) => set.id === setId)
  if (!existing) return { state, error: 'missing-set' }
  if (existing.userId !== currentUserId) return { state, error: 'unauthorized' }

  const remaining = state.sets.filter((set) => set.id !== setId)
  return {
    state: { ...state, sets: reorderSets(remaining, existing.entryId, currentUserId) },
    error: null,
  }
}

export function getAttendance(state, roomId, date, userId) {
  return state.attendance.find((item) =>
    item.roomId === roomId && item.date === date && item.userId === userId,
  )?.status ?? null
}

export function getExercisesForDate(state, roomId, date) {
  return state.exercises.filter((entry) => entry.roomId === roomId && entry.date === date)
}

export function getSetsForExercise(state, entryId, userId) {
  return state.sets
    .filter((set) => set.entryId === entryId && set.userId === userId)
    .sort((first, second) => first.order - second.order)
}

export function parseWorkoutState(value) {
  const hasId = (item, fields) => item && typeof item === 'object'
    && fields.every((field) => typeof item[field] === 'string' && item[field].length > 0)
  const validDate = (date) => typeof date === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)
  const validExercise = (entry) => hasId(entry, ['id', 'roomId', 'exerciseId']) && validDate(entry.date)
  const validSet = (set) => hasId(set, ['id', 'entryId', 'userId'])
    && Number.isInteger(set.order) && set.order > 0
    && Number.isFinite(set.weight) && set.weight >= 0
    && Number.isInteger(set.reps) && set.reps > 0
  const validAttendance = (item) => hasId(item, ['id', 'roomId', 'userId'])
    && validDate(item.date) && ['attending', 'not_attending'].includes(item.status)

  if (!value || value.version !== STORAGE_VERSION
    || !Array.isArray(value.exercises) || !value.exercises.every(validExercise)
    || !Array.isArray(value.sets) || !value.sets.every(validSet)
    || !Array.isArray(value.attendance) || !value.attendance.every(validAttendance)) {
    return createInitialWorkoutState()
  }
  return value
}

import { exercises as masterExercises } from './exerciseCatalog.js'

const STORAGE_VERSION = 2
const RECORDING_METHODS = new Set(['weight-reps', 'reps', 'duration', 'duration-distance'])
const EXERCISE_CATEGORIES = new Set(['가슴', '등', '하체', '어깨', '팔', '복근·코어', '유산소'])

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${id}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function hasId(item, fields) {
  return item && typeof item === 'object'
    && fields.every((field) => typeof item[field] === 'string' && item[field].length > 0)
}

function validDate(date) {
  return typeof date === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)
}

function validExercise(entry) {
  return hasId(entry, ['id', 'roomId', 'exerciseId']) && validDate(entry.date)
}

function validAttendance(item) {
  return hasId(item, ['id', 'roomId', 'userId'])
    && validDate(item.date) && ['attending', 'not_attending'].includes(item.status)
}

function validLegacySet(set) {
  return hasId(set, ['id', 'entryId', 'userId'])
    && Number.isInteger(set.order) && set.order > 0
    && Number.isFinite(set.weight) && set.weight >= 0
    && Number.isInteger(set.reps) && set.reps > 0
}

function validSet(set) {
  if (!hasId(set, ['id', 'entryId', 'userId']) || !Number.isInteger(set.order) || set.order < 1
    || !Number.isInteger(set.recordedOrder) || set.recordedOrder < 1 || !RECORDING_METHODS.has(set.recordingMethod)) {
    return false
  }
  if (set.recordingMethod === 'weight-reps') {
    return Number.isFinite(set.weight) && set.weight >= 0 && Number.isInteger(set.reps) && set.reps > 0
  }
  if (set.recordingMethod === 'reps') return Number.isInteger(set.reps) && set.reps > 0
  if (set.recordingMethod === 'duration') return Number.isFinite(set.durationSeconds) && set.durationSeconds > 0
  return Number.isFinite(set.durationMinutes) && set.durationMinutes > 0
    && Number.isFinite(set.distanceKm) && set.distanceKm >= 0
}

function validCustomExercise(exercise) {
  return hasId(exercise, ['id', 'roomId', 'name'])
    && exercise.id.startsWith('custom-exercise-')
    && Array.isArray(exercise.categories) && exercise.categories.length > 0
    && exercise.categories.every((category) => EXERCISE_CATEGORIES.has(category))
    && RECORDING_METHODS.has(exercise.recordingMethod)
}

function normalizeName(name) {
  return String(name ?? '').trim()
}

function normalizeNameForMatch(name) {
  return normalizeName(name).toLocaleLowerCase('ko')
}

function getExerciseDefinition(state, exerciseId) {
  return masterExercises.find((exercise) => exercise.id === exerciseId)
    ?? state.customExercises.find((exercise) => exercise.id === exerciseId)
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
  return { version: STORAGE_VERSION, exercises: [], sets: [], attendance: [], customExercises: [], nextRecordOrder: 1 }
}

export function migrateWorkoutState(value) {
  if (!value || typeof value !== 'object') return { state: null, error: 'invalid-workout-data', migrated: false }

  if (value.version === 1) {
    if (!Array.isArray(value.exercises) || !value.exercises.every(validExercise)
      || !Array.isArray(value.sets) || !value.sets.every(validLegacySet)
      || !Array.isArray(value.attendance) || !value.attendance.every(validAttendance)) {
      return { state: null, error: 'invalid-workout-data', migrated: false }
    }
    const sets = value.sets.map((set, index) => ({ ...set, recordingMethod: 'weight-reps', recordedOrder: index + 1 }))
    return {
      state: {
        version: STORAGE_VERSION,
        exercises: value.exercises,
        sets,
        attendance: value.attendance,
        customExercises: [],
        nextRecordOrder: sets.length + 1,
      },
      error: null,
      migrated: true,
    }
  }

  if (value.version !== STORAGE_VERSION
    || !Array.isArray(value.exercises) || !value.exercises.every(validExercise)
    || !Array.isArray(value.sets) || !value.sets.every(validSet)
    || !Array.isArray(value.attendance) || !value.attendance.every(validAttendance)
    || !Array.isArray(value.customExercises) || !value.customExercises.every(validCustomExercise)
    || !Number.isInteger(value.nextRecordOrder) || value.nextRecordOrder < 1) {
    return { state: null, error: 'invalid-workout-data', migrated: false }
  }
  return { state: value, error: null, migrated: false }
}

export function addExercise(state, roomId, date, exerciseId) {
  const duplicate = state.exercises.some((entry) =>
    entry.roomId === roomId && entry.date === date && entry.exerciseId === exerciseId,
  )
  if (duplicate) return { state, entry: null, error: 'duplicate' }

  const entry = { id: createId('room-exercise'), roomId, date, exerciseId }
  return { state: { ...state, exercises: [...state.exercises, entry] }, entry, error: null }
}

export function addCustomExercise(state, input) {
  const name = normalizeName(input.name)
  const categories = Array.isArray(input.categories) ? [...new Set(input.categories)] : []
  if (!name) return { state, exercise: null, error: 'invalid-custom-name' }
  if (!input.roomId || !categories.length || !categories.every((category) => EXERCISE_CATEGORIES.has(category))) {
    return { state, exercise: null, error: 'invalid-custom-categories' }
  }
  if (!RECORDING_METHODS.has(input.recordingMethod)) return { state, exercise: null, error: 'invalid-recording-method' }
  if (masterExercises.some((exercise) => normalizeNameForMatch(exercise.name) === normalizeNameForMatch(name))) {
    return { state, exercise: null, error: 'duplicate-master-exercise' }
  }
  if (state.customExercises.some((exercise) => exercise.roomId === input.roomId
    && normalizeNameForMatch(exercise.name) === normalizeNameForMatch(name))) {
    return { state, exercise: null, error: 'duplicate-custom-exercise' }
  }

  const exercise = {
    id: createId('custom-exercise'), roomId: input.roomId, name, categories, recordingMethod: input.recordingMethod,
  }
  return { state: { ...state, customExercises: [...state.customExercises, exercise] }, exercise, error: null }
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
  const removedEntryIds = new Set(state.exercises.filter((entry) => entry.roomId === roomId).map((entry) => entry.id))
  return {
    ...state,
    exercises: state.exercises.filter((entry) => entry.roomId !== roomId),
    sets: state.sets.filter((set) => !removedEntryIds.has(set.entryId)),
    attendance: state.attendance.filter((item) => item.roomId !== roomId),
    customExercises: state.customExercises.filter((exercise) => exercise.roomId !== roomId),
  }
}

export function setAttendance(state, roomId, date, userId, status) {
  if (!['attending', 'not_attending'].includes(status)) return state
  const existing = state.attendance.find((item) => item.roomId === roomId && item.date === date && item.userId === userId)
  if (existing) {
    return { ...state, attendance: state.attendance.map((item) => item.id === existing.id ? { ...item, status } : item) }
  }
  const attendance = { id: createId('attendance'), roomId, date, userId, status }
  return { ...state, attendance: [...state.attendance, attendance] }
}

function validatePositiveInteger(value, error) {
  const text = String(value ?? '').trim()
  const number = Number(text)
  return text && Number.isInteger(number) && number > 0 ? { value: number } : { error }
}

function validateSetInput(input, recordingMethod) {
  if (recordingMethod === 'weight-reps') {
    const weightText = String(input.weight ?? '').trim()
    const weight = Number(weightText)
    if (!weightText || !Number.isFinite(weight) || weight < 0) return { error: 'invalid-weight' }
    const reps = validatePositiveInteger(input.reps, 'invalid-reps')
    return reps.error ? reps : { weight, reps: reps.value }
  }
  if (recordingMethod === 'reps') {
    const reps = validatePositiveInteger(input.reps, 'invalid-reps')
    return reps.error ? reps : { reps: reps.value }
  }
  if (recordingMethod === 'duration') {
    const duration = Number(String(input.duration ?? '').trim())
    if (!Number.isFinite(duration) || duration <= 0 || !['seconds', 'minutes'].includes(input.durationUnit)) return { error: 'invalid-duration' }
    return { durationSeconds: input.durationUnit === 'minutes' ? duration * 60 : duration }
  }
  if (recordingMethod === 'duration-distance') {
    const durationMinutes = Number(String(input.durationMinutes ?? '').trim())
    const distanceKm = Number(String(input.distanceKm ?? '').trim())
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return { error: 'invalid-duration' }
    if (!Number.isFinite(distanceKm) || distanceKm < 0) return { error: 'invalid-distance' }
    return { durationMinutes, distanceKm }
  }
  return { error: 'invalid-recording-method' }
}

function reorderSets(sets, entryId, userId) {
  let order = 0
  return sets.map((set) => {
    if (set.entryId !== entryId || set.userId !== userId) return set
    order += 1
    return set.order === order ? set : { ...set, order }
  })
}

export function addSet(state, entryId, userId, currentUserId, input, recordingMethod = 'weight-reps') {
  if (userId !== currentUserId) return { state, set: null, error: 'unauthorized' }
  const entry = state.exercises.find((item) => item.id === entryId)
  if (!entry) return { state, set: null, error: 'missing-exercise' }
  const exercise = getExerciseDefinition(state, entry.exerciseId)
  if (!exercise) return { state, set: null, error: 'missing-exercise-definition' }
  if (exercise.recordingMethod !== recordingMethod) {
    return { state, set: null, error: 'recording-method-mismatch' }
  }
  const values = validateSetInput(input, recordingMethod)
  if (values.error) return { state, set: null, error: values.error }

  const order = state.sets.filter((set) => set.entryId === entryId && set.userId === userId).length + 1
  const set = { id: createId('set'), entryId, userId, order, recordingMethod, ...values, recordedOrder: state.nextRecordOrder }
  const nextState = { ...state, sets: [...state.sets, set], nextRecordOrder: state.nextRecordOrder + 1 }
  return { state: setAttendance(nextState, entry.roomId, entry.date, userId, 'attending'), set, error: null }
}

export function updateSet(state, setId, currentUserId, input) {
  const existing = state.sets.find((set) => set.id === setId)
  if (!existing) return { state, set: null, error: 'missing-set' }
  if (existing.userId !== currentUserId) return { state, set: null, error: 'unauthorized' }
  const values = validateSetInput(input, existing.recordingMethod ?? 'weight-reps')
  if (values.error) return { state, set: null, error: values.error }

  const set = { ...existing, ...values }
  return { state: { ...state, sets: state.sets.map((item) => item.id === setId ? set : item) }, set, error: null }
}

export function removeSet(state, setId, currentUserId) {
  const existing = state.sets.find((set) => set.id === setId)
  if (!existing) return { state, error: 'missing-set' }
  if (existing.userId !== currentUserId) return { state, error: 'unauthorized' }
  const remaining = state.sets.filter((set) => set.id !== setId)
  return { state: { ...state, sets: reorderSets(remaining, existing.entryId, currentUserId) }, error: null }
}

export function getAttendance(state, roomId, date, userId) {
  return state.attendance.find((item) => item.roomId === roomId && item.date === date && item.userId === userId)?.status ?? null
}

export function getExercisesForDate(state, roomId, date) {
  return state.exercises.filter((entry) => entry.roomId === roomId && entry.date === date)
}

export function getSetsForExercise(state, entryId, userId) {
  return state.sets.filter((set) => set.entryId === entryId && set.userId === userId).sort((first, second) => first.order - second.order)
}

function isRecord(value) {
  return value !== null && typeof value === 'object'
}

function toCustomExercise(entry) {
  if (!entry.exercise_id?.startsWith('custom-exercise-')) return null
  return {
    id: entry.exercise_id,
    roomId: entry.room_id,
    name: entry.exercise_name,
    categories: Array.isArray(entry.exercise_categories) ? entry.exercise_categories : [],
    recordingMethod: entry.recording_method,
  }
}

function toEntry(entry) {
  if (!isRecord(entry) || !entry.id || !entry.room_id || !entry.workout_date || !entry.exercise_id) return null
  return {
    id: entry.id,
    roomId: entry.room_id,
    date: entry.workout_date,
    exerciseId: entry.exercise_id,
  }
}

function toSet(entry, set) {
  if (!isRecord(set) || !set.id || !set.user_id) return null
  return {
    id: set.id,
    entryId: entry.id,
    userId: set.user_id,
    order: set.set_order,
    recordedOrder: set.recorded_order ?? set.set_order,
    recordingMethod: set.recording_method,
    ...(set.weight === null || set.weight === undefined ? {} : { weight: Number(set.weight) }),
    ...(set.reps === null || set.reps === undefined ? {} : { reps: Number(set.reps) }),
    ...(set.duration_seconds === null || set.duration_seconds === undefined ? {} : { durationSeconds: Number(set.duration_seconds) }),
    ...(set.duration_minutes === null || set.duration_minutes === undefined ? {} : { durationMinutes: Number(set.duration_minutes) }),
    ...(set.distance_km === null || set.distance_km === undefined ? {} : { distanceKm: Number(set.distance_km) }),
  }
}

function toAttendance(item) {
  if (!isRecord(item) || !item.room_id || !item.user_id || !item.attendance_date) return null
  return {
    id: `${item.room_id}:${item.attendance_date}:${item.user_id}`,
    roomId: item.room_id,
    date: item.attendance_date,
    userId: item.user_id,
    status: item.status,
  }
}

export function normalizeRemoteWorkoutData({ entries = [], attendance = [] } = {}) {
  const exercises = []
  const sets = []
  const customExercises = []
  const customExerciseIds = new Set()

  entries.filter(isRecord).forEach((entry) => {
    const normalizedEntry = toEntry(entry)
    if (!normalizedEntry) return
    exercises.push(normalizedEntry)
    const customExercise = toCustomExercise(entry)
    if (customExercise && !customExerciseIds.has(customExercise.id)) {
      customExercises.push(customExercise)
      customExerciseIds.add(customExercise.id)
    }
    if (Array.isArray(entry.workout_sets)) {
      entry.workout_sets.map((set) => toSet(entry, set)).filter(Boolean).forEach((set) => sets.push(set))
    }
  })

  return {
    version: 2,
    exercises,
    sets,
    attendance: attendance.map(toAttendance).filter(Boolean),
    customExercises,
    nextRecordOrder: sets.reduce((max, set) => Math.max(max, set.recordedOrder ?? 0), 0) + 1,
  }
}

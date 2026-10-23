function matchesCategory(exercise, category) {
  return category === '전체' || exercise.categories.includes(category)
}

function normalizeQuery(query) {
  return String(query ?? '').trim().toLocaleLowerCase('ko')
}

function compareByName(first, second) {
  return first.name.localeCompare(second.name, 'ko')
}

function newestSetForExercise(state, currentUserId, exerciseIds) {
  const entriesById = new Map(state.exercises.map((entry) => [entry.id, entry]))
  const newestByExerciseId = new Map()

  state.sets.forEach((set) => {
    if (set.userId !== currentUserId) return
    const entry = entriesById.get(set.entryId)
    if (!entry || !exerciseIds.has(entry.exerciseId)) return
    const current = newestByExerciseId.get(entry.exerciseId)
    const candidate = { date: entry.date, recordedOrder: set.recordedOrder ?? 0 }
    if (!current || candidate.date > current.date
      || (candidate.date === current.date && candidate.recordedOrder > current.recordedOrder)) {
      newestByExerciseId.set(entry.exerciseId, candidate)
    }
  })

  return newestByExerciseId
}

export function getExercisesForPicker({
  exercises,
  customExercises,
  roomId,
  category,
  query,
  state,
  currentUserId,
}) {
  const normalizedQuery = normalizeQuery(query)
  const available = [
    ...exercises,
    ...customExercises.filter((exercise) => exercise.roomId === roomId),
  ]
  const all = available
    .filter((exercise) => matchesCategory(exercise, category))
    .filter((exercise) => !normalizedQuery || exercise.name.toLocaleLowerCase('ko').includes(normalizedQuery))
    .sort(compareByName)
  const allIds = new Set(all.map((exercise) => exercise.id))
  const newestByExerciseId = newestSetForExercise(state, currentUserId, allIds)
  const recent = all
    .filter((exercise) => newestByExerciseId.has(exercise.id))
    .sort((first, second) => {
      const firstRecord = newestByExerciseId.get(first.id)
      const secondRecord = newestByExerciseId.get(second.id)
      if (firstRecord.date !== secondRecord.date) return secondRecord.date.localeCompare(firstRecord.date)
      if (firstRecord.recordedOrder !== secondRecord.recordedOrder) {
        return secondRecord.recordedOrder - firstRecord.recordedOrder
      }
      return compareByName(first, second)
    })
    .slice(0, 3)
  const recentIds = new Set(recent.map((exercise) => exercise.id))

  return { all, recent, remaining: all.filter((exercise) => !recentIds.has(exercise.id)) }
}

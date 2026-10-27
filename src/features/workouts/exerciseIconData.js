export const exerciseIconCount = 6

function stableHash(value) {
  let hash = 2166136261
  for (const character of String(value)) {
    hash ^= character.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function getExerciseIconIndex(exercise) {
  const key = exercise?.id ?? exercise?.name
  if (!key) return null
  return stableHash(key) % exerciseIconCount
}

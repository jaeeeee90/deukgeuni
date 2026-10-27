import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addExercise,
  addSet,
  createInitialWorkoutState,
  getLatestSetForExercise,
} from './workoutData.js'

test('selects only the latest set for the same exercise entry and user', () => {
  const firstEntry = addExercise(createInitialWorkoutState(), 'room-a', '2026-10-27', 'bench-press')
  const otherDate = addExercise(firstEntry.state, 'room-a', '2026-10-28', 'bench-press')
  const otherExercise = addExercise(otherDate.state, 'room-a', '2026-10-27', 'squat')
  let state = addSet(otherExercise.state, firstEntry.entry.id, 'kim', 'kim', { weight: 40, reps: 10 }).state
  state = addSet(state, firstEntry.entry.id, 'kim', 'kim', { weight: 45, reps: 8 }).state
  state = addSet(state, firstEntry.entry.id, 'lee', 'lee', { weight: 70, reps: 5 }).state
  state = addSet(state, otherDate.entry.id, 'kim', 'kim', { weight: 80, reps: 3 }).state
  state = addSet(state, otherExercise.entry.id, 'kim', 'kim', { weight: 30, reps: 12 }).state

  assert.deepEqual(getLatestSetForExercise(state, firstEntry.entry.id, 'kim'), state.sets[1])
  assert.equal(getLatestSetForExercise(state, firstEntry.entry.id, 'lee').userId, 'lee')
  assert.equal(getLatestSetForExercise(state, 'missing-entry', 'kim'), null)
})

test('stores explicitly entered zero weight and ten reps as numbers', () => {
  const entry = addExercise(createInitialWorkoutState(), 'room-a', '2026-10-27', 'bench-press')
  const result = addSet(entry.state, entry.entry.id, 'kim', 'kim', { weight: '0', reps: '10' })

  assert.equal(result.error, null)
  assert.equal(result.set.weight, 0)
  assert.equal(result.set.reps, 10)
})

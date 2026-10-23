import assert from 'node:assert/strict'
import test from 'node:test'
import { addExercise, createInitialWorkoutState } from './workoutData.js'
import { loadWorkoutState, saveWorkoutState, STORAGE_KEY } from './workoutStorage.js'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
  }
}

test('저장 기록이 없으면 빈 임시 상태로 시작한다', () => {
  assert.deepEqual(loadWorkoutState(createMemoryStorage()), createInitialWorkoutState())
})

test('저장된 운동방·날짜별 기록을 다시 불러온다', () => {
  let state = createInitialWorkoutState()
  state = addExercise(state, 'room-a', '2026-10-23', 'bench-press').state
  const storage = createMemoryStorage()
  saveWorkoutState(state, storage)

  assert.deepEqual(loadWorkoutState(storage), state)
})

test('손상되거나 다른 버전의 저장 데이터는 빈 상태로 복구한다', () => {
  const brokenJson = createMemoryStorage({ [STORAGE_KEY]: '{bad json' })
  const unsupported = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99 }) })
  const malformedEntry = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({
    version: 1,
    exercises: [null],
    sets: [],
    attendance: [],
  }) })

  assert.deepEqual(loadWorkoutState(brokenJson), createInitialWorkoutState())
  assert.deepEqual(loadWorkoutState(unsupported), createInitialWorkoutState())
  assert.deepEqual(loadWorkoutState(malformedEntry), createInitialWorkoutState())
})

test('브라우저 저장소 접근이 차단되어도 읽기·쓰기가 예외를 전달하지 않는다', () => {
  const blockedStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }

  assert.deepEqual(loadWorkoutState(blockedStorage), createInitialWorkoutState())
  assert.equal(saveWorkoutState(createInitialWorkoutState(), blockedStorage), false)
})

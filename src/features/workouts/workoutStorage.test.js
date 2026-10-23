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

test('저장 기록이 없으면 쓰기 가능한 빈 v2 상태로 시작한다', () => {
  const result = loadWorkoutState(createMemoryStorage())

  assert.equal(result.error, null)
  assert.equal(result.shouldPersist, true)
  assert.deepEqual(result.state, createInitialWorkoutState())
})

test('유효한 v1 저장 기록은 원본을 읽은 뒤 쓰기 가능한 v2 상태로 변환한다', () => {
  const legacy = {
    version: 1,
    exercises: [{ id: 'entry-1', roomId: 'room-a', date: '2026-10-23', exerciseId: 'bench-press' }],
    sets: [{ id: 'set-1', entryId: 'entry-1', userId: 'kim', order: 1, weight: 40, reps: 12 }],
    attendance: [],
  }
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) })
  const result = loadWorkoutState(storage)

  assert.equal(result.error, null)
  assert.equal(result.migrated, true)
  assert.equal(result.state.version, 2)
  assert.equal(result.state.sets[0].weight, 40)
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1)
})

test('변환 또는 JSON 오류는 기존 raw 저장 데이터를 보존하고 쓰기를 잠근다', () => {
  const brokenRaw = '{bad json'
  const malformedRaw = JSON.stringify({ version: 1, exercises: [null], sets: [], attendance: [] })

  for (const raw of ['', brokenRaw, malformedRaw]) {
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw })
    const result = loadWorkoutState(storage)

    assert.notEqual(result.error, null)
    assert.equal(result.shouldPersist, false)
    assert.equal(storage.getItem(STORAGE_KEY), raw)
  }
})

test('정상 v2 운동 상태를 다시 저장하고 불러온다', () => {
  let state = createInitialWorkoutState()
  state = addExercise(state, 'room-a', '2026-10-23', 'bench-press').state
  const storage = createMemoryStorage()

  assert.equal(saveWorkoutState(state, storage), true)
  assert.deepEqual(loadWorkoutState(storage).state, state)
})

test('브라우저 저장소 접근이 차단되어도 오류 결과를 반환하고 예외를 전달하지 않는다', () => {
  const blockedStorage = {
    getItem() { throw new Error('blocked') },
    setItem() { throw new Error('blocked') },
  }

  const result = loadWorkoutState(blockedStorage)
  assert.notEqual(result.error, null)
  assert.equal(result.shouldPersist, false)
  assert.equal(saveWorkoutState(createInitialWorkoutState(), blockedStorage), false)
})

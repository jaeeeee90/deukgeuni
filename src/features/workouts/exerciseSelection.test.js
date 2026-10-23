import assert from 'node:assert/strict'
import test from 'node:test'
import { getExercisesForPicker } from './exerciseSelection.js'

const exercises = [
  { id: 'bench-press', name: '벤치프레스', categories: ['가슴', '팔'], recordingMethod: 'weight-reps' },
  { id: 'deadlift', name: '데드리프트', categories: ['등', '하체', '복근·코어'], recordingMethod: 'weight-reps' },
  { id: 'chest-fly', name: '체스트 플라이', categories: ['가슴'], recordingMethod: 'weight-reps' },
  { id: 'pull-up', name: '풀업', categories: ['등', '팔'], recordingMethod: 'reps' },
]

const state = {
  exercises: [
    { id: 'entry-bench', roomId: 'room-a', date: '2026-10-22', exerciseId: 'bench-press' },
    { id: 'entry-deadlift', roomId: 'room-b', date: '2026-10-23', exerciseId: 'deadlift' },
    { id: 'entry-fly', roomId: 'room-a', date: '2026-10-23', exerciseId: 'chest-fly' },
  ],
  sets: [
    { id: 'set-bench', entryId: 'entry-bench', userId: 'kim', recordedOrder: 2 },
    { id: 'set-deadlift', entryId: 'entry-deadlift', userId: 'kim', recordedOrder: 3 },
    { id: 'set-fly', entryId: 'entry-fly', userId: 'kim', recordedOrder: 4 },
    { id: 'set-other', entryId: 'entry-fly', userId: 'lee', recordedOrder: 99 },
  ],
}

function select(overrides = {}) {
  return getExercisesForPicker({
    exercises,
    customExercises: [],
    roomId: 'room-a',
    category: '전체',
    query: '',
    state,
    currentUserId: 'kim',
    ...overrides,
  })
}

test('복수 부위 운동은 각 카테고리에서 한 번씩 찾을 수 있다', () => {
  assert.deepEqual(select({ category: '가슴' }).all.map((exercise) => exercise.id), ['bench-press', 'chest-fly'])
  assert.deepEqual(select({ category: '팔' }).all.map((exercise) => exercise.id), ['bench-press', 'pull-up'])
  assert.deepEqual(select({ category: '등' }).all.map((exercise) => exercise.id), ['deadlift', 'pull-up'])
})

test('최근 운동은 현재 카테고리·현재 사용자·수행 날짜와 같은 날짜 기록 순서로 정렬한다', () => {
  const chest = select({ category: '가슴' })
  const back = select({ category: '등' })
  const all = select()

  assert.deepEqual(chest.recent.map((exercise) => exercise.id), ['chest-fly', 'bench-press'])
  assert.deepEqual(back.recent.map((exercise) => exercise.id), ['deadlift'])
  assert.deepEqual(all.recent.map((exercise) => exercise.id), ['chest-fly', 'deadlift', 'bench-press'])
  assert.deepEqual(chest.remaining.map((exercise) => exercise.id), [])
})

test('검색은 카테고리 필터와 함께 적용하고 최근 목록과 가나다순 나머지를 분리한다', () => {
  const result = select({ category: '팔', query: '벤치' })

  assert.deepEqual(result.recent.map((exercise) => exercise.id), ['bench-press'])
  assert.deepEqual(result.remaining.map((exercise) => exercise.id), [])
  assert.equal(result.all.length, 1)
})

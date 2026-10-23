import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addExercise,
  addCustomExercise,
  addSet,
  createInitialWorkoutState,
  getLocalDateKey,
  migrateWorkoutState,
  removeRoomData,
  removeExercise,
  removeSet,
  setAttendance,
  shiftDateKey,
  updateSet,
} from './workoutData.js'

const exercise = { id: 'bench-press', name: '벤치프레스' }
const today = '2026-10-23'

function addBench(state, roomId = 'room-a', date = today) {
  return addExercise(state, roomId, date, exercise.id)
}

test('로컬 날짜 키는 로컬 달력 날짜를 사용한다', () => {
  const localDate = new Date(2026, 9, 23, 23, 59, 59)
  assert.equal(getLocalDateKey(localDate), '2026-10-23')
})

test('날짜 이동은 월 경계를 포함해 로컬 달력 기준으로 계산한다', () => {
  assert.equal(shiftDateKey('2026-10-31', 1), '2026-11-01')
  assert.equal(shiftDateKey('2026-11-01', -1), '2026-10-31')
})

test('운동 종목은 같은 방과 날짜에서만 중복을 거절한다', () => {
  const state = createInitialWorkoutState()
  const first = addBench(state)
  const duplicate = addBench(first.state)
  const otherDate = addBench(first.state, 'room-a', '2026-10-24')
  const otherRoom = addBench(first.state, 'room-b', today)

  assert.equal(first.error, null)
  assert.equal(duplicate.error, 'duplicate')
  assert.equal(duplicate.state, first.state)
  assert.equal(otherDate.state.exercises.length, 2)
  assert.equal(otherRoom.state.exercises.length, 2)
})

test('운동 삭제는 연결된 모든 세트만 삭제하고 참여 및 다른 날짜 기록은 유지한다', () => {
  let state = createInitialWorkoutState()
  const entry = addBench(state).entry
  state = addBench(state, 'room-a', '2026-10-24').state
  state = addSet(state, entry.id, 'kim', 'kim', { weight: 40, reps: 12 }).state
  state = addSet(state, entry.id, 'lee', 'lee', { weight: 20, reps: 10 }).state
  state = setAttendance(state, 'room-a', today, 'lee', 'not_attending')

  const next = removeExercise(state, entry.id)

  assert.equal(next.exercises.length, 1)
  assert.equal(next.sets.length, 0)
  assert.equal(next.attendance[0].status, 'not_attending')
  assert.equal(next.exercises[0].date, '2026-10-24')
})

test('방 삭제는 해당 방의 종목·연결 세트·참여 상태만 정리한다', () => {
  const roomA = addBench(createInitialWorkoutState(), 'room-a')
  const roomB = addBench(roomA.state, 'room-b')
  let state = roomB.state
  state = addSet(state, roomA.entry.id, 'kim', 'kim', { weight: 40, reps: 10 }).state
  state = addSet(state, roomB.entry.id, 'lee', 'lee', { weight: 30, reps: 12 }).state
  state = setAttendance(state, 'room-a', today, 'kim', 'attending')
  state = setAttendance(state, 'room-b', today, 'lee', 'not_attending')

  const next = removeRoomData(state, 'room-a')

  assert.deepEqual(next.exercises.map((entry) => entry.roomId), ['room-b'])
  assert.deepEqual(next.sets.map((set) => set.entryId), [roomB.entry.id])
  assert.deepEqual(next.attendance.map((item) => item.roomId), ['room-b'])
})

test('세트 중량은 0 이상의 소수도 허용하고 반복 횟수는 양의 정수만 허용한다', () => {
  const exerciseEntry = addBench(createInitialWorkoutState())
  const valid = addSet(exerciseEntry.state, exerciseEntry.entry.id, 'kim', 'kim', {
    weight: '12.5',
    reps: '8',
  })
  const invalidWeight = addSet(valid.state, exerciseEntry.entry.id, 'kim', 'kim', { weight: '-1', reps: '8' })
  const invalidReps = addSet(valid.state, exerciseEntry.entry.id, 'kim', 'kim', { weight: '10', reps: '2.5' })

  assert.equal(valid.error, null)
  assert.equal(valid.set.weight, 12.5)
  assert.equal(invalidWeight.error, 'invalid-weight')
  assert.equal(invalidReps.error, 'invalid-reps')
  assert.equal(invalidWeight.state, valid.state)
  assert.equal(invalidReps.state, valid.state)
})

test('세트 변경은 현재 사용자의 기록에만 허용한다', () => {
  const exerciseEntry = addBench(createInitialWorkoutState())
  const added = addSet(exerciseEntry.state, exerciseEntry.entry.id, 'kim', 'kim', { weight: 40, reps: 12 })
  const state = added.state

  const unauthorizedUpdate = updateSet(state, added.set.id, 'lee', { weight: 55, reps: 8 })
  const unauthorizedDelete = removeSet(state, added.set.id, 'lee')

  assert.equal(unauthorizedUpdate.error, 'unauthorized')
  assert.equal(unauthorizedDelete.error, 'unauthorized')
  assert.equal(state.sets[0].weight, 40)
  assert.equal(unauthorizedDelete.state, state)
})

test('본인은 자신의 세트 중량과 반복 횟수를 수정할 수 있다', () => {
  const exerciseEntry = addBench(createInitialWorkoutState())
  const added = addSet(exerciseEntry.state, exerciseEntry.entry.id, 'kim', 'kim', {
    weight: 40,
    reps: 12,
  })
  const updated = updateSet(added.state, added.set.id, 'kim', { weight: '42.5', reps: '10' })

  assert.equal(updated.error, null)
  assert.equal(updated.set.weight, 42.5)
  assert.equal(updated.set.reps, 10)
})

test('삭제한 세트 뒤의 순번을 당기고 다음 세트를 순서대로 추가한다', () => {
  const exerciseEntry = addBench(createInitialWorkoutState())
  const entry = exerciseEntry.entry
  const first = addSet(exerciseEntry.state, entry.id, 'kim', 'kim', { weight: 20, reps: 12 })
  const second = addSet(first.state, entry.id, 'kim', 'kim', { weight: 25, reps: 10 })
  const third = addSet(second.state, entry.id, 'kim', 'kim', { weight: 30, reps: 8 })
  const afterDelete = removeSet(third.state, second.set.id, 'kim')
  const next = addSet(afterDelete.state, entry.id, 'kim', 'kim', { weight: 35, reps: 6 })

  assert.deepEqual(afterDelete.state.sets.map((set) => set.order), [1, 2])
  assert.deepEqual(next.state.sets.map((set) => set.order), [1, 2, 3])
})

test('세트를 추가하면 미참여 상태의 해당 사용자만 참여로 바뀐다', () => {
  const exerciseEntry = addBench(createInitialWorkoutState())
  const entry = exerciseEntry.entry
  let state = exerciseEntry.state
  state = setAttendance(state, 'room-a', today, 'kim', 'not_attending')
  state = setAttendance(state, 'room-a', today, 'lee', 'not_attending')

  const result = addSet(state, entry.id, 'kim', 'kim', { weight: 0, reps: 1 })

  assert.equal(result.error, null)
  assert.equal(result.state.attendance.find((item) => item.userId === 'kim').status, 'attending')
  assert.equal(result.state.attendance.find((item) => item.userId === 'lee').status, 'not_attending')
})

test('참여 상태는 방과 날짜별로 독립적으로 관리한다', () => {
  let state = createInitialWorkoutState()
  state = setAttendance(state, 'room-a', today, 'kim', 'attending')
  state = setAttendance(state, 'room-a', '2026-10-24', 'kim', 'not_attending')
  state = setAttendance(state, 'room-b', today, 'kim', 'not_attending')

  assert.equal(state.attendance.length, 3)
})

test('유효한 v1 기록은 ID와 무게·횟수를 보존한 v2로 변환한다', () => {
  const v1 = {
    version: 1,
    exercises: [{ id: 'entry-1', roomId: 'room-a', date: today, exerciseId: 'bench-press' }],
    sets: [{ id: 'set-1', entryId: 'entry-1', userId: 'kim', order: 1, weight: 42.5, reps: 10 }],
    attendance: [{ id: 'attendance-1', roomId: 'room-a', date: today, userId: 'kim', status: 'attending' }],
  }

  const result = migrateWorkoutState(v1)

  assert.equal(result.error, null)
  assert.equal(result.migrated, true)
  assert.equal(result.state.version, 2)
  assert.equal(result.state.exercises[0].exerciseId, 'bench-press')
  assert.deepEqual(result.state.sets[0], {
    id: 'set-1', entryId: 'entry-1', userId: 'kim', order: 1, weight: 42.5, reps: 10,
    recordingMethod: 'weight-reps', recordedOrder: 1,
  })
})

test('사용자 운동은 같은 방에서 이름 중복을 막고 다른 방에는 허용한다', () => {
  const first = addCustomExercise(createInitialWorkoutState(), {
    roomId: 'room-a', name: '  케틀벨 스윙 ', categories: ['하체', '복근·코어'], recordingMethod: 'reps',
  })
  const duplicate = addCustomExercise(first.state, {
    roomId: 'room-a', name: '케틀벨 스윙', categories: ['하체'], recordingMethod: 'reps',
  })
  const otherRoom = addCustomExercise(first.state, {
    roomId: 'room-b', name: '케틀벨 스윙', categories: ['하체'], recordingMethod: 'reps',
  })

  assert.equal(first.error, null)
  assert.equal(first.exercise.name, '케틀벨 스윙')
  assert.equal(duplicate.error, 'duplicate-custom-exercise')
  assert.equal(otherRoom.error, null)
})

test('사용자 운동은 같은 방의 마스터 운동 이름과도 중복 등록할 수 없다', () => {
  const result = addCustomExercise(createInitialWorkoutState(), {
    roomId: 'room-a', name: ' 벤치프레스 ', categories: ['가슴'], recordingMethod: 'weight-reps',
  })

  assert.equal(result.error, 'duplicate-master-exercise')
})

test('기록 방식에 맞는 값만 세트로 저장한다', () => {
  const pullUp = addExercise(createInitialWorkoutState(), 'room-a', today, 'pull-up')
  const plank = addExercise(pullUp.state, 'room-a', today, 'plank')
  const running = addExercise(plank.state, 'room-a', today, 'running')
  const reps = addSet(running.state, pullUp.entry.id, 'kim', 'kim', { reps: '12' }, 'reps')
  const duration = addSet(running.state, plank.entry.id, 'kim', 'kim', { duration: '90', durationUnit: 'seconds' }, 'duration')
  const distance = addSet(running.state, running.entry.id, 'kim', 'kim', { durationMinutes: '30', distanceKm: '5.2' }, 'duration-distance')
  const invalid = addSet(running.state, pullUp.entry.id, 'kim', 'kim', { reps: '2.5' }, 'reps')

  assert.equal(reps.error, null)
  assert.deepEqual(duration.set, { id: duration.set.id, entryId: plank.entry.id, userId: 'kim', order: 1, recordingMethod: 'duration', durationSeconds: 90, recordedOrder: 1 })
  assert.equal(distance.set.distanceKm, 5.2)
  assert.equal(invalid.error, 'invalid-reps')
})

test('세트는 연결된 운동의 기록 방식과 다른 방식으로 저장할 수 없다', () => {
  const bench = addBench(createInitialWorkoutState())
  const result = addSet(bench.state, bench.entry.id, 'kim', 'kim', { duration: '30', durationUnit: 'seconds' }, 'duration')

  assert.equal(result.error, 'recording-method-mismatch')
  assert.equal(result.state, bench.state)
})

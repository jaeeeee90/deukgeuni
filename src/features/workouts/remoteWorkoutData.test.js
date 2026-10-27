import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRemoteWorkoutData } from './remoteWorkoutData.js'

test('remote workout rows become the existing workout state shape', () => {
  const state = normalizeRemoteWorkoutData({
    entries: [{
      id: 'entry-1',
      room_id: 'room-1',
      workout_date: '2026-10-26',
      exercise_id: 'bench-press',
      exercise_name: '벤치프레스',
      exercise_categories: ['가슴', '팔'],
      recording_method: 'weight-reps',
      created_by: 'user-1',
      workout_sets: [{
        id: 'set-1',
        user_id: 'user-1',
        set_order: 1,
        recorded_order: 1,
        recording_method: 'weight-reps',
        weight: 50,
        reps: 10,
      }],
    }],
    attendance: [{ room_id: 'room-1', user_id: 'user-1', attendance_date: '2026-10-26', status: 'attending' }],
  })

  assert.deepEqual(state.exercises, [{
    id: 'entry-1', roomId: 'room-1', date: '2026-10-26', exerciseId: 'bench-press',
  }])
  assert.deepEqual(state.sets, [{
    id: 'set-1', entryId: 'entry-1', userId: 'user-1', order: 1, recordedOrder: 1,
    recordingMethod: 'weight-reps', weight: 50, reps: 10,
  }])
  assert.deepEqual(state.attendance, [{
    id: 'room-1:2026-10-26:user-1', roomId: 'room-1', date: '2026-10-26', userId: 'user-1', status: 'attending',
  }])
  assert.deepEqual(state.customExercises, [])
})

test('remote custom exercise definitions are available to the existing picker', () => {
  const state = normalizeRemoteWorkoutData({
    entries: [{
      id: 'entry-1', room_id: 'room-1', workout_date: '2026-10-26', exercise_id: 'custom-exercise-1',
      exercise_name: '케이블 프레스', exercise_categories: ['가슴'], recording_method: 'reps', workout_sets: [],
    }],
    attendance: [],
  })

  assert.deepEqual(state.customExercises, [{
    id: 'custom-exercise-1', roomId: 'room-1', name: '케이블 프레스', categories: ['가슴'], recordingMethod: 'reps',
  }])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { exerciseCategories, exercises } from './exerciseCatalog.js'

test('운동 마스터는 기존 ID를 보존하며 다중 부위와 기록 방식을 제공한다', () => {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))

  assert.deepEqual(exerciseCategories, ['전체', '가슴', '등', '하체', '어깨', '팔', '복근·코어', '유산소'])
  assert.equal(byId.get('bench-press').name, '벤치프레스')
  assert.deepEqual(byId.get('bench-press').categories, ['가슴', '팔'])
  assert.equal(byId.get('bench-press').recordingMethod, 'weight-reps')
  assert.deepEqual(byId.get('deadlift').categories, ['등', '하체', '복근·코어'])
  assert.equal(byId.get('plank').recordingMethod, 'duration')
  assert.equal(byId.get('running').recordingMethod, 'duration-distance')
})

test('운동 마스터는 70~100개의 고유한 안정 ID를 가진다', () => {
  assert.ok(exercises.length >= 70 && exercises.length <= 100)
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, exercises.length)
})

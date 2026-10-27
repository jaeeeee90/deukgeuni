import assert from 'node:assert/strict'
import test from 'node:test'
import { exerciseIconCount, getExerciseIconIndex } from './exerciseIconData.js'

test('운동 ID가 같으면 배열 순서와 관계없이 같은 강아지 아이콘 번호를 선택한다', () => {
  const exercise = { id: 'bench-press', name: '벤치프레스' }
  const sameExercise = { id: 'bench-press', name: '다른 표시 이름' }

  assert.equal(getExerciseIconIndex(exercise), getExerciseIconIndex(sameExercise))
  assert.equal(exerciseIconCount, 6)
})

test('운동 ID는 6종 범위 안에서 안정적으로 아이콘 번호를 선택한다', () => {
  const first = getExerciseIconIndex({ id: 'bench-press' })
  const second = getExerciseIconIndex({ id: 'squat' })

  assert.ok(first >= 0 && first < exerciseIconCount)
  assert.ok(second >= 0 && second < exerciseIconCount)
  assert.equal(getExerciseIconIndex({ id: 'squat' }), second)
})

test('ID가 없으면 운동 이름으로 아이콘을 선택하고 입력이 없으면 null을 반환한다', () => {
  assert.ok(getExerciseIconIndex({ name: '직접 등록 운동' }) >= 0)
  assert.equal(getExerciseIconIndex(null), null)
})

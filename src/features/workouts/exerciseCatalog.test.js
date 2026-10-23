import assert from 'node:assert/strict'
import test from 'node:test'
import { exerciseCategories, exercises } from './exerciseCatalog.js'

test('운동 마스터에 요청된 부위별 종목이 모두 포함되어 있다', () => {
  const namesByCategory = Object.fromEntries(
    exerciseCategories.map((category) => [
      category,
      exercises.filter((exercise) => exercise.category === category).map((exercise) => exercise.name),
    ]),
  )

  assert.deepEqual(namesByCategory, {
    가슴: ['벤치프레스', '인클라인 벤치프레스', '체스트프레스', '덤벨 플라이'],
    등: ['랫풀다운', '바벨로우', '시티드로우', '풀업'],
    하체: ['스쿼트', '레그프레스', '레그익스텐션', '레그컬'],
    어깨: ['숄더프레스', '사이드 레터럴 레이즈', '리어 델트 플라이'],
    팔: ['바벨컬', '덤벨컬', '트라이셉스 푸시다운'],
    복근: ['크런치', '레그레이즈', '플랭크'],
  })
})

test('운동 마스터의 종목 ID는 모두 고유하다', () => {
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, exercises.length)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMemberSummary } from './memberSummary.js'

test('한 명은 이름과 전체 인원을 표시한다', () => {
  assert.equal(formatMemberSummary(['김민수']), '김민수 (1명)')
})

test('세 명 이하는 가나다순으로 모두 표시한다', () => {
  assert.equal(
    formatMemberSummary(['이지훈', '김민수', '박서연']),
    '김민수, 박서연, 이지훈 (3명)',
  )
})

test('네 명 이상이면 가나다순 상위 세 명 뒤에 등을 붙인다', () => {
  assert.equal(
    formatMemberSummary(['최유진', '이지훈', '박서연', '김민수']),
    '김민수, 박서연, 이지훈 등 (4명)',
  )
})

test('긴 이름도 동일한 규칙으로 요약한다', () => {
  assert.equal(
    formatMemberSummary(['오하늘', '김민수', '박서연', '이지훈', '최유진']),
    '김민수, 박서연, 오하늘 등 (5명)',
  )
})

test('참여자가 없으면 0명으로 표시한다', () => {
  assert.equal(formatMemberSummary([]), '(0명)')
})

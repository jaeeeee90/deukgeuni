import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialRoomState } from './roomData.js'
import { loadRoomState, saveRoomState } from './roomStorage.js'

function createMemoryStorage() {
  const data = new Map()
  return {
    getItem(key) { return data.get(key) ?? null },
    setItem(key, value) { data.set(key, value) },
  }
}

test('사용자 생성 방 저장소는 저장한 방을 다시 불러온다', () => {
  const storage = createMemoryStorage()
  const state = {
    version: 1,
    rooms: [{
      id: 'custom-room-1', name: '아침 헬스', description: '', symbol: '💪', color: 'peach',
      creatorId: 'member-kim-minsu', members: [{ id: 'member-kim-minsu', name: '김민수' }], exercises: [],
    }],
  }

  assert.equal(saveRoomState(state, storage), true)
  assert.deepEqual(loadRoomState(storage), state)
})

test('손상된 저장 값 또는 접근 불가 저장소는 기존 예시 방 대신 빈 사용자 방 상태를 반환한다', () => {
  const damaged = { getItem() { return '{not-json' } }
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }

  assert.deepEqual(loadRoomState(damaged), createInitialRoomState())
  assert.deepEqual(loadRoomState(blocked), createInitialRoomState())
  assert.equal(saveRoomState(createInitialRoomState(), blocked), false)
})

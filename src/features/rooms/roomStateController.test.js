import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialRoomState, createRoom } from './roomData.js'
import { applyRoomMutation } from './roomStateController.js'

const creator = { id: 'member-kim-minsu', name: '김민수' }
const input = { name: '연속 생성 방', description: '', symbol: '💪', color: 'peach' }

test('연속된 방 변경은 가장 최근 상태를 기준으로 누적한다', () => {
  const stateRef = { current: createInitialRoomState() }
  const savedStates = []
  const setState = (state) => savedStates.push(state)

  const first = applyRoomMutation(stateRef, setState, (state) => createRoom(state, input, creator, () => 'custom-room-first'))
  const second = applyRoomMutation(stateRef, setState, (state) => createRoom(state, input, creator, () => 'custom-room-second'))

  assert.equal(first.error, null)
  assert.equal(second.error, null)
  assert.deepEqual(stateRef.current.rooms.map((room) => room.id), ['custom-room-second', 'custom-room-first'])
  assert.equal(savedStates.length, 2)
  assert.deepEqual(savedStates[1], stateRef.current)
})

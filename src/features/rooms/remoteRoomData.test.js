import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeRemoteRoom, normalizeRemoteRooms } from './remoteRoomData.js'

test('remote room is converted to the existing room view model', () => {
  const room = normalizeRemoteRoom({
    id: '6f7f1c7a-6c10-4a12-b3c6-7e6b1db1a111',
    name: '아침 러닝 크루',
    description: '평일 아침 운동',
    symbol: '🏃',
    color: 'mint',
    creator_id: 'user-owner',
    room_members: [
      { user_id: 'user-owner', display_name: '김민수', role: 'owner', status: 'active' },
      { user_id: 'user-member', display_name: '박서연', role: 'member', status: 'active' },
      { user_id: 'user-left', display_name: '탈퇴자', role: 'member', status: 'left' },
    ],
  })

  assert.deepEqual(room, {
    id: '6f7f1c7a-6c10-4a12-b3c6-7e6b1db1a111',
    name: '아침 러닝 크루',
    description: '평일 아침 운동',
    symbol: '🏃',
    color: 'mint',
    creatorId: 'user-owner',
    members: [
      { id: 'user-owner', name: '김민수' },
      { id: 'user-member', name: '박서연' },
    ],
    exercises: [],
    source: 'remote',
  })
})

test('remote room list ignores invalid rows without changing local data', () => {
  const rooms = normalizeRemoteRooms([
    { id: 'remote-1', name: '첫 방', description: '', symbol: '💪', color: 'peach', creator_id: 'user-1', room_members: [] },
    null,
    { id: '', name: '잘못된 방' },
  ])

  assert.equal(rooms.length, 1)
  assert.equal(rooms[0].source, 'remote')
})

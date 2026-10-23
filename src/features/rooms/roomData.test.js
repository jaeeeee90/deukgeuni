import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialRoomState,
  createRoom,
  deleteRoom,
  parseRoomState,
  updateRoom,
} from './roomData.js'

const creator = { id: 'member-kim-minsu', name: '김민수' }
const otherUserId = 'member-lee-jihoon'
const roomInput = {
  name: '  아침 헬스  ',
  description: '  출근 전 함께 운동해요.  ',
  symbol: '🏃',
  color: 'mint',
}

function makeRoom(state = createInitialRoomState(), input = roomInput, id = 'custom-room-1') {
  return createRoom(state, input, creator, () => id)
}

test('운동방 생성은 이름과 설명을 정리하고 생성자를 첫 회원으로 등록한다', () => {
  const result = makeRoom()

  assert.equal(result.error, null)
  assert.deepEqual(result.room, {
    id: 'custom-room-1',
    name: '아침 헬스',
    description: '출근 전 함께 운동해요.',
    symbol: '🏃',
    color: 'mint',
    creatorId: creator.id,
    members: [creator],
    exercises: [],
  })
})

test('공백뿐이거나 30자를 넘는 운동방 이름은 생성하지 않는다', () => {
  const blank = makeRoom(createInitialRoomState(), { ...roomInput, name: '   ' })
  const tooLong = makeRoom(createInitialRoomState(), { ...roomInput, name: '가'.repeat(31) })

  assert.equal(blank.error, 'invalid-name')
  assert.equal(blank.state.rooms.length, 0)
  assert.equal(tooLong.error, 'invalid-name')
  assert.equal(tooLong.state.rooms.length, 0)
})

test('같은 이름의 운동방도 각각 다른 고유 ID로 생성할 수 있다', () => {
  const first = makeRoom()
  const second = makeRoom(first.state, roomInput, 'custom-room-2')

  assert.equal(second.error, null)
  assert.equal(second.state.rooms.length, 2)
  assert.deepEqual(second.state.rooms.map((room) => room.id), ['custom-room-2', 'custom-room-1'])
  assert.deepEqual(second.state.rooms.map((room) => room.name), ['아침 헬스', '아침 헬스'])
})

test('이미 사용 중인 ID는 새 운동방에 다시 사용할 수 없다', () => {
  const first = makeRoom()
  const duplicate = makeRoom(first.state, roomInput, first.room.id)

  assert.equal(duplicate.error, 'duplicate-id')
  assert.equal(duplicate.state, first.state)
})

test('생성자만 운동방 정보를 수정하거나 삭제할 수 있다', () => {
  const created = makeRoom()
  const deniedUpdate = updateRoom(created.state, created.room.id, otherUserId, { name: '다른 이름' })
  const updated = updateRoom(created.state, created.room.id, creator.id, {
    name: '  저녁 헬스 ', description: '새 설명', symbol: '🚴', color: 'peach',
  })
  const deniedDelete = deleteRoom(updated.state, created.room.id, otherUserId)
  const deleted = deleteRoom(updated.state, created.room.id, creator.id)

  assert.equal(deniedUpdate.error, 'unauthorized')
  assert.equal(deniedUpdate.state, created.state)
  assert.equal(updated.error, null)
  assert.equal(updated.room.name, '저녁 헬스')
  assert.equal(updated.room.description, '새 설명')
  assert.equal(updated.room.symbol, '🚴')
  assert.equal(deniedDelete.error, 'unauthorized')
  assert.equal(deleted.error, null)
  assert.equal(deleted.removedRoom.id, created.room.id)
  assert.equal(deleted.state.rooms.length, 0)
})

test('손상되거나 다른 버전의 사용자 생성 방 데이터는 빈 상태로 복구한다', () => {
  assert.deepEqual(parseRoomState({ version: 99, rooms: [] }), createInitialRoomState())
  assert.deepEqual(parseRoomState({ version: 1, rooms: [{ id: 'missing-fields' }] }), createInitialRoomState())

  const room = makeRoom().room
  assert.deepEqual(parseRoomState({ version: 1, rooms: [room, room] }), createInitialRoomState())
  assert.deepEqual(parseRoomState({ version: 1, rooms: [{ ...room, id: 'after-work' }] }), createInitialRoomState())
})

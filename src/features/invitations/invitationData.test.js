import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearPendingInviteToken,
  createInviteUrl,
  getFirstRpcRow,
  getInviteTokenFromLocation,
  getPendingInviteToken,
  mapInvitationError,
  savePendingInviteToken,
} from './invitationData.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

test('reads only a valid invite token from the invite URL', () => {
  assert.equal(
    getInviteTokenFromLocation({ pathname: '/invite', search: '?token=' + 'a'.repeat(64) }),
    'a'.repeat(64),
  )
  assert.equal(getInviteTokenFromLocation({ pathname: '/invite', search: '?token=too-short' }), null)
  assert.equal(getInviteTokenFromLocation({ pathname: '/rooms', search: '?token=' + 'a'.repeat(64) }), null)
})

test('stores and clears the pending invite token without logging it', () => {
  const storage = createStorage()
  const token = 'b'.repeat(64)

  assert.equal(savePendingInviteToken(storage, token), true)
  assert.equal(getPendingInviteToken(storage), token)
  assert.equal(clearPendingInviteToken(storage), true)
  assert.equal(getPendingInviteToken(storage), null)
})

test('creates an invite URL and normalizes table RPC responses', () => {
  const token = 'c'.repeat(64)
  assert.equal(createInviteUrl('https://deukgeuni.example', token), `https://deukgeuni.example/invite?token=${token}`)
  assert.deepEqual(getFirstRpcRow([{ room_id: 'room-1' }]), { room_id: 'room-1' })
  assert.deepEqual(getFirstRpcRow({ room_id: 'room-2' }), { room_id: 'room-2' })
  assert.equal(getFirstRpcRow([]), null)
})

test('maps invitation RPC errors without exposing the token', () => {
  assert.equal(mapInvitationError({ message: 'invitation_unavailable' }), '초대 링크가 만료됐거나 유효하지 않아요.')
  assert.equal(mapInvitationError({ message: 'not_authenticated' }), '로그인 후 운동방에 참여할 수 있어요.')
  assert.equal(mapInvitationError({ message: 'member_join_conflict' }), '회원 상태를 확인하지 못했어요. 다시 시도해 주세요.')
  assert.equal(mapInvitationError({ message: 'unexpected secret token value' }), '초대 링크를 처리하지 못했어요. 다시 시도해 주세요.')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { getRlsMutationGuard } from './rlsProbeGuard.js'

test('RLS mutation guard only allows an isolated test room and another member set', () => {
  const allowed = getRlsMutationGuard({
    room: { id: 'room-1', name: '[RLS TEST] 권한 검증방', deleted_at: null },
    currentUserId: 'user-2',
    targetOwnerId: 'user-1',
    targetOwnerIsMember: true,
  })
  assert.deepEqual(allowed, { allowed: true, reason: null })
})

test('RLS mutation guard rejects production rooms and own records', () => {
  assert.equal(getRlsMutationGuard({
    room: { id: 'room-1', name: '실제 운동방', deleted_at: null },
    currentUserId: 'user-2', targetOwnerId: 'user-1', targetOwnerIsMember: true,
  }).allowed, false)
  assert.equal(getRlsMutationGuard({
    room: { id: 'room-1', name: '[RLS TEST] 권한 검증방', deleted_at: null },
    currentUserId: 'user-1', targetOwnerId: 'user-1', targetOwnerIsMember: true,
  }).allowed, false)
  assert.equal(getRlsMutationGuard({
    room: { id: 'room-1', name: '[RLS TEST] 권한 검증방', deleted_at: null },
    currentUserId: 'user-2', targetOwnerId: 'user-1', targetOwnerIsMember: false,
  }).allowed, false)
})

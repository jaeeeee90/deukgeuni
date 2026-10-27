import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapRoomFriendInvitationError,
  normalizeReceivedRoomFriendInvitations,
  normalizeRoomFriendInvitationStatuses,
  normalizeSendRoomFriendInvitationResults,
} from './roomFriendInvitationData.js'

test('normalizes room friend invitation statuses', () => {
  assert.deepEqual(normalizeRoomFriendInvitationStatuses([
    { invitation_id: 'invite-1', invitee_id: 'user-2', invitation_status: 'pending', created_at: '2026-01-01' },
    { invitation_id: '', invitee_id: 'invalid' },
  ]), {
    'user-2': { id: 'invite-1', status: 'pending', createdAt: '2026-01-01' },
  })
})

test('normalizes received room invitations and ignores incomplete rows', () => {
  assert.deepEqual(normalizeReceivedRoomFriendInvitations([
    {
      invitation_id: 'invite-1',
      room_id: 'room-1',
      room_name: '아침 운동방',
      room_symbol: '💪',
      room_color: 'peach',
      inviter_id: 'user-1',
      inviter_name: '김민수',
      inviter_avatar_url: null,
      created_at: '2026-01-01',
    },
    { invitation_id: 'invalid', room_id: 'room-2' },
  ]), [{
    id: 'invite-1',
    roomId: 'room-1',
    roomName: '아침 운동방',
    roomSymbol: '💪',
    roomColor: 'peach',
    inviterId: 'user-1',
    inviterName: '김민수',
    inviterAvatarUrl: null,
    createdAt: '2026-01-01',
  }])
})

test('normalizes send results for sent, pending, and already-member states', () => {
  assert.deepEqual(normalizeSendRoomFriendInvitationResults([
    { invitation_id: 'invite-1', invitee_id: 'user-1', invitation_status: 'sent' },
    { invitation_id: null, invitee_id: 'user-2', invitation_status: 'already_member' },
    { invitation_id: 'invite-3', invitee_id: 'user-3', invitation_status: 'pending' },
  ]), [
    { id: 'invite-1', userId: 'user-1', status: 'sent' },
    { id: null, userId: 'user-2', status: 'already_member' },
    { id: 'invite-3', userId: 'user-3', status: 'pending' },
  ])
})

test('maps room friend invitation errors without exposing database details', () => {
  assert.equal(mapRoomFriendInvitationError({ message: 'room_invitee_not_friend' }), '친구 관계를 확인한 뒤 초대해 주세요.')
  assert.equal(mapRoomFriendInvitationError({ message: 'room_friend_invitation_not_pending' }), '이미 처리된 운동방 초대예요.')
  assert.equal(mapRoomFriendInvitationError({ message: 'unexpected token value' }), '운동방 초대를 처리하지 못했어요. 다시 시도해 주세요.')
})

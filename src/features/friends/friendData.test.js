import assert from 'node:assert/strict'
import test from 'node:test'
import {
  mapFriendError,
  normalizeFriendCode,
  normalizeFriendList,
  normalizeFriendRequests,
} from './friendData.js'

test('normalizes friend codes for display and RPC input', () => {
  assert.equal(normalizeFriendCode(' dg-ab7k2m '), 'DG-AB7K2M')
  assert.equal(normalizeFriendCode('DG-AB7K2M'), 'DG-AB7K2M')
  assert.equal(normalizeFriendCode('wrong-code'), null)
})

test('normalizes accepted friends and ignores incomplete rows', () => {
  assert.deepEqual(normalizeFriendList([
    { friendship_id: 'friendship-1', friend_id: 'user-2', display_name: '박서연', avatar_url: null, friends_since: '2026-01-01' },
    { friendship_id: 'friendship-2', friend_id: '', display_name: '잘못된 행' },
  ]), [
    { id: 'friendship-1', userId: 'user-2', name: '박서연', avatarUrl: null, friendsSince: '2026-01-01' },
  ])
})

test('splits incoming and outgoing pending requests', () => {
  const requests = normalizeFriendRequests([
    { friendship_id: 'incoming-1', direction: 'incoming', user_id: 'user-2', display_name: '김서윤', avatar_url: null, created_at: '2026-01-02' },
    { friendship_id: 'outgoing-1', direction: 'outgoing', user_id: 'user-3', display_name: '이도윤', avatar_url: null, created_at: '2026-01-03' },
  ])

  assert.equal(requests.incoming[0].id, 'incoming-1')
  assert.equal(requests.outgoing[0].id, 'outgoing-1')
})

test('maps friend RPC errors to safe user messages', () => {
  assert.equal(mapFriendError({ message: 'already_friends' }), '이미 친구로 등록된 사용자예요.')
  assert.equal(mapFriendError({ message: 'friend_request_not_recipient' }), '받은 친구 요청만 처리할 수 있어요.')
  assert.equal(mapFriendError({ message: 'friend_request_not_requester' }), '보낸 친구 요청만 취소할 수 있어요.')
  assert.equal(mapFriendError({ message: 'unknown database error' }), '친구 기능을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
})

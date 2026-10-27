import assert from 'node:assert/strict'
import test from 'node:test'
import { getDisplayName } from './authData.js'

test('uses the profile display name before auth metadata', () => {
  assert.equal(getDisplayName(
    { display_name: '  프로필 이름  ' },
    { user_metadata: { display_name: 'Auth 이름' } },
  ), '프로필 이름')
})

test('falls back safely while the profile is not available', () => {
  assert.equal(getDisplayName(null, { user_metadata: { display_name: '가입 이름' } }), '가입 이름')
  assert.equal(getDisplayName(null, null), '운동 친구')
})

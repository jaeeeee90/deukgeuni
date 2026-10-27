function isRecord(value) {
  return value !== null && typeof value === 'object'
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

export function normalizeRoomFriendInvitationStatuses(values) {
  if (!Array.isArray(values)) return {}
  return values.reduce((result, value) => {
    if (!isRecord(value) || !nonEmptyString(value.invitation_id) || !nonEmptyString(value.invitee_id)
      || value.invitation_status !== 'pending') return result
    result[value.invitee_id] = {
      id: value.invitation_id,
      status: value.invitation_status,
      createdAt: value.created_at ?? null,
    }
    return result
  }, {})
}

export function normalizeReceivedRoomFriendInvitations(values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => {
    if (!isRecord(value) || !nonEmptyString(value.invitation_id) || !nonEmptyString(value.room_id)
      || !nonEmptyString(value.room_name) || !nonEmptyString(value.inviter_id)
      || !nonEmptyString(value.inviter_name)) return null
    return {
      id: value.invitation_id,
      roomId: value.room_id,
      roomName: value.room_name,
      roomSymbol: nonEmptyString(value.room_symbol) ? value.room_symbol : '💪',
      roomColor: nonEmptyString(value.room_color) ? value.room_color : 'peach',
      inviterId: value.inviter_id,
      inviterName: value.inviter_name,
      inviterAvatarUrl: nonEmptyString(value.inviter_avatar_url) ? value.inviter_avatar_url : null,
      createdAt: value.created_at ?? null,
    }
  }).filter(Boolean)
}

export function normalizeSendRoomFriendInvitationResults(values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => {
    if (!isRecord(value) || !nonEmptyString(value.invitee_id)
      || !['sent', 'pending', 'already_member'].includes(value.invitation_status)) return null
    return {
      id: nonEmptyString(value.invitation_id) ? value.invitation_id : null,
      userId: value.invitee_id,
      status: value.invitation_status,
    }
  }).filter(Boolean)
}

export function mapRoomFriendInvitationError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  if (message.includes('not_authenticated')) return '로그인 상태를 확인해 주세요.'
  if (message.includes('room_not_found')) return '운동방을 찾지 못했어요.'
  if (message.includes('room_invitation_not_allowed')) return '이 운동방에 초대할 권한이 없어요.'
  if (message.includes('cannot_invite_self')) return '자기 자신은 초대할 수 없어요.'
  if (message.includes('room_invitee_not_friend')) return '친구 관계를 확인한 뒤 초대해 주세요.'
  if (message.includes('room_friend_invitation_not_found')) return '운동방 초대를 찾지 못했어요.'
  if (message.includes('room_friend_invitation_not_pending')) return '이미 처리된 운동방 초대예요.'
  if (message.includes('owner_rejoin_not_allowed')) return '방장 상태의 회원은 다시 가입할 수 없어요.'
  if (message.includes('member_join_conflict')) return '회원 상태를 확인하지 못했어요. 다시 시도해 주세요.'
  if (message.includes('missing_profile')) return '프로필을 확인하지 못했어요. 다시 로그인해 주세요.'
  return '운동방 초대를 처리하지 못했어요. 다시 시도해 주세요.'
}

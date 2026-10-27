const FRIEND_CODE_PATTERN = /^DG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/

function isRecord(value) {
  return value !== null && typeof value === 'object'
}

function normalizeItem(value) {
  if (!isRecord(value) || typeof value.friendship_id !== 'string' || !value.friendship_id
    || typeof value.user_id !== 'string' || !value.user_id
    || typeof value.display_name !== 'string' || !value.display_name) return null

  return {
    id: value.friendship_id,
    userId: value.user_id,
    name: value.display_name,
    avatarUrl: typeof value.avatar_url === 'string' ? value.avatar_url : null,
    createdAt: value.created_at ?? null,
  }
}

export function normalizeFriendCode(value) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return FRIEND_CODE_PATTERN.test(code) ? code : null
}

export function normalizeFriendList(values) {
  if (!Array.isArray(values)) return []
  return values.map((value) => {
    const item = normalizeItem({ ...value, user_id: value?.friend_id, created_at: value?.friends_since })
    if (!item) return null
    return {
      id: item.id,
      userId: item.userId,
      name: item.name,
      avatarUrl: item.avatarUrl,
      friendsSince: item.createdAt,
    }
  }).filter(Boolean)
}

export function normalizeFriendRequests(values) {
  const requests = { incoming: [], outgoing: [] }
  if (!Array.isArray(values)) return requests

  values.forEach((value) => {
    const item = normalizeItem(value)
    if (!item || !['incoming', 'outgoing'].includes(value.direction)) return
    requests[value.direction].push(item)
  })
  return requests
}

export function mapFriendError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  if (message.includes('not_authenticated')) return '로그인 상태를 확인해 주세요.'
  if (message.includes('invalid_friend_code')) return '친구 코드를 DG-XXXXXX 형식으로 입력해 주세요.'
  if (message.includes('friend_not_found')) return '해당 친구 코드를 찾지 못했어요.'
  if (message.includes('cannot_request_self')) return '내 친구 코드는 검색할 수 없어요.'
  if (message.includes('already_friends')) return '이미 친구로 등록된 사용자예요.'
  if (message.includes('friend_request_already_pending')) return '이미 친구 요청을 보냈어요.'
  if (message.includes('incoming_friend_request_pending')) return '받은 친구 요청을 먼저 처리해 주세요.'
  if (message.includes('friend_request_not_recipient')) return '받은 친구 요청만 처리할 수 있어요.'
  if (message.includes('friend_request_not_requester')) return '보낸 친구 요청만 취소할 수 있어요.'
  if (message.includes('friend_request_not_pending')) return '대기 중인 친구 요청이 아니에요.'
  if (message.includes('friendship_not_participant')) return '이 친구 관계를 처리할 권한이 없어요.'
  if (message.includes('friendship_not_accepted')) return '수락된 친구 관계만 삭제할 수 있어요.'
  if (message.includes('room_not_found')) return '운동방을 찾지 못했어요.'
  if (message.includes('room_friend_invitation_not_found')) return '운동방 초대를 찾지 못했어요.'
  if (message.includes('room_friend_invitation_not_pending')) return '이미 처리된 운동방 초대예요.'
  if (message.includes('owner_rejoin_not_allowed')) return '방장 상태의 회원은 다시 가입할 수 없어요.'
  if (message.includes('member_join_conflict')) return '회원 상태를 확인하지 못했어요. 다시 시도해 주세요.'
  if (message.includes('missing_profile')) return '프로필을 확인하지 못했어요. 다시 로그인해 주세요.'
  return '친구 기능을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export const PENDING_INVITE_TOKEN_KEY = 'deukgeuni:pending-invite-token:v1'
const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/

function normalizeToken(token) {
  const value = typeof token === 'string' ? token.trim() : ''
  return INVITE_TOKEN_PATTERN.test(value) ? value : null
}

export function getInviteTokenFromLocation(location) {
  if (!location || location.pathname !== '/invite') return null
  const token = new URLSearchParams(location.search ?? '').get('token')
  return normalizeToken(token)
}

export function savePendingInviteToken(storage, token) {
  const normalizedToken = normalizeToken(token)
  if (!storage || !normalizedToken) return false
  try {
    storage.setItem(PENDING_INVITE_TOKEN_KEY, normalizedToken)
    return true
  } catch {
    return false
  }
}

export function getPendingInviteToken(storage) {
  if (!storage) return null
  try {
    return normalizeToken(storage.getItem(PENDING_INVITE_TOKEN_KEY))
  } catch {
    return null
  }
}

export function clearPendingInviteToken(storage) {
  if (!storage) return false
  try {
    storage.removeItem(PENDING_INVITE_TOKEN_KEY)
    return true
  } catch {
    return false
  }
}

export function createInviteUrl(origin, token) {
  const normalizedToken = normalizeToken(token)
  if (!normalizedToken || typeof origin !== 'string' || !origin) return null
  const url = new URL('/invite', origin)
  url.searchParams.set('token', normalizedToken)
  return url.toString()
}

export function getFirstRpcRow(data) {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

export function mapInvitationError(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  if (message.includes('invitation_unavailable')) return '초대 링크가 만료됐거나 유효하지 않아요.'
  if (message.includes('not_authenticated')) return '로그인 후 운동방에 참여할 수 있어요.'
  if (message.includes('member_join_conflict')) return '회원 상태를 확인하지 못했어요. 다시 시도해 주세요.'
  if (message.includes('missing_profile')) return '프로필을 확인하지 못했어요. 다시 로그인해 주세요.'
  if (message.includes('invalid_member_status') || message.includes('owner_rejoin_not_allowed')) return '회원 상태를 확인하지 못했어요. 다시 시도해 주세요.'
  return '초대 링크를 처리하지 못했어요. 다시 시도해 주세요.'
}

const TEST_ROOM_PREFIX = '[RLS TEST]'

export function getRlsMutationGuard({ room, currentUserId, targetOwnerId, targetOwnerIsMember }) {
  if (!room?.id || !room.name?.startsWith(TEST_ROOM_PREFIX) || room.deleted_at) {
    return { allowed: false, reason: 'RLS 테스트 전용 방이 아닙니다.' }
  }
  if (!currentUserId || !targetOwnerId || currentUserId === targetOwnerId) {
    return { allowed: false, reason: '다른 회원 소유의 테스트 기록만 검사할 수 있습니다.' }
  }
  if (!targetOwnerIsMember) {
    return { allowed: false, reason: '대상 기록 소유자가 테스트 방의 active 회원인지 확인되지 않았습니다.' }
  }
  return { allowed: true, reason: null }
}

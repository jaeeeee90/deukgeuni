function isRecord(value) {
  return value !== null && typeof value === 'object'
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

export function normalizeRemoteRoom(value) {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)
    || !isNonEmptyString(value.symbol) || !isNonEmptyString(value.color)
    || !isNonEmptyString(value.creator_id)) {
    return null
  }

  const members = Array.isArray(value.room_members)
    ? value.room_members
      .filter((member) => isRecord(member)
        && member.status === 'active'
        && isNonEmptyString(member.user_id)
        && isNonEmptyString(member.display_name))
      .map((member) => ({ id: member.user_id, name: member.display_name }))
    : []

  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : '',
    symbol: value.symbol,
    color: value.color,
    creatorId: value.creator_id,
    members,
    exercises: [],
    source: 'remote',
  }
}

export function normalizeRemoteRooms(values) {
  if (!Array.isArray(values)) return []
  return values.map(normalizeRemoteRoom).filter(Boolean)
}

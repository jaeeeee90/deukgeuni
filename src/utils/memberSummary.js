export function formatMemberSummary(members) {
  const sortedNames = [...members].sort((first, second) =>
    first.localeCompare(second, 'ko'),
  )
  const visibleNames = sortedNames.slice(0, 3)
  const names = visibleNames.join(', ')
  const overflowSuffix = sortedNames.length > 3 ? ' 등' : ''

  const displayedNames = names ? `${names}${overflowSuffix} ` : ''
  return `${displayedNames}(${members.length}명)`
}

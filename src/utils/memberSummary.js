export function formatMemberSummary(members) {
  const sortedMembers = [...members].sort((first, second) => {
    const firstName = typeof first === 'string' ? first : first.name
    const secondName = typeof second === 'string' ? second : second.name
    return firstName.localeCompare(secondName, 'ko')
  })
  const visibleNames = sortedMembers.slice(0, 3).map((member) =>
    typeof member === 'string' ? member : member.name,
  )
  const names = visibleNames.join(', ')
  const overflowSuffix = sortedMembers.length > 3 ? ' 등' : ''
  const displayedNames = names ? `${names}${overflowSuffix} ` : ''

  return `${displayedNames}(${members.length}명)`
}

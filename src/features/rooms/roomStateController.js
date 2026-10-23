export function applyRoomMutation(stateRef, setState, operation) {
  const result = operation(stateRef.current)
  if (!result.error) {
    stateRef.current = result.state
    setState(result.state)
  }
  return result
}

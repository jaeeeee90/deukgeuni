export function getDisplayName(profile, user) {
  const profileName = typeof profile?.display_name === 'string' ? profile.display_name.trim() : ''
  if (profileName) return profileName
  const metadataName = typeof user?.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : ''
  return metadataName || '운동 친구'
}

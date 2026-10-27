import { useMemo, useState } from 'react'
import { useRoomFriendInvitationStore } from './useRoomFriendInvitationStore.js'

function FriendAvatar({ name, avatarUrl }) {
  if (avatarUrl) return <img className="friend-avatar friend-avatar--image" src={avatarUrl} alt="" />
  return <span className="friend-avatar friend-avatar--1" aria-hidden="true">{name?.slice(0, 1) ?? '?'}</span>
}

function getOptionStatus(option) {
  if (option.isMember) return '이미 참여 중'
  if (option.isPending) return '초대 대기 중'
  return '초대 가능'
}

function RoomFriendInviteDialog({ room, user, onClose }) {
  const store = useRoomFriendInvitationStore(room, user)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [notice, setNotice] = useState('')

  const selectableOptions = useMemo(() => store.options.filter((option) => !option.isMember && !option.isPending), [store.options])

  const toggle = (userId) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const submit = async () => {
    const result = await store.actions.sendInvitations([...selectedIds])
    if (result.error) {
      setNotice(result.error)
      return
    }
    const sentCount = result.data.filter((item) => item.status === 'sent').length
    const pendingCount = result.data.filter((item) => item.status === 'pending').length
    const memberCount = result.data.filter((item) => item.status === 'already_member').length
    const parts = []
    if (sentCount > 0) parts.push(`${sentCount}명에게 초대를 보냈어요.`)
    if (pendingCount > 0) parts.push(`${pendingCount}명은 이미 초대 대기 중이에요.`)
    if (memberCount > 0) parts.push(`${memberCount}명은 이미 참여 중이에요.`)
    setSelectedIds(new Set())
    setNotice(parts.join(' ') || '초대 결과를 확인해 주세요.')
  }

  return <div className="workout-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="room-friend-invite-dialog" role="dialog" aria-modal="true" aria-labelledby="room-friend-invite-title">
      <div className="room-manage-dialog__heading">
        <div><p className="section-kicker">INVITE FRIENDS</p><h3 id="room-friend-invite-title">친구 초대</h3></div>
        <button className="picker-close" disabled={store.saving} type="button" aria-label="친구 초대 닫기" onClick={onClose}>×</button>
      </div>
      <p className="room-friend-invite-description"><b>{room.name}</b>에서 함께 운동할 친구를 선택해 주세요.</p>
      {store.loading ? <p className="friend-loading" role="status">친구목록을 불러오고 있어요.</p> : store.options.length === 0 ? <p className="friend-empty-state">초대할 수 있는 친구가 없어요. 먼저 친구를 추가해 주세요.</p> : <ul className="room-friend-invite-list">
        {store.options.map((option) => {
          const disabled = option.isMember || option.isPending || store.saving
          return <li className={`room-friend-invite-item${disabled ? ' is-disabled' : ''}`} key={option.userId}>
            <label>
              <input checked={selectedIds.has(option.userId)} disabled={disabled} type="checkbox" onChange={() => toggle(option.userId)} />
              <FriendAvatar avatarUrl={option.avatarUrl} name={option.name} />
              <span className="friend-name">{option.name}</span>
            </label>
            <span className={`room-friend-invite-status${option.isMember || option.isPending ? ' is-muted' : ''}`}>{getOptionStatus(option)}</span>
          </li>
        })}
      </ul>}
      {store.error && <p className="field-error" role="alert">{store.error}</p>}
      {notice && <p className="friend-action-status" role="status">{notice}</p>}
      <div className="room-friend-invite-actions">
        <button className="secondary-action" disabled={store.saving} type="button" onClick={onClose}>닫기</button>
        <button className="home-button" disabled={store.loading || store.saving || selectedIds.size === 0 || selectableOptions.length === 0} type="button" onClick={submit}>{store.saving ? '보내는 중…' : `초대 보내기${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}</button>
      </div>
    </section>
  </div>
}

export default RoomFriendInviteDialog

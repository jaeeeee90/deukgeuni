import { useState } from 'react'
import RoomIcon from '../../components/RoomIcon.jsx'
import RoomFriendInviteDialog from '../friends/RoomFriendInviteDialog.jsx'
import InviteLinkPanel from '../invitations/InviteLinkPanel.jsx'
import { roomIconOptions } from './roomData.js'

function getErrorMessage(error) {
  if (error === 'invalid-name') return '운동방 이름은 공백 없이 1~30자로 입력해 주세요.'
  if (error === 'invalid-description') return '운동방 설명은 100자 이하로 입력해 주세요.'
  if (error === 'invalid-icon') return '운동방 아이콘을 선택해 주세요.'
  return '방 정보를 저장하지 못했어요. 다시 시도해 주세요.'
}

function RoomManageDialog({ authUser, room, onClose, onCreateInvitation, onDelete, onSave }) {
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description ?? '')
  const [selectedIcon, setSelectedIcon] = useState(`${room.symbol}:${room.color}`)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [friendInviteOpen, setFriendInviteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const selected = roomIconOptions.find((option) => `${option.symbol}:${option.color}` === selectedIcon)

  const save = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const result = await onSave({ name, description, symbol: selected?.symbol, color: selected?.color })
      if (result?.error) setError(getErrorMessage(result.error))
    } catch {
      setError('방 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setError('')
    setSaving(true)
    try {
      const result = await onDelete()
      if (result?.error) setError('운동방을 삭제하지 못했어요. 다시 시도해 주세요.')
    } catch {
      setError('운동방을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="workout-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="room-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="room-manage-title">
        {!confirmingDelete ? <form noValidate onSubmit={save}>
          <div className="room-manage-dialog__heading">
            <div><p className="section-kicker">ROOM MANAGEMENT</p><h3 id="room-manage-title">운동방 관리</h3></div>
            <button className="picker-close" disabled={saving} type="button" aria-label="운동방 관리 닫기" onClick={onClose}>×</button>
          </div>
          <label className="field-label" htmlFor="manage-room-name">운동방 이름</label>
          <input className="text-field" id="manage-room-name" maxLength="30" value={name} onChange={(event) => setName(event.target.value)} />
          <label className="field-label" htmlFor="manage-room-description">운동방 설명 <span>선택</span></label>
          <textarea className="text-field text-area-field" id="manage-room-description" maxLength="100" value={description} onChange={(event) => setDescription(event.target.value)} />
          <p className="field-count">{description.length}/100</p>
          <span className="field-label">운동방 아이콘</span>
          <div className="room-icon-picker" role="radiogroup" aria-label="운동방 아이콘 선택">
            {roomIconOptions.map((option) => {
              const value = `${option.symbol}:${option.color}`
              return <button aria-checked={selectedIcon === value} aria-label={option.label} className={`room-icon-choice room-card__art--${option.color}${selectedIcon === value ? ' is-selected' : ''}`} disabled={saving} key={value} onClick={() => setSelectedIcon(value)} role="radio" type="button"><RoomIcon color={option.color} symbol={option.symbol} /></button>
            })}
          </div>
          {error && <p className="field-error room-form-error" role="alert">{error}</p>}
          <button className="home-button room-submit-button" disabled={saving} type="submit">{saving ? '저장 중…' : '변경 사항 저장'}</button>
          {room.source === 'remote' && onCreateInvitation && <InviteLinkPanel roomId={room.id} onCreate={onCreateInvitation} />}
          {room.source === 'remote' && authUser && <button className="secondary-action room-friend-invite-trigger" disabled={saving} type="button" onClick={() => setFriendInviteOpen(true)}>친구 초대</button>}
          <button className="room-delete-trigger" disabled={saving} type="button" onClick={() => { setError(''); setConfirmingDelete(true) }}>운동방 삭제</button>
        </form> : <div className="room-delete-confirmation">
          <div className="delete-dialog__icon" aria-hidden="true">!</div>
          <h3>운동방을 삭제할까요?</h3>
          <p>{room.source === 'remote' ? <><b>{room.name}</b>을(를) 목록에서 숨깁니다. 이 브라우저의 임시 운동 기록은 삭제되지 않아요.</> : <><b>{room.name}</b>과(와) 해당 방의 모든 날짜별 운동 종목, 세트 기록, 참여 상태가 함께 삭제됩니다. 이 작업은 되돌릴 수 없어요.</>}</p>
          {error && <p className="field-error room-form-error" role="alert">{error}</p>}
          <div className="delete-dialog__actions">
            <button className="secondary-action" disabled={saving} type="button" onClick={() => setConfirmingDelete(false)}>취소</button>
            <button className="danger-action" disabled={saving} type="button" onClick={remove}>{saving ? '삭제 중…' : '운동방 삭제'}</button>
          </div>
        </div>}
      </section>
      {friendInviteOpen && <RoomFriendInviteDialog room={room} user={authUser} onClose={() => setFriendInviteOpen(false)} />}
    </div>
  )
}

export default RoomManageDialog

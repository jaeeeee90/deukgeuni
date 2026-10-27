import { useState } from 'react'
import { useInvitation } from './useInvitation.js'

function InvitePage({ token, onAccepted, onExit }) {
  const { accepting, accept, error, loading, preview } = useInvitation(token)
  const [actionError, setActionError] = useState('')

  const join = async () => {
    setActionError('')
    const result = await accept()
    if (result.error) {
      setActionError(result.error)
      return
    }
    const completed = await onAccepted(result.data.room_id)
    if (completed?.error) setActionError(completed.error)
  }

  return <section className="invite-page" aria-labelledby="invite-title">
    <div className="auth-brand-mark" aria-hidden="true">ㄷ</div>
    <p className="eyebrow">YOU’RE INVITED</p>
    <h1 id="invite-title">운동방 초대</h1>
    {loading && <p className="auth-description" role="status">초대받은 운동방을 확인하고 있어요.</p>}
    {!loading && error && <>
      <p className="auth-description" role="alert">{error}</p>
      <button className="secondary-action invite-exit-button" type="button" onClick={onExit}>운동방 목록으로 돌아가기</button>
    </>}
    {!loading && !error && preview && <>
      <p className="auth-description">친구가 함께 운동할 운동방으로 초대했어요.</p>
      <article className="invite-room-card">
        <span className={`room-card__art room-card__art--${preview.color}`} aria-hidden="true">{preview.symbol}</span>
        <div className="invite-room-card__copy">
          <p className="section-kicker">WORKOUT ROOM</p>
          <h2>{preview.name}</h2>
          {preview.description && <p>{preview.description}</p>}
          <span>현재 {preview.memberCount}명이 함께하고 있어요.</span>
        </div>
      </article>
      {actionError && <p className="auth-error" role="alert">{actionError}</p>}
      <button className="auth-submit invite-join-button" disabled={accepting} type="button" onClick={join}>{accepting ? '참여하는 중…' : '이 운동방에 참여하기'}</button>
      <button className="auth-switch" type="button" onClick={onExit}>나중에 참여할게요</button>
    </>}
  </section>
}

export default InvitePage

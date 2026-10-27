import { useState } from 'react'
import { createInviteUrl } from './invitationData.js'

function InviteLinkPanel({ roomId, onCreate }) {
  const [link, setLink] = useState('')
  const [expiresAt, setExpiresAt] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    setError('')
    setStatus('')
    setSaving(true)
    try {
      const result = await onCreate(roomId)
      if (result?.error) {
        setError(result.error)
        return
      }
      const url = createInviteUrl(window.location.origin, result.data?.token)
      if (!url) {
        setError('초대 링크를 만들지 못했어요. 다시 시도해 주세요.')
        return
      }
      setLink(url)
      setExpiresAt(result.data?.expires_at ?? null)
      setStatus('새 초대 링크를 만들었어요. 이전 링크는 사용할 수 없어요.')
    } catch {
      setError('초대 링크를 만들지 못했어요. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setStatus('초대 링크를 복사했어요.')
    } catch {
      setStatus('복사가 되지 않았어요. 아래 주소를 길게 눌러 복사해 주세요.')
    }
  }

  return <section className="invite-link-panel" aria-labelledby="invite-link-title">
    <div className="invite-link-panel__heading">
      <div><p className="section-kicker">INVITE FRIENDS</p><h4 id="invite-link-title">초대 링크</h4></div>
      <span aria-hidden="true">↗</span>
    </div>
    <p>링크를 받은 친구가 로그인하면 이 운동방에 참여할 수 있어요.</p>
    {!link && <button className="secondary-action invite-create-button" disabled={saving} type="button" onClick={create}>{saving ? '링크 만드는 중…' : '초대 링크 만들기'}</button>}
    {link && <>
      <div className="invite-link-value" aria-label="생성된 초대 링크">{link}</div>
      <button className="home-button invite-copy-button" type="button" onClick={copy}>링크 복사</button>
      {expiresAt && <small className="invite-link-expiry">7일 동안 사용할 수 있어요.</small>}
    </>}
    {status && <p className="invite-link-status" role="status">{status}</p>}
    {error && <p className="field-error room-form-error" role="alert">{error}</p>}
  </section>
}

export default InviteLinkPanel

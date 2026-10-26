import { useState } from 'react'
import RoomCard from '../components/RoomCard.jsx'
import { roomIconOptions } from '../features/rooms/roomData.js'

const exampleFriends = ['김서윤', '박하준', '이도윤']

export function HomePage({ onOpenRoom, onRetryRooms, roomError, roomLoading, rooms }) {
  return (
    <>
      <header className="welcome-header">
        <div className="brand-mark" aria-hidden="true">ㄷ</div>
        <p className="eyebrow">친구와 함께하는 운동 기록</p>
        <h1>득근이<span className="brand-sparkle" aria-hidden="true">✦</span></h1>
        <p className="welcome-message">오늘도 친구들과 함께 득근!</p>
        <div className="welcome-doodle" aria-hidden="true">✿</div>
      </header>
      <section className="room-section" aria-labelledby="rooms-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">LET’S MOVE</p>
            <h2 id="rooms-heading">내 운동방 <span>{rooms.length}</span></h2>
          </div>
          <span className="section-note">오늘도 파이팅!</span>
        </div>
        {roomLoading && <p className="room-sync-note" role="status">온라인 운동방을 불러오고 있어요.</p>}
        {roomError && <div className="room-sync-error" role="alert"><span>{roomError}</span><button type="button" onClick={onRetryRooms}>다시 시도</button></div>}
        <div className="room-list">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} onSelect={onOpenRoom} />
          ))}
        </div>
      </section>
    </>
  )
}

export function FriendsPage() {
  return (
    <section className="page-section" aria-labelledby="friends-heading">
      <p className="section-kicker">YOUR CREW</p>
      <h1 className="page-title" id="friends-heading">친구목록</h1>
      <p className="page-description">함께 운동하는 친구들이에요.</p>
      <ul className="friend-list">
        {exampleFriends.map((friend, index) => (
          <li className="friend-item" key={friend}>
            <span className={`friend-avatar friend-avatar--${index + 1}`} aria-hidden="true">
              {friend.slice(0, 1)}
            </span>
            <span className="friend-name">{friend}</span>
            <span className="friend-status">운동 친구</span>
          </li>
        ))}
      </ul>
      <p className="page-footnote">QR코드 친구 추가 기능은 다음 단계에서 준비할게요.</p>
    </section>
  )
}

export function CreateRoomPage({ currentUser, onCreateRoom, roomSaving }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIcon, setSelectedIcon] = useState(`${roomIconOptions[0].symbol}:${roomIconOptions[0].color}`)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selected = roomIconOptions.find((option) => `${option.symbol}:${option.color}` === selectedIcon)

  const createRoom = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await onCreateRoom({ name, description, symbol: selected?.symbol, color: selected?.color }, currentUser)
      if (result?.error === 'invalid-name') setError('운동방 이름은 공백 없이 1~30자로 입력해 주세요.')
      else if (result?.error === 'invalid-description') setError('운동방 설명은 100자 이하로 입력해 주세요.')
      else if (result?.error) setError(result.error)
    } catch {
      setError('운동방을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="page-section create-room-page" aria-labelledby="create-heading">
      <p className="section-kicker">LET’S WORK OUT TOGETHER</p>
      <h1 className="page-title" id="create-heading">새 운동방 만들기</h1>
      <p className="page-description">함께 운동할 방을 만들고 오늘의 기록을 시작해요.</p>
      <form noValidate onSubmit={createRoom}>
        <label className="field-label" htmlFor="room-name">운동방 이름 <b>필수</b></label>
        <input className="text-field" id="room-name" maxLength="30" placeholder="예: 아침 러닝 크루" value={name} onChange={(event) => setName(event.target.value)} />
        <p className="field-count">{name.length}/30</p>
        <label className="field-label" htmlFor="room-description">운동방 설명 <span>선택</span></label>
        <textarea className="text-field text-area-field" id="room-description" maxLength="100" placeholder="예: 평일 아침 7시, 같이 가볍게 달려요." value={description} onChange={(event) => setDescription(event.target.value)} />
        <p className="field-count">{description.length}/100</p>
        <span className="field-label">운동방 아이콘</span>
        <div className="room-icon-picker" role="radiogroup" aria-label="운동방 아이콘 선택">
          {roomIconOptions.map((option) => {
            const value = `${option.symbol}:${option.color}`
            return <button className={`room-icon-choice room-card__art--${option.color}${selectedIcon === value ? ' is-selected' : ''}`} aria-checked={selectedIcon === value} key={value} onClick={() => setSelectedIcon(value)} role="radio" type="button"><span aria-hidden="true">{option.symbol}</span><small>{option.label}</small></button>
          })}
        </div>
        {error && <p className="field-error room-form-error" role="alert">{error}</p>}
        <button className="home-button create-room-button" disabled={submitting || roomSaving} type="submit">{submitting || roomSaving ? '운동방을 만드는 중…' : '운동방 만들기'}</button>
      </form>
    </section>
  )
}

export function StatisticsPage() {
  return (
    <section className="page-section" aria-labelledby="stats-heading">
      <p className="section-kicker">YOUR PROGRESS</p>
      <h1 className="page-title" id="stats-heading">운동 통계</h1>
      <p className="page-description">차곡차곡 쌓이는 나의 운동 기록</p>
      <div className="stat-grid">
        {['운동 횟수', '총 운동량', '최고 중량'].map((label) => (
          <div className="stat-card" key={label}>
            <span className="stat-card__label">{label}</span>
            <span className="stat-card__value">--</span>
          </div>
        ))}
      </div>
      <div className="chart-placeholder">
        <span className="chart-placeholder__icon" aria-hidden="true">↗</span>
        <span>성장 그래프를 준비하고 있어요.</span>
      </div>
      <p className="page-footnote">운동 통계는 기록 기능과 함께 다음 단계에서 제공됩니다.</p>
    </section>
  )
}

export function SettingsPage() {
  return (
    <section className="page-section" aria-labelledby="settings-heading">
      <p className="section-kicker">PREFERENCES</p>
      <h1 className="page-title" id="settings-heading">설정</h1>
      <p className="page-description">득근이를 내게 맞게 설정해요.</p>
      <div className="settings-list">
        {[
          ['프로필', '프로필 정보 관리'],
          ['계정', '계정 및 보안'],
          ['앱 정보', '득근이 버전 및 이용 안내'],
        ].map(([title, description]) => (
          <div className="settings-item" key={title}>
            <span className="settings-item__copy">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <span className="settings-item__arrow" aria-hidden="true">›</span>
          </div>
        ))}
      </div>
      <p className="page-footnote">계정 및 앱 설정 기능은 다음 단계에서 준비할게요.</p>
    </section>
  )
}

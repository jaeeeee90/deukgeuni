import RoomCard from '../components/RoomCard.jsx'
import { rooms } from '../data/rooms.js'

const exampleFriends = ['김서윤', '박하준', '이도윤']

export function HomePage({ onOpenRoom }) {
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

export function CreateRoomPage() {
  return (
    <section className="page-section" aria-labelledby="create-heading">
      <p className="section-kicker">LET’S WORK OUT TOGETHER</p>
      <h1 className="page-title" id="create-heading">새 운동방 만들기</h1>
      <p className="page-description">운동할 친구들과 함께할 방을 준비해요.</p>
      <label className="field-label" htmlFor="room-name">운동방 이름</label>
      <input className="text-field" id="room-name" type="text" placeholder="예: 아침 러닝 크루" />
      <div className="invite-heading">
        <span className="field-label">친구 초대</span>
        <span className="section-note">기능 준비 중</span>
      </div>
      <div className="invite-placeholder">
        <span aria-hidden="true">＋</span>
        <span>친구 초대 기능은 다음 단계에서 준비할게요.</span>
      </div>
      <button className="home-button create-room-button" type="button" disabled>
        운동방 만들기
      </button>
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

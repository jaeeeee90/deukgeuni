import { formatMemberSummary } from '../utils/memberSummary.js'
import RoomIcon from './RoomIcon.jsx'

function RoomCard({ room, onSelect }) {
  const exerciseSummary = room.exercises.length
    ? room.exercises.join(', ')
    : '기록 없음'

  return (
    <button
      className="room-card"
      type="button"
      onClick={() => onSelect(room)}
      aria-label={`${room.name}, ${formatMemberSummary(room.members)}`}
    >
      <RoomIcon className={`room-card__art room-card__art--${room.color}`} color={room.color} symbol={room.symbol} />
      <span className="room-card__content">
        <span className="room-card__title-row">
          <span className="room-card__name">{room.name}</span>
          <span className="room-card__arrow" aria-hidden="true">↗</span>
        </span>
        <span className="room-card__members">👥 {formatMemberSummary(room.members)}</span>
        <span className="room-card__exercise">
          <span className="room-card__exercise-label">오늘의 운동</span>
          {exerciseSummary}
        </span>
      </span>
    </button>
  )
}

export default RoomCard

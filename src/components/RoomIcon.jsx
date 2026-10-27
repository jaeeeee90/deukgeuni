import benchPressDog from '../assets/room-icons/bench-press-dog.png'
import dumbbellDog from '../assets/room-icons/dumbbell-dog.png'
import gymnasticsDog from '../assets/room-icons/gymnastics-dog.png'
import latPulldownDog from '../assets/room-icons/lat-pulldown-dog.png'
import squatDog from '../assets/room-icons/squat-dog.png'
import treadmillDog from '../assets/room-icons/treadmill-dog.png'
import { roomIconOptions } from '../features/rooms/roomData.js'

const assets = {
  'bench-press-dog.png': benchPressDog,
  'dumbbell-dog.png': dumbbellDog,
  'gymnastics-dog.png': gymnasticsDog,
  'lat-pulldown-dog.png': latPulldownDog,
  'squat-dog.png': squatDog,
  'treadmill-dog.png': treadmillDog,
}

function RoomIcon({ symbol, color, className = '', decorative = true }) {
  const option = roomIconOptions.find((item) => item.symbol === symbol && item.color === color)
  const source = option ? assets[option.assetName] : null
  const fallbackLabel = option?.label ?? '운동방 아이콘'

  return <span className={`room-icon ${className}`} aria-hidden={decorative || undefined}>
    {source && <img alt={decorative ? '' : fallbackLabel} src={source} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false }} />}
    <span className="room-icon__fallback" hidden={Boolean(source)}>{symbol ?? '🏋️'}</span>
  </span>
}

export default RoomIcon

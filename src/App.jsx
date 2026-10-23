import { useMemo, useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import {
  CreateRoomPage,
  FriendsPage,
  HomePage,

  SettingsPage,
  StatisticsPage,
} from './pages/Pages.jsx'
import { currentUserId as initialCurrentUserId, rooms as exampleRooms } from './data/rooms.js'
import { useRoomStore } from './features/rooms/useRoomStore.js'
import WorkoutRoomPage from './features/workouts/WorkoutRoomPage.jsx'
import { useWorkoutStore } from './features/workouts/useWorkoutStore.js'
import './App.css'

const pages = {
  home: HomePage,
  friends: FriendsPage,
  create: CreateRoomPage,
  stats: StatisticsPage,
  settings: SettingsPage,
}

function App() {
  const [activeScreen, setActiveScreen] = useState('home')
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(initialCurrentUserId)
  const { state: roomState, actions: roomActions } = useRoomStore()
  const { state: workoutState, actions: workoutActions } = useWorkoutStore()
  const allRooms = useMemo(() => [...roomState.rooms, ...exampleRooms], [roomState.rooms])
  const selectedRoom = allRooms.find((room) => room.id === selectedRoomId) ?? null
  const currentUser = allRooms
    .flatMap((room) => room.members)
    .find((member) => member.id === currentUserId)
    ?? { id: currentUserId, name: '테스트 사용자' }

  const navigateTo = (screen) => {
    setSelectedRoomId(null)
    setActiveScreen(screen)
  }

  const openRoom = (room) => {
    if (!room.members.some((member) => member.id === currentUserId)) {
      setCurrentUserId(room.members[0]?.id ?? initialCurrentUserId)
    }
    setSelectedRoomId(room.id)
  }

  const createRoom = (input, creator) => {
    const result = roomActions.createRoom(input, creator)
    if (!result.error) {
      setActiveScreen('home')
      setSelectedRoomId(result.room.id)
    }
    return result
  }

  const updateRoom = (input) => roomActions.updateRoom(selectedRoom.id, currentUserId, input)

  const deleteRoom = () => {
    const result = roomActions.deleteRoom(selectedRoom.id, currentUserId)
    if (!result.error) {
      workoutActions.removeRoomData(selectedRoom.id)
      setSelectedRoomId(null)
      setActiveScreen('home')
    }
    return result
  }

  const Page = pages[activeScreen]

  return (
    <div className="app-shell">
      <main className="main-content">
        {selectedRoom ? (
          <WorkoutRoomPage
            actions={workoutActions}
            currentUserId={currentUserId}
            onBack={() => setSelectedRoomId(null)}
            onDeleteRoom={deleteRoom}
            onUpdateRoom={updateRoom}
            onUserChange={setCurrentUserId}
            room={selectedRoom}
            state={workoutState}
          />
        ) : (
          <Page currentUser={currentUser} onCreateRoom={createRoom} onOpenRoom={openRoom} rooms={allRooms} />
        )}
      </main>
      <BottomNav activeScreen={activeScreen} onNavigate={navigateTo} />
    </div>
  )
}

export default App

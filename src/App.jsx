import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import {
  CreateRoomPage,
  FriendsPage,
  HomePage,

  SettingsPage,
  StatisticsPage,
} from './pages/Pages.jsx'
import { currentUserId as initialCurrentUserId } from './data/rooms.js'
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
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(initialCurrentUserId)
  const { state: workoutState, actions: workoutActions } = useWorkoutStore()

  const navigateTo = (screen) => {
    setSelectedRoom(null)
    setActiveScreen(screen)
  }

  const openRoom = (room) => {
    setSelectedRoom(room)
  }

  const Page = pages[activeScreen]

  return (
    <div className="app-shell">
      <main className="main-content">
        {selectedRoom ? (
          <WorkoutRoomPage
            actions={workoutActions}
            currentUserId={currentUserId}
            onBack={() => setSelectedRoom(null)}
            onUserChange={setCurrentUserId}
            room={selectedRoom}
            state={workoutState}
          />
        ) : (
          <Page onOpenRoom={openRoom} />
        )}
      </main>
      <BottomNav activeScreen={activeScreen} onNavigate={navigateTo} />
    </div>
  )
}

export default App

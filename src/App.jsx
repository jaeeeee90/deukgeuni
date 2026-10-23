import { useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import {
  CreateRoomPage,
  FriendsPage,
  HomePage,
  RoomDetailPage,
  SettingsPage,
  StatisticsPage,
} from './pages/Pages.jsx'
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
          <RoomDetailPage room={selectedRoom} onBack={() => setSelectedRoom(null)} />
        ) : (
          <Page onOpenRoom={openRoom} />
        )}
      </main>
      <BottomNav activeScreen={activeScreen} onNavigate={navigateTo} />
    </div>
  )
}

export default App

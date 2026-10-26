import { useMemo, useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import AuthPage from './features/auth/AuthPage.jsx'
import { useAuth } from './features/auth/useAuth.js'
import {
  CreateRoomPage,
  FriendsPage,
  HomePage,

  SettingsPage,
  StatisticsPage,
} from './pages/Pages.jsx'
import { currentUserId as initialCurrentUserId, rooms as exampleRooms } from './data/rooms.js'
import { useRoomStore } from './features/rooms/useRoomStore.js'
import { useRemoteRoomStore } from './features/rooms/useRemoteRoomStore.js'
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

function AuthLoadingScreen() {
  return <section className="auth-page auth-page--loading" aria-live="polite"><div className="auth-brand-mark" aria-hidden="true">ㄷ</div><p className="eyebrow">DEUKGEUNI</p><h1>득근이를 준비하고 있어요</h1></section>
}

function AuthenticatedApp({ authUser }) {
  const [activeScreen, setActiveScreen] = useState('home')
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(initialCurrentUserId)
  const { state: roomState, actions: roomActions } = useRoomStore()
  const remoteRoomStore = useRemoteRoomStore(authUser)
  const { state: workoutState, actions: workoutActions, storageError } = useWorkoutStore()
  const allRooms = useMemo(() => [
    ...remoteRoomStore.rooms,
    ...roomState.rooms.map((room) => ({ ...room, source: 'local' })),
    ...exampleRooms.map((room) => ({ ...room, source: 'fixture' })),
  ], [remoteRoomStore.rooms, roomState.rooms])
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
    if (room.source === 'remote') {
      setCurrentUserId(authUser.id)
      setSelectedRoomId(room.id)
      return
    }
    if (!room.members.some((member) => member.id === currentUserId)) {
      setCurrentUserId(room.members[0]?.id ?? initialCurrentUserId)
    }
    setSelectedRoomId(room.id)
  }

  const createRoom = async (input) => {
    const result = await remoteRoomStore.actions.createRoom(input)
    if (!result.error) {
      setCurrentUserId(authUser.id)
      setActiveScreen('home')
      setSelectedRoomId(result.data?.id ?? null)
    }
    return result
  }

  const updateRoom = async (input) => {
    if (selectedRoom.source === 'remote') return remoteRoomStore.actions.updateRoom(selectedRoom.id, input)
    return roomActions.updateRoom(selectedRoom.id, currentUserId, input)
  }

  const deleteRoom = async () => {
    const result = selectedRoom.source === 'remote'
      ? await remoteRoomStore.actions.deleteRoom(selectedRoom.id)
      : roomActions.deleteRoom(selectedRoom.id, currentUserId)
    if (!result.error) {
      if (selectedRoom.source !== 'remote') workoutActions.removeRoomData(selectedRoom.id)
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
            storageError={storageError}
          />
        ) : (
          <Page
            currentUser={currentUser}
            onCreateRoom={createRoom}
            onOpenRoom={openRoom}
            roomError={remoteRoomStore.error}
            roomLoading={remoteRoomStore.loading}
            onRetryRooms={remoteRoomStore.actions.loadRooms}
            rooms={allRooms}
            roomSaving={remoteRoomStore.saving}
          />
        )}
      </main>
      <BottomNav activeScreen={activeScreen} onNavigate={navigateTo} />
    </div>
  )
}

function App() {
  const auth = useAuth()

  if (auth.loading) return <AuthLoadingScreen />
  if (!auth.user || auth.profileError || !auth.isConfigured) return <AuthPage auth={auth} />
  return <AuthenticatedApp authUser={auth.user} />
}

export default App

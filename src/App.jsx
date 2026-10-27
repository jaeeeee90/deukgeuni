import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import BottomNav from './components/BottomNav.jsx'
import AuthPage from './features/auth/AuthPage.jsx'
import { useAuth } from './features/auth/useAuth.js'
import InvitePage from './features/invitations/InvitePage.jsx'
import {
  clearPendingInviteToken,
  getInviteTokenFromLocation,
  getPendingInviteToken,
  savePendingInviteToken,
} from './features/invitations/invitationData.js'
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
import { useRemoteWorkoutStore } from './features/workouts/useRemoteWorkoutStore.js'
import './App.css'

const DevRlsTestPanel = import.meta.env.DEV
  ? lazy(() => import('./features/dev/RlsTestPanel.jsx'))
  : null

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

function getInitialPendingInviteToken() {
  if (typeof window === 'undefined') return null
  const token = getInviteTokenFromLocation(window.location)
  const hasInviteToken = window.location.pathname === '/invite'
    && new URLSearchParams(window.location.search).has('token')
  if (!hasInviteToken) return getPendingInviteToken(window.sessionStorage)

  if (token) savePendingInviteToken(window.sessionStorage, token)
  else clearPendingInviteToken(window.sessionStorage)
  window.history.replaceState({}, document.title, '/invite')
  return token ?? ''
}

function AuthenticatedApp({ authUser, onClearInvite, pendingInviteToken }) {
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
  const remoteWorkoutStore = useRemoteWorkoutStore(
    selectedRoom?.source === 'remote' ? selectedRoom.id : null,
    authUser.id,
  )
  const activeWorkoutState = selectedRoom?.source === 'remote' ? remoteWorkoutStore.state : workoutState
  const activeWorkoutActions = selectedRoom?.source === 'remote' ? remoteWorkoutStore.actions : workoutActions
  const activeWorkoutError = selectedRoom?.source === 'remote' ? remoteWorkoutStore.error : storageError
  const activeWorkoutBusy = selectedRoom?.source === 'remote' && (remoteWorkoutStore.loading || remoteWorkoutStore.saving)
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

  const completeInvitation = async (roomId) => {
    const refreshed = await remoteRoomStore.actions.loadRooms({ force: true })
    if (refreshed.error) return { error: refreshed.error }
    const joinedRoom = refreshed.rooms.find((room) => room.id === roomId)
    if (!joinedRoom) return { error: '참여한 운동방을 목록에서 확인하지 못했어요. 다시 시도해 주세요.' }
    onClearInvite()
    setCurrentUserId(authUser.id)
    setActiveScreen('home')
    setSelectedRoomId(joinedRoom.id)
    return { error: null }
  }

  const exitInvitation = () => {
    onClearInvite()
    setSelectedRoomId(null)
    setActiveScreen('home')
  }

  if (pendingInviteToken !== null) {
    return <InvitePage onAccepted={completeInvitation} onExit={exitInvitation} token={pendingInviteToken} />
  }

  const Page = pages[activeScreen]

  return (
    <div className="app-shell">
      <main className="main-content">
        {selectedRoom ? (
          <WorkoutRoomPage
            actions={activeWorkoutActions}
            currentUserId={currentUserId}
            onBack={() => setSelectedRoomId(null)}
            onCreateInvitation={selectedRoom?.source === 'remote' ? remoteRoomStore.actions.createInvitation : null}
            onDeleteRoom={deleteRoom}
            onUpdateRoom={updateRoom}
            onUserChange={setCurrentUserId}
            room={selectedRoom}
            state={activeWorkoutState}
            storageError={activeWorkoutError}
            workoutBusy={activeWorkoutBusy}
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
      {DevRlsTestPanel && <Suspense fallback={null}><DevRlsTestPanel /></Suspense>}
    </div>
  )
}

function App() {
  const auth = useAuth()
  const [pendingInviteToken, setPendingInviteToken] = useState(getInitialPendingInviteToken)

  const clearInvite = useCallback(() => {
    if (typeof window !== 'undefined') clearPendingInviteToken(window.sessionStorage)
    setPendingInviteToken(null)
  }, [])

  if (auth.loading) return <AuthLoadingScreen />
  if (!auth.user || auth.profileError || !auth.isConfigured) {
    return <AuthPage auth={auth} invitePending={pendingInviteToken !== null} />
  }
  return <AuthenticatedApp authUser={auth.user} onClearInvite={clearInvite} pendingInviteToken={pendingInviteToken} />
}

export default App

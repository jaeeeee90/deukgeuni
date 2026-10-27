import { useMemo, useRef, useState } from 'react'
import { formatMemberSummary } from '../../utils/memberSummary.js'
import RoomFriendInviteDialog from '../friends/RoomFriendInviteDialog.jsx'
import RoomManageDialog from '../rooms/RoomManageDialog.jsx'
import { exerciseCategories, exercises } from './exerciseCatalog.js'
import { getExercisesForPicker } from './exerciseSelection.js'
import {
  getAttendance,
  getExercisesForDate,
  getLocalDateKey,
  getSetsForExercise,
  shiftDateKey,
} from './workoutData.js'

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(new Date(year, month - 1, day))
}

function formatSet(set) {
  if (set.recordingMethod === 'reps') return `${set.reps}회`
  if (set.recordingMethod === 'duration') {
    return set.durationSeconds % 60 === 0 ? `${set.durationSeconds / 60}분` : `${set.durationSeconds}초`
  }
  if (set.recordingMethod === 'duration-distance') return `${set.durationMinutes}분 · ${set.distanceKm}km`
  return `${set.weight}kg × ${set.reps}회`
}

function emptyDraft(method) {
  if (method === 'reps') return { reps: '' }
  if (method === 'duration') return { duration: '', durationUnit: 'minutes' }
  if (method === 'duration-distance') return { durationMinutes: '', distanceKm: '' }
  return { weight: '', reps: '' }
}

function draftFromSet(set) {
  if (set.recordingMethod === 'reps') return { reps: String(set.reps) }
  if (set.recordingMethod === 'duration') {
    const isMinute = set.durationSeconds % 60 === 0
    return { duration: String(isMinute ? set.durationSeconds / 60 : set.durationSeconds), durationUnit: isMinute ? 'minutes' : 'seconds' }
  }
  if (set.recordingMethod === 'duration-distance') return { durationMinutes: String(set.durationMinutes), distanceKm: String(set.distanceKm) }
  return { weight: String(set.weight), reps: String(set.reps) }
}

function MethodFields({ method, draft, onChange, prefix = '' }) {
  const label = (name) => `${prefix}${name}`
  if (method === 'reps') return <label className="workout-set-input"><span>횟수</span><input aria-label={label('반복 횟수')} inputMode="numeric" min="1" placeholder="10" step="1" type="number" value={draft.reps} onChange={(event) => onChange('reps', event.target.value)} /><span>회</span></label>
  if (method === 'duration') return <>
    <label className="workout-set-input"><span>시간</span><input aria-label={label('운동 시간')} inputMode="decimal" min="0" placeholder="20" step="any" type="number" value={draft.duration} onChange={(event) => onChange('duration', event.target.value)} /></label>
    <label className="workout-unit-select"><span className="visually-hidden">시간 단위</span><select aria-label={label('시간 단위')} value={draft.durationUnit} onChange={(event) => onChange('durationUnit', event.target.value)}><option value="minutes">분</option><option value="seconds">초</option></select></label>
  </>
  if (method === 'duration-distance') return <>
    <label className="workout-set-input"><span>시간</span><input aria-label={label('운동 시간(분)')} inputMode="decimal" min="0" placeholder="30" step="any" type="number" value={draft.durationMinutes} onChange={(event) => onChange('durationMinutes', event.target.value)} /><span>분</span></label>
    <label className="workout-set-input"><span>거리</span><input aria-label={label('운동 거리(km)')} inputMode="decimal" min="0" placeholder="5" step="any" type="number" value={draft.distanceKm} onChange={(event) => onChange('distanceKm', event.target.value)} /><span>km</span></label>
  </>
  return <>
    <label className="workout-set-input"><span>중량</span><input aria-label={label('중량(kg)')} inputMode="decimal" min="0" placeholder="0" step="any" type="number" value={draft.weight} onChange={(event) => onChange('weight', event.target.value)} /><span>kg</span></label>
    <label className="workout-set-input"><span>횟수</span><input aria-label={label('반복 횟수')} inputMode="numeric" min="1" placeholder="10" step="1" type="number" value={draft.reps} onChange={(event) => onChange('reps', event.target.value)} /><span>회</span></label>
  </>
}

function errorCopy(error) {
  if (error === 'invalid-weight') return '중량은 0 이상의 숫자로 입력해 주세요.'
  if (error === 'invalid-reps') return '반복 횟수는 1 이상의 정수로 입력해 주세요.'
  if (error === 'invalid-duration') return '시간은 0보다 크게 입력해 주세요.'
  if (error === 'invalid-distance') return '거리는 0 이상의 숫자로 입력해 주세요.'
  return '기록을 저장하지 못했어요. 다시 확인해 주세요.'
}

function SetRow({ set, canEdit, onUpdate, onRemove, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => draftFromSet(set))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await onUpdate(set.id, draft)
      if (result?.error) return setError(errorCopy(result.error))
      setError('')
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) return <form className="workout-set-edit" noValidate onSubmit={save}>
    <MethodFields draft={draft} method={set.recordingMethod ?? 'weight-reps'} onChange={updateDraft} prefix="수정 " />
    <button className="text-action" disabled={saving || disabled} type="submit">{saving ? '저장 중…' : '저장'}</button>
    <button className="text-action text-action--muted" disabled={saving || disabled} type="button" onClick={() => setEditing(false)}>취소</button>
    {error && <span className="field-error" role="alert">{error}</span>}
  </form>

  return <div className="workout-set-row">
    <span className="workout-set-summary">{set.order}세트 <b>{formatSet(set)}</b></span>
    {canEdit && <span className="workout-set-actions">
      <button className="text-action" disabled={disabled} type="button" onClick={() => { setDraft(draftFromSet(set)); setEditing(true) }}>수정</button>
      <button className="text-action text-action--muted" disabled={disabled} type="button" aria-label={`${set.order}세트 삭제`} onClick={() => onRemove(set.id)}>삭제</button>
    </span>}
  </div>
}

function SetEntryForm({ entryId, userId, currentUserId, recordingMethod, onAdd, disabled }) {
  const [draft, setDraft] = useState(() => emptyDraft(recordingMethod))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await onAdd(entryId, userId, currentUserId, draft, recordingMethod)
      if (result?.error) return setError(errorCopy(result.error))
      setDraft(emptyDraft(recordingMethod))
      setError('')
    } finally {
      setSaving(false)
    }
  }
  return <form className={`workout-set-form workout-set-form--${recordingMethod}`} noValidate onSubmit={submit}>
    <MethodFields draft={draft} method={recordingMethod} onChange={updateDraft} />
    <button className="add-set-button" disabled={disabled || saving} type="submit">{saving ? '저장 중…' : '세트 추가'}</button>
    {error && <span className="field-error" role="alert">{error}</span>}
  </form>
}

function MemberRecord({ member, entryId, sets, currentUserId, actions, recordingMethod, disabled }) {
  const isCurrentUser = member.id === currentUserId
  return <section className={`member-record${isCurrentUser ? ' member-record--mine' : ''}`} aria-label={`${member.name} 세트 기록`}>
    <div className="member-record__heading"><span className="member-avatar" aria-hidden="true">{member.name.slice(0, 1)}</span><h4>{member.name}</h4>{isCurrentUser && <span className="my-record-badge">나</span>}</div>
    {sets.length ? <div className="workout-set-list">{sets.map((set) => <SetRow canEdit={isCurrentUser} disabled={disabled} key={set.id} onRemove={(setId) => actions.removeSet(setId, currentUserId)} onUpdate={(setId, input) => actions.updateSet(setId, currentUserId, input)} set={set} />)}</div> : <p className="no-member-sets">아직 기록 없음</p>}
    {isCurrentUser && <SetEntryForm currentUserId={currentUserId} disabled={disabled} entryId={entryId} onAdd={actions.addSet} recordingMethod={recordingMethod} userId={member.id} />}
  </section>
}

function DirectExerciseForm({ roomId, actions, onChoose }) {
  const [name, setName] = useState('')
  const [categories, setCategories] = useState([])
  const [recordingMethod, setRecordingMethod] = useState('weight-reps')
  const [error, setError] = useState('')
  const toggleCategory = (category) => setCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category])
  const submit = (event) => {
    event.preventDefault()
    const result = actions.addCustomExercise({ roomId, name, categories, recordingMethod })
    if (result?.error) {
      setError(result.error === 'duplicate-custom-exercise' ? '이 방에 같은 이름의 직접 등록 운동이 있어요.' : '이름과 자극 부위를 확인해 주세요.')
      return
    }
    onChoose(result.exercise)
  }
  return <form className="direct-exercise-form" noValidate onSubmit={submit}>
    <p className="direct-exercise-form__title">직접 운동 등록</p>
    <label className="visually-hidden" htmlFor="direct-exercise-name">운동 이름</label><input className="text-field" id="direct-exercise-name" placeholder="목록에 없는 운동 이름" value={name} onChange={(event) => setName(event.target.value)} />
    <p className="direct-exercise-label">자극 부위 (복수 선택)</p>
    <div className="direct-category-list">{exerciseCategories.slice(1).map((category) => <button className={`direct-category${categories.includes(category) ? ' is-selected' : ''}`} key={category} type="button" onClick={() => toggleCategory(category)}>{category}</button>)}</div>
    <label className="direct-exercise-label" htmlFor="direct-record-method">기록 방식</label><select className="direct-record-method" id="direct-record-method" value={recordingMethod} onChange={(event) => setRecordingMethod(event.target.value)}><option value="weight-reps">무게·횟수</option><option value="reps">횟수</option><option value="duration">시간</option><option value="duration-distance">시간·거리</option></select>
    {error && <p className="field-error" role="alert">{error}</p>}
    <button className="add-exercise-button" type="submit">직접 등록하고 추가</button>
  </form>
}

function ExercisePicker({ category, onCategoryChange, onChoose, onClose, notice, roomId, state, currentUserId, actions, disabled }) {
  const [query, setQuery] = useState('')
  const [registering, setRegistering] = useState(false)
  const selection = getExercisesForPicker({ exercises, customExercises: state.customExercises, roomId, category, query, state, currentUserId })
  const choice = (exercise) => <button className="exercise-choice" disabled={disabled} key={exercise.id} type="button" onClick={() => onChoose(exercise)}><span><b>{exercise.name}</b><small>{exercise.categories.join(' · ')}</small></span><span aria-hidden="true">＋</span></button>
  return <div className="workout-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} onTouchStart={(event) => event.stopPropagation()} onTouchEnd={(event) => event.stopPropagation()}>
    <section className="workout-picker" role="dialog" aria-modal="true" aria-labelledby="exercise-picker-title">
      <div className="workout-picker__handle" aria-hidden="true" />
      <div className="workout-picker__heading"><div><p className="section-kicker">CHOOSE AN EXERCISE</p><h3 id="exercise-picker-title">운동 종목 추가</h3></div><button className="picker-close" type="button" aria-label="운동 선택 닫기" onClick={onClose}>×</button></div>
      <label className="exercise-search"><span aria-hidden="true">⌕</span><input aria-label="운동 이름 검색" placeholder="운동 이름 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="exercise-category-list" role="tablist" aria-label="운동 부위">{exerciseCategories.map((item) => <button aria-selected={category === item} className={`exercise-category${category === item ? ' is-selected' : ''}`} key={item} onClick={() => onCategoryChange(item)} role="tab" type="button">{item}</button>)}</div>
      {selection.recent.length > 0 && <section className="picker-section"><p>최근 기록한 운동</p><div className="exercise-choice-list">{selection.recent.map(choice)}</div></section>}
      {selection.remaining.length > 0 && <section className="picker-section"><p>{selection.recent.length ? '전체 운동' : '운동 목록'}</p><div className="exercise-choice-list">{selection.remaining.map(choice)}</div></section>}
      {selection.all.length === 0 && <div className="picker-empty"><p>찾는 운동이 없나요?</p><span>직접 등록해 이 방에서 함께 사용해 보세요.</span></div>}
      {selection.all.length === 0 && <button className="direct-exercise-toggle" disabled={disabled} type="button" onClick={() => setRegistering((current) => !current)}>{registering ? '직접 등록 닫기' : '목록에 없는 운동 직접 등록'}</button>}
      {selection.all.length === 0 && registering && <DirectExerciseForm actions={actions} onChoose={onChoose} roomId={roomId} />}
      {notice && <p className="workout-notice" role="status">{notice}</p>}
    </section>
  </div>
}

function DeleteExerciseDialog({ exerciseName, onCancel, onConfirm, disabled }) {
  const [deleting, setDeleting] = useState(false)
  const confirm = async () => {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }
  return <div className="workout-modal-backdrop"><section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-exercise-title"><div className="delete-dialog__icon" aria-hidden="true">!</div><h3 id="delete-exercise-title">운동 종목을 삭제할까요?</h3><p><b>{exerciseName}</b> 및 모든 참여자의 해당 세트 기록이 함께 삭제됩니다. 참여 상태는 유지됩니다.</p><div className="delete-dialog__actions"><button className="secondary-action" disabled={disabled || deleting} type="button" onClick={onCancel}>취소</button><button className="danger-action" disabled={disabled || deleting} type="button" onClick={confirm}>{deleting ? '삭제 중…' : '기록 삭제'}</button></div></section></div>
}

function AttendanceControl({ roomId, date, currentUserId, state, actions, disabled }) {
  const status = getAttendance(state, roomId, date, currentUserId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = async (nextStatus) => {
    setSaving(true)
    setError('')
    try {
      const result = await actions.setAttendance(roomId, date, currentUserId, nextStatus)
      if (result?.error) setError('참여 상태를 저장하지 못했어요.')
    } finally {
      setSaving(false)
    }
  }
  return <section className="attendance-card" aria-label="오늘의 참여 상태"><div><p className="attendance-card__title">오늘 운동에 참여하나요?</p><p className="attendance-card__hint">미참여여도 모두의 기록을 볼 수 있어요.</p></div><div className="attendance-options"><button className={`attendance-option${status === 'attending' ? ' is-selected' : ''}`} disabled={disabled || saving} type="button" aria-pressed={status === 'attending'} onClick={() => update('attending')}>참여</button><button className={`attendance-option attendance-option--no${status === 'not_attending' ? ' is-selected' : ''}`} disabled={disabled || saving} type="button" aria-pressed={status === 'not_attending'} onClick={() => update('not_attending')}>미참여</button></div>{error && <p className="field-error" role="alert">{error}</p>}</section>
}

function ExerciseEntryCard({ entry, exercise, room, members, currentUserId, state, actions, onDelete, disabled }) {
  if (!exercise) return null
  return <article className="exercise-entry-card"><div className="exercise-entry-heading"><div className="exercise-entry-title"><span className="exercise-entry-icon" aria-hidden="true">🏋️</span><div><p className="exercise-entry-category">{exercise.categories.join(' · ')}</p><h3>{exercise.name}</h3></div></div><button className="exercise-delete-button" disabled={disabled} type="button" onClick={() => onDelete(entry.id)}>삭제</button></div><div className="member-record-list">{members.map((member) => <MemberRecord actions={actions} currentUserId={currentUserId} disabled={disabled} entryId={entry.id} key={member.id} member={member} recordingMethod={exercise.recordingMethod} sets={getSetsForExercise(state, entry.id, member.id)} />)}</div><span className="visually-hidden">{room.name}</span></article>
}

function WorkoutRoomPage({ authUser, room, onBack, onCreateInvitation, onDeleteRoom, onUpdateRoom, state, currentUserId, onUserChange, actions, storageError, workoutBusy }) {
  const [date, setDate] = useState(() => getLocalDateKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [category, setCategory] = useState(exerciseCategories[0])
  const [pickerNotice, setPickerNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [deleteEntryId, setDeleteEntryId] = useState(null)
  const [managingRoom, setManagingRoom] = useState(false)
  const [friendInviteOpen, setFriendInviteOpen] = useState(false)
  const touchStart = useRef(null)
  const disabled = Boolean(storageError || workoutBusy)
  const currentEntries = getExercisesForDate(state, room.id, date)
  const sortedMembers = [...room.members].sort((first, second) => first.name.localeCompare(second.name, 'ko'))
  const exercisesById = useMemo(() => new Map([...exercises, ...state.customExercises].map((exercise) => [exercise.id, exercise])), [state.customExercises])
  const selectedDeleteEntry = currentEntries.find((entry) => entry.id === deleteEntryId)
  const deleteExercise = selectedDeleteEntry ? exercisesById.get(selectedDeleteEntry.exerciseId) : null
  const changeDate = (amount) => { setDate((current) => shiftDateKey(current, amount)); setNotice('') }
  const handleTouchStart = (event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY } }
  const handleTouchEnd = (event) => { if (!touchStart.current) return; const touch = event.changedTouches[0]; const deltaX = touch.clientX - touchStart.current.x; const deltaY = touch.clientY - touchStart.current.y; touchStart.current = null; if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 85) changeDate(deltaX < 0 ? 1 : -1) }
  const chooseExercise = async (exercise) => {
    if (currentEntries.some((entry) => entry.exerciseId === exercise.id)) return setPickerNotice('이미 추가한 운동입니다.')
    const result = await actions.addExercise(room.id, date, exercise.id, exercise)
    if (result?.error) return setPickerNotice(result.error)
    setPickerOpen(false); setPickerNotice(''); setNotice(`${exercise.name}을(를) 추가했어요.`)
  }
  const today = getLocalDateKey()
  const canManageRoom = room.creatorId === currentUserId
  const canInviteFriends = room.source === 'remote'
    && authUser?.id
    && room.members.some((member) => member.id === authUser.id && member.status === 'active')

  return <section className="workout-room-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
    <header className="workout-room-header"><button className="back-button workout-room-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> 운동방 목록</button><div className="workout-room-heading"><div><p className="section-kicker">WORKOUT ROOM</p><h1>{room.name}</h1><p className="workout-room-members">👥 {formatMemberSummary(room.members)}</p>{room.description && <p className="workout-room-description">{room.description}</p>}</div><span className={`workout-room-mark room-card__art--${room.color}`} aria-hidden="true">{room.symbol}</span></div>{canManageRoom && <button className="room-manage-button" type="button" onClick={() => setManagingRoom(true)}><span aria-hidden="true">⚙</span> 방 관리</button>}{canInviteFriends && !canManageRoom && <button className="room-manage-button" type="button" onClick={() => setFriendInviteOpen(true)}><span aria-hidden="true">＋</span> 친구 초대</button>}<label className="dev-user-picker"><span>기록 확인 사용자</span><select aria-label="개발용 현재 사용자" value={currentUserId} onChange={(event) => onUserChange(event.target.value)}>{sortedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p className="demo-storage-note">{room.source === 'remote' ? '이 방의 운동 기록은 Supabase에 저장되며 다른 기기와 공유됩니다.' : '테스트용 임시 기록은 이 브라우저에 저장됩니다.'}</p>{storageError && <p className="storage-protection-notice" role="alert">{room.source === 'remote' ? storageError : '기존 운동 기록을 해석하지 못해 데이터를 보호하고 있습니다. 브라우저 저장 데이터는 변경하지 않았습니다.'}</p>}</header>
    <div className="workout-date-picker"><button className="date-arrow" type="button" aria-label="이전 날짜" onClick={() => changeDate(-1)}>‹</button><div className="workout-date-label"><span className="workout-date-icon" aria-hidden="true">▦</span><span>{formatDate(date)}</span>{date === today && <span className="today-badge">오늘</span>}</div><button className="date-arrow" type="button" aria-label="다음 날짜" onClick={() => changeDate(1)}>›</button></div>
    <p className="swipe-hint">화면을 좌우로 밀어 날짜를 바꿀 수 있어요.</p>
    <AttendanceControl actions={actions} currentUserId={currentUserId} date={date} disabled={disabled} roomId={room.id} state={state} />
    <div className="workout-list-heading"><div><p className="section-kicker">TODAY’S EXERCISES</p><h2>오늘의 운동 <span>{currentEntries.length}</span></h2></div><button className="add-exercise-button" disabled={disabled} type="button" onClick={() => { setPickerNotice(''); setPickerOpen(true) }}><span aria-hidden="true">＋</span> 운동 종목 추가</button></div>
    {notice && <p className="workout-notice" role="status">{notice}</p>}
    {currentEntries.length === 0 ? <div className="empty-workout-state"><span className="empty-workout-icon" aria-hidden="true">🌱</span><p>이 날짜에는 아직 운동 종목이 없어요.</p><span>운동 종목을 추가해 기록을 시작해 보세요.</span></div> : <div className="exercise-entry-list">{currentEntries.map((entry) => <ExerciseEntryCard actions={actions} currentUserId={currentUserId} disabled={disabled} entry={entry} exercise={exercisesById.get(entry.exerciseId)} key={entry.id} members={sortedMembers} onDelete={setDeleteEntryId} room={room} state={state} />)}</div>}
    {pickerOpen && <ExercisePicker actions={actions} category={category} currentUserId={currentUserId} disabled={disabled} notice={pickerNotice} onCategoryChange={setCategory} onChoose={chooseExercise} onClose={() => setPickerOpen(false)} roomId={room.id} state={state} />}
    {deleteEntryId && deleteExercise && <DeleteExerciseDialog disabled={disabled} exerciseName={deleteExercise.name} onCancel={() => setDeleteEntryId(null)} onConfirm={async () => { const result = await actions.removeExercise(deleteEntryId); if (result?.error) { setNotice(result.error); return } setDeleteEntryId(null); setNotice(`${deleteExercise.name}과 연결된 모든 세트 기록을 삭제했어요.`) }} />}
    {managingRoom && <RoomManageDialog authUser={authUser} room={room} onClose={() => setManagingRoom(false)} onCreateInvitation={onCreateInvitation} onDelete={onDeleteRoom} onSave={async (input) => { const result = await onUpdateRoom(input); if (!result?.error) setManagingRoom(false); return result }} />}
    {friendInviteOpen && <RoomFriendInviteDialog room={room} user={authUser} onClose={() => setFriendInviteOpen(false)} />}
  </section>
}

export default WorkoutRoomPage

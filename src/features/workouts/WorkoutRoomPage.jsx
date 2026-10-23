import { useRef, useState } from 'react'
import { formatMemberSummary } from '../../utils/memberSummary.js'
import RoomManageDialog from '../rooms/RoomManageDialog.jsx'
import {
  getAttendance,
  getExercisesForDate,
  getLocalDateKey,
  getSetsForExercise,
  shiftDateKey,
} from './workoutData.js'
import { exerciseCategories, exercises } from './exerciseCatalog.js'

const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }).format(date)
}

function isValidSet(weight, reps) {
  const parsedWeight = Number(weight)
  const parsedReps = Number(reps)
  return weight.trim() !== '' && Number.isFinite(parsedWeight) && parsedWeight >= 0
    && reps.trim() !== '' && Number.isInteger(parsedReps) && parsedReps >= 1
}

function SetRow({ set, canEdit, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(String(set.weight))
  const [reps, setReps] = useState(String(set.reps))
  const [error, setError] = useState('')

  const save = (event) => {
    event.preventDefault()
    if (!isValidSet(weight, reps)) {
      setError('중량은 0 이상, 반복 횟수는 1 이상의 정수로 입력해 주세요.')
      return
    }
    onUpdate(set.id, { weight, reps })
    setError('')
    setEditing(false)
  }

  if (editing) {
    return (
      <form className="workout-set-edit" noValidate onSubmit={save}>
        <label><span className="visually-hidden">중량(kg) 수정</span><input aria-label="중량(kg) 수정" inputMode="decimal" min="0" step="any" type="number" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
        <span>kg ×</span>
        <label><span className="visually-hidden">반복 횟수 수정</span><input aria-label="반복 횟수 수정" inputMode="numeric" min="1" step="1" type="number" value={reps} onChange={(event) => setReps(event.target.value)} /></label>
        <span>회</span>
        <button className="text-action" type="submit">저장</button>
        <button className="text-action text-action--muted" type="button" onClick={() => setEditing(false)}>취소</button>
        {error && <span className="field-error" role="alert">{error}</span>}
      </form>
    )
  }

  return (
    <div className="workout-set-row">
      <span className="workout-set-summary">{set.order}세트 <b>{set.weight}kg × {set.reps}회</b></span>
      {canEdit && <span className="workout-set-actions">
        <button className="text-action" type="button" onClick={() => setEditing(true)}>수정</button>
        <button className="text-action text-action--muted" type="button" aria-label={`${set.order}세트 삭제`} onClick={() => onRemove(set.id)}>삭제</button>
      </span>}
    </div>
  )
}

function SetEntryForm({ entryId, userId, currentUserId, onAdd }) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [error, setError] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!isValidSet(weight, reps)) {
      setError('중량은 0 이상의 숫자, 반복 횟수는 1 이상의 정수로 입력해 주세요.')
      return
    }
    onAdd(entryId, userId, currentUserId, { weight, reps })
    setWeight('')
    setReps('')
    setError('')
  }

  return (
    <form className="workout-set-form" noValidate onSubmit={submit}>
      <label className="workout-set-input"><span>중량</span><input aria-label="중량(kg)" inputMode="decimal" min="0" placeholder="0" step="any" type="number" value={weight} onChange={(event) => setWeight(event.target.value)} /><span>kg</span></label>
      <label className="workout-set-input workout-set-input--reps"><span>횟수</span><input aria-label="반복 횟수" inputMode="numeric" min="1" placeholder="10" step="1" type="number" value={reps} onChange={(event) => setReps(event.target.value)} /><span>회</span></label>
      <button className="add-set-button" type="submit">세트 추가</button>
      {error && <span className="field-error" role="alert">{error}</span>}
    </form>
  )
}

function MemberRecord({ member, entryId, sets, currentUserId, actions }) {
  const isCurrentUser = member.id === currentUserId
  return (
    <section className={`member-record${isCurrentUser ? ' member-record--mine' : ''}`} aria-label={`${member.name} 세트 기록`}>
      <div className="member-record__heading">
        <span className="member-avatar" aria-hidden="true">{member.name.slice(0, 1)}</span>
        <h4>{member.name}</h4>
        {isCurrentUser && <span className="my-record-badge">나</span>}
      </div>
      {sets.length ? <div className="workout-set-list">
        {sets.map((set) => <SetRow
          canEdit={isCurrentUser}
          key={set.id}
          onRemove={(setId) => actions.removeSet(setId, currentUserId)}
          onUpdate={(setId, input) => actions.updateSet(setId, currentUserId, input)}
          set={set}
        />)}
      </div> : <p className="no-member-sets">아직 기록 없음</p>}
      {isCurrentUser && <SetEntryForm currentUserId={currentUserId} entryId={entryId} onAdd={actions.addSet} userId={member.id} />}
    </section>
  )
}

function ExercisePicker({ category, onCategoryChange, onChoose, onClose, notice }) {
  const categoryExercises = exercises.filter((exercise) => exercise.category === category)
  return (
    <div
      className="workout-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
    >
      <section className="workout-picker" role="dialog" aria-modal="true" aria-labelledby="exercise-picker-title">
        <div className="workout-picker__handle" aria-hidden="true" />
        <div className="workout-picker__heading">
          <div><p className="section-kicker">CHOOSE AN EXERCISE</p><h3 id="exercise-picker-title">운동 종목 추가</h3></div>
          <button className="picker-close" type="button" aria-label="운동 선택 닫기" onClick={onClose}>×</button>
        </div>
        <div className="exercise-category-list" role="tablist" aria-label="운동 부위">
          {exerciseCategories.map((item) => <button
            aria-selected={category === item}
            className={`exercise-category${category === item ? ' is-selected' : ''}`}
            key={item}
            onClick={() => onCategoryChange(item)}
            role="tab"
            type="button"
          >{item}</button>)}
        </div>
        <div className="exercise-choice-list" role="tabpanel">
          {categoryExercises.map((exercise) => <button className="exercise-choice" key={exercise.id} type="button" onClick={() => onChoose(exercise)}>
            <span>{exercise.name}</span><span aria-hidden="true">＋</span>
          </button>)}
        </div>
        {notice && <p className="workout-notice" role="status">{notice}</p>}
      </section>
    </div>
  )
}

function DeleteExerciseDialog({ exerciseName, onCancel, onConfirm }) {
  return (
    <div className="workout-modal-backdrop">
      <section className="delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-exercise-title">
        <div className="delete-dialog__icon" aria-hidden="true">!</div>
        <h3 id="delete-exercise-title">운동 종목을 삭제할까요?</h3>
        <p><b>{exerciseName}</b> 및 모든 참여자의 해당 세트 기록이 함께 삭제됩니다. 참여 상태는 유지됩니다.</p>
        <div className="delete-dialog__actions">
          <button className="secondary-action" type="button" onClick={onCancel}>취소</button>
          <button className="danger-action" type="button" onClick={onConfirm}>기록 삭제</button>
        </div>
      </section>
    </div>
  )
}

function AttendanceControl({ roomId, date, currentUserId, state, actions }) {
  const status = getAttendance(state, roomId, date, currentUserId)
  return (
    <section className="attendance-card" aria-label="오늘의 참여 상태">
      <div><p className="attendance-card__title">오늘 운동에 참여하나요?</p><p className="attendance-card__hint">미참여여도 모두의 기록을 볼 수 있어요.</p></div>
      <div className="attendance-options">
        <button className={`attendance-option${status === 'attending' ? ' is-selected' : ''}`} type="button" aria-pressed={status === 'attending'} onClick={() => actions.setAttendance(roomId, date, currentUserId, 'attending')}>참여</button>
        <button className={`attendance-option attendance-option--no${status === 'not_attending' ? ' is-selected' : ''}`} type="button" aria-pressed={status === 'not_attending'} onClick={() => actions.setAttendance(roomId, date, currentUserId, 'not_attending')}>미참여</button>
      </div>
    </section>
  )
}

function ExerciseEntryCard({ entry, room, members, currentUserId, state, actions, onDelete }) {
  const exercise = exerciseById.get(entry.exerciseId)
  if (!exercise) return null
  return (
    <article className="exercise-entry-card">
      <div className="exercise-entry-heading">
        <div className="exercise-entry-title"><span className="exercise-entry-icon" aria-hidden="true">🏋️</span><div><p className="exercise-entry-category">{exercise.category}</p><h3>{exercise.name}</h3></div></div>
        <button className="exercise-delete-button" type="button" onClick={() => onDelete(entry.id)}>삭제</button>
      </div>
      <div className="member-record-list">
        {members.map((member) => <MemberRecord
          actions={actions}
          currentUserId={currentUserId}
          entryId={entry.id}
          key={member.id}
          member={member}
          sets={getSetsForExercise(state, entry.id, member.id)}
        />)}
      </div>
      <span className="visually-hidden">{room.name}</span>
    </article>
  )
}

function WorkoutRoomPage({ room, onBack, onDeleteRoom, onUpdateRoom, state, currentUserId, onUserChange, actions }) {
  const [date, setDate] = useState(() => getLocalDateKey())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [category, setCategory] = useState(exerciseCategories[0])
  const [pickerNotice, setPickerNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [deleteEntryId, setDeleteEntryId] = useState(null)
  const [managingRoom, setManagingRoom] = useState(false)
  const touchStart = useRef(null)
  const currentEntries = getExercisesForDate(state, room.id, date)
  const sortedMembers = [...room.members].sort((first, second) => first.name.localeCompare(second.name, 'ko'))
  const selectedDeleteEntry = currentEntries.find((entry) => entry.id === deleteEntryId)
  const deleteExercise = selectedDeleteEntry ? exerciseById.get(selectedDeleteEntry.exerciseId) : null

  const changeDate = (amount) => { setDate((current) => shiftDateKey(current, amount)); setNotice('') }
  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }
  const handleTouchEnd = (event) => {
    if (!touchStart.current) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - touchStart.current.x
    const deltaY = touch.clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(deltaX) > 60 && Math.abs(deltaY) < 85) changeDate(deltaX < 0 ? 1 : -1)
  }
  const chooseExercise = (exercise) => {
    if (currentEntries.some((entry) => entry.exerciseId === exercise.id)) {
      setPickerNotice('이미 추가한 운동입니다.')
      return
    }
    actions.addExercise(room.id, date, exercise.id)
    setPickerOpen(false)
    setPickerNotice('')
    setNotice(`${exercise.name}을(를) 추가했어요.`)
  }
  const today = getLocalDateKey()
  const canManageRoom = room.creatorId === currentUserId

  return (
    <section className="workout-room-page" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <header className="workout-room-header">
        <button className="back-button workout-room-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> 운동방 목록</button>
        <div className="workout-room-heading">
          <div><p className="section-kicker">WORKOUT ROOM</p><h1>{room.name}</h1><p className="workout-room-members">👥 {formatMemberSummary(room.members)}</p>{room.description && <p className="workout-room-description">{room.description}</p>}</div>
          <span className={`workout-room-mark room-card__art--${room.color}`} aria-hidden="true">{room.symbol}</span>
        </div>
        {canManageRoom && <button className="room-manage-button" type="button" onClick={() => setManagingRoom(true)}><span aria-hidden="true">⚙</span> 방 관리</button>}
        <label className="dev-user-picker"><span>기록 확인 사용자</span><select aria-label="개발용 현재 사용자" value={currentUserId} onChange={(event) => onUserChange(event.target.value)}>
          {sortedMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select></label>
        <p className="demo-storage-note">테스트용 임시 기록은 이 브라우저에 저장됩니다.</p>
      </header>

      <div className="workout-date-picker">
        <button className="date-arrow" type="button" aria-label="이전 날짜" onClick={() => changeDate(-1)}>‹</button>
        <div className="workout-date-label"><span className="workout-date-icon" aria-hidden="true">▦</span><span>{formatDate(date)}</span>{date === today && <span className="today-badge">오늘</span>}</div>
        <button className="date-arrow" type="button" aria-label="다음 날짜" onClick={() => changeDate(1)}>›</button>
      </div>
      <p className="swipe-hint">화면을 좌우로 밀어 날짜를 바꿀 수 있어요.</p>
      <AttendanceControl actions={actions} currentUserId={currentUserId} date={date} roomId={room.id} state={state} />

      <div className="workout-list-heading"><div><p className="section-kicker">TODAY’S EXERCISES</p><h2>오늘의 운동 <span>{currentEntries.length}</span></h2></div><button className="add-exercise-button" type="button" onClick={() => { setPickerNotice(''); setPickerOpen(true) }}><span aria-hidden="true">＋</span> 운동 종목 추가</button></div>
      {notice && <p className="workout-notice" role="status">{notice}</p>}
      {currentEntries.length === 0 ? <div className="empty-workout-state"><span className="empty-workout-icon" aria-hidden="true">🌱</span><p>이 날짜에는 아직 운동 종목이 없어요.</p><span>운동 종목을 추가해 기록을 시작해 보세요.</span></div> : <div className="exercise-entry-list">
        {currentEntries.map((entry) => <ExerciseEntryCard
          actions={actions}
          currentUserId={currentUserId}
          entry={entry}
          key={entry.id}
          members={sortedMembers}
          onDelete={setDeleteEntryId}
          room={room}
          state={state}
        />)}
      </div>}

      {pickerOpen && <ExercisePicker category={category} notice={pickerNotice} onCategoryChange={setCategory} onChoose={chooseExercise} onClose={() => setPickerOpen(false)} />}
      {deleteEntryId && deleteExercise && <DeleteExerciseDialog
        exerciseName={deleteExercise.name}
        onCancel={() => setDeleteEntryId(null)}
        onConfirm={() => { actions.removeExercise(deleteEntryId); setDeleteEntryId(null); setNotice(`${deleteExercise.name}과 연결된 모든 세트 기록을 삭제했어요.`) }}
      />}
      {managingRoom && <RoomManageDialog
        room={room}
        onClose={() => setManagingRoom(false)}
        onDelete={onDeleteRoom}
        onSave={(input) => {
          const result = onUpdateRoom(input)
          if (!result?.error) setManagingRoom(false)
          return result
        }}
      />}
    </section>
  )
}

export default WorkoutRoomPage

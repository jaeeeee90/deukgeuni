import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient.js'
import { getRlsMutationGuard } from './rlsProbeGuard.js'

const setFields = 'id,entry_id,user_id,set_order,recorded_order,recording_method,weight,reps,duration_seconds,duration_minutes,distance_km,updated_at'
const entryFields = `id,room_id,workout_date,exercise_name,workout_sets(${setFields})`

function sameJson(first, second) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function setComparable(set) {
  if (!set) return null
  return {
    id: set.id,
    entry_id: set.entry_id,
    user_id: set.user_id,
    set_order: set.set_order,
    recorded_order: set.recorded_order,
    recording_method: set.recording_method,
    weight: set.weight,
    reps: set.reps,
    duration_seconds: set.duration_seconds,
    duration_minutes: set.duration_minutes,
    distance_km: set.distance_km,
    updated_at: set.updated_at,
  }
}

function attendanceComparable(item) {
  if (!item) return null
  return {
    room_id: item.room_id,
    user_id: item.user_id,
    attendance_date: item.attendance_date,
    status: item.status,
    updated_at: item.updated_at,
  }
}

function RlsTestPanel() {
  const [roomId, setRoomId] = useState(import.meta.env.VITE_RLS_TEST_ROOM_ID ?? '')
  const [snapshot, setSnapshot] = useState(null)
  const [selectedSetId, setSelectedSetId] = useState('')
  const [selectedAttendanceKey, setSelectedAttendanceKey] = useState('')
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedSet = snapshot?.sets.find((set) => set.id === selectedSetId) ?? null
  const selectedAttendance = snapshot?.attendance.find((item) => `${item.room_id}:${item.user_id}:${item.attendance_date}` === selectedAttendanceKey) ?? null
  const targetOwnerIsMember = (userId) => snapshot?.members.some((member) => member.user_id === userId && member.status === 'active') ?? false
  const setGuard = getRlsMutationGuard({
    room: snapshot?.room,
    currentUserId: snapshot?.user?.id,
    targetOwnerId: selectedSet?.user_id,
    targetOwnerIsMember: targetOwnerIsMember(selectedSet?.user_id),
  })
  const attendanceGuard = getRlsMutationGuard({
    room: snapshot?.room,
    currentUserId: snapshot?.user?.id,
    targetOwnerId: selectedAttendance?.user_id,
    targetOwnerIsMember: targetOwnerIsMember(selectedAttendance?.user_id),
  })

  const readSnapshot = async () => {
    if (!supabase) return { error: 'Supabase 환경변수가 설정되지 않았어요.', snapshot: null }
    if (!roomId.trim()) return { error: 'RLS 테스트 전용 방 UUID를 입력해 주세요.', snapshot: null }
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { error: '현재 로그인 세션을 확인하지 못했어요.', snapshot: null }
    const [roomResult, membersResult, entriesResult, attendanceResult] = await Promise.all([
      supabase.from('rooms').select('id,name,deleted_at').eq('id', roomId.trim()).maybeSingle(),
      supabase.from('room_members').select('room_id,user_id,display_name,role,status').eq('room_id', roomId.trim()),
      supabase.from('workout_entries').select(entryFields).eq('room_id', roomId.trim()),
      supabase.from('workout_attendance').select('room_id,user_id,attendance_date,status,updated_at').eq('room_id', roomId.trim()),
    ])
    const firstError = roomResult.error || membersResult.error || entriesResult.error || attendanceResult.error
    if (firstError) return { error: `테스트 대상을 읽지 못했어요: ${firstError.message}`, snapshot: null }
    if (!roomResult.data) return { error: '방을 찾지 못했거나 현재 사용자가 회원이 아닙니다.', snapshot: null }
    if (!roomResult.data.name.startsWith('[RLS TEST]')) return { error: '이 도구는 이름이 [RLS TEST]로 시작하는 방만 대상으로 합니다.', snapshot: null }

    const sets = (entriesResult.data ?? []).flatMap((entry) => entry.workout_sets ?? [])
      .filter((set) => set.user_id !== userData.user.id)
    const attendance = (attendanceResult.data ?? []).filter((item) => item.user_id !== userData.user.id)
    return { error: null, snapshot: {
      user: userData.user,
      room: roomResult.data,
      members: membersResult.data ?? [],
      sets,
      attendance,
    } }
  }

  const reload = async () => {
    setError('')
    setMessage('')
    setSnapshot(null)
    setSelectedSetId('')
    setSelectedAttendanceKey('')
    const result = await readSnapshot()
    if (result.error) return setError(result.error)
    setSnapshot(result.snapshot)
    setMessage('읽기 전용 대상 확인이 완료됐어요. 아래에서 검증 작업을 선택해 주세요.')
  }

  const begin = (type) => {
    const target = type.startsWith('set') ? selectedSet : selectedAttendance
    const guard = type.startsWith('set') ? setGuard : attendanceGuard
    if (!target || !guard.allowed) {
      setError(guard.reason ?? '검증 대상이 안전 조건을 충족하지 않아요.')
      return
    }
    setError('')
    setPending({ type, target })
  }

  const confirmProbe = async () => {
    if (!pending || !snapshot) return
    setBusy(true)
    setError('')
    setMessage('RLS 검증 요청을 실행하고 전후 상태를 비교하고 있어요.')
    try {
      const target = pending.target
      const before = pending.type.startsWith('set') ? setComparable(target) : attendanceComparable(target)
      let result
      if (pending.type === 'set-update') {
        result = await supabase.from('workout_sets').update({
          weight: target.weight,
          reps: target.reps,
          duration_seconds: target.duration_seconds,
          duration_minutes: target.duration_minutes,
          distance_km: target.distance_km,
        }).eq('id', target.id).select(setFields).maybeSingle()
      } else if (pending.type === 'set-delete') {
        result = await supabase.from('workout_sets').delete().eq('id', target.id).select('id').maybeSingle()
      } else {
        result = await supabase.from('workout_attendance').update({ status: target.status }).eq('room_id', target.room_id).eq('user_id', target.user_id).eq('attendance_date', target.attendance_date).select('room_id,user_id,attendance_date,status,updated_at').maybeSingle()
      }

      const refreshed = await readSnapshot()
      if (refreshed.error) throw new Error(refreshed.error)
      setSnapshot(refreshed.snapshot)
      const afterSet = pending.type.startsWith('set') ? refreshed.snapshot.sets.find((set) => set.id === target.id) : null
      const afterAttendance = pending.type.startsWith('attendance') ? refreshed.snapshot.attendance.find((item) => `${item.room_id}:${item.user_id}:${item.attendance_date}` === `${target.room_id}:${target.user_id}:${target.attendance_date}`) : null
      const after = pending.type.startsWith('set') ? setComparable(afterSet) : attendanceComparable(afterAttendance)
      const unchanged = sameJson(before, after)
      const blocked = Boolean(result.error) || (pending.type === 'set-delete' ? unchanged : unchanged)
      setMessage(blocked && unchanged
        ? 'RLS 차단 확인: 요청 오류 또는 0행 처리 후 대상 데이터가 변하지 않았어요.'
        : '주의: 대상 데이터가 변했어요. RLS 정책과 실제 DB 적용 상태를 즉시 확인해야 합니다.')
      if (!unchanged) setError('안전 검증 실패: 테스트 대상 데이터가 변경되었습니다.')
    } catch (probeError) {
      setError(`검증 요청 중 오류가 발생했어요: ${probeError.message}`)
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  const setOptions = useMemo(() => snapshot?.sets.map((set) => `${set.id} · ${set.user_id} · ${set.recording_method}`) ?? [], [snapshot?.sets])
  const attendanceOptions = useMemo(() => snapshot?.attendance.map((item) => `${item.room_id}:${item.user_id}:${item.attendance_date}`) ?? [], [snapshot?.attendance])

  return <aside style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 50, width: 'min(420px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 24px)', overflow: 'auto', padding: 16, border: '1px solid #e6c8bc', borderRadius: 16, background: '#fffaf6', boxShadow: '0 12px 30px #5a403025', color: '#34313b', fontSize: 12 }}>
    <strong style={{ display: 'block', marginBottom: 6 }}>개발용 RLS 검증 도구</strong>
    <p style={{ margin: '0 0 10px', lineHeight: 1.5 }}>운영 빌드에는 포함되지 않으며, [RLS TEST] 방만 검사합니다.</p>
    <input aria-label="RLS 테스트 방 UUID" placeholder="RLS 테스트 방 UUID" value={roomId} onChange={(event) => setRoomId(event.target.value)} style={{ width: '100%', marginBottom: 8, padding: 8, border: '1px solid #eadbd4', borderRadius: 8 }} />
    <button disabled={busy} type="button" onClick={reload} style={{ width: '100%', padding: 8, border: 0, borderRadius: 8, color: '#fff', background: '#ef8e73' }}>로그인 세션·대상 읽기</button>
    {snapshot && <div style={{ marginTop: 10, lineHeight: 1.6 }}><div>현재 사용자: <code>{snapshot.user.id}</code></div><div>테스트 방: {snapshot.room.name}</div><div>회원 수: {snapshot.members.length}명</div>
      <label style={{ display: 'block', marginTop: 8 }}>타 회원 세트<select value={selectedSetId} onChange={(event) => setSelectedSetId(event.target.value)} style={{ width: '100%', marginTop: 4, padding: 6 }}><option value="">선택하세요</option>{setOptions.map((label, index) => <option key={snapshot.sets[index].id} value={snapshot.sets[index].id}>{label}</option>)}</select></label>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}><button disabled={!setGuard.allowed || busy} type="button" onClick={() => begin('set-update')}>타 회원 UPDATE 검증</button><button disabled={!setGuard.allowed || busy} type="button" onClick={() => begin('set-delete')}>타 회원 DELETE 검증</button></div>
      <label style={{ display: 'block', marginTop: 8 }}>타 회원 참여 상태<select value={selectedAttendanceKey} onChange={(event) => setSelectedAttendanceKey(event.target.value)} style={{ width: '100%', marginTop: 4, padding: 6 }}><option value="">선택하세요</option>{attendanceOptions.map((label) => <option key={label} value={label}>{label}</option>)}</select></label>
      <button disabled={!attendanceGuard.allowed || busy} type="button" onClick={() => begin('attendance-update')}>타 회원 참여 상태 UPDATE 검증</button>
      {!setGuard.allowed && selectedSet && <p style={{ color: '#b45d50' }}>{setGuard.reason}</p>}
      {!attendanceGuard.allowed && selectedAttendance && <p style={{ color: '#b45d50' }}>{attendanceGuard.reason}</p>}
    </div>}
    {pending && <div role="alertdialog" style={{ marginTop: 10, padding: 10, border: '1px solid #d58f7e', borderRadius: 10, background: '#fff0eb' }}><strong>실제 요청 확인</strong><p style={{ lineHeight: 1.5 }}>방: {snapshot.room.name}<br />현재 사용자: {snapshot.user.id}<br />대상 소유자: {pending.target.user_id}<br />작업: {pending.type}<br />실제 DB 요청을 실행합니다. 테스트 방 데이터만 대상으로 하며, 전후 값을 비교합니다.</p><button disabled={busy} type="button" onClick={confirmProbe}>확인하고 실행</button><button disabled={busy} type="button" onClick={() => setPending(null)}>취소</button></div>}
    {message && <p role="status" style={{ margin: '10px 0 0', color: '#47765e' }}>{message}</p>}
    {error && <p role="alert" style={{ margin: '10px 0 0', color: '#b45d50' }}>{error}</p>}
  </aside>
}

export default RlsTestPanel

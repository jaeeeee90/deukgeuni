-- 득근이 6-3차: 날짜별 운동 종목·세트·참여 상태
-- 전제: 001_create_profiles.sql, 002_create_rooms.sql을 먼저 실행합니다.
-- 이 파일은 Supabase SQL Editor에서 사용자가 직접 실행합니다.

-- 1. 운동방의 날짜별 운동 종목
create table if not exists public.workout_entries (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  workout_date date not null,
  exercise_id text not null,
  exercise_name text not null,
  exercise_categories text[] not null default '{}',
  recording_method text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  constraint workout_entries_name_length check (char_length(btrim(exercise_name)) between 1 and 100),
  constraint workout_entries_recording_method_allowed check (
    recording_method in ('weight-reps', 'reps', 'duration', 'duration-distance')
  ),
  constraint workout_entries_unique_exercise_per_date unique (room_id, workout_date, exercise_id)
);

-- 2. 회원별 세트 기록
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.workout_entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_order integer not null,
  recorded_order bigint not null,
  recording_method text not null,
  weight numeric(10, 2),
  reps integer,
  duration_seconds numeric(10, 2),
  duration_minutes numeric(10, 2),
  distance_km numeric(10, 2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint workout_sets_order_positive check (set_order > 0),
  constraint workout_sets_recorded_order_positive check (recorded_order > 0),
  constraint workout_sets_recording_method_allowed check (
    recording_method in ('weight-reps', 'reps', 'duration', 'duration-distance')
  ),
  constraint workout_sets_values_valid check (
    (recording_method = 'weight-reps'
      and weight is not null and weight >= 0
      and reps is not null and reps > 0
      and duration_seconds is null and duration_minutes is null and distance_km is null)
    or (recording_method = 'reps'
      and weight is null and reps is not null and reps > 0
      and duration_seconds is null and duration_minutes is null and distance_km is null)
    or (recording_method = 'duration'
      and weight is null and reps is null
      and duration_seconds is not null and duration_seconds > 0
      and duration_minutes is null and distance_km is null)
    or (recording_method = 'duration-distance'
      and weight is null and reps is null and duration_seconds is null
      and duration_minutes is not null and duration_minutes > 0
      and distance_km is not null and distance_km >= 0)
  ),
  constraint workout_sets_unique_order_per_user unique (entry_id, user_id, set_order),
  constraint workout_sets_unique_recorded_order unique (entry_id, recorded_order)
);

-- 3. 운동방 회원별 날짜 참여 상태
create table if not exists public.workout_attendance (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  status text not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id, attendance_date),
  constraint workout_attendance_status_allowed check (status in ('attending', 'not_attending'))
);

-- 4. RLS 활성화와 클라이언트 권한
alter table public.workout_entries enable row level security;
alter table public.workout_sets enable row level security;
alter table public.workout_attendance enable row level security;

revoke all on table public.workout_entries from anon, authenticated;
revoke all on table public.workout_sets from anon, authenticated;
revoke all on table public.workout_attendance from anon, authenticated;

grant select on table public.workout_entries to authenticated;
grant insert (room_id, workout_date, exercise_id, exercise_name, exercise_categories, recording_method, created_by)
on table public.workout_entries to authenticated;
grant delete on table public.workout_entries to authenticated;

grant select on table public.workout_sets to authenticated;
grant update (recording_method, weight, reps, duration_seconds, duration_minutes, distance_km)
on table public.workout_sets to authenticated;
grant delete on table public.workout_sets to authenticated;

grant select, insert, update on table public.workout_attendance to authenticated;

-- 5. 삭제되지 않은 운동방의 회원 여부를 확인하는 SECURITY DEFINER 함수
-- rooms와 workout_sets 정책이 서로 RLS를 재귀 호출하지 않도록 private schema에서 조회합니다.
create or replace function private.is_active_workout_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.rooms room
    join public.room_members member on member.room_id = room.id
    where room.id = target_room_id
      and room.deleted_at is null
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

revoke all on function private.is_active_workout_room_member(uuid) from public, anon, authenticated;
grant execute on function private.is_active_workout_room_member(uuid) to authenticated;

create or replace function private.is_workout_entry_member(target_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workout_entries entry
    join public.rooms room on room.id = entry.room_id
    join public.room_members member on member.room_id = entry.room_id
    where entry.id = target_entry_id
      and room.deleted_at is null
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

revoke all on function private.is_workout_entry_member(uuid) from public, anon, authenticated;
grant execute on function private.is_workout_entry_member(uuid) to authenticated;

-- 6. 세트의 recording_method가 상위 운동 종목과 일치하는지 검증
create or replace function public.validate_workout_set()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  entry_recording_method text;
begin
  select recording_method
  into entry_recording_method
  from public.workout_entries
  where id = new.entry_id;

  if entry_recording_method is null then
    raise exception 'missing_workout_entry';
  end if;

  if new.recording_method is distinct from entry_recording_method then
    raise exception 'recording_method_mismatch';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_workout_set() from public, anon, authenticated;
grant execute on function public.validate_workout_set() to postgres;

drop trigger if exists workout_sets_validate_method on public.workout_sets;
create trigger workout_sets_validate_method
before insert or update on public.workout_sets
for each row
execute function public.validate_workout_set();

-- 6. 날짜별 운동 종목 RLS
drop policy if exists "workout_entries_select_member" on public.workout_entries;
create policy "workout_entries_select_member"
on public.workout_entries
for select
to authenticated
using ((select private.is_active_workout_room_member(room_id)));

drop policy if exists "workout_entries_insert_member" on public.workout_entries;
create policy "workout_entries_insert_member"
on public.workout_entries
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.is_active_workout_room_member(room_id))
);

drop policy if exists "workout_entries_delete_member" on public.workout_entries;
create policy "workout_entries_delete_member"
on public.workout_entries
for delete
to authenticated
using ((select private.is_active_workout_room_member(room_id)));

-- 7. 세트 기록 RLS: 조회는 방 회원, 변경·삭제는 본인만
drop policy if exists "workout_sets_select_member" on public.workout_sets;
create policy "workout_sets_select_member"
on public.workout_sets
for select
to authenticated
using ((select private.is_workout_entry_member(entry_id)));

drop policy if exists "workout_sets_update_own" on public.workout_sets;
create policy "workout_sets_update_own"
on public.workout_sets
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workout_entry_member(entry_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_workout_entry_member(entry_id))
);

drop policy if exists "workout_sets_delete_own" on public.workout_sets;
create policy "workout_sets_delete_own"
on public.workout_sets
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_workout_entry_member(entry_id))
);

-- 8. 참여 상태 RLS: 조회는 방 회원, 쓰기는 본인만
drop policy if exists "workout_attendance_select_member" on public.workout_attendance;
create policy "workout_attendance_select_member"
on public.workout_attendance
for select
to authenticated
using ((select private.is_active_workout_room_member(room_id)));

drop policy if exists "workout_attendance_insert_own" on public.workout_attendance;
create policy "workout_attendance_insert_own"
on public.workout_attendance
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.is_active_workout_room_member(room_id))
);

drop policy if exists "workout_attendance_update_own" on public.workout_attendance;
create policy "workout_attendance_update_own"
on public.workout_attendance
for update
to authenticated
using (
  user_id = (select auth.uid())
  and (select private.is_active_workout_room_member(room_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.is_active_workout_room_member(room_id))
);

-- 9. 세트 추가 RPC: user_id와 순서는 서버가 결정합니다.
create or replace function public.add_workout_set(
  p_entry_id uuid,
  p_recording_method text,
  p_weight numeric default null,
  p_reps integer default null,
  p_duration_seconds numeric default null,
  p_duration_minutes numeric default null,
  p_distance_km numeric default null
)
returns public.workout_sets
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
  entry_room_id uuid;
  entry_recording_method text;
  next_set_order integer;
  next_recorded_order bigint;
  created_set public.workout_sets;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_recording_method is null
    or p_recording_method not in ('weight-reps', 'reps', 'duration', 'duration-distance') then
    raise exception 'invalid_recording_method';
  end if;

  select entry.room_id, entry.recording_method
  into entry_room_id, entry_recording_method
  from public.workout_entries entry
  join public.rooms room on room.id = entry.room_id
  where entry.id = p_entry_id
    and room.deleted_at is null;

  if entry_room_id is null then
    raise exception 'missing_workout_entry';
  end if;

  if not exists (
    select 1
    from public.room_members member
    where member.room_id = entry_room_id
      and member.user_id = current_user_id
      and member.status = 'active'
  ) then
    raise exception 'not_room_member';
  end if;

  if entry_recording_method <> p_recording_method then
    raise exception 'recording_method_mismatch';
  end if;

  if p_recording_method = 'weight-reps'
    and (p_weight is null or p_weight < 0 or p_reps is null or p_reps <= 0
      or p_duration_seconds is not null or p_duration_minutes is not null or p_distance_km is not null) then
    raise exception 'invalid_set_values';
  elsif p_recording_method = 'reps'
    and (p_weight is not null or p_reps is null or p_reps <= 0
      or p_duration_seconds is not null or p_duration_minutes is not null or p_distance_km is not null) then
    raise exception 'invalid_set_values';
  elsif p_recording_method = 'duration'
    and (p_weight is not null or p_reps is not null
      or p_duration_seconds is null or p_duration_seconds <= 0
      or p_duration_minutes is not null or p_distance_km is not null) then
    raise exception 'invalid_set_values';
  elsif p_recording_method = 'duration-distance'
    and (p_weight is not null or p_reps is not null or p_duration_seconds is not null
      or p_duration_minutes is null or p_duration_minutes <= 0 or p_distance_km is null or p_distance_km < 0) then
    raise exception 'invalid_set_values';
  end if;

  -- 같은 운동 종목의 모든 동시 추가 요청을 하나씩 처리합니다.
  -- 이후 unique 제약도 최종 방어선으로 동작합니다.
  perform pg_advisory_xact_lock(hashtextextended(p_entry_id::text, 0));

  select min(candidate)
  into next_set_order
  from generate_series(
    1,
    coalesce((
      select max(set_order)
      from public.workout_sets
      where entry_id = p_entry_id and user_id = current_user_id
    ), 0) + 1
  ) as series(candidate)
  where not exists (
    select 1
    from public.workout_sets existing_set
    where existing_set.entry_id = p_entry_id
      and existing_set.user_id = current_user_id
      and existing_set.set_order = candidate
  );

  select coalesce(max(recorded_order), 0) + 1
  into next_recorded_order
  from public.workout_sets
  where entry_id = p_entry_id;

  insert into public.workout_sets (
    entry_id, user_id, set_order, recorded_order, recording_method,
    weight, reps, duration_seconds, duration_minutes, distance_km
  )
  values (
    p_entry_id, current_user_id, next_set_order, next_recorded_order, p_recording_method,
    p_weight, p_reps, p_duration_seconds, p_duration_minutes, p_distance_km
  )
  returning * into created_set;

  return created_set;
end;
$$;

revoke all on function public.add_workout_set(uuid, text, numeric, integer, numeric, numeric, numeric)
from public, anon, authenticated;
grant execute on function public.add_workout_set(uuid, text, numeric, integer, numeric, numeric, numeric)
to authenticated;

-- 10. updated_at 자동 갱신
create or replace function public.set_workout_record_updated_at()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.set_workout_record_updated_at() from public, anon, authenticated;
grant execute on function public.set_workout_record_updated_at() to postgres;

drop trigger if exists workout_sets_set_updated_at on public.workout_sets;
create trigger workout_sets_set_updated_at
before update on public.workout_sets
for each row
execute function public.set_workout_record_updated_at();

drop trigger if exists workout_attendance_set_updated_at on public.workout_attendance;
create trigger workout_attendance_set_updated_at
before update on public.workout_attendance
for each row
execute function public.set_workout_record_updated_at();

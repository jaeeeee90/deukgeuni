-- 득근이 6-2차: Supabase 운동방과 방 회원
-- 전제: 001_create_profiles.sql을 먼저 실행합니다.
-- 이 파일은 프론트엔드나 로컬 개발 명령으로 자동 실행하지 않습니다.

-- 1. 운동방
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  symbol text not null,
  color text not null,
  creator_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint rooms_name_length check (char_length(btrim(name)) between 1 and 30),
  constraint rooms_description_length check (char_length(description) <= 100),
  constraint rooms_icon_allowed check ((symbol, color) in (
    ('💪', 'peach'),
    ('🏋️', 'lavender'),
    ('🏃', 'mint'),
    ('🚴', 'peach'),
    ('🧘', 'lavender'),
    ('🥊', 'mint')
  ))
);

-- 2. 운동방 회원
create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (room_id, user_id),
  constraint room_members_role_allowed check (role in ('owner', 'member')),
  constraint room_members_status_allowed check (status in ('active', 'left'))
);

-- 3. RLS와 클라이언트 권한
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

revoke all on table public.rooms from anon, authenticated;
revoke all on table public.room_members from anon, authenticated;

grant select on table public.rooms to authenticated;
grant update (name, description, symbol, color, deleted_at) on table public.rooms to authenticated;
grant select on table public.room_members to authenticated;

-- 4. RLS 재귀를 피하는 방 회원 확인 함수
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

revoke all on function private.is_room_member(uuid) from public, anon, authenticated;
grant execute on function private.is_room_member(uuid) to authenticated;

-- 5. 회원만 방을 조회하고, 방장만 방을 수정
drop policy if exists "rooms_select_member" on public.rooms;
create policy "rooms_select_member"
on public.rooms
for select
to authenticated
using (
  deleted_at is null
  and (select private.is_room_member(id))
);

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner"
on public.rooms
for update
to authenticated
using (
  deleted_at is null
  and creator_id = (select auth.uid())
)
with check (
  creator_id = (select auth.uid())
);

-- 6. 방 회원은 같은 방의 active 회원 목록만 조회
drop policy if exists "room_members_select_member" on public.room_members;
create policy "room_members_select_member"
on public.room_members
for select
to authenticated
using (
  status = 'active'
  and (select private.is_room_member(room_id))
);

-- 7. 방 생성과 방장 첫 회원 등록을 하나의 트랜잭션으로 처리
create or replace function public.create_room_with_owner(
  p_name text,
  p_description text,
  p_symbol text,
  p_color text
)
returns public.rooms
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_name text := btrim(coalesce(p_name, ''));
  normalized_description text := btrim(coalesce(p_description, ''));
  owner_name text;
  created_room public.rooms;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if char_length(normalized_name) not between 1 and 30 then
    raise exception 'invalid_room_name';
  end if;

  if char_length(normalized_description) > 100 then
    raise exception 'invalid_room_description';
  end if;

  if (p_symbol, p_color) not in (
    ('💪', 'peach'),
    ('🏋️', 'lavender'),
    ('🏃', 'mint'),
    ('🚴', 'peach'),
    ('🧘', 'lavender'),
    ('🥊', 'mint')
  ) then
    raise exception 'invalid_room_icon';
  end if;

  select display_name
  into owner_name
  from public.profiles
  where id = current_user_id;

  if owner_name is null then
    raise exception 'missing_profile';
  end if;

  insert into public.rooms (name, description, symbol, color, creator_id)
  values (normalized_name, normalized_description, p_symbol, p_color, current_user_id)
  returning * into created_room;

  insert into public.room_members (room_id, user_id, display_name, role, status)
  values (created_room.id, current_user_id, owner_name, 'owner', 'active');

  return created_room;
end;
$$;

revoke all on function public.create_room_with_owner(text, text, text, text)
from public, anon, authenticated;
grant execute on function public.create_room_with_owner(text, text, text, text)
to authenticated;

-- 8. updated_at 자동 갱신
create or replace function public.set_rooms_updated_at()
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

revoke all on function public.set_rooms_updated_at() from public, anon, authenticated;
grant execute on function public.set_rooms_updated_at() to postgres;

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_rooms_updated_at();

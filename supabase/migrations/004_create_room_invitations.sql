-- 득근이 7-2차: 운동방 초대 링크
-- 전제: 001_create_profiles.sql, 002_create_rooms.sql을 먼저 실행합니다.
-- 이 파일은 프론트엔드에서 자동 실행하지 않고 Supabase SQL Editor에서 직접 실행합니다.

-- 1. 서버 토큰 생성과 SHA-256 해시에 필요한 pgcrypto
-- Supabase의 기본 확장 스키마를 사용합니다.
create extension if not exists pgcrypto with schema extensions;

-- 2. 초대 링크
-- 원문 토큰은 저장하지 않고 token_hash만 저장합니다.
create table if not exists public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint room_invitations_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint room_invitations_expiry_after_creation check (expires_at > created_at),
  constraint room_invitations_revoked_after_creation check (
    revoked_at is null or revoked_at >= created_at
  )
);

-- 한 방에는 활성 초대 링크를 하나만 유지합니다.
create unique index if not exists room_invitations_one_active_per_room
on public.room_invitations (room_id)
where revoked_at is null;

-- 3. RLS와 직접 테이블 권한
alter table public.room_invitations enable row level security;

-- 모든 초대 작업은 아래 SECURITY DEFINER RPC를 통해서만 수행합니다.
revoke all on table public.room_invitations from anon, authenticated;

-- 4. 토큰 정규화·해시 공통 함수
-- 이 함수는 외부에서 호출하지 않고 아래 RPC 내부에서만 사용합니다.
create or replace function private.hash_room_invitation_token(p_token text)
returns text
language sql
immutable
security definer
set search_path = pg_catalog, public, private, extensions
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(pg_catalog.btrim(p_token), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.hash_room_invitation_token(text)
from public, anon, authenticated;

-- 5. 방장 전용 초대 링크 생성
create or replace function public.create_room_invitation(p_room_id uuid)
returns table (
  room_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  locked_room public.rooms;
  generated_token text;
  generated_expires_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- 방 행을 잠가 동시에 생성되는 링크가 두 개 남지 않도록 합니다.
  select room.*
  into locked_room
  from public.rooms as room
  where room.id = p_room_id
  for update;

  if locked_room.id is null
    or locked_room.deleted_at is not null
    or locked_room.creator_id <> current_user_id
    or not exists (
      select 1
      from public.room_members as member
      where member.room_id = locked_room.id
        and member.user_id = current_user_id
        and member.role = 'owner'
        and member.status = 'active'
    ) then
    raise exception 'invitation_creation_not_allowed';
  end if;

  -- gen_random_bytes(32)는 256비트 토큰을 생성합니다.
  generated_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  generated_expires_at := timezone('utc', now()) + interval '7 days';

  update public.room_invitations as invitation
  set revoked_at = timezone('utc', now())
  where invitation.room_id = locked_room.id
    and invitation.revoked_at is null;

  insert into public.room_invitations (
    room_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    locked_room.id,
    private.hash_room_invitation_token(generated_token),
    current_user_id,
    generated_expires_at
  );

  return query
  select locked_room.id, generated_token, generated_expires_at;
end;
$$;

revoke all on function public.create_room_invitation(uuid)
from public, anon, authenticated;
grant execute on function public.create_room_invitation(uuid)
to authenticated;

-- 6. 비로그인 사용자도 토큰을 가진 경우에만 호출할 수 있는 최소 미리보기
-- 유효하지 않은 토큰·만료·폐기·삭제 방은 같은 오류로 처리해 존재 여부를 숨깁니다.
create or replace function public.get_room_invitation_preview(p_token text)
returns table (
  room_id uuid,
  room_name text,
  room_description text,
  room_symbol text,
  room_color text,
  member_count bigint,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  normalized_token text := pg_catalog.btrim(coalesce(p_token, ''));
  invitation_hash text;
begin
  if pg_catalog.char_length(normalized_token) <> 64
    or normalized_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invitation_unavailable';
  end if;

  invitation_hash := private.hash_room_invitation_token(normalized_token);

  return query
  select
    room.id,
    room.name,
    room.description,
    room.symbol,
    room.color,
    (
      select count(*)::bigint
      from public.room_members as member
      where member.room_id = room.id
        and member.status = 'active'
    ),
    invitation.expires_at
  from public.room_invitations as invitation
  join public.rooms as room on room.id = invitation.room_id
  where invitation.token_hash = invitation_hash
    and invitation.revoked_at is null
    and invitation.expires_at > timezone('utc', now())
    and room.deleted_at is null;

  if not found then
    raise exception 'invitation_unavailable';
  end if;
end;
$$;

revoke all on function public.get_room_invitation_preview(text)
from public, anon, authenticated;
grant execute on function public.get_room_invitation_preview(text)
to anon, authenticated;

-- 7. 로그인 사용자의 초대 참여
create or replace function public.accept_room_invitation(p_token text)
returns table (
  room_id uuid,
  already_member boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_token text := pg_catalog.btrim(coalesce(p_token, ''));
  invitation_hash text;
  target_room_id uuid;
  profile_display_name text;
  existing_status text;
  existing_role text;
  existing_joined_at timestamptz;
  affected_rows integer;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if pg_catalog.char_length(normalized_token) <> 64
    or normalized_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invitation_unavailable';
  end if;

  invitation_hash := private.hash_room_invitation_token(normalized_token);

  select invitation.room_id
  into target_room_id
  from public.room_invitations as invitation
  join public.rooms as room on room.id = invitation.room_id
  where invitation.token_hash = invitation_hash
    and invitation.revoked_at is null
    and invitation.expires_at > timezone('utc', now())
    and room.deleted_at is null;

  if target_room_id is null then
    raise exception 'invitation_unavailable';
  end if;

  select profile.display_name
  into profile_display_name
  from public.profiles as profile
  where profile.id = current_user_id;

  if profile_display_name is null then
    raise exception 'missing_profile';
  end if;

  -- 기존 행이 있으면 active는 그대로 성공, left는 재가입시킵니다.
  select member.status, member.role, member.joined_at
  into existing_status, existing_role, existing_joined_at
  from public.room_members as member
  where member.room_id = target_room_id
    and member.user_id = current_user_id
  for update;

  if existing_status = 'active' then
    return query select target_room_id, true, existing_joined_at;
    return;
  end if;

  if existing_status = 'left' then
    if existing_role <> 'member' then
      raise exception 'owner_rejoin_not_allowed';
    end if;

    update public.room_members as member
    set display_name = profile_display_name,
        role = 'member',
        status = 'active',
        joined_at = timezone('utc', now())
    where member.room_id = target_room_id
      and member.user_id = current_user_id
    returning member.joined_at into existing_joined_at;

    return query select target_room_id, false, existing_joined_at;
    return;
  end if;

  if existing_status is not null then
    raise exception 'invalid_member_status';
  end if;

  -- 동시 가입은 복합 기본키의 충돌을 이용해 한 번만 삽입합니다.
  insert into public.room_members (
    room_id,
    user_id,
    display_name,
    role,
    status
  )
  values (
    target_room_id,
    current_user_id,
    profile_display_name,
    'member',
    'active'
  )
  on conflict on constraint room_members_pkey do nothing;

  get diagnostics affected_rows = row_count;

  if affected_rows = 0 then
    -- 경쟁 요청이 먼저 삽입한 행을 다시 확인합니다.
    -- active인 경우에만 중복 가입 성공으로 처리합니다.
    select member.status, member.role, member.joined_at
    into existing_status, existing_role, existing_joined_at
    from public.room_members as member
    where member.room_id = target_room_id
      and member.user_id = current_user_id;

    if existing_status = 'active' then
      return query select target_room_id, true, existing_joined_at;
      return;
    end if;

    if existing_status = 'left' then
      raise exception 'member_join_conflict';
    end if;

    raise exception 'invalid_member_status';
  end if;

  select member.joined_at
  into existing_joined_at
  from public.room_members as member
  where member.room_id = target_room_id
    and member.user_id = current_user_id;

  return query select target_room_id, false, existing_joined_at;
end;
$$;

revoke all on function public.accept_room_invitation(text)
from public, anon, authenticated;
grant execute on function public.accept_room_invitation(text)
to authenticated;

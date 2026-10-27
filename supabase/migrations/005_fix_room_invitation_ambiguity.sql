-- 득근이 7-5차: 초대 참여 RPC의 PL/pgSQL 이름 충돌 수정
-- 전제: 001~004 migration을 이미 실행한 Supabase 프로젝트입니다.
-- 이 파일만 SQL Editor에서 실행합니다. 기존 migration은 재실행하지 않습니다.
-- room_members의 기본키 제약조건명은 002_create_rooms.sql의 기본 이름인 room_members_pkey입니다.

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

  -- 기존 행이 있으면 active는 그대로 성공, left는 일반 member만 재가입시킵니다.
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

  -- 반환 테이블의 room_id/user_id 변수와 컬럼명이 충돌하지 않도록
  -- 기본키 constraint 이름을 사용합니다.
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

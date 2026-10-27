-- 득근이 8-4차: 친구 지정 운동방 초대
-- 전제: 001~007 migration을 이미 실행했습니다.
-- 이 파일만 Supabase SQL Editor에서 직접 실행합니다.
-- 기존 001~007 migration과 기존 React 파일은 수정하지 않습니다.
-- 기존 링크 초대(public.room_invitations)는 그대로 유지합니다.

-- 1. 친구 지정 초대
-- 한 초대는 한 방의 한 친구를 대상으로 하며, 응답 이력은 status로 보존합니다.
create table if not exists public.room_friend_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint room_friend_invitations_different_users check (inviter_id <> invitee_id),
  constraint room_friend_invitations_status_allowed check (
    status in ('pending', 'accepted', 'rejected', 'cancelled')
  )
);

-- 같은 방·같은 친구에게 pending 초대가 두 개 생기지 않게 합니다.
create unique index if not exists room_friend_invitations_one_pending
on public.room_friend_invitations (room_id, invitee_id)
where status = 'pending';

create index if not exists room_friend_invitations_invitee_status
on public.room_friend_invitations (invitee_id, status, created_at desc);

create index if not exists room_friend_invitations_inviter_room
on public.room_friend_invitations (inviter_id, room_id, invitee_id, status);

-- 모든 변경·조회는 아래 SECURITY DEFINER RPC를 통합니다.
alter table public.room_friend_invitations enable row level security;
revoke all on table public.room_friend_invitations from anon, authenticated;

-- 2. 친구 여러 명에게 운동방 초대 보내기
-- 초대자는 해당 방의 active 회원이어야 하고, 대상은 accepted 친구여야 합니다.
-- 한 명이라도 친구가 아니면 전체 트랜잭션을 중단합니다.
create or replace function public.send_room_friend_invitations(
  p_room_id uuid,
  p_invitee_ids uuid[]
)
returns table (
  invitation_id uuid,
  invitee_id uuid,
  invitation_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_room public.rooms;
  candidate_id uuid;
  existing_invitation_id uuid;
  existing_status text;
  result_invitation_id uuid;
  result_status text;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select room.*
  into target_room
  from public.rooms as room
  where room.id = p_room_id
    and room.deleted_at is null;

  if target_room.id is null then
    raise exception 'room_not_found';
  end if;

  if not exists (
    select 1
    from public.room_members as member
    where member.room_id = p_room_id
      and member.user_id = current_user_id
      and member.status = 'active'
  ) then
    raise exception 'room_invitation_not_allowed';
  end if;

  for candidate_id in
    select distinct candidate.invitee_id
    from unnest(coalesce(p_invitee_ids, '{}'::uuid[])) as candidate(invitee_id)
    where candidate.invitee_id is not null
  loop
    if candidate_id = current_user_id then
      raise exception 'cannot_invite_self';
    end if;

    if not exists (
      select 1
      from public.friendships as friendship
      where friendship.status = 'accepted'
        and (
          (friendship.requester_id = current_user_id and friendship.recipient_id = candidate_id)
          or (friendship.requester_id = candidate_id and friendship.recipient_id = current_user_id)
        )
    ) then
      raise exception 'room_invitee_not_friend';
    end if;

    -- 발송과 수락이 같은 방·같은 사용자를 동시에 처리하지 않게 합니다.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        p_room_id::text || ':' || candidate_id::text,
        0
      )
    );

    if exists (
      select 1
      from public.room_members as member
      where member.room_id = p_room_id
        and member.user_id = candidate_id
        and member.status = 'active'
    ) then
      return query select null::uuid, candidate_id, 'already_member'::text;
      continue;
    end if;

    select invitation.id, invitation.status
    into existing_invitation_id, existing_status
    from public.room_friend_invitations as invitation
    where invitation.room_id = p_room_id
      and invitation.invitee_id = candidate_id
      and invitation.status = 'pending'
    for update;

    if existing_status = 'pending' then
      return query select existing_invitation_id, candidate_id, 'pending'::text;
      continue;
    end if;

    insert into public.room_friend_invitations as new_invitation (
      room_id,
      inviter_id,
      invitee_id,
      status
    )
    values (
      p_room_id,
      current_user_id,
      candidate_id,
      'pending'
    )
    returning new_invitation.id, new_invitation.status
    into result_invitation_id, result_status;

    return query select result_invitation_id, candidate_id, 'sent'::text;
  end loop;
end;
$$;

revoke all on function public.send_room_friend_invitations(uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.send_room_friend_invitations(uuid, uuid[])
to authenticated;

-- 3. 방별 친구 초대 상태 조회
-- 현재 방의 active 회원인 사용자만 자신의 pending 초대 상태를 조회합니다.
create or replace function public.list_room_friend_invitation_statuses(p_room_id uuid)
returns table (
  invitation_id uuid,
  invitee_id uuid,
  invitation_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.rooms as room
    join public.room_members as member on member.room_id = room.id
    where room.id = p_room_id
      and room.deleted_at is null
      and member.user_id = current_user_id
      and member.status = 'active'
  ) then
    raise exception 'room_invitation_not_allowed';
  end if;

  return query
  select invitation.id,
         invitation.invitee_id,
         invitation.status,
         invitation.created_at
  from public.room_friend_invitations as invitation
  where invitation.room_id = p_room_id
    and invitation.inviter_id = current_user_id
    and invitation.status = 'pending'
  order by invitation.created_at desc;
end;
$$;

revoke all on function public.list_room_friend_invitation_statuses(uuid)
from public, anon, authenticated;
grant execute on function public.list_room_friend_invitation_statuses(uuid)
to authenticated;

-- 4. 받은 운동방 친구 초대 조회
create or replace function public.list_received_room_friend_invitations()
returns table (
  invitation_id uuid,
  room_id uuid,
  room_name text,
  room_symbol text,
  room_color text,
  inviter_id uuid,
  inviter_name text,
  inviter_avatar_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  return query
  select invitation.id,
         room.id,
         room.name,
         room.symbol,
         room.color,
         profile.id,
         profile.display_name,
         profile.avatar_url,
         invitation.created_at
  from public.room_friend_invitations as invitation
  join public.rooms as room on room.id = invitation.room_id
  join public.profiles as profile on profile.id = invitation.inviter_id
  where invitation.invitee_id = current_user_id
    and invitation.status = 'pending'
    and room.deleted_at is null
  order by invitation.created_at desc;
end;
$$;

revoke all on function public.list_received_room_friend_invitations()
from public, anon, authenticated;
grant execute on function public.list_received_room_friend_invitations()
to authenticated;

-- 5. 운동방 친구 초대 수락
-- 초대받은 사용자만 호출할 수 있습니다.
-- 링크 초대와 동일하게 active 재사용, left member 재가입을 지원합니다.
create or replace function public.accept_room_friend_invitation(p_invitation_id uuid)
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
  target_room_id uuid;
  invitation_status text;
  existing_role text;
  existing_member_status text;
  existing_joined_at timestamptz;
  profile_display_name text;
  affected_rows integer;
  result_already_member boolean;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select invitation.room_id
  into target_room_id
  from public.room_friend_invitations as invitation
  where invitation.id = p_invitation_id
    and invitation.invitee_id = current_user_id;

  if target_room_id is null then
    raise exception 'room_friend_invitation_not_found';
  end if;

  -- 발송 RPC와 같은 잠금 키를 사용해 중복 발송·동시 수락을 직렬화합니다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_room_id::text || ':' || current_user_id::text,
      0
    )
  );

  select invitation.status
  into invitation_status
  from public.room_friend_invitations as invitation
  join public.rooms as room on room.id = invitation.room_id
  where invitation.id = p_invitation_id
    and invitation.invitee_id = current_user_id
    and room.deleted_at is null
  for update;

  if invitation_status is null then
    raise exception 'room_friend_invitation_not_found';
  end if;

  if invitation_status <> 'pending' then
    raise exception 'room_friend_invitation_not_pending';
  end if;

  select profile.display_name
  into profile_display_name
  from public.profiles as profile
  where profile.id = current_user_id;

  if profile_display_name is null then
    raise exception 'missing_profile';
  end if;

  select member.status, member.role, member.joined_at
  into existing_member_status, existing_role, existing_joined_at
  from public.room_members as member
  where member.room_id = target_room_id
    and member.user_id = current_user_id
  for update;

  if existing_member_status = 'active' then
    result_already_member := true;
  elsif existing_member_status = 'left' then
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

    result_already_member := false;
  elsif existing_member_status is not null then
    raise exception 'invalid_member_status';
  else
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
      select member.status, member.role, member.joined_at
      into existing_member_status, existing_role, existing_joined_at
      from public.room_members as member
      where member.room_id = target_room_id
        and member.user_id = current_user_id;

      if existing_member_status <> 'active' then
        raise exception 'member_join_conflict';
      end if;

      result_already_member := true;
    else
      select member.joined_at
      into existing_joined_at
      from public.room_members as member
      where member.room_id = target_room_id
        and member.user_id = current_user_id;

      result_already_member := false;
    end if;
  end if;

  update public.room_friend_invitations as invitation
  set status = 'accepted',
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where invitation.id = p_invitation_id
    and invitation.invitee_id = current_user_id
    and invitation.status = 'pending';

  return query
  select target_room_id, result_already_member, existing_joined_at;
end;
$$;

revoke all on function public.accept_room_friend_invitation(uuid)
from public, anon, authenticated;
grant execute on function public.accept_room_friend_invitation(uuid)
to authenticated;

-- 6. 운동방 친구 초대 거절
create or replace function public.reject_room_friend_invitation(p_invitation_id uuid)
returns table (
  invitation_id uuid,
  invitation_status text,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
  result_responded_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select invitation.status
  into current_status
  from public.room_friend_invitations as invitation
  where invitation.id = p_invitation_id
    and invitation.invitee_id = current_user_id
  for update;

  if current_status is null then
    raise exception 'room_friend_invitation_not_found';
  end if;

  if current_status <> 'pending' then
    raise exception 'room_friend_invitation_not_pending';
  end if;

  update public.room_friend_invitations as invitation
  set status = 'rejected',
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where invitation.id = p_invitation_id
    and invitation.invitee_id = current_user_id
    and invitation.status = 'pending'
  returning invitation.updated_at into result_responded_at;

  return query
  select p_invitation_id, 'rejected'::text, result_responded_at;
end;
$$;

revoke all on function public.reject_room_friend_invitation(uuid)
from public, anon, authenticated;
grant execute on function public.reject_room_friend_invitation(uuid)
to authenticated;

-- 득근이 8-3차: 친구 요청 RPC의 컬럼·변수 이름 충돌 수정
-- 전제: 006_create_friendships.sql을 이미 실행했습니다.
-- 이 파일만 Supabase SQL Editor에서 실행합니다. 기존 migration은 수정·재실행하지 않습니다.

-- user_low_id/user_high_id 지역 변수를 v_ 접두사로 구분하고,
-- 테이블 컬럼은 항상 friendship/new_friendship 별칭으로 한정합니다.
create or replace function public.send_friend_request(p_recipient_id uuid)
returns table (
  friendship_id uuid,
  status text,
  recipient_id uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_user_low_id uuid;
  v_user_high_id uuid;
  existing_id uuid;
  existing_status text;
  existing_requester_id uuid;
  existing_recipient_id uuid;
  recipient_exists boolean;
  result_id uuid;
  result_status text;
  result_recipient_id uuid;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_recipient_id is null or p_recipient_id = current_user_id then
    raise exception 'cannot_request_self';
  end if;

  select exists (
    select 1
    from public.profiles as profile
    where profile.id = p_recipient_id
  )
  into recipient_exists;

  if not recipient_exists then
    raise exception 'friend_not_found';
  end if;

  if current_user_id < p_recipient_id then
    v_user_low_id := current_user_id;
    v_user_high_id := p_recipient_id;
  else
    v_user_low_id := p_recipient_id;
    v_user_high_id := current_user_id;
  end if;

  -- 같은 두 사용자의 동시 요청을 하나의 transaction lock으로 직렬화합니다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_low_id::text || ':' || v_user_high_id::text,
      0
    )
  );

  select friendship.id,
         friendship.status,
         friendship.requester_id,
         friendship.recipient_id
  into existing_id,
       existing_status,
       existing_requester_id,
       existing_recipient_id
  from public.friendships as friendship
  where friendship.user_low_id = v_user_low_id
    and friendship.user_high_id = v_user_high_id
  for update;

  if existing_status = 'pending' then
    if existing_requester_id = current_user_id then
      raise exception 'friend_request_already_pending';
    end if;
    raise exception 'incoming_friend_request_pending';
  end if;

  if existing_status = 'accepted' then
    raise exception 'already_friends';
  end if;

  if existing_id is not null then
    update public.friendships as friendship
    set requester_id = current_user_id,
        recipient_id = p_recipient_id,
        status = 'pending',
        created_at = timezone('utc', now()),
        responded_at = null,
        updated_at = timezone('utc', now())
    where friendship.id = existing_id
    returning friendship.id,
              friendship.status,
              friendship.recipient_id
    into result_id,
         result_status,
         result_recipient_id;

    return query
    select result_id, result_status, result_recipient_id;
    return;
  end if;

  insert into public.friendships as new_friendship (
    requester_id,
    recipient_id,
    user_low_id,
    user_high_id,
    status
  )
  values (
    current_user_id,
    p_recipient_id,
    v_user_low_id,
    v_user_high_id,
    'pending'
  )
  returning new_friendship.id,
            new_friendship.status,
            new_friendship.recipient_id
  into result_id,
       result_status,
       result_recipient_id;

  return query
  select result_id, result_status, result_recipient_id;
end;
$$;

revoke all on function public.send_friend_request(uuid)
from public, anon, authenticated;

grant execute on function public.send_friend_request(uuid)
to authenticated;

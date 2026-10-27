-- 득근이 8-2차: 친구 코드와 친구 관계
-- 전제: 001~005 migration을 먼저 실행합니다.
-- 이 파일은 Supabase SQL Editor에서 사용자가 직접 실행합니다.
-- 기존 profiles, rooms, room_members, workout_records, invitation 데이터는 삭제하지 않습니다.

-- 1. 친구 코드 생성기
-- alphabet 길이에 맞춰 6자를 뽑아 DG-XXXXXX 형식으로 만듭니다.
-- I, O, 0, 1을 제외해 사람이 읽고 입력하기 쉽게 합니다.
create or replace function private.generate_friend_code()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  alphabet_length integer := pg_catalog.char_length(alphabet);
  random_bytes bytea;
  candidate text;
  attempt integer;
  index_value integer;
begin
  for attempt in 1..100 loop
    random_bytes := extensions.gen_random_bytes(6);
    candidate := 'DG-';

    for index_value in 0..5 loop
      candidate := candidate || pg_catalog.substr(
        alphabet,
        (pg_catalog.get_byte(random_bytes, index_value) % alphabet_length) + 1,
        1
      );
    end loop;

    if pg_catalog.char_length(candidate) <> 9 then
      raise exception 'friend_code_format_generation_failed';
    end if;

    if not exists (
      select 1
      from public.profiles as profile
      where profile.friend_code = candidate
    ) then
      return candidate;
    end if;
  end loop;

  raise exception 'friend_code_generation_failed';
end;
$$;

revoke all on function private.generate_friend_code()
from public, anon, authenticated;

-- 2. 기존 profiles에 친구 코드 추가 및 backfill
alter table public.profiles
add column if not exists friend_code text;

-- NULL은 unique index에서 여러 개를 허용하므로, index를 backfill보다 먼저 만듭니다.
create unique index if not exists profiles_friend_code_key
on public.profiles (friend_code);

-- 한 행씩 잠그고 갱신합니다. 드문 unique 충돌은 새 코드를 생성해 재시도합니다.
do $$
declare
  target_profile_id uuid;
  generated_code text;
  attempt integer;
  updated_rows integer;
begin
  loop
    select profile.id
    into target_profile_id
    from public.profiles as profile
    where profile.friend_code is null
    order by profile.id
    limit 1
    for update skip locked;

    exit when not found;

    updated_rows := 0;
    for attempt in 1..100 loop
      generated_code := private.generate_friend_code();
      begin
        update public.profiles as profile
        set friend_code = generated_code
        where profile.id = target_profile_id
          and profile.friend_code is null;

        get diagnostics updated_rows = row_count;
        if updated_rows = 1 then
          exit;
        end if;
      exception
        when unique_violation then
          if attempt = 100 then
            raise exception 'friend_code_generation_failed';
          end if;
      end;
    end loop;

    if updated_rows <> 1 then
      raise exception 'friend_code_generation_failed';
    end if;
  end loop;
end;
$$;

alter table public.profiles
alter column friend_code set not null;

do $$
begin
  alter table public.profiles
  add constraint profiles_friend_code_format
  check (friend_code ~ '^DG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$');
exception
  when duplicate_object then null;
end;
$$;

-- 친구 코드는 사용자가 임의로 바꿀 수 없게 합니다.
revoke update on table public.profiles from authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;

create or replace function private.protect_profile_friend_code()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if old.friend_code is not null
    and new.friend_code is distinct from old.friend_code then
    raise exception 'friend_code_immutable';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_profile_friend_code()
from public, anon, authenticated;

drop trigger if exists profiles_protect_friend_code on public.profiles;
create trigger profiles_protect_friend_code
before update on public.profiles
for each row
execute function private.protect_profile_friend_code();

-- 3. 신규 Auth 사용자 profile 자동 생성 함수 보강
-- 001의 trigger 이름은 그대로 유지하고 함수 본문만 확장합니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  attempt integer;
  violated_constraint text;
begin
  for attempt in 1..10 loop
    begin
      insert into public.profiles (id, display_name, friend_code)
      values (
        new.id,
        coalesce(nullif(pg_catalog.trim(new.raw_user_meta_data ->> 'display_name'), ''), '득근이 사용자'),
        private.generate_friend_code()
      );
      return new;
    exception
      when unique_violation then
        get stacked diagnostics violated_constraint = constraint_name;
        if violated_constraint <> 'profiles_friend_code_key' then
          raise exception 'profile_creation_failed';
        end if;
        if attempt = 10 then
          raise exception 'friend_code_generation_failed';
        end if;
    end;
  end loop;

  raise exception 'profile_creation_failed';
exception
  when others then
    if sqlstate = 'P0001' then
      raise;
    end if;
    raise exception 'profile_creation_failed';
end;
$$;

revoke all on function public.handle_new_user()
from public, anon, authenticated;
grant execute on function public.handle_new_user()
to postgres;

-- 4. 친구 관계
-- 한 쌍의 사용자당 한 행만 유지하고 status로 요청·친구·삭제 상태를 표현합니다.
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  user_low_id uuid not null references public.profiles(id) on delete cascade,
  user_high_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint friendships_different_users check (requester_id <> recipient_id),
  constraint friendships_canonical_pair check (user_low_id < user_high_id),
  constraint friendships_requester_in_pair check (
    (requester_id = user_low_id and recipient_id = user_high_id)
    or (requester_id = user_high_id and recipient_id = user_low_id)
  ),
  constraint friendships_status_allowed check (
    status in ('pending', 'accepted', 'rejected', 'cancelled')
  )
);

create unique index if not exists friendships_pair_key
on public.friendships (user_low_id, user_high_id);

create index if not exists friendships_recipient_status_key
on public.friendships (recipient_id, status);

create index if not exists friendships_requester_status_key
on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

revoke all on table public.friendships from anon, authenticated;
grant select on table public.friendships to authenticated;

drop policy if exists "friendships_select_participant" on public.friendships;
create policy "friendships_select_participant"
on public.friendships
for select
to authenticated
using (
  requester_id = (select auth.uid())
  or recipient_id = (select auth.uid())
);

-- 5. 내 친구 코드 조회
create or replace function public.get_my_friend_code()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  code text;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select profile.friend_code
  into code
  from public.profiles as profile
  where profile.id = current_user_id;

  if code is null then
    raise exception 'missing_profile';
  end if;

  return code;
end;
$$;

revoke all on function public.get_my_friend_code()
from public, anon, authenticated;
grant execute on function public.get_my_friend_code()
to authenticated;

-- 6. 친구 코드로 사용자 검색
-- 이메일과 auth.users 정보는 반환하지 않습니다.
create or replace function public.find_profile_by_friend_code(p_friend_code text)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_friend_code, '')));
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if normalized_code !~ '^DG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$' then
    raise exception 'invalid_friend_code';
  end if;

  return query
  select profile.id, profile.display_name, profile.avatar_url
  from public.profiles as profile
  where profile.friend_code = normalized_code
    and profile.id <> current_user_id;

  if not found then
    raise exception 'friend_not_found';
  end if;
end;
$$;

revoke all on function public.find_profile_by_friend_code(text)
from public, anon, authenticated;
grant execute on function public.find_profile_by_friend_code(text)
to authenticated;

-- 7. 친구 요청 보내기
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
  user_low_id uuid;
  user_high_id uuid;
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
  ) into recipient_exists;

  if not recipient_exists then
    raise exception 'friend_not_found';
  end if;

  if current_user_id < p_recipient_id then
    user_low_id := current_user_id;
    user_high_id := p_recipient_id;
  else
    user_low_id := p_recipient_id;
    user_high_id := current_user_id;
  end if;

  -- 같은 두 사용자의 동시 요청을 하나의 transaction lock으로 직렬화합니다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(user_low_id::text || ':' || user_high_id::text, 0)
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
  where friendship.user_low_id = user_low_id
    and friendship.user_high_id = user_high_id
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
    returning friendship.id, friendship.status, friendship.recipient_id
    into result_id, result_status, result_recipient_id;

    return query select result_id, result_status, result_recipient_id;
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
    user_low_id,
    user_high_id,
    'pending'
  )
  returning new_friendship.id,
            new_friendship.status,
            new_friendship.recipient_id
  into result_id, result_status, result_recipient_id;

  return query select result_id, result_status, result_recipient_id;
end;
$$;

revoke all on function public.send_friend_request(uuid)
from public, anon, authenticated;
grant execute on function public.send_friend_request(uuid)
to authenticated;

-- 8. 받은 친구 요청 수락·거절
create or replace function public.respond_friend_request(
  p_friendship_id uuid,
  p_action text
)
returns table (
  friendship_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
  current_recipient_id uuid;
  next_status text;
  result_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_action not in ('accept', 'reject') then
    raise exception 'invalid_friend_request_action';
  end if;

  next_status := case when p_action = 'accept' then 'accepted' else 'rejected' end;

  select friendship.status, friendship.recipient_id
  into current_status, current_recipient_id
  from public.friendships as friendship
  where friendship.id = p_friendship_id
  for update;

  if current_recipient_id is distinct from current_user_id then
    raise exception 'friend_request_not_recipient';
  end if;

  if current_status <> 'pending' then
    raise exception 'friend_request_not_pending';
  end if;

  update public.friendships as friendship
  set status = next_status,
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where friendship.id = p_friendship_id
  returning friendship.updated_at into result_updated_at;

  return query select p_friendship_id, next_status, result_updated_at;
end;
$$;

revoke all on function public.respond_friend_request(uuid, text)
from public, anon, authenticated;
grant execute on function public.respond_friend_request(uuid, text)
to authenticated;

-- 9. 보낸 친구 요청 취소
create or replace function public.cancel_friend_request(p_friendship_id uuid)
returns table (
  friendship_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
  current_requester_id uuid;
  result_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select friendship.status, friendship.requester_id
  into current_status, current_requester_id
  from public.friendships as friendship
  where friendship.id = p_friendship_id
  for update;

  if current_requester_id is distinct from current_user_id then
    raise exception 'friend_request_not_requester';
  end if;

  if current_status <> 'pending' then
    raise exception 'friend_request_not_pending';
  end if;

  update public.friendships as friendship
  set status = 'cancelled',
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where friendship.id = p_friendship_id
  returning friendship.updated_at into result_updated_at;

  return query select p_friendship_id, 'cancelled', result_updated_at;
end;
$$;

revoke all on function public.cancel_friend_request(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_friend_request(uuid)
to authenticated;

-- 10. 친구 삭제
-- accepted 관계를 cancelled로 바꾸어 재요청과 이력 보존을 모두 지원합니다.
create or replace function public.remove_friend(p_friendship_id uuid)
returns table (
  friendship_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_status text;
  is_participant boolean;
  result_updated_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select friendship.status,
         friendship.requester_id = current_user_id
           or friendship.recipient_id = current_user_id
  into current_status, is_participant
  from public.friendships as friendship
  where friendship.id = p_friendship_id
  for update;

  if not coalesce(is_participant, false) then
    raise exception 'friendship_not_participant';
  end if;

  if current_status <> 'accepted' then
    raise exception 'friendship_not_accepted';
  end if;

  update public.friendships as friendship
  set status = 'cancelled',
      responded_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where friendship.id = p_friendship_id
  returning friendship.updated_at into result_updated_at;

  return query select p_friendship_id, 'cancelled', result_updated_at;
end;
$$;

revoke all on function public.remove_friend(uuid)
from public, anon, authenticated;
grant execute on function public.remove_friend(uuid)
to authenticated;

-- 11. 친구목록 조회
create or replace function public.list_friends()
returns table (
  friendship_id uuid,
  friend_id uuid,
  display_name text,
  avatar_url text,
  friends_since timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select
    friendship.id,
    case
      when friendship.requester_id = (select auth.uid()) then friendship.recipient_id
      else friendship.requester_id
    end,
    profile.display_name,
    profile.avatar_url,
    friendship.responded_at
  from public.friendships as friendship
  join public.profiles as profile
    on profile.id = case
      when friendship.requester_id = (select auth.uid()) then friendship.recipient_id
      else friendship.requester_id
    end
  where friendship.status = 'accepted'
    and (
      friendship.requester_id = (select auth.uid())
      or friendship.recipient_id = (select auth.uid())
    )
  order by profile.display_name;
$$;

revoke all on function public.list_friends()
from public, anon, authenticated;
grant execute on function public.list_friends()
to authenticated;

-- 12. 대기 중인 요청 조회
create or replace function public.list_friend_requests()
returns table (
  friendship_id uuid,
  direction text,
  user_id uuid,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select
    friendship.id,
    case
      when friendship.recipient_id = (select auth.uid()) then 'incoming'
      else 'outgoing'
    end,
    case
      when friendship.recipient_id = (select auth.uid()) then friendship.requester_id
      else friendship.recipient_id
    end,
    profile.display_name,
    profile.avatar_url,
    friendship.created_at
  from public.friendships as friendship
  join public.profiles as profile
    on profile.id = case
      when friendship.recipient_id = (select auth.uid()) then friendship.requester_id
      else friendship.recipient_id
    end
  where friendship.status = 'pending'
    and (
      friendship.requester_id = (select auth.uid())
      or friendship.recipient_id = (select auth.uid())
    )
  order by friendship.created_at desc;
$$;

revoke all on function public.list_friend_requests()
from public, anon, authenticated;
grant execute on function public.list_friend_requests()
to authenticated;

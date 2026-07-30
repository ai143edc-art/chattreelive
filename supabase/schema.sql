-- ============================================================================
--  Chat Tree — Supabase backend schema (source of truth)
-- ----------------------------------------------------------------------------
--  Run this on a fresh Supabase project (SQL Editor) to recreate the full
--  backend: table, Row Level Security, storage buckets + policies, and the
--  RPC functions used for account deletion and public sharing.
--
--  SECURITY MODEL
--    * Every row in user_chats belongs to exactly one auth user (user_id).
--    * RLS ensures a signed-in user can only see / change / delete THEIR rows.
--    * Media lives in a PRIVATE storage bucket, namespaced per-user folder,
--      and is served to the owner via short-lived signed URLs.
--    * Public sharing is opt-in: only rows with a share_token are exposed,
--      and only through the get_shared_chat() function (no direct table read).
-- ============================================================================

-- ---------- Table ----------------------------------------------------------
create table if not exists public.user_chats (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text,
  contact_title text,
  me_name       text,
  model         text,
  theme         text,
  chat_text     text,
  media_map     jsonb default '{}'::jsonb,
  msg_count     integer,
  media_count   integer,
  avatar        text,
  share_token   uuid,
  shared_media  jsonb,
  share_expires_at timestamptz,   -- null = the share link never expires
  category      text,
  created_at    timestamptz not null default now()
);

-- For projects created before these features: add the columns if missing.
alter table public.user_chats add column if not exists category text;
alter table public.user_chats add column if not exists share_expires_at timestamptz;

create index if not exists user_chats_user_id_idx     on public.user_chats (user_id);
create index if not exists user_chats_share_token_idx on public.user_chats (share_token);

-- ---------- Row Level Security ---------------------------------------------
alter table public.user_chats enable row level security;

drop policy if exists "own select" on public.user_chats;
drop policy if exists "own insert" on public.user_chats;
drop policy if exists "own update" on public.user_chats;
drop policy if exists "own delete" on public.user_chats;

create policy "own select" on public.user_chats
  for select to authenticated using (auth.uid() = user_id);
create policy "own insert" on public.user_chats
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own update" on public.user_chats
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own delete" on public.user_chats
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- Storage bucket (private, media-only) ---------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-media', 'user-media', false, 52428800,
        array['image/*','video/*','audio/*','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Users may only touch objects inside a folder named after their own uid.
drop policy if exists "user-media auth insert"  on storage.objects;
drop policy if exists "user-media owner list"   on storage.objects;
drop policy if exists "user-media owner delete" on storage.objects;

create policy "user-media auth insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user-media owner list" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "user-media owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- RPC: delete the caller's own account ---------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to user_chats
end $$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- ---------- RPC: read a chat by its public share token ---------------------
--  Only exposes rows that were explicitly shared (share_token set), and only
--  while the share is still valid (share_expires_at null = never expires).
--  Never leaks user_id, share_token, or private media paths.
create or replace function public.get_shared_chat(token uuid)
returns table (
  title text, contact_title text, me_name text, model text, theme text,
  chat_text text, shared_media jsonb, avatar text, created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if token is null then return; end if;
  return query
    select c.title, c.contact_title, c.me_name, c.model, c.theme,
           c.chat_text, c.shared_media, c.avatar, c.created_at
    from public.user_chats c
    where c.share_token = token
      and (c.share_expires_at is null or c.share_expires_at > now());
end $$;

grant execute on function public.get_shared_chat(uuid) to anon, authenticated;

-- ---------- Abuse control: cap saved chats per user ------------------------
create or replace function public.enforce_chat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_chats constant int := 100;
  cnt int;
begin
  select count(*) into cnt from public.user_chats where user_id = new.user_id;
  if cnt >= max_chats then
    raise exception 'Chat limit reached (% max). Delete an old chat to save a new one.', max_chats
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_enforce_chat_limit on public.user_chats;
create trigger trg_enforce_chat_limit
  before insert on public.user_chats
  for each row execute function public.enforce_chat_limit();

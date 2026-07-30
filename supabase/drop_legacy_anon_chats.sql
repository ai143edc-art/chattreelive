-- Run this in the Supabase SQL editor when you are ready.
--
-- Why: `public.chats` and its two RPCs are the passphrase-based sharing that
-- predates accounts. The app has not referenced any of it for a long time
-- (it uses user_chats + get_shared_chat now), but it is still live and open:
--
--   * policy `anon insert chats` has WITH CHECK (true), so anybody can insert
--     rows into `chats` without signing in — free storage for a spammer.
--   * `get_chats(p text)` is SECURITY DEFINER and callable by `anon` over
--     /rest/v1/rpc/get_chats, so the passphrase can be brute-forced.
--
-- Checked before writing this (2026-07-10):
--   chats holds 0 rows · no foreign key points at it · no view reads it ·
--   no other function references it.
--
-- Re-check right before you run it, in case that has changed:
--
--   select count(*) from public.chats;      -- expect 0
--
-- DROP is not reversible. If you would rather keep the table, run PART B
-- instead of PART A — it closes the same hole and leaves the table in place.

-- ---------------- PART A: remove it (recommended) ----------------
drop function if exists public.get_chat(p text, cid uuid);
drop function if exists public.get_chats(p text);
drop table if exists public.chats;

-- ---------------- PART B: keep the table, close the hole ----------------
-- (run this INSTEAD of Part A, not as well)
--
-- drop policy if exists "anon insert chats" on public.chats;
-- revoke execute on function public.get_chat(text, uuid)  from anon, authenticated;
-- revoke execute on function public.get_chats(text)       from anon, authenticated;

-- ---------------- After either part, confirm ----------------
-- Expect zero rows back:
--
--   select p.proname
--     from pg_proc p
--    where p.pronamespace = 'public'::regnamespace
--      and p.proname in ('get_chat', 'get_chats')
--      and has_function_privilege('anon', p.oid, 'execute');
--
--   select policyname from pg_policies
--    where schemaname = 'public' and tablename = 'chats' and cmd = 'INSERT';

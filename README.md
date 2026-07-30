# 💬 Chat Tree

Create realistic WhatsApp-style chat mockups, or upload and relive your exported
chats — with media, replies, reactions, call logs and more. Save chats privately
to your account and share them with a read-only link.

Built with **React + TypeScript + Vite** on the frontend and **Supabase**
(Postgres + Auth + Storage) on the backend.

---

## Features

- Upload an exported WhatsApp `.txt` / `.zip` chat and view it in a phone frame
- Full edit mode: add/edit/delete messages, reactions, replies, call logs, ticks
- Realistic device frames, light/dark themes, wallpapers, avatars
- Export as PNG or PDF
- Sign up to save chats to a **private** cloud history
- Share any saved chat via a read-only link
- Installable PWA, SEO-ready, fully responsive

---

## Quick start (local)

```bash
npm install
cp .env.example .env      # then fill in your Supabase values
npm run dev
```

The app **will not start** until `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
are set — this is intentional (fail fast instead of shipping broken auth).

### Build

```bash
npm run build     # type-checks then builds to dist/
npm run preview   # preview the production build
```

---

## Backend setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the `user_chats` table, all Row Level Security policies, the
   private `user-media` storage bucket + policies, and the sharing / account
   RPC functions.
3. Copy **Project URL** and the **anon/public** API key from
   *Project Settings → API* into your `.env`.
4. (Recommended) In *Authentication → Providers → Email*, turn on
   **"Leaked password protection"** to block known-compromised passwords.

> The anon key is meant to be public — every data access is enforced by RLS on
> the database. **Never** ship the `service_role` key to the browser.

---

## Deployment

Works out of the box on **Vercel** or **Netlify** (configs included):

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
  in the hosting dashboard.
- Both [`vercel.json`](vercel.json) and [`netlify.toml`](netlify.toml) include
  SPA rewrites and hardened security headers (HSTS, X-Frame-Options, nosniff,
  Referrer-Policy, Permissions-Policy).

---

## Security model

| Concern            | How it's handled                                                        |
|--------------------|-------------------------------------------------------------------------|
| Data isolation     | RLS: a user can only read/write rows where `auth.uid() = user_id`       |
| Media privacy      | Private storage bucket, per-user folders, short-lived signed URLs       |
| Uploads            | Bucket restricted to image/video/audio/pdf, 50 MB max                   |
| Public sharing     | Opt-in only, via `get_shared_chat()` — never exposes user_id or paths   |
| Account deletion   | `delete_own_account()` removes the auth user (cascades to their chats)  |
| Secrets            | Only the public anon key reaches the browser; `.env` is git-ignored     |

---

## Project structure

```
src/
  components/   UI (viewer, toolbar, modals, uploader, error boundary…)
  lib/          supabase client + data layer, parser, stats, exporter, image
  App.tsx       app state + screen routing
supabase/
  schema.sql    full backend (table, RLS, storage, RPCs) — source of truth
```

---

## Disclaimer

Chat Tree is an independent tool and is **not** affiliated with, endorsed by, or
connected to WhatsApp or Meta. WhatsApp is a trademark of Meta Platforms, Inc.
Use responsibly — do not create misleading or fraudulent content.

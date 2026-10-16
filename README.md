# ScreenVault

ScreenVault is my personal series tracker. It started because I wanted something like Letterboxd but for series — a beautiful private library with progress tracking, watchlist, reviews, and diary stats.

## Features

- **Home** — "Continue Watching" recommendation strip + recently completed
- **Library** — full series catalogue with filters: All · Watching · Finished – To Continue · Up to Date
- **Watchlist** — save titles you want to watch in the future
- **Profile** — stats dashboard, profile photo, and settings (sign out)
- **Sync** — Supabase backend syncs data across all your devices
- **PWA** — installable on iPhone via Safari → Add to Home Screen

---

## Tech Stack

### Architecture

The app follows a **single-file component architecture** for the React Native layer, with a **serverless backend** via Supabase (PostgreSQL + Auth + Storage). Deployment is handled automatically by Vercel on every `git push`.

```
┌─────────────────────────────────────────────┐
│  Client  (React Native / Expo Web / PWA)    │
│  App.tsx — all screens and components       │
├─────────────────────────────────────────────┤
│  lib/tmdb.ts       — TMDB REST API client   │
│  lib/supabase.ts   — Supabase JS client     │
├─────────────────────────────────────────────┤
│  Backend (Supabase)                         │
│  ├── PostgreSQL (series_entries, watchlist) │
│  ├── Auth (email + password)                │
│  └── Storage (avatars bucket)               │
├─────────────────────────────────────────────┤
│  External API                               │
│  └── TMDB — movie & series metadata         │
└─────────────────────────────────────────────┘
```

### Languages & Frameworks

| Layer | Technology |
|---|---|
| Language | **TypeScript** |
| UI Framework | **React Native** 0.88 |
| Cross-platform runtime | **Expo** ~58 (SDK 58) |
| Web target | **React Native Web** + Expo Web |
| State management | React built-in (`useState`, `useEffect`, `useMemo`) |
| Local persistence | **AsyncStorage** (`@react-native-async-storage`) |
| Backend / Database | **Supabase** (PostgreSQL + Row Level Security) |
| Auth | **Supabase Auth** (email + password) |
| File storage | **Supabase Storage** (avatars bucket) |
| Movie/series data | **TMDB API** (The Movie Database) |
| Deployment | **Vercel** (static web export via `expo export`) |
| Build tooling | **Metro** (bundler), **TypeScript** compiler |
| Linting | **ESLint** + `eslint-config-expo` |

### Database schema

Two main tables in PostgreSQL (hosted on Supabase):

- **`series_entries`** — user's tracked series/movies with progress, collection status, rating, and review
- **`watchlist`** — titles the user wants to watch in the future

Both tables use **Row Level Security (RLS)** — each user can only read/write their own rows.

---

## Running Locally

```powershell
cd C:\ScreenVault\mobile
npm install
npm start          # Expo dev server (scan QR with Expo Go)
npm run web        # Open in browser at localhost:8081
```

## Running on iPhone (Expo Go)

1. Install **Expo Go** on iPhone.
2. Connect iPhone and PC to the same Wi-Fi network.
3. Run `npm run start -- --lan` and scan the QR code.

## Production Deploy

Vercel watches the connected repository. On every `git push`, it:

1. Runs `expo export --platform web` inside `mobile/`
2. Serves the `mobile/dist/` folder as a static site

The app becomes a PWA — open in Safari and tap **Share → Add to Home Screen**.

---

## Environment Variables

Create `mobile/.env` (never commit this):

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_TMDB_ACCESS_TOKEN=eyJhbGci...
```

Set the same variables in **Vercel → Settings → Environment Variables** for Production and Preview.

---

## Supabase Setup

1. Open **SQL Editor** in your Supabase project and run [`supabase/schema.sql`](supabase/schema.sql).
2. In **Storage**, create a private bucket named `avatars` and apply the storage policies shown (commented) at the bottom of the schema file.
3. In **Authentication → URL Configuration**, add your Vercel production URL to the Redirect URLs list.

---

## Privacy

The repository is public but your library is not. All data is stored in your own Supabase project under your authenticated user ID, protected by Row Level Security. No data is ever visible to other users.

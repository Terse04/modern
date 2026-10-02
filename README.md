<div align="center">
  
# 🎧 Modern — Shared Audio Sanctuary

**A real-time, synchronized social listening platform built for the modern web.**

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react&style=for-the-badge)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&style=for-the-badge)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite&style=for-the-badge)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20%26%20Postgres-3ECF8E?logo=supabase&style=for-the-badge)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&style=for-the-badge)](https://tailwindcss.com/)

> Listen in lockstep with friends, cast frequency visualizers, vote on upcoming tracks, and cultivate shared soundscapes in highly secure, browser-powered listening rooms.

</div>

---

## 🌟 Core Innovations & Architecture

### ⏱️ True Clock-Skew Compensated Audio Sync
- **RTT-Calibrated Precision**: Continuously measures round-trip time (RTT) and calculates device clock skew via ping-pong handshakes, allowing listeners on vastly different OS time zones to stay perfectly synced.
- **Proportional Drift Nudge**: Seamlessly scales listener `playbackRate` proportionally to the drift delta, eliminating audible pitch warping or abrupt jumps.
- **Reliable Seek-on-Load**: Automatically waits for metadata (`canplay`) before attempting programmatic seeks, guaranteeing reliable drop-ins to mid-track sessions.

### 🔒 Enterprise-Grade Security & RLS
- **Private Realtime Channels**: Room playback control events are broadcasted over strict, authenticated private channels (`room:<id>:control` and `:social`), fully preventing unauthorized playback hijacking.
- **Server-Authoritative Administration**: Admin overrides, user bans, and platform settings (like guest limits) are strictly executed via `SECURITY DEFINER` RPCs (`admin_set_user_flags`), making client-side tampering impossible.
- **Protected File Uploads**: Community track uploads are gated by a Vercel serverless endpoint that strictly validates Supabase JWTs, enforces file typing, and utilizes secure signed URLs (`createSignedUrl`).

### ⏭️ Server-Side Democratic Vote-to-Skip
- **Atomic Threshold Execution**: Skip votes are persisted to a dedicated `skip_votes` DB table. Once the threshold is met, the backend atomically advances the room's current track and bumps a `playback_revision` to reject out-of-order/stale client events.
- **Host Override Skip**: Room hosts bypass voting and instantly advance or switch tracks with secure, host-only mutations.
- **Collaborative Queueing**: Listeners can securely up-vote queued tracks via the `toggle_queue_vote` RPC, dynamically resorting the upcoming playlist.

### 🪐 Live Orbiting Avatars & Realtime Presence
- **Dynamic Orbital Ring**: Active room listeners orbit around the turntable record player in real-time.
- **Heartbeat & Presence Tracking**: Detects joins and leaves precisely using Page Lifecycle APIs (`pagehide` / `visibilitychange`) backed by a robust `room_heartbeat` database check.
- **Optimized Avatars**: Custom avatars are strictly downscaled via canvas (to ≤512px) before upload and gated by a 1.5MB database constraint.

### ✨ Premium, Immersive UI & Glassmorphism
- **Dynamic Landing Page**: Asymmetrical hero section featuring a 3D vinyl visualizer and a premium bento grid layout.
- **Fluid & Responsive Design**: Fully responsive, with careful attention to mobile ergonomics (proper handling of 100dvh for iOS Safari safe areas, optimized visualizer margins).
- **Polished Dashboards**: A consistent, premium aesthetic across Join, Create, and Admin interfaces with subtle micro-animations and deep dark modes.

---

## 🛠️ Tech Stack

| Domain | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) (Modular stores for playback, auth, chat) |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) (Glassmorphism theme) + [Lucide React](https://lucide.dev/) |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL 15+, Auth, Realtime, RLS, Storage) |
| **Audio Processing** | Web Audio API (`AudioContext`, Master GainNode, peak extraction) |
| **Cloud Functions** | Vercel Serverless Functions (`/api/upload-url`) |

---

## 📁 Project Architecture & Migrations

```
together/
├── api/                     # Secure Vercel endpoints (JWT verified track uploads)
├── src/
│   ├── components/          # Auth, Layout, Profile, Room, Studio, UI primitives
│   ├── data/                # Mock tracks, fallback demo profiles
│   ├── hooks/               # useRealtimeRoom, useAudioEngine
│   ├── lib/                 # supabaseClient setup & AudioPlayer engine
│   ├── pages/               # Discover, Room, Profile, Login, AdminDashboard
│   ├── services/            # admin, profile, realtime, room, storage, tracks
│   └── stores/              # Zustand state (useAuthStore, usePlaybackStore)
├── supabase/
│   └── migrations/          # Modular, idempotent DB schema & RLS migrations
│       ├── 20260927000000_reset.sql
│       ├── 20260927000100_core_schema.sql
│       ├── 20260927000200_rls_policies.sql
│       ├── 20260927000300_functions_triggers.sql
│       ├── 20260928000000_leave_room.sql
│       ├── 20260928000001_admin_set_user_flags.sql
│       ├── 20260928000002_realtime_auth.sql
│       ├── 20260928000003_storage_policies.sql
│       ├── 20260928000004_skip_votes.sql
│       ├── 20260928000005_profiles_insert_guard.sql
│       └── 20260928000006_avatar_constraint.sql
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or later)
- **npm** or **pnpm**
- A **Supabase** account
- A **Vercel** account (Optional, for deploying `/api` functions)

### 2. Install Dependencies
```bash
git clone https://github.com/Terse04/modern.git
cd modern
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
SUPABASE_SECRET_KEY=your-service-role-key-for-api-only
```
*(The `SUPABASE_SECRET_KEY` is specifically required by the secure `/api/upload-url` Vercel function and is never exposed to the client.)*

### 4. Run Database Migrations
In your Supabase project dashboard, navigate to the **SQL Editor** and run **all** 11 migration files located in `supabase/migrations/` sequentially to ensure complete schema, RLS, and RPC provisioning.

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Starts Vite local development server with hot-reload |
| `npm run build` | Validates TypeScript and builds production bundle to `/dist` |
| `npm run typecheck` | Runs TypeScript compiler verification (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint analysis across codebase |

---

## 🔒 Security Posture & Hardening

This project incorporates deep security measures:
- **No Client Trust**: Client states (like `isHost` or `isAdmin` from `localStorage`) are exclusively used for UI/UX masking. True authorizations happen on the Database via RLS policies and Server-side RPCs.
- **Signed Storage URLs**: Audio chunks are secured inside private Supabase buckets. Read access is gated using dynamic signed URLs (`createSignedUrl`), tied to `room_members` visibility.
- **Stale Event Rejection**: All playback synchronization events carry a `playback_revision` tag. Events arriving out of order are cleanly dropped.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).

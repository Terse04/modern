# Modern 🎧 — Shared Audio Sanctuary

> **A real-time, synchronized social listening platform.** Listen in lockstep with friends, cast frequency visualizers, vote on upcoming tracks, and cultivate shared soundscapes in browser-powered listening rooms.

[![React](https://img.shields.io/badge/React-19.0-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2-646CFF?logo=vite)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20%26%20Postgres-3ECF8E?logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Key Features

### ⏱️ Sub-Frame Audio Synchronization Engine
- **Web Audio Drift Compensation**: Continuously samples host playback timestamps and subtly scales listener `playbackRate` to eliminate audio drift without audible pitch warping or abrupt jumps.
- **Latency Buffering Modes**: Configurable sync presets:
  - **Ultra-Low** (`< 20ms`): Immediate sync for local and ultra-fast connections.
  - **Balanced** (`~ 50ms`): Recommended default for smooth multi-region listening.
  - **Hi-Fi Buffer**: Eliminates micro-stutters over fluctuating networks.
- **BroadcastChannel & Realtime Fallback**: Supports both multi-tab local listening via `BroadcastChannel` and global remote synchronization over Supabase Realtime.

### 🪐 Live Orbiting Avatars & Realtime Presence
- **Dynamic Orbital Ring**: Active room listeners orbit around the turntable record player in real-time.
- **Member Popovers**: Click any participant avatar to view their Sound Identity card, host badge, live listening status, and link to their public profile.
- **Heartbeat & Presence Tracking**: Detects joins, leaves, and unexpected disconnects with automatic un-tracking on tab close.

### ⏭️ Democratic Vote-to-Skip & Collaborative Queue
- **Majority Vote-to-Skip**: Listeners can cast skip votes (`skipVotes / requiredVotes` badge); tracks automatically advance once `Math.ceil(members / 2)` agree to skip.
- **Host Override Skip**: Room hosts can bypass voting and instantly advance or switch tracks.
- **Host Queue Reordering**: Move tracks up or down in the upcoming playlist or remove unwanted items directly from the queue bottom sheet.

### 👑 Admin Dashboard & Platform Governance
- **Centralized Administration** (`/admin`): Restricted via `RequireAdmin` route guards and database-level RLS privilege checks.
- **User Management**: Search users, toggle account bans, elevate listener roles (`listener` → `admin`), and review user metrics.
- **System Maintenance & Controls**: Toggle platform maintenance mode, configure guest daily room limits (default: 5/day), and manage streaming bitrate limits.

### 🎨 Sound Identity & Profile Customization
- **Curated Avatar Presets**: 10 handpicked aesthetic avatars (Lo-Fi Chill, Studio Producer, Neon Beats, Audiophile, Vinyl Master, Synthwave, etc.).
- **Custom Avatar Upload**: Drag-and-drop file uploader with instant client-side preview and size validation (< 5MB), plus direct image URL support.
- **Status Chips & Bio**: Express your current vibe (*"Deep focus coding flow"*, *"Exploring ambient soundscapes"*) and showcase listening stats.
- **Self-Healing Auth**: Automatic profile creation and repair if a database profile row was previously removed.

### 💬 Synchronized Room Chat & Emoji Bursts
- **Low-Latency Chat**: Integrated room messaging with timestamps and host distinction badges.
- **Floating Reactions**: Listeners can burst animated emojis that float upwards with physics-based random trajectories across all listeners' viewports.

---

## 🛠️ Tech Stack

| Domain | Technology |
|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict Mode) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) (Modular stores for playback, auth, chat, toast) |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) (Custom glassmorphism theme) + [Lucide React](https://lucide.dev/) |
| **Backend & Database** | [Supabase](https://supabase.com/) (PostgreSQL 15+, Auth, Realtime, Row Level Security) |
| **Audio Processing** | Web Audio API (`AudioContext`, gain nodes, peak extraction, drift correction) |
| **Local Storage** | IndexedDB for offline audio blobs + `localStorage` for session resilience |

---

## 📁 Project Architecture

```
together/
├── src/
│   ├── components/
│   │   ├── auth/            # AuthModal, RequireAdmin guard
│   │   ├── layout/          # Navbar, MobileNav, Footer
│   │   ├── profile/         # EditProfileModal, avatar presets
│   │   ├── room/            # VinylPlayer, OrbitingParticipants, SyncControlHUD, RoomChat
│   │   ├── studio/          # AudioUploadModal, track inspector
│   │   └── ui/              # Button, Toast, Modal primitives
│   ├── data/                # Mock tracks, fallback demo profiles
│   ├── hooks/               # useRealtimeRoom, useAudioEngine
│   ├── lib/                 # supabaseClient setup & credentials
│   ├── pages/               # DiscoverPage, RoomPage, ProfilePage, LoginPage, AdminDashboardPage
│   ├── services/            # adminService, profileService, realtimeService, roomService, trackService
│   ├── stores/              # useAuthStore, usePlaybackStore, useRoomStore
│   ├── types/               # TypeScript interfaces (User, Room, Track, SyncEvent)
│   └── utils/               # audioMetadata, timeFormatters, waveform
├── supabase/
│   └── migrations/          # Modular, idempotent database schema & RLS migrations
│       ├── 20260927000000_reset.sql
│       ├── 20260927000100_core_schema.sql
│       ├── 20260927000200_rls_policies.sql
│       └── 20260927000300_functions_triggers.sql
├── public/                  # Lightweight demo audio tracks & ambient soundscapes
├── package.json
└── vite.config.ts
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or later)
- **npm** or **pnpm**
- A **Supabase** account (Free tier works perfectly)

### 2. Clone the Repository
```bash
git clone https://github.com/Terse04/modern.git
cd modern
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
```

> **Note**: If Supabase variables are left empty or unconfigured, Modern automatically runs in **Offline / Demo Mode**, enabling local audio playback, demo personas, and multi-tab sync via `BroadcastChannel`.

### 5. Run Database Migrations (Supabase)
In your Supabase project dashboard, navigate to the **SQL Editor** and run the migration files located in `supabase/migrations/` in sequential order:
1. `20260927000000_reset.sql` — Cleans up legacy schemas and conflicting triggers.
2. `20260927000100_core_schema.sql` — Creates `profiles`, `rooms`, `tracks`, `queue_items`, `room_members`.
3. `20260927000200_rls_policies.sql` — Authoritative Row Level Security policies.
4. `20260927000300_functions_triggers.sql` — Auto-creates profile on sign-up, privilege guard triggers, and stats aggregators.

### 6. Start the Development Server
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
| `npm run preview` | Previews the production build locally |
| `npm run typecheck` | Runs TypeScript compiler verification (`tsc --noEmit`) |
| `npm run lint` | Runs ESLint analysis across codebase |

---

## 🔒 Security & Row Level Security (RLS)

- **Column Privilege Guards**: Sensitive flags like `is_admin`, `is_banned`, and `role` are guarded by PostgreSQL `BEFORE UPDATE` triggers executing with `SECURITY DEFINER`. Normal users cannot elevate their own privileges via client-side updates.
- **Safe Dynamic Redirects**: All login query redirects (`?redirect=`) are strictly sanitised to prevent open-redirect vulnerabilities.
- **Idempotent Self-Repair**: Authenticated sessions missing a `profiles` row automatically trigger client upserts with conflict resolution.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

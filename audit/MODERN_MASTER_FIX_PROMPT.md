# MODERN — MASTER FIX PROMPT

Paste this into Claude Code / Claude / Antigravity together with the project source and `MODERN_AUDIT_REPORT.md`.

---

## ROLE

Act as a Principal Full-Stack Engineer taking **Modern** (React 19, TypeScript, Vite, Zustand, Supabase Auth/Postgres/Realtime/RLS, Web Audio API) from its current state to production reliability.

## INPUT

1. The Modern source code (repo `Terse04/modern`).
2. `MODERN_AUDIT_REPORT.md` (bug registry BUG-01 … BUG-26, plus §0).

The audit is a **diagnostic document, not unquestionable truth.** Before changing anything for a bug, open the cited files and confirm the problem still exists in the current source. If it doesn't reproduce, say so and skip it. Where the audit says INFERRED or REQUIRES RUNTIME VERIFICATION, state how you verified it (or that you couldn't).

## HARD RULES

DO NOT: rewrite the app; replace Supabase, Zustand, or the Web Audio approach; add dependencies without justification; remove offline/demo mode; weaken RLS or disable security controls to make a feature work; run destructive migrations (no `drop schema`, no data deletion); use or print any secret found in the repo.

DO: fix root causes with minimal production-safe diffs; enforce security at the server/DB boundary, never only in React/UI/localStorage; make realtime operations idempotent; keep TypeScript strict; add new SQL as a **new migration file** (`20260928…_*.sql`), never by editing applied migrations.

---

## PHASE 0 — SECRETS (do first, before any code)

**§0 — Leaked Supabase secret key.**
- In `api/upload-url.ts`, delete the hardcoded fallback literal for `secretKey` and the hardcoded fallback project URL. Read only `process.env.SUPABASE_SECRET_KEY` / `process.env.SUPABASE_URL`; if missing, return HTTP 500 and log a config error (fail closed).
- Do NOT write the key anywhere else. Add a note in your final report telling me to (a) rotate the secret key in Supabase → Project Settings → API, (b) update it in Vercel env vars, (c) treat the old key as public regardless of history rewriting.
- Confirm `.env` stays in `.gitignore`; add `.env.*` except `.env.example`. Add a `scripts/check-secrets.cjs` (or a simple grep step documented in README) that fails if `sb_secret_` followed by a non-placeholder appears in tracked files.

## PHASE 1 — P0 FIXES

**BUG-11 — Unauthenticated `/api/upload-url`.**
Require `Authorization: Bearer <supabase JWT>`; verify with `supabase.auth.getUser(token)` using the server client. Reject anonymous callers (401). Ignore the client-supplied `path` beyond a sanitized filename: build the path server-side as `${profileId}/${Date.now()}_${sanitizedName}` where `profileId` is resolved from the verified user's `profiles.auth_user_id`. Restrict CORS to the app origin (env `VITE_APP_URL`), not `*`. Cap filename length; validate extension/MIME allowlist matching the bucket. Update `storageService.uploadTrack()` to send the session access token and to use the returned path.

**BUG-01 — Room creation always inserts `host_id: null`.**
In `roomService.createRoom()` remove the `isUuid()` sniffing. For an authenticated user, insert with `host_id: hostUser.id` (this is already `profiles.id`). For guests (no Supabase session), call `supabase.rpc('create_room_guest', {...})` with a stable client fingerprint (generate once, persist in localStorage, matches `^[a-zA-Z0-9_-]{8,128}$`), and use the returned `room_id` / `profile_id`. **Stop swallowing errors**: if the insert/RPC fails, throw, and make `CreateRoomPage` show the error and NOT navigate. Only use the in-memory `roomsStore` path when `!isSupabaseConfigured` (demo mode). Remove the dead `if (dbHostId)` retry.

**BUG-02 — `joinRoom` never writes `room_members`.**
Replace the `isUuid` guard: for authenticated users call `supabase.rpc('join_room', { p_room_id })`; on error, surface it (capacity full, banned, not visible). Guests stay presence-only. Keep demo-mode behavior unchanged. Also add a `leave_room(p_room_id)` SECURITY DEFINER RPC (new migration) that deletes the caller's row and recomputes `rooms.listener_count`, and call it on leave/unmount.

**BUG-03 — No server-side authority on realtime playback.**
Two layers:
1. *Store-level guard:* in `usePlaybackStore`, `play/pause/seek/setTrack/nextTrack/previousTrack` and the `onEnded` repeat path must only broadcast when `get().isHost` (or, when `room.settings.playbackPermissions === 'everyone'`, when the caller is a verified member). Non-hosts apply locally only where that makes sense (BUG-16).
2. *Transport-level enforcement:* migrate the room channel to a **private** Supabase Realtime channel (`supabase.channel('room:'+id, { config: { private: true, broadcast: { self: false } } })`) and add a new migration with RLS policies on `realtime.messages` so that: any authenticated member/visible-room user may SELECT (receive) on `room:<id>`; INSERT (send) is allowed only for the room host/admin (`can_host_room(<id>)`) for playback events, and for members for chat/reaction/presence. Because policies can't inspect event names easily, split into two topics: `room:<id>:control` (host-only send) and `room:<id>:social` (member send). Update `realtimeService` to subscribe to both and route event types accordingly. Verify against current Supabase Realtime Authorization docs before writing the policy syntax (web search if needed). Keep BroadcastChannel and demo mode working when Supabase isn't configured.

**BUG-09 — Admin ban/promote silently no-ops.**
New migration: `admin_set_user_flags(p_user_id text, p_is_banned boolean default null, p_role text default null, p_is_admin boolean default null)` — `SECURITY DEFINER`, `set search_path = public`, first line `if not public.is_admin() then raise exception ... 42501`, refuse to let an admin change their own `is_admin`/`is_banned`, validate `p_role` against the CHECK list, `grant execute ... to authenticated`. Change `adminService.updateUser()` to call it and to **return false with the error message** on failure; never treat "no error" as success without checking the RPC result. Also make `deleteUser`, `toggleRoomLive`, `deleteRoom`, `deleteTrack`, `updateRoomVisibility` use `.select()` and treat zero returned rows as failure.

## PHASE 2 — P1 FIXES

**BUG-06 — Queue vote dead in Supabase mode.**
`roomService.voteQueueItem()`: when Supabase is configured, call `supabase.rpc('toggle_queue_vote', { p_queue_item_id })`, return the boolean, and re-fetch (or locally patch) the item's `votes`/`hasVoted`. Only touch `queueStore` in demo mode. In `getRoomQueue()`, populate `hasVoted` from the caller's own `queue_votes` rows (allowed by `queue_votes_select_own`). Note the current `getRoomQueue` returns `queueStore` fallback when the DB returns an empty array — fix so an empty real queue isn't replaced by demo data.

**BUG-07 / BUG-08 — Uploads unplayable.**
Decide one design and implement fully:
- Store the **storage path** in `tracks.audio_url` (or new nullable `audio_path` column via additive migration), never a public URL.
- Upload to `${profileId}/${...}` (matches the policy's folder check).
- Add a migration extending the storage SELECT policy: allow read when the object is referenced by a `tracks` row that appears in a `queue_items` row of a room where `can_see_room(room_id)` is true (join `tracks.audio_url`/`audio_path` = `storage.objects.name`).
- Add `trackService.resolvePlayableUrl(track)` that calls `createSignedUrl(path, 3600)` (cache with expiry ~50 min, re-sign on `audio` error/expiry) and use it in `setTrack`, `initRoom`, `syncFromRemoteEvent`, `resyncNow` before `loadTrack`.
- Remove the `getPublicUrl()` calls. Stop writing `blob:` URLs into the shared `tracks` table (keep them local-only, never insert into DB); for the `data:` fallback, don't persist to DB either.
- Enforce audio MIME/extension/size (50 MB) server-side (bucket already does; also validate in the API route from BUG-11).

**BUG-05 — Vote-to-skip.**
New migration: table `skip_votes (room_id, track_id, user_id, created_at, primary key (room_id, track_id, user_id))` with RLS (insert/delete own, select for visible rooms) and RPC `vote_skip(p_room_id text)` — SECURITY DEFINER: resolve caller via `current_profile_id()`, require membership/visibility and non-banned, insert vote (idempotent), compute threshold **server-side** from a defined member set (`room_members` rows with `last_seen_at` within the last N seconds — add a `room_heartbeat(p_room_id)` RPC that touches `last_seen_at`), and if threshold reached, atomically advance `rooms.current_track_id`, bump a new `rooms.playback_revision`, and clear that track's votes, exactly once (use `select ... for update` on the room row). Return `{ voted, threshold, votes, advanced, current_track_id, revision }`. The client then broadcasts/receives a *result* (from the host client or via `postgres_changes` on `rooms`), not a self-asserted skip. Replace client-side `voteSkip` tally/threshold logic; `SKIP_VOTE` handler must merge (union) if it remains for display purposes. Keep the host's direct-skip path.

**BUG-13 — Stale/out-of-order realtime events.**
Add `rooms.playback_revision bigint not null default 0` (additive migration). Host-side mutations bump it via RPC (`set_playback_state(p_room_id, p_track_id, p_status, p_position, p_client_ts)` — host/admin only, returns new revision and server `now()`); events carry `{revision}` from that RPC. In `syncFromRemoteEvent`, drop any event with `revision <= get().revision` for the same room (reset the local revision on `initRoom`). Remove the per-client `revisionCounters` or restrict it to local ids only. Also dedupe by `event.id` using a small LRU set.

**BUG-04 — Clock skew / fake latency.**
Implement clock-offset estimation in `realtimeService`: a `estimateClockOffset(roomId)` that performs N (e.g. 5–8) ping/pong exchanges over the control channel or via an RPC `server_time()` returning `extract(epoch from clock_timestamp())*1000`; use the min-RTT sample: `offset = serverTime + rtt/2 - Date.now()`, keep a rolling median, refresh every ~60s and on reconnect. Host stamps events with `serverTime = Date.now() + offset` (server-clock ms); `calculateExpectedPosition` uses `(Date.now() + offset) - serverTimestamp`. Replace the `Math.random()` latency with the measured half-RTT and expose it in `driftMetrics`. Re-evaluate the 120 ms / 1500 ms thresholds using `performance.now()`-based elapsed time for local measurement where possible. Add unit-level reasoning (or vitest tests if adding vitest is acceptable) for: constant skew of ±2 s converges; asymmetric latency stays bounded.

**BUG-14 — Seek before metadata loaded.**
Make `AudioEngine.loadTrack()` return a Promise resolving on `loadedmetadata`/`canplay` (with timeout + error rejection, and a token to ignore superseded loads). Add `loadAndSeek(url, positionSeconds, autoPlay)`. Use it in `resyncNow`, `SYNC_HEARTBEAT`, `PLAY`, and `TRACK_CHANGE` (which should also honor `payload.position`). `resyncNow` must await the track fetch/load before seeking, and must not seek the old track.

## PHASE 3 — P2 / HARDENING

**BUG-17 — profiles INSERT gap.** New migration: drop/recreate `profiles_insert_own` adding `and is_admin = false and is_banned = false and role = 'listener'`; additionally add a `BEFORE INSERT` guard trigger (same pattern as `guard_profile_privileges`) that forces those columns to defaults unless `public.is_admin()`. Do not break `handle_new_user()` or `create_room_guest()` (both SECURITY DEFINER; verify the trigger doesn't reject their inserts — they insert defaults).

**BUG-18 — Trusting localStorage identity.** In `useAuthStore`, `getStoredUser()` must strip/ignore `isAdmin`, `isBanned`, `role`, `isHost`, and validate shape (string id/username/name/avatar). Persist only `id/username/name/avatar` for guests. `updateCurrentUser` must reject privileged keys. On sign-out and on sign-in-as-different-account, reset playback store (`currentRoomId`, `skipVotes`, `lastHeartbeat`, `isHost`), realtime channels, and any per-user cached state.

**BUG-10 — Platform settings.** `adminService.get/updatePlatformSettings` → read/write the `platform_settings` row (id=1) via supabase (mapping snake_case ↔ camelCase), falling back to localStorage only when Supabase isn't configured. Make `maintenance_mode` actually enforced: RLS or RPC checks for room creation/join when `maintenance_mode` is true and caller isn't admin; and the client shows a maintenance banner.

**BUG-16 — Repeat broadcast.** Covered by BUG-03 store guard; add an explicit test: non-host `onEnded` with repeat on → no broadcast.

**BUG-19 — Presence.** Use `pagehide` + `visibilitychange` in addition to `beforeunload`. Make Supabase Presence the single source of truth for "who's here"; remove or clearly demote the custom `PRESENCE_SYNC` broadcast path (keep only for demo/BroadcastChannel mode). Call `room_heartbeat` (BUG-05) on an interval for DB-backed membership; add a server-side stale-member sweep (pg_cron or lazy cleanup inside `join_room`/`vote_skip`).

**BUG-15 — Synth fallback pause.** Route synth output through a master `GainNode`; `pause()` ramps it to 0 (`setTargetAtTime`), `play()` ramps back; `stopSynthFallback()` on any successful real load.

**BUG-12 — Nudge shape.** Replace the fixed 1.04/0.96 with a proportional rate: `rate = 1 + clamp(-driftMs/4000, -0.03, 0.03)` (tune), applied via a short ramp (update at most every ~250 ms with slew limiting), hysteresis on the 120 ms boundary (enter at 120 ms, exit at 40 ms). Never oscillate: add a minimum dwell time. Confirm `audio.preservesPitch = true` explicitly.

**BUG-20 — Avatar.** Add `check (length(avatar) <= 1500000)` on `profiles.avatar` (additive; verify existing rows first — do not fail the migration on existing large rows; use `not valid` then validate after cleanup), and downscale to ≤512px on the client via canvas before saving.

## PHASE 4 — LOW PRIORITY

BUG-21 (use `position` in TRACK_CHANGE — covered in BUG-14), BUG-22 (make `nextTrack/previousTrack` robust when current track isn't in queue: define explicit "now playing" vs "upcoming" semantics and add tests), BUG-23 (route-level `React.lazy` code splitting for Admin/Profile/Create pages), BUG-24 (make `npm run lint` pass: replace `any` with proper types or narrowly-scoped disables, replace empty `catch {}` with at least `console.warn` in dev; do not weaken the ESLint config), BUG-25 (make self-repair use the same `'usr_' + 12 hex` id convention — or better, have repair call a SECURITY DEFINER `ensure_my_profile()` RPC so the client never chooses ids and never writes privileged columns), BUG-26 (documented in code comments once BUG-05 lands).

---

## SECURITY REQUIREMENTS (apply to every change)

- Every mutation that affects shared/protected state is authorized at the DB (RLS / SECURITY DEFINER RPC with `set search_path = public` and an explicit `auth.uid()`-derived identity) or in a server function that verifies the JWT. UI hiding and client-side role checks are never sufficient.
- New SECURITY DEFINER functions: pinned `search_path`, validate every argument, never accept a user id from the client, `revoke all ... from public` then grant to the minimum role.
- Preserve `guard_profile_privileges`, all existing RLS, and `handle_new_user`.

## DATABASE REQUIREMENTS

New migrations only, idempotent (`create or replace`, `if not exists`, `drop policy if exists`), additive columns, no data loss. After writing, re-read every policy touching each table and list the resulting policy set per table in your report.

## VERIFICATION (run after implementing)

```bash
npm install
npm run typecheck
npm run lint
npm run build
```
Add tests only if you introduce a test runner (vitest is acceptable) — at minimum cover: drift/clock-offset math, revision rejection, `safeRedirect`, non-host broadcast guard, `getStoredUser` sanitization. Then reason through each workflow again: auth (signup/login/refresh/logout → login as different user: every store reset), profile create/repair, room create (auth + guest), join/leave, presence, host controls, play/pause/resume, drift correction, queue add/reorder/remove/vote, skip vote (concurrent voters → exactly one advance), chat, reactions, admin (ban/promote/settings actually change DB), RLS, offline/demo mode, BroadcastChannel multi-tab, mobile (`pagehide`, AudioContext resume on gesture).

Label everything you can't run against a live Supabase project as **REQUIRES RUNTIME VERIFICATION**, and provide the exact SQL / manual steps I should run in the Supabase SQL editor to verify each RLS/RPC change (e.g. an anon-key `insert into profiles ... is_admin = true` must now fail).

## FINAL FIX REPORT FORMAT

**Fixed** — table: Bug | Root Cause | Fix | Files | Verification
**Not Fixed** — and why
**New Issues Discovered**
**Regression Risks**
**Verification** — Typecheck / Lint / Build / Tests / Database / Realtime / Audio / Security
**Remaining Production Blockers** — genuine blockers only, including the manual key rotation from Phase 0

## ABSOLUTE FINAL RULES

Code exists ≠ feature works. Build passes ≠ production-ready. One client works ≠ distributed system works. Audio plays ≠ audio stays synchronized. RLS exists ≠ RLS protects every resource. Trace it, prove it, or label it unverified.

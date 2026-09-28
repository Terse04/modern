# Modern 🎧 — Deep Production Audit

Audited artifact: `together_-_Copy_1.zip` (repo `Terse04/modern`, HEAD `e04411c`).
Method: full static read of every source file, every migration, `git log -p`
history search, and actual execution of `npm install`, `npm run typecheck`,
`npm run lint`, `npm run build` inside a sandboxed container. No network
calls were made to the live Supabase project or to GitHub with the
credentials found in the repo.

Labels used below: **VERIFIED** = read in source / reproduced by running a
command. **INFERRED** = derived from code logic, not executed against a live
DB. **REQUIRES RUNTIME VERIFICATION** = needs a live Supabase project to
confirm.

---

## 0. STOP — Immediate action item, separate from the audit

Your uploaded project contains **live, active Supabase credentials**,
including a **secret key** (service-role equivalent). This is not a
hypothetical finding — it's an operational incident:

- `.env` (not committed, but present in the ZIP you uploaded) contains
  `SUPABASE_SECRET_KEY=sb_secret_Kk163O-7QqYrY--UgibG6A_o286NMKx` for
  project `lvudbyfktpymccdskmtf.supabase.co`. **VERIFIED**
- That exact key is **hardcoded as a literal fallback string** in
  `api/upload-url.ts` line 12, and that file **is committed to git**, present
  in your last two commits (`367028a`, `e04411c`), with `origin` pointing at
  `https://github.com/Terse04/modern.git`. **VERIFIED** (`git log --all -p`,
  `git rev-list --all | xargs git grep`)
- `.env` itself is correctly git-ignored and not tracked — that part is fine.
  The problem is the key living in a *tracked source file*, not the env file.

**Do this now, independent of anything else in this report:** rotate the
Supabase secret key (Project Settings → API), remove the hardcoded fallback
from `api/upload-url.ts`, and if this repository has ever been pushed to a
non-private GitHub remote, treat the old key as fully public and rotated-only
(git history rewrite doesn't undo exposure that already happened). I have not
used this key for anything beyond confirming it's the same string that
appears in your `.env`.

---

## A. Executive Summary

**Honest state: this is a well-intentioned, partially-hardened prototype
that is not safe or functional to run against a real Supabase backend
today.** The RLS layer and several migration comments show real, competent
security work — someone clearly went through a previous incident (`Anyone
can update profiles using (true)`, documented in
`20260927000000_reset.sql`) and fixed it properly at the database layer.
But the **application code was never updated to match the new schema and
new RPC-based mutation model**, and the **realtime transport layer has
no authorization at all**. The result is a system where the database is
reasonably strict and the frontend routinely tries to do things that
database now correctly refuses — silently, with the UI reporting success.

What's genuinely solid:
- RLS policy design on `profiles`/`rooms`/`queue_items`/`chat_messages` is
  well thought out and the privilege-guard trigger pattern (BEFORE UPDATE,
  SECURITY DEFINER) is the correct way to do column-level protection in
  Postgres.
- `safeRedirect()` in `LoginPage.tsx` is a genuinely correct open-redirect
  guard.
- The project typechecks and builds cleanly (`tsc -b`, `vite build`) —
  **VERIFIED**.
- Chat message rendering uses JSX text interpolation, not
  `dangerouslySetInnerHTML` — no stored-XSS in chat. **VERIFIED**.

What's fragile or actively broken:
- **Room creation does not work against the real database, for any user,
  ever**, because of a stale UUID-format check left over from a schema
  migration (BUG-01). This is the single most important flow in the app.
- Queue up-voting, guest room creation, and authenticated room joining all
  have server-side RPCs built for them that **the frontend never calls**
  (`grep -rn "\.rpc(" src/` → zero matches, VERIFIED). The client instead
  uses legacy code paths the migration's own comments say are broken.
- Real-time playback (play/pause/seek/track-change/skip-vote) has **no
  server-side authorization whatsoever**. Any client with the public anon
  key can broadcast into any room and hijack playback, and the "am I host"
  check driving the UI is a client-side string comparison against
  forgeable local state.
- The "sub-frame audio synchronization" claim doesn't hold up: the whole
  drift model diffs two independent devices' wall clocks with no clock-skew
  or network-latency compensation, and the reported "latency" is a random
  number, not a measurement.
- Community track uploads are stored with URLs that don't work: the
  storage bucket is private, but the code still calls `getPublicUrl()`
  (the migration's own comment flags this as an unfixed, known breaking
  change).
- The Admin Dashboard's "ban user" / "promote to admin" actions silently
  no-op against a real database (no RLS policy permits admin-on-other's
  profile UPDATEs), and its platform-settings panel (maintenance mode,
  guest limits) is pure `localStorage` — completely disconnected from the
  `platform_settings` table the rest of the backend actually reads.

What's dangerous: the hardcoded secret key (see §0), and the fully
unauthenticated `/api/upload-url` endpoint that hands out admin-signed
storage upload URLs to anyone, no login required.

What's likely to fail in real usage: literally the first thing a new user
does — create a room — plus every feature that depends on the
`room_members` table being populated (it never gets a row per listener, for
the same root-cause bug as room creation).

---

## B. Architecture Map (as actually implemented, not as documented)

```
Auth (Supabase Auth) ──> handle_new_user() trigger ──> profiles row
                                                         (id = 'usr_' + 12 hex, TEXT)
                                                         (auth_user_id = real UUID)
        │
        ▼
useAuthStore (Zustand) ──> currentUser, persisted verbatim to
                            localStorage['modern_active_user'] on every
                            change, restored verbatim on boot before any
                            server round-trip resolves.
        │
        ▼
roomService.createRoom() ──> checks isUuid(currentUser.id) to decide
                              host_id. currentUser.id is ALWAYS the TEXT
                              profile id, NEVER a UUID under the current
                              schema → host_id is ALWAYS null →
                              rooms_insert_own_host RLS policy
                              (host_id = current_profile_id()) ALWAYS
                              rejects the insert. Error is caught and
                              swallowed; app proceeds on an in-memory
                              fallback array that isn't visible to anyone
                              else and doesn't survive reload.
        │
        ▼
RoomPage ──> usePlaybackStore.initRoom() ──> realtimeService.subscribeToRoom()
                                              ├─ BroadcastChannel (same
                                              │  browser, cross-tab)
                                              └─ supabase.channel('room:{id}')
                                                 broadcast + presence,
                                                 NO channel-level
                                                 authorization, NO RLS
                                                 (Realtime Broadcast is not
                                                 a Postgres table and isn't
                                                 covered by any policy here)
        │
        ▼
Any subscriber to 'room:{id}' can send PLAY / PAUSE / SEEK / TRACK_CHANGE /
SYNC_HEARTBEAT / SKIP_VOTE / QUEUE_UPDATE. Every receiving client applies
these unconditionally (no isHost check, no server check, no
sequence-number/staleness check on the fake per-client "revision" counter).
        │
        ▼
usePlaybackStore.syncFromRemoteEvent() ──> realtimeService.calculateExpectedPosition()
      elapsed = (Date.now()[receiver] - serverTimestamp[sender's Date.now()]) / 1000
      → drifts by exactly however much the two devices' system clocks disagree,
        forever, with zero correction for that skew.
        │
        ▼
AudioEngine.applyDriftCorrection() ──> fixed ±4% playbackRate nudge or a hard
                                        seek, no proportional scaling, no
                                        smoothing/ramp.
```

Parallel, disconnected persistence layers that don't talk to each other:
- `room_members` (Postgres table) — essentially never written for listeners
  (see BUG-01/BUG-02); only the host gets a row, via a DB trigger.
- Supabase Realtime **Presence** — ephemeral, per-connection, ungated by RLS
  or membership; this is what `members.length` (vote-skip threshold,
  listener count) actually reads.
- A custom `'PRESENCE_SYNC'` **broadcast** event type, layered on top of the
  above, maintained independently by the client.
- `queue_items`/`queue_votes` (Postgres, RPC-guarded) vs. an entirely
  separate in-memory `skipVotes: string[]` array in `usePlaybackStore`
  broadcast over the same unauthenticated channel — two unrelated "voting"
  systems that share a name in the README but not a data model.

---

## C. Feature Health Matrix

| Feature | Status | Severity | Main Risk |
|---|---|---|---|
| Room creation (Supabase mode) | **Broken** | P0 | `host_id` always null → RLS rejects insert; UI reports success anyway (BUG-01) |
| Guest room creation | **Broken** | P0 | Same root cause as above; `create_room_guest()` RPC exists but is never called (BUG-01) |
| Room joining (listener → `room_members`) | **Broken** | P0 | Legacy `isUuid()` guard skips the insert for every current ID format (BUG-02) |
| Play / Pause / Seek / Skip (host controls) | **Insecure** | P0 | No server authorization; any client can broadcast; "isHost" is a forgeable client string compare (BUG-03) |
| Audio drift correction | **Ineffective / misleading** | P0/P1 | Wall-clock diff with no clock-skew or latency compensation; "latency" is `Math.random()` (BUG-04) |
| Vote-to-skip | **Unreliable** | P1 | Client-only vote tally, overwrite-not-merge on receipt, no shared threshold, can double-fire (BUG-05) |
| Queue up-vote | **Broken (Supabase mode)** | P1 | `voteQueueItem()` checks an in-memory store that's never populated in Supabase mode → always returns null (BUG-06) |
| Community track upload | **Broken for playback** | P0/P1 | `getPublicUrl()` on a private bucket; storage READ policy also doesn't cover other room members (BUG-07/BUG-08) |
| Admin: ban / unban / promote user | **Silently no-ops** | P0/P1 | No RLS UPDATE policy lets an admin modify another user's profile row (BUG-09) |
| Admin: platform settings (maintenance mode, guest limits) | **Disconnected fake** | P1 | Pure `localStorage`; never touches `platform_settings`, which is what the guest-room RPC actually reads (BUG-10) |
| Admin: delete user / delete room / delete track / toggle room live | Works (for a real `is_admin()`) | — | RLS correctly covers these |
| `/api/upload-url` | **Unauthenticated admin endpoint** | P0 | No auth check, uses secret key, CORS `*` (BUG-11) |
| Secret key hygiene | **Compromised** | P0 | Live secret committed to git (see §0) |
| Presence / "who's online" | **Inconsistent** | P2 | Two independent, unreconciled presence systems (Realtime Presence + custom broadcast) plus a dead DB table |
| Chat | Functionally OK, rate-limited server-side | — | Text rendering is safe (JSX escaping) |
| Redirect handling (`?redirect=`) | **Correct** | — | Genuinely good open-redirect guard |
| Avatar upload | Works, but unenforced limits | P3 | 5MB check is client-only; no DB constraint |
| Build / typecheck | **Passes** | — | VERIFIED `tsc -b` and `vite build` both succeed |
| Lint | **Fails** | P3 | 50 errors under `--max-warnings 0`, mostly `any`/unused-var (VERIFIED) |

---

## D. Complete Bug Registry

### BUG-01 — Room creation is non-functional against Supabase for every user type

**Severity:** P0
**Confidence:** High (root-caused and independently corroborated three ways)
**Category:** Data integrity / core functionality
**Affected Feature:** Room creation (host and guest)
**Files:**
```text
src/services/roomService.ts
src/pages/CreateRoomPage.tsx
supabase/migrations/20260927000200_rls_policies.sql (rooms_insert_own_host)
```
**Relevant Function/Component:** `roomService.createRoom()`

**Problem:** `createRoom()` decides the `host_id` to insert with:
```js
const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-...-[0-9a-f]{12}$/i.test(val);
const dbHostId = isUuid(hostUser?.id) ? hostUser.id : null;
```
`hostUser` is `currentUser` from `useAuthStore`, whose `id` is always a
`profiles.id` value — under the current schema that's a TEXT id shaped like
`usr_1a2b3c4d5e6f` (from `handle_new_user()`) or `usr_<timestamp>_<random>`
(guest), **never** a canonical UUID. `isUuid()` is therefore `false` for
100% of real callers, so `dbHostId` is **always `null`**.

**Root Cause:** This check is a leftover from the *previous* schema, where
`profiles.id` literally was the `auth.users` UUID. The migration in this
repo (`20260927000100_core_schema.sql`) deliberately split identity into
`profiles.id` (TEXT) + `profiles.auth_user_id` (UUID) — the migration's own
top comment says so explicitly — but `roomService.createRoom()` was never
updated to match.

**Failure Scenario:** Any user, guest or fully signed-up, clicks "Create
Room." The INSERT is sent with `host_id: null`. RLS policy
`rooms_insert_own_host` requires `host_id = public.current_profile_id()`;
since `current_profile_id()` is never `NULL` for a real profile and SQL
`NULL = <anything>` is never TRUE, the insert is rejected. The retry branch
in the same function only fires `if (dbHostId)`, which is already `null`,
so the retry never runs either. The error is logged to `console.error` and
**swallowed** — the function falls through to push the room into an
in-memory `roomsStore` array and returns a fully-formed `Room` object as if
it had succeeded.

**Steps To Reproduce:**
1. Configure a real Supabase project per the README, run all four
   migrations.
2. Sign up a normal user (or continue as guest).
3. Click "Create Room," fill the form, submit.
4. Open the Supabase Table Editor → `rooms`. No row exists.
5. Reload the app, or open the room URL in a different browser/incognito
   session. `getRoomById()` finds nothing in Supabase and nothing in the
   (per-tab, in-memory) `roomsStore` fallback → "room not found."

**Expected:** A `rooms` row is created with a real `host_id`; the room is
visible to any client that can see it per its visibility setting.

**Actual:** No row is ever created; the creator's own browser tab is the
only place the room "exists," and only until refresh.

**Impact:** This is the core product loop. Nothing downstream of it
(joining, playback sync, chat, queue) can be exercised against a real
backend, because there's never a real room to join.

**Recommended Fix:** Stop deriving `host_id` from a UUID-format sniff test.
Use `currentUser.id` directly (it already *is* the correct `profiles.id`
for a signed-in user), and route guest room creation through the
already-built `create_room_guest()` RPC (see BUG-06 for the general "RPCs
exist but are never called" pattern) instead of a raw `.insert()`.

**Regression Risk:** Low — this narrows/corrects a check that currently
does nothing but harm.
**Related Bugs:** BUG-02 (same `isUuid()` anti-pattern), BUG-06.

---

### BUG-02 — Listeners never get a `room_members` row; `join_room()` RPC is dead code

**Severity:** P0
**Confidence:** High
**Category:** Data integrity / realtime consistency
**Affected Feature:** Room membership, vote-to-skip threshold accuracy, room
capacity enforcement, admin member visibility
**Files:**
```text
src/services/roomService.ts (joinRoom)
src/hooks/useRealtimeRoom.ts (joinAsCurrentUser)
supabase/migrations/20260927000300_functions_triggers.sql (join_room, enforce_room_capacity)
```
**Relevant Function/Component:** `roomService.joinRoom()`

**Problem:** Same `isUuid(user?.id)` anti-pattern as BUG-01, this time
gating whether the app even *attempts* to upsert into `room_members`:
```js
if (isSupabaseConfigured && supabase && isUuid(user?.id)) {
  await supabase.from('room_members').upsert({ ... });
}
```
Since no real `user.id` is ever a UUID under the current schema, this
branch never runs. Meanwhile, `supabase/migrations/.../join_room()` is a
purpose-built `SECURITY DEFINER` RPC that does this correctly (and also
keeps `rooms.listener_count` in sync) — and it is never called anywhere in
the frontend (`grep -rn "\.rpc(" src/` returns zero results, VERIFIED).

**Root Cause:** Same stale-schema-assumption bug as BUG-01, compounded by
the app never being updated to call the RPC the migration was written for.

**Failure Scenario:** A room's host is the only row ever present in
`room_members` (inserted by the `sync_room_host_membership` trigger on room
creation). Every listener who joins is tracked only in ephemeral Realtime
Presence, never in Postgres. Anything that reads `room_members` — future
admin tooling, moderation, `enforce_room_capacity()` (which only fires
`BEFORE INSERT`, and inserts never happen) — sees a room with one member
forever, regardless of how many people are actually listening.

**Steps To Reproduce:**
1. Create a room (workaround BUG-01 by inserting a row manually for
   testing, or fix BUG-01 first).
2. Join as a second user.
3. Query `select * from room_members where room_id = '<room>'` in Supabase.
   Only the host row exists.

**Expected:** One row per active member, with a live `status`/`last_seen_at`.

**Actual:** Zero rows for any listener, ever, via the in-app join flow.

**Impact:** Room capacity limits are unenforceable (the trigger never
fires); any server-side feature built against `room_members` (billing,
analytics, moderation, "who's in this room" for admins) will be wrong.
Vote-to-skip threshold in the UI falls back to ephemeral Presence
`members.length` instead (see BUG-05), which has its own integrity
problems.

**Recommended Fix:** Call `supabase.rpc('join_room', { p_room_id: roomId })`
instead of the raw upsert, for authenticated users. Guests remain
presence-only, as the RPC's own comment documents (`grant execute ...to
authenticated` only) until a signed guest-token mechanism exists.

**Regression Risk:** Low.
**Related Bugs:** BUG-01, BUG-05.

---

### BUG-03 — Host authority exists only as a forgeable client-side string comparison; realtime channel has no server-side authorization

**Severity:** P0
**Confidence:** High
**Category:** Security / architecture
**Affected Feature:** Play, Pause, Seek, Track change, Queue reorder/remove,
Sync heartbeat — i.e. all playback control
**Files:**
```text
src/pages/RoomPage.tsx        (isHostUser derivation)
src/stores/usePlaybackStore.ts (play/pause/seek/setTrack/nextTrack/previousTrack)
src/services/realtimeService.ts (initChannel — no channel auth config)
src/stores/useAuthStore.ts     (updateCurrentUser / localStorage persistence)
```
**Relevant Function/Component:** `RoomPage`'s `isHostUser`,
`realtimeService.initChannel()`

**Problem:** Three independent gaps compound into a full playback
hijack:

1. `isHostUser = Boolean(room && (room.host.id === currentUser.id ||
   currentUser.isAdmin))` is evaluated entirely from client state.
   `room.host.id` is public information (readable by anyone via
   `rooms_select_visible`/`profiles_select_public`). `currentUser.id` is
   fully attacker-controlled: `useAuthStore` restores `currentUser`
   verbatim from `localStorage['modern_active_user']` on boot with **no
   server-side re-validation for guests** (`initAuth()` only overwrites
   `currentUser` from the server when a real Supabase session exists;
   for a pure guest/anonymous visitor it leaves the locally-loaded value
   alone). Setting that localStorage key's `id` field to match any room's
   `host.id` makes `isHostUser` true on the client.
2. None of `play()`, `pause()`, `seek()`, `setTrack()`, `nextTrack()`,
   `previousTrack()` in `usePlaybackStore` check `get().isHost` before
   broadcasting. They broadcast unconditionally whenever called — including
   from the browser console (`usePlaybackStore.getState().play()`), from
   any UI element that happens to be reachable, or from the `onEnded`
   handler's repeat-loop (a plain listener with local "repeat" toggled on
   will broadcast `SEEK`+`PLAY` for the whole room when their track ends).
3. The Supabase Realtime channel (`room:{roomId}`) is created with only
   `{ broadcast: { self: false } }` — no Realtime Authorization / private
   channel configuration, no RLS-backed check of any kind. **Any client
   holding the public anon key can subscribe to any `room:{id}` and publish
   any event type**, without ever having joined that room, being
   authenticated, or being a member of anything.

**Root Cause:** Host authority was designed as a UI affordance, not a
security boundary, and the realtime transport was never given a
corresponding server-side check to make that boundary real.

**Failure Scenario:** An attacker who knows (or guesses/enumerates) a
public room ID can, with a few lines of `supabase-js` using only the
public anon key, subscribe to that room's channel and broadcast a
`TRACK_CHANGE` or `PAUSE` event. Every listener's client applies it
immediately and unconditionally.

**Steps To Reproduce:**
1. Open a live room in one browser as a listener (not host).
2. In DevTools console: `useAuthStore.getState().updateCurrentUser({ id:
   room.host.id })` (or edit `localStorage.modern_active_user` and reload
   while logged out).
3. Observe host-only controls (skip, reorder, remove-from-queue) now
   render, and calling `usePlaybackStore.getState().pause()` broadcasts a
   room-wide pause with no server round trip rejecting it.

**Expected:** Only the room's actual host (or a real, DB-verified admin)
can cause a mutating broadcast to be honored by other clients.

**Actual:** Any client can.

**Impact:** Complete loss of host authority; trivial denial-of-service or
harassment vector against any room; directly contradicts the "Host
Override Skip" / "Host Queue Reordering" feature claims, which assume the
host designation is meaningful.

**Recommended Fix:** Adopt Supabase Realtime Authorization (private
channels backed by an RLS policy on `realtime.messages`, checking
`can_host_room()`/membership as appropriate per event type), and add a
belt-and-suspenders `isHost` check before broadcasting from the store
itself. At minimum, gate mutating broadcast types server-side; presence
and chat can remain more permissive per the RLS file's own documented
"bounded-but-permissive" stance.
**Regression Risk:** Medium — tightening this will require every event
type to be classified as host-only vs. everyone, which isn't fully
decided today (`settings.playbackPermissions` has an `'everyone'` mode
that legitimately should allow non-host playback control — this needs to
move from "everyone, unauthenticated" to "everyone, but a real verified
member").
**Related Bugs:** BUG-04, BUG-05, BUG-11 (same "no server boundary"
pattern recurring across the app).

---

### BUG-04 — Drift correction has no clock-skew or latency compensation; "latency" is a random number

**Severity:** P0 (falsifies the core marketing claim) / P1 (functional)
**Confidence:** High
**Category:** Web Audio / Realtime correctness
**Affected Feature:** "Sub-Frame Audio Synchronization Engine"
**Files:**
```text
src/services/realtimeService.ts (calculateExpectedPosition, evaluateDrift)
src/lib/AudioPlayer.ts (applyDriftCorrection)
```
**Relevant Function/Component:** `calculateExpectedPosition()`,
`evaluateDrift()`

**Problem:**
```js
calculateExpectedPosition(authoritativePosition, serverTimestamp, status) {
  const elapsedSeconds = Math.max(0, (Date.now() - serverTimestamp) / 1000);
  return authoritativePosition + elapsedSeconds;
}
```
`serverTimestamp` is not a server timestamp at all — it's `Date.now()` read
on the **host's own device** at broadcast time (see every call site in
`usePlaybackStore.ts`: `const now = Date.now(); ... serverTimestamp: now`).
Every listener then subtracts *its own* `Date.now()` from that value. There
is no NTP-style handshake, no use of Supabase's server clock, and no
round-trip-time measurement anywhere in the codebase. Two listeners with
different clock offsets relative to the host (routine in the real world —
unsynced OS clocks, VMs, mobile devices) will compute two **different**
`expected` positions from the *same* broadcast, and therefore converge to
*different* actual playback positions — the opposite of "listen in
lockstep." Separately:
```js
latencyMs: Math.max(8, Math.floor(Math.random() * 15)),
```
The reported network latency used to populate `driftMetrics.latencyMs`
(shown in the UI, per `SyncControlHUD`) is **not measured at all** — it's a
random number in [8, 22]ms on every calculation, purely cosmetic.

**Root Cause:** The synchronization model assumes all participating
devices share a clock. They don't, and nothing in the protocol corrects
for that.

**Failure Scenario:** Host's laptop clock is 2 seconds fast relative to a
listener's phone (common — many phones/laptops drift by seconds over
weeks without NTP sync, or are in different, misconfigured timezones at
the OS level even when the app displays correct wall time). Every
`SYNC_HEARTBEAT` computes `elapsedSeconds` 2 seconds too high, `evaluateDrift`
reports `desynced` (>1500ms), and the listener hard-seeks forward by ~2
seconds on every heartbeat interval, permanently, audibly, indefinitely —
even though there is no real drift at all.

**Steps To Reproduce:**
1. Set one test device's system clock 2+ seconds ahead of another's
   (`date -s` / OS clock settings).
2. Host a room on the skewed device, join as listener on the correct
   device.
3. Observe `SyncControlHUD`'s drift indicator and audible jump-seeking on
   every heartbeat.

**Expected:** Drift correction should be robust to arbitrary,
constant, per-device clock offset — this is the textbook first problem any
"NTP-style" sync protocol solves (round-trip half-latency + offset
estimation), which the README explicitly claims exists ("Continuously
samples host playback timestamps").

**Actual:** No offset estimation exists at all.

**Recommended Fix:** Implement a minimal clock-offset estimator: on join
(and periodically), exchange a ping/pong (or use each Realtime message's
own server-inserted receive timestamp, which Supabase does attach) to
estimate `offset = serverClock - localClock` per client, and apply that
offset when computing `elapsedSeconds`, instead of comparing two raw
`Date.now()` values from different machines. Replace the random
`latencyMs` with an actual measured round-trip time.
**Regression Risk:** Medium — touches the core sync math; needs careful
testing against the existing threshold constants (120ms/1500ms in
`evaluateDrift`), which themselves should probably be revisited once real
latency is known instead of guessed.
**Related Bugs:** BUG-12 (fixed ±4% nudge is separately too crude, on top
of this).

---

### BUG-05 — Vote-to-skip is client-authoritative, can double-fire, and disagrees on its own threshold

**Severity:** P1
**Confidence:** High
**Category:** Realtime race condition
**Affected Feature:** Democratic Vote-to-Skip
**Files:**
```text
src/stores/usePlaybackStore.ts (voteSkip, syncFromRemoteEvent -> SKIP_VOTE)
src/pages/RoomPage.tsx (skipThreshold, handleSkipClick-equivalent)
```
**Problem:** Skip-voting is entirely a client-broadcast mechanism (no DB
table, unlike the separate `queue_votes` table used for queue up-voting).
Three compounding issues:

1. **Overwrite, not merge, on receipt.** `case 'SKIP_VOTE': { const {
   skipVotes: remoteVotes } = event.payload; set({ skipVotes: remoteVotes ||
   [] }); }` — a client's local `skipVotes` array is *replaced* by whatever
   array the sender happened to have locally, not unioned. Under any race
   (two people voting within the same round-trip window), votes can be
   silently dropped from other clients' perspective.
2. **Threshold-crossing is only checked by the voter who just clicked**, not
   by clients passively receiving a `SKIP_VOTE` broadcast. `voteSkip()`
   checks `if (nextVotes.length >= threshold) nextTrack()` using its own,
   possibly-stale, local tally — receivers of the broadcast never run this
   check at all.
3. **`threshold` isn't shared.** `Math.ceil(members.length / 2)` is computed
   independently on every client from its own local view of `members`
   (itself sourced from ephemeral Presence, see BUG-02/architecture map) —
   different clients can and will compute different thresholds for the
   same room if their presence view is even momentarily out of sync (a
   join/leave in flight, a reconnect).

**Failure Scenario (Race 1, per audit brief):** Room has 4 members,
threshold 2. User A votes (local tally `['A']`, not yet broadcast-received
elsewhere, no skip). User B votes independently before receiving A's
broadcast (local tally `['B']`, no skip). Once B's vote broadcast reaches A,
A's `skipVotes` becomes `['B']` — A's own earlier vote has vanished from A's
own state (overwrite, not merge) — while B's client, if B's own tally
happened to already include A's vote by that point, may separately decide
threshold is met and call `nextTrack()`. In the more common bad case (both
independently think they alone reached threshold, e.g., a stale/cached
member count), **two different clients broadcast two different
`TRACK_CHANGE` events in quick succession** — see BUG-13 for why the
receiving side has no defense against that either.

**Recommended Fix:** Move current-track skip voting onto the same
authoritative pattern as `queue_votes`/`toggle_queue_vote()`: a real table
+ a `SECURITY DEFINER` RPC that does the threshold check and the track
advance atomically, server-side, exactly once. This removes the need for
client-side threshold math entirely.
**Regression Risk:** Medium — this is a genuine feature rewrite, not a
patch.
**Related Bugs:** BUG-02 (threshold input), BUG-13 (no de-dup on the
resulting `TRACK_CHANGE`).

---

### BUG-06 — Queue up-voting is dead against Supabase; the purpose-built RPC is never called

**Severity:** P1
**Confidence:** High
**Category:** Core functionality
**Affected Feature:** Collaborative Queue (up-vote a queued track)
**Files:**
```text
src/services/roomService.ts (voteQueueItem)
supabase/migrations/20260927000300_functions_triggers.sql (toggle_queue_vote)
```
**Problem:**
```js
async voteQueueItem(roomId, queueItemId) {
  const list = queueStore[roomId];
  if (!list) return null;   // <- always true in Supabase mode
  ...
}
```
`queueStore` is a module-level in-memory object that is **only ever
written to** by the demo/offline code paths (`createRoom`, `addQueueTrack`
when Supabase isn't configured); when Supabase *is* configured,
`getRoomQueue()` returns data straight from the database and never
populates `queueStore`. So `list` is `undefined` for every real room, and
the function returns `null` **before reaching the Supabase branch a few
lines below it**, which is therefore dead code. The migration file's own
comment (`20260927000300_functions_triggers.sql`, section 8) documents
this exact bug and the RPC it was supposed to be replaced with
(`toggle_queue_vote`) — but the frontend call site was never changed. A
full repo-wide search confirms: `grep -rn "\.rpc(" src/` → **zero matches**.

**Failure Scenario:** Any user clicks the up-vote heart on a queued track.
Nothing happens: no error, no network call reaches Supabase, no state
changes, no toast.

**Recommended Fix:** Replace the body of `voteQueueItem` with
`supabase.rpc('toggle_queue_vote', { p_queue_item_id: queueItemId })` and
use its boolean return value to update `hasVoted` optimistically.
**Regression Risk:** Low.
**Related Bugs:** BUG-01, BUG-02 (same "RPC exists, frontend doesn't call
it" pattern, three times over).

---

### BUG-07 — Community track uploads store a public URL against a private bucket; playback 403s

**Severity:** P0/P1
**Confidence:** High
**Category:** Data integrity / storage
**Affected Feature:** Audio Studio upload, any track played from a
community upload
**Files:**
```text
src/services/storageService.ts (uploadTrack)
supabase/migrations/20260927000300_functions_triggers.sql (storage bucket section)
```
**Problem:** The migration explicitly sets the `tracks` bucket to
`public: false` and documents why:
> "The old setup used `getPublicUrl()` on a public 'tracks' bucket ...
> storageService.ts ... must switch to `createSignedUrl(path, 3600)` ...
> BREAKING CHANGE ... Tracked as a Phase 1 item."

`storageService.uploadTrack()` still calls `.getPublicUrl(storagePath)` in
both the direct-upload branch and the signed-upload-URL fallback branch,
and stores that string directly into `tracks.audio_url`.
`getPublicUrl()` **does not check bucket permissions** — it always returns
a syntactically valid URL, so the code has no way of knowing, at upload
time, that the URL is dead. The resulting `<audio src="...">` request will
receive a 403 from Supabase Storage for every listener, including the
uploader, on a fresh page load.

**Steps To Reproduce:**
1. Run migrations, upload an audio file via the Studio modal as a signed-in
   user.
2. Note the `tracks.audio_url` value stored in the DB.
3. `curl -I <that url>` → 400/403 (bucket is private; URL carries no
   token).

**Recommended Fix:** Store the **storage path**, not a URL, in
`tracks.audio_url` (or a new `audio_path` column), and resolve a fresh
`createSignedUrl(path, 3600)` at playback time (and re-sign on expiry —
see BUG-08 for why the read policy also needs to change first).
**Regression Risk:** Medium — this is a schema-shape change
(`audio_url` semantics) that ripples through `trackService`,
`usePlaybackStore.setTrack`, and anywhere `audioUrl` is read directly.
**Related Bugs:** BUG-08.

---

### BUG-08 — Storage READ policy only covers the uploader (or admin); other room members can never hear someone else's upload

**Severity:** P1
**Confidence:** High
**Category:** RLS / architecture
**Affected Feature:** Community track sharing
**Files:**
```text
supabase/migrations/20260927000300_functions_triggers.sql (tracks_read_own_or_admin)
src/services/storageService.ts (storagePath = `uploads/${Date.now()}_${name}`)
```
**Problem:** The storage `SELECT` policy allows access only if
`owner_id = auth.uid()::text` **or** the object's first folder segment
equals the caller's own `profiles.id`. But every upload in the current
code goes to `uploads/<timestamp>_<filename>` — the first folder segment is
the literal string `"uploads"`, never a user id — so the folder-based
branch can never match for anyone. That leaves only `owner_id =
auth.uid()`, i.e., **the original uploader only**. Even after fixing
BUG-07's URL-generation problem, a signed URL still has to pass this same
RLS check to be issued, so **other listeners in the room still cannot
legitimately play a track someone else uploaded** — the entire point of a
shared community queue.
**Recommended Fix:** Either (a) change the upload path to
`{profileId}/{filename}` and add a policy branch that permits `SELECT`
for anyone who can see a room containing that track in its queue
(`can_see_room` join through `queue_items`/`tracks`), or (b) route all
playback through signed URLs minted server-side (an Edge Function
checking room membership) rather than relying on Storage RLS to be
room-aware, which it fundamentally isn't designed to be.
**Regression Risk:** Medium.
**Related Bugs:** BUG-07.

---

### BUG-09 — Admin "ban user" / "promote to admin" silently no-ops (missing RLS policy)

**Severity:** P0/P1
**Confidence:** High
**Category:** Data integrity / silent failure
**Affected Feature:** Admin Dashboard → User Management
**Files:**
```text
src/services/adminService.ts (updateUser)
supabase/migrations/20260927000200_rls_policies.sql (profiles policies)
```
**Problem:** `adminService.updateUser()` runs
`supabase.from('profiles').update(payload).eq('id', userId)` to ban/unban
or change another user's role. The only UPDATE policy on `profiles` is
`profiles_update_own` (`using (auth_user_id = auth.uid())`) — there is
**no policy permitting an admin to update a row that isn't their own**.
Postgres RLS silently filters the target row out of the `UPDATE`'s
visibility; zero rows are affected, and because the call doesn't chain
`.select()` to force a "no rows returned" signal, `error` stays `null` and
`updateUser()` returns `true` — **a false "success."**
**Steps To Reproduce:**
1. Sign in as a real `is_admin = true` user, open `/admin` → Users.
2. Ban a different user. Toast/UI shows success.
3. Query `select is_banned from profiles where id = '<that user>'` — still
   `false`.
**Impact:** Moderation is a no-op. A platform operator can believe they've
banned an abusive account while that account continues operating
normally.
**Recommended Fix:** Add a dedicated `SECURITY DEFINER` RPC (mirroring the
existing `guard_profile_privileges()` pattern) — e.g. `admin_set_user_flags(p_user_id,
p_is_banned, p_role)` that checks `public.is_admin()` internally and
performs the update, bypassing the row-scoped RLS by design (the same way
`toggle_queue_vote` bypasses `queue_items_update_host` for voters). Do
**not** simply add a blanket `profiles_update_admin using (is_admin())`
policy without also re-checking `guard_profile_privileges()`'s interaction
with it — the trigger already handles the column guard, so a
`for update using (is_admin())` policy (no `with check` needed beyond the
trigger) is the minimal correct fix, but should be paired with an explicit
integration test.
**Regression Risk:** Low if implemented as an RPC; low-medium if via a new
RLS policy (needs to be verified against the existing privilege-guard
trigger, which is unaffected either way since it fires on all UPDATEs
regardless of which policy admitted them).
**Related Bugs:** BUG-10.

---

### BUG-10 — Admin "Platform Settings" panel is pure `localStorage`, entirely disconnected from the `platform_settings` table

**Severity:** P1
**Confidence:** High
**Category:** Data integrity / silent failure
**Affected Feature:** Maintenance mode, guest daily room limit, bitrate
limits (Admin Dashboard)
**Files:**
```text
src/services/adminService.ts (getPlatformSettings / updatePlatformSettings)
supabase/migrations/20260927000300_functions_triggers.sql (create_room_guest reads platform_settings)
```
**Problem:** `adminService.getPlatformSettings()` /
`updatePlatformSettings()` read and write **only**
`localStorage['modern_platform_settings']`. There is no `supabase` call
anywhere in these two functions. Meanwhile, the actual server-side
enforcement — `create_room_guest()`'s daily-quota check — reads
`platform_settings.guest_daily_room_limit` **from the database**, which
these admin actions never touch. An admin changing "guest daily room
limit" from 5 to 0 (say, during an abuse incident) changes nothing about
what the server enforces; it only changes what that one admin's own
browser displays.
**Recommended Fix:** Route these through a `platform_settings` table
UPDATE (already covered by the existing `platform_settings_update_admin`
RLS policy) instead of `localStorage`.
**Regression Risk:** Low.
**Related Bugs:** BUG-09 (same "admin panel looks connected, isn't"
pattern).

---

### BUG-11 — `/api/upload-url` is a fully unauthenticated endpoint that mints admin-signed storage upload URLs

**Severity:** P0
**Confidence:** High
**Category:** Security
**Affected Feature:** Guest audio upload fallback path
**Files:**
```text
api/upload-url.ts
```
**Problem:** This Vercel serverless function accepts a `path` query/body
parameter with **no authentication check of any kind**, and uses a
Supabase client constructed with the **secret key** to call
`createSignedUploadUrl(path)` for the `tracks` bucket, returning the
signed token to the caller. `res.setHeader('Access-Control-Allow-Origin',
'*')` additionally allows this to be called cross-origin from anywhere.
This is the fallback path `storageService.uploadTrack()` takes for guests
(whose direct upload correctly fails normal Storage RLS, since it requires
`auth.uid() is not null`) — meaning the intended "guest can share audio"
UX flow for this app specifically routes through a completely open admin
endpoint.
**Failure Scenario:** Anyone, without ever opening the app, can `curl` this
endpoint with an arbitrary `path` and receive a valid signed upload token
for the `tracks` bucket, then upload arbitrary content (any file type,
since this bypasses the bucket's `allowed_mime_types`/`file_size_limit`
enforcement path that only applies to policy-gated uploads — signed
uploads still respect bucket-level `file_size_limit`/`allowed_mime_types`,
but nothing stops path collisions/overwrites of other users' files, since
`path` is fully attacker-chosen and there's no ownership check).
**Recommended Fix:** Require a valid Supabase JWT (verify it inside the
handler, or better, use the `@supabase/server` package already referenced
in this repo's own `.agents/skills` doc with `auth: 'user'`), scope the
generated `path` server-side to a namespace the caller doesn't control
(e.g., prefix with the verified caller's profile id), and never fall back
to this for anonymous/guest callers without a separate, explicitly
rate-limited, reduced-privilege mechanism.
**Regression Risk:** Low — currently this endpoint is strictly more
permissive than intended; tightening it can only remove unintended access.
**Related Bugs:** §0 (the hardcoded key this endpoint uses), BUG-07/BUG-08.

---

### BUG-12 — Fixed ±4% playback-rate nudge, no proportional correction, no smoothing/ramp

**Severity:** P2
**Confidence:** High
**Category:** Web Audio
**Files:** `src/lib/AudioPlayer.ts` (`applyDriftCorrection`)
**Problem:** `const newRate = driftMs < 0 ? 1.04 : 0.96;` — this is applied
instantly regardless of whether drift is 130ms or 1499ms (the entire
"nudge" band per `evaluateDrift`'s thresholds), and reset to `1.0` instantly
once drift crosses back under 120ms, with no easing. A ±4% rate change over
even a few seconds is easily audible as a tempo shift, which cuts against
the "without audible pitch warping or abrupt jumps" claim (pitch itself is
usually preserved by the browser's own time-stretching, but the *tempo*
change is still perceptible, and the on/off snap at the 120ms boundary
will read as "chugging").
**Recommended Fix:** Scale the nudge proportionally to `driftMs` within
some bounded range (e.g. 0.99–1.02 for anything under ~500ms), and ramp
`playbackRate` over a short window (a few hundred ms) rather than setting
it instantaneously.
**Regression Risk:** Low.
**Related Bugs:** BUG-04.

---

### BUG-13 — No staleness/ordering check on realtime sync events; "revision" is a decorative, per-client counter

**Severity:** P1
**Confidence:** High
**Category:** Realtime / distributed systems
**Files:**
```text
src/services/realtimeService.ts (broadcastEvent — revisionCounters)
src/stores/usePlaybackStore.ts (syncFromRemoteEvent — every case assigns event.revision unconditionally)
```
**Problem:** `revisionCounters` is a `Map` local to each browser tab's
`RealtimeService` instance, starting at 0 and incrementing per-sender. It
is never compared against the *previous* value before being written:
every handler in `syncFromRemoteEvent` does `set({ ..., revision:
event.revision })` unconditionally. Two different senders' revision
numbers have no defined relationship to each other (both can be "3" at
the same time), and even for a single sender, a message that arrives late
(network reordering, a Realtime reconnect replaying a buffered message)
will unconditionally overwrite newer local state with older data — there
is no `if (event.revision <= state.revision) return` guard anywhere.
**Failure Scenario (per audit brief, Scenario J / Race 8):** Host rapidly
skips track A → B → C. Due to normal network jitter, the `TRACK_CHANGE(B)`
event arrives at a listener *after* `TRACK_CHANGE(C)`. The listener's
`currentTrack` reverts from C back to B and stays there — the queue has
visibly regressed for that one listener, and nothing will correct it
until the next unrelated event happens to arrive.
**Recommended Fix:** Make `revision` a real, single monotonically
increasing counter — ideally server-side (e.g., derived from a Postgres
sequence, or from `rooms.updated_at`/a dedicated `rooms.playback_revision`
column bumped by a trigger alongside the actual authoritative state
change) — and reject any incoming event whose revision isn't strictly
greater than the currently-applied one.
**Regression Risk:** Medium — this is the fix that also resolves half of
BUG-05's "two clients advance the queue independently" failure mode, since
a server-issued revision would let the second `TRACK_CHANGE` be recognized
as redundant.
**Related Bugs:** BUG-03, BUG-05.

---

### BUG-14 — `resyncNow()` / `SYNC_HEARTBEAT` track-change path seeks before the new track's metadata has loaded

**Severity:** P1
**Confidence:** Medium-High (INFERRED from `HTMLAudioElement` semantics;
behavior varies slightly by browser but the race is real in all of them)
**Category:** Web Audio / race condition
**Files:**
```text
src/stores/usePlaybackStore.ts (resyncNow, syncFromRemoteEvent -> SYNC_HEARTBEAT/PLAY)
src/lib/AudioPlayer.ts (loadTrack — calls audio.load() and returns immediately)
```
**Problem:** `AudioEngine.loadTrack()` sets `audio.src` and calls
`audio.load()`, which is asynchronous — it does not wait for
`loadedmetadata`/`canplay`. Every call site that changes track *and* wants
to land on a specific non-zero position (`resyncNow`,
`syncFromRemoteEvent`'s `SYNC_HEARTBEAT` and `PLAY` cases) calls
`setTrack()` and then, on the very next lines, `globalAudioEngine.seek(...)`
/ relies on `applyDriftCorrection` to seek — while the browser is still
fetching/decoding the new source. Seeking an `HTMLMediaElement` before its
metadata has loaded is commonly ignored or reset once metadata does
arrive, depending on the browser.
**Failure Scenario:** A listener resyncs (or receives a heartbeat) mid-way
through a host's already-playing track that differs from what the
listener currently has loaded. The intended behavior is "jump straight to
the host's current position in the new track"; the actual behavior is
frequently "start the new track from 0," silently, with no error.
**Recommended Fix:** Await `canplay` (or `loadedmetadata`) before issuing
the seek — e.g. have `loadTrack()` return a Promise that resolves once
metadata is available, or have `setTrack`'s callers wait for a
`durationchange`/`canplay` event before calling `seek()`.
**Regression Risk:** Low — this only adds a wait before an action that
currently silently fails.
**Related Bugs:** BUG-04.

---

### BUG-15 — Synth fallback's `pause()` doesn't stop the oscillators

**Severity:** P2
**Confidence:** High
**Category:** Web Audio
**Files:** `src/lib/AudioPlayer.ts`
**Problem:**
```js
pause() {
  if (this.isUsingSynthFallback) {
    this.events.onStatusChange?.('paused');
    return;
  }
  this.audio.pause();
  ...
}
```
When the ambient-synth fallback is active (triggered on any
`HTMLAudioElement` error, e.g. an unplayable/expired URL — which, per
BUG-07, will be common), calling `pause()` only fires the `'paused'` UI
event; the oscillators created in `startSynthFallback()` keep running
(`osc.start()` with no scheduled `stop()`) until the track is changed or
`destroy()` runs. A user who hits "pause" while the fallback tone is
playing will keep hearing it.
**Recommended Fix:** In the synth-fallback branch of `pause()`, actually
ramp the fallback gain nodes to 0 (and back up on `play()`), or stop/restart
the oscillators.
**Regression Risk:** Low.

---

### BUG-16 — Listener with local "Repeat" enabled can broadcast playback control for the whole room

**Severity:** P1 (a specific, concrete instance of BUG-03)
**Confidence:** High
**Files:** `src/stores/usePlaybackStore.ts` (`onEnded` handler)
**Problem:**
```js
onEnded: () => {
  const state = get();
  if (state.isRepeating && state.currentTrack) {
    get().seek(0, true);   // broadcast = true, unconditional
    get().play(true);      // broadcast = true, unconditional
  } else { ... }
}
```
`isRepeating` is a purely local, per-client toggle (`toggleRepeat`). There
is no `isHost` check before the broadcast calls. Any listener who turns on
"Repeat" will, the moment their local track finishes, broadcast a `SEEK`
and `PLAY` event that every other client in the room applies.
**Recommended Fix:** Either make "Repeat" local-only (don't broadcast when
triggered from `onEnded` unless `get().isHost`), or, once BUG-03 is fixed
at the transport layer, this becomes moot (the broadcast would simply be
rejected server-side for a non-host).
**Regression Risk:** Low.
**Related Bugs:** BUG-03.

---

### BUG-17 — `profiles` INSERT policy doesn't restrict `is_admin`/`is_banned`/`role`

**Severity:** P2 (traced through; real-world impact is currently limited,
but it's a genuine gap worth closing)
**Confidence:** High
**Files:** `supabase/migrations/20260927000200_rls_policies.sql`
(`profiles_insert_own`)
**Problem:** The privilege-guard trigger
(`guard_profile_privileges()`) only fires `BEFORE UPDATE`. The INSERT
policy only checks `auth_user_id`:
```sql
create policy "profiles_insert_own" on public.profiles
  for insert with check (
    auth_user_id = auth.uid()
    or (auth_user_id is null and not public.is_banned())
  );
```
Nothing stops a raw `INSERT` (e.g., from the browser console, using
nothing but the public anon key) from setting `is_admin = true, role =
'admin'` on a brand-new row with `auth_user_id = null`.
**Why this doesn't currently escalate to full account takeover:**
`public.is_admin()`/`public.current_profile_id()` both resolve via `select
... where auth_user_id = auth.uid()`. For a row inserted with
`auth_user_id = null`, that join can never match any real session's
`auth.uid()` (SQL `NULL = <uuid>` is never true), so this forged row can
never make `is_admin()` return `true` for anyone. The practical impact
today is limited to: (a) junk rows polluting `profiles` with arbitrary
`is_admin`/`role` values, visible to **everyone** via the
`profiles_select_public using (true)` policy (a minor information/spam
issue), and (b) if any future code path ever trusts a client-supplied
profile id to determine "who am I" without cross-checking `auth_user_id`
(the app's own `useAuthStore.updateCurrentUser`/localStorage pattern is
already exactly that anti-pattern at the client layer — see BUG-03), this
gap becomes the DB-side half of a real escalation.
**Recommended Fix:** Add explicit `is_admin = false and is_banned = false
and role = 'listener'` to the `with check` clause of
`profiles_insert_own` (or route all profile creation through a
`SECURITY DEFINER` function that sets those columns itself and ignores
client input for them, matching the pattern already used for room/track
inserts).
**Regression Risk:** Low.
**Related Bugs:** BUG-03.

---

### BUG-18 — Client `currentUser` (including `isAdmin`) is trusted from raw `localStorage` on boot, with no re-validation until an async Supabase round-trip resolves

**Severity:** P2 (defense-in-depth gap; `RequireAdmin`'s `isAuthenticated`
gate currently prevents this from granting real `/admin` access to a
non-authenticated visitor, but see BUG-03 for how it *does* matter for
mid-session host impersonation)
**Confidence:** High
**Files:** `src/stores/useAuthStore.ts` (`getStoredUser`,
`updateCurrentUser`, `switchProfile`)
**Problem:** `currentUser: getStoredUser()` (a synchronous
`JSON.parse(localStorage.getItem(...))` with zero validation) is the
store's initial state, used for the entire render tree until `initAuth()`'s
async `getSession()` resolves. For a signed-in user, that resolution
does eventually overwrite `currentUser` with server-verified data. For a
guest/anonymous visitor (`session` is `null`), `initAuth()` explicitly
does **not** touch `currentUser` — whatever was in `localStorage` stands,
indefinitely, including a hand-edited `isAdmin: true`. Separately,
`updateCurrentUser()`/`switchProfile()` are unauthenticated ways to mutate
this same trusted client record at any point during a session, not just
at boot.
**Recommended Fix:** Never trust `isAdmin`/`role`/privileged fields from
`localStorage`; strip them on load and re-derive only from a server round
trip (or simply don't persist those specific fields to `localStorage` at
all — persist only cosmetic fields like avatar/name for guests).
**Regression Risk:** Low.
**Related Bugs:** BUG-03.

---

### BUG-19 — `beforeunload`-based presence untrack is unreliable; dual, unreconciled presence systems

**Severity:** P2
**Confidence:** Medium (browser-dependent, well-documented general
limitation of `beforeunload` for completing async work)
**Files:**
```text
src/hooks/useRealtimeRoom.ts (handleLeave / beforeunload)
src/services/realtimeService.ts (trackPresence/untrackPresence vs. PRESENCE_SYNC broadcast)
```
**Problem:** Clean-leave relies on the `beforeunload` event firing
`realtimeService.untrackPresence()`, an `await`-ed async call
(`sc.untrack()`). Browsers do not guarantee async work started in
`beforeunload` completes before the page is torn down, and the handler
frequently doesn't fire at all on mobile app-switch, OS-level kill, or a
crash. Supabase's own Realtime Presence *does* clean up independently on
socket disconnect (a genuine, separate safety net), but the app's custom
`'PRESENCE_SYNC'` broadcast-based leave notification and the
cross-tab `BroadcastChannel` "leave" message both depend entirely on this
handler completing, so those two paths can leave a stale/ghost entry in
local UI state even after the underlying Supabase Presence has correctly
cleaned up.
**Recommended Fix:** Prefer `visibilitychange`/`pagehide` in addition to
`beforeunload` (more reliable on mobile), and — more importantly — treat
Supabase's own `presence` `sync`/`leave` events (already wired up in
`realtimeService.initChannel`) as the single source of truth for "who's
here," rather than layering a second, custom broadcast-based presence
system on top that can disagree with it.
**Regression Risk:** Low.

---

### BUG-20 — Avatar size/type limits are client-side only; no server-side constraint

**Severity:** P3
**Confidence:** High
**Files:**
```text
src/components/profile/EditProfileModal.tsx
supabase/migrations/20260927000100_core_schema.sql (profiles.avatar text, no length check)
```
**Problem:** Avatar "upload" is a pure client-side `FileReader.readAsDataURL()`
into the `profiles.avatar` TEXT column — it never touches Supabase
Storage, so the storage bucket's `file_size_limit` doesn't apply. The
5MB / image-type checks in `EditProfileModal.tsx` are JavaScript-only and
trivially bypassed (call the save handler directly, or intercept the
request). There's no `CHECK (length(avatar) < N)` constraint at the DB
layer.
**Recommended Fix:** Add a `check (length(avatar) <= 2_000_000)`-style
constraint (base64 5MB image ≈ 6.9M chars) as a backstop, or move avatar
storage to the Storage bucket with real server-enforced limits.
**Regression Risk:** Low.

---

### Additional lower-priority items (compact form)

| # | Finding | Severity | Files |
|---|---|---|---|
| 21 | `TRACK_CHANGE` broadcast payload carries a `position` field that's never fed into `AudioEngine.seek()` on the receiving end — dead field, currently harmless only because every call site always sends `position: 0` | P3 | `usePlaybackStore.ts` |
| 22 | `nextTrack`/`previousTrack` compute `currentIndex` via `queue.findIndex(track.id === currentTrack.id)`; if the currently-playing track has already been removed from the `queue` array (depends on UI queue semantics), this returns `-1`, silently jumping to `queue[0]` instead of a defined "next" — worth an explicit test given how the queue array is mutated in `RoomPage.tsx` | P3 | `usePlaybackStore.ts`, `RoomPage.tsx` |
| 23 | Single JS bundle, no code-splitting: `dist/assets/index-*.js` is 744KB (202KB gzipped) — VERIFIED via `npm run build` output; Vite explicitly warns about this | P3 | `vite.config.ts` |
| 24 | `npm run lint` fails out of the box: 50 errors under the repo's own `--max-warnings 0` policy (mostly `no-explicit-any`, a few genuine `catch { }` empty blocks swallowing errors silently, e.g. `profileService.ts:61`, `storageService.ts:233`) — VERIFIED | P3 | repo-wide |
| 25 | `ensureProfileForAuthUser()`'s self-repair path creates a profile with `id: sessionUser.id` (the raw UUID) instead of the `'usr_' + ...` convention the DB trigger uses for the normal signup path — two different ID *shapes* exist for the same conceptual entity depending on which code path created the row, which is exactly the kind of inconsistency that made BUG-01's `isUuid()` check *sometimes* accidentally pass | P3 | `useAuthStore.ts` |
| 26 | Two independent, unreconciled "voting" systems share vocabulary but not data: `skipVotes` (client-only, BUG-05) vs. `queue_votes`/`toggle_queue_vote` (DB-backed, BUG-06 — unused) | Systemic, see §F | — |

---

## E. Critical User Journey Failures

1. **New user signs up → creates a room → shares link with a friend.**
   Fails at step 2 (BUG-01): the room never persists. The friend's link
   404s / "room not found," or (if same browser session) the creator sees
   a room that only they can ever see, that vanishes on refresh.
2. **Host uploads a track and adds it to the queue for everyone to
   enjoy.** The upload "succeeds" (toast, track appears in the queue UI),
   but the stored URL 403s for every listener including, after a page
   reload, the uploader (BUG-07/BUG-08).
3. **A room gets rowdy; the moderator/host votes to skip a bad track.**
   Depending on timing, either nothing happens (votes silently dropped,
   BUG-05) or the queue advances by two tracks at once (double-fire,
   BUG-05 + BUG-13).
4. **Platform admin bans an abusive user.** UI reports success. The user
   is not actually banned (BUG-09) and can keep using the platform.
5. **Any visitor, with zero login, opens the browser console.** Can
   impersonate any room's host and pause/skip/hijack playback for every
   real listener in that room (BUG-03), and can mint an admin-signed
   storage upload URL with no credentials at all (BUG-11).

---

## F. Systemic Root Causes (not just individual bugs)

1. **Frontend/schema drift.** The most recent migrations (dated
   2026-09-27, per their own filenames) represent a real, documented
   security fix pass over an earlier, badly broken schema — but the
   corresponding application-code changes the migration's own final
   comment block calls out as required (*"Remaining Phase 0 app-side
   work: useAuthStore query by auth_user_id [done]; roomService call
   toggle_queue_vote/join_room/create_room_guest [NOT done];
   storageService signed URLs [NOT done]; adminService stop deriving
   isAdmin from username [done]"*) were only partially completed.
   BUG-01, BUG-02, BUG-06, BUG-07 are all instances of this one gap.
   **Recommendation: before any further feature work, do a single pass
   reconciling every Supabase call site against the current schema and
   the RPCs that exist for it.**
2. **No server-side authoritative mutation for realtime state.**
   Playback control, skip-voting, and (until very recently, per the
   migration comments) even profile privilege escalation have all been
   architected as "broadcast an intention, hope everyone applies it the
   same way." Every genuinely distributed-systems bug in this report
   (BUG-03, BUG-05, BUG-13) traces back to this one decision. **The fix
   is the same in each case: move the mutation behind a `SECURITY
   DEFINER` RPC that does the authorization check and the state
   transition atomically, and have Realtime broadcast the *result*, not
   accept arbitrary client-asserted state.** The codebase already has
   the right pattern in `toggle_queue_vote()` / the privilege-guard
   trigger — it just needs to be applied consistently.
3. **"Looks connected" admin surfaces that write to `localStorage`
   instead of the database** (BUG-09, BUG-10) — a symptom of the app
   having started as a client-only demo and not every surface being
   migrated when Supabase was added.

---

## G. Web Audio Findings (dedicated section)

Covered in depth at BUG-04, BUG-12, BUG-14, BUG-15. Summary: the
*mechanics* of drift correction (nudge vs. seek thresholds, playbackRate
manipulation) are reasonable in shape, but the *inputs* to that math (a
non-clock-corrected timestamp, a fabricated latency number) make the
output unreliable across real devices, and there's a genuine
metadata-loading race on every track change that can silently discard
the intended sync position.

## H. Supabase / PostgreSQL / RLS Findings (dedicated section)

The schema and RLS design in the current migrations (BUG-17 aside) are
the strongest part of this codebase — SECURITY DEFINER helper functions
with pinned `search_path`, a column-level privilege-guard trigger, a real
per-track-per-user `queue_votes` table instead of a naive counter, rate
limiting on chat and track uploads, and a documented history of exactly
what was wrong before (`20260927000000_reset.sql` is unusually good
incident documentation). The problems in this system are almost entirely
about the **application never being updated to use what the database
now correctly requires** (BUG-01/02/06/09), plus one real gap (BUG-17)
and one storage-specific design mismatch (BUG-08).

## I. Authentication & Authorization Findings

`safeRedirect()` is correct (positive finding). Session restoration,
token refresh, and sign-out are standard Supabase Auth usage with no
obvious issues. The self-healing profile-repair flow (BUG-25 in the
compact table) creates an ID-format inconsistency but doesn't itself
escalate privilege. The real authorization gaps are all downstream of
client-side trust (BUG-03, BUG-17, BUG-18), not the auth flow itself.

## J. Security Findings

See §0 (leaked secret), BUG-03 (unauthenticated realtime mutation),
BUG-11 (unauthenticated admin storage endpoint), BUG-17/BUG-18 (client
trust gaps). No SQL injection found (all queries are parameterized via
supabase-js / PL/pgSQL with typed parameters). No stored-XSS found (chat
renders as JSX text).

## K. Performance Findings

Single 744KB JS bundle with no code-splitting (BUG-23). Base64 data-URL
fallback for uploads under 8MB (in `storageService.ts`) means a track's
entire audio payload can ride along in ordinary `tracks` table queries
for every client that lists tracks, not just the one playing it — a
real, if secondary, bandwidth concern once BUG-07 is fixed and this
fallback path stops being the *accidentally working* one.

## L. Mobile / Browser Findings

`beforeunload` reliance (BUG-19) is the primary mobile-relevant risk —
iOS Safari and mobile Chrome both routinely fail to run this handler's
async work on app-switch. AudioContext-suspension recovery is only
handled reactively (`initAnalyser()` resumes a suspended context, but
only when something calls it, e.g. on next `play()`), not proactively.

## M. Data Integrity Findings

`room_members` almost entirely unpopulated for listeners (BUG-02);
`platform_settings` disconnected from its own admin UI (BUG-10);
`tracks.audio_url` storing dead URLs (BUG-07); `profiles` insertable with
arbitrary privilege columns, though not currently exploitable to full
takeover (BUG-17).

## N. Architecture Weaknesses (recap)

1. No server-side authoritative mutation layer for realtime events (§F.2).
2. Frontend/schema drift after migrations (§F.1).
3. Two unreconciled sources of truth for "who's in this room" (Presence
   vs. the dead `room_members` table) and for "vote counts" (client
   `skipVotes` vs. DB `queue_votes`).

## O. Technical Debt

**Must Fix:** §0 (secret rotation), BUG-01, BUG-02, BUG-03, BUG-09,
BUG-11.
**Should Fix:** BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, BUG-10, BUG-13,
BUG-17.
**Nice to Fix:** BUG-12, BUG-14 through BUG-16, BUG-18 through BUG-26.

---

## Verification ledger

```text
Typecheck:  PASS   (VERIFIED — `npm run typecheck`, tsc -b, no errors)
Lint:       FAIL   (VERIFIED — 50 errors under --max-warnings 0)
Build:      PASS   (VERIFIED — `npm run build`, dist/ produced, 7.03s)
Database:   NOT RUN against a live project — all DB findings are from
            reading the migration SQL directly (VERIFIED as written;
            REQUIRES RUNTIME VERIFICATION to confirm live-project state
            matches these migrations, since a Supabase project can drift
            from its migration files if changes were made by hand in the
            dashboard)
Realtime:   Read from source only (INFERRED architecture; the "any
            client can broadcast" claim in BUG-03 follows necessarily
            from the channel configuration shown, but was not tested
            against your live project)
Audio:      Read from source only (INFERRED/reasoned from documented
            HTMLMediaElement + Web Audio API semantics)
Security:   git history search VERIFIED; endpoint auth gaps VERIFIED by
            reading api/upload-url.ts directly
```

A companion file, `MODERN_MASTER_FIX_PROMPT.md`, is provided separately —
paste it into a fresh Claude Code / Claude session together with this
project's source to drive the remediation pass.

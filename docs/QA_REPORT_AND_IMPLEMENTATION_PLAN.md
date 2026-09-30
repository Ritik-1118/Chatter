# Chatter: QA report and implementation plan

Date: 2026-09-30 · Branch: `claude/dazzling-rubin-9l8yud` · Base commit: `2b0693e`

This document has four parts:

1. What was tested and how.
2. Every bug, issue, gap and inconsistency found. Each finding has an ID, a severity and its evidence.
3. One consolidated implementation plan (not phased) that fixes all of them and adds the recommended features.
4. The acceptance criteria.

Finding IDs match the tags in the test titles (`[B-S07]`, `[B-C14]`, …). A test that fails today is the reproduction of its finding, and it becomes the regression test once the fix lands.

---

## 1. What was tested

| Layer | How | Location | Result on current code |
|---|---|---|---|
| Server integration (HTTP + Socket.IO) | Black-box. The **real** `server/index.js` runs as a child process against an in-memory MongoDB. Only Firebase token verification is replaced, by a preloaded shim (`test/helpers/fake-firebase.js`). Tests call the REST API and Socket.IO exactly as the client does. | `server/test/integration/*.test.js` | **29 pass / 47 fail**. Every failure is a tagged finding. |
| Client unit | Vitest on the reducer and time-formatting utilities (TZ = Asia/Kolkata) | `client/test/*.test.js` | **5 pass / 14 fail** (all tagged) |
| Browser end-to-end | Playwright + Chromium drive the **production build** of the real Next.js client against the real server and MongoDB, with two users in parallel browser contexts. Only the `firebase/app` and `firebase/auth` modules are swapped for a local shim (`e2e/mocks`); all app code is unmodified. | `e2e/tests/*.spec.js` | **5 pass / 22 fail** (all tagged; the 5 passes are 4 baseline flows plus 1 regression guard) |
| Static analysis | Full code read of both packages, `next build`, `npm audit`, a script that checks every Tailwind class against the compiled CSS, and a dependency/dead-code sweep | — | See findings |

The tests use two kinds of tag:
- `[B-..]` is a bug.
- `[G-..]` is a missing capability.

Untagged tests are baseline behaviour that works today and must keep working. One test is a *regression guard*: it covers coupled behaviour that is correct today but would break during the fix (see B-S04).

### How to run the tests

```bash
# Server: needs a MongoDB binary. mongodb-memory-server downloads one automatically.
# In a sandbox without that download, point it at a local mongod:
#   export MONGOMS_SYSTEM_BINARY=/path/to/mongod     (or MONGO_TEST_URI=mongodb://...)
cd server && npm install && npm test

# Client unit tests
cd client && npm install && npm test

# Browser E2E: builds a copy of the client into e2e/.build, starts the API on :8765
# and Next on :3000. Socket.IO CORS only allows http://localhost:3000.
cd e2e && npm install && npx playwright test
# E2E_SKIP_BUILD=1 reuses the previous client build.
```

---

## 2. Findings

Severity:
- **Critical**: security breach, server crash, or a headline feature that is completely broken.
- **High**: data or privacy leak, or a core flow broken for many users.
- **Medium**: incorrect behaviour with a workaround.
- **Low**: polish or hygiene.

"Evidence" names the test that reproduces the finding, or the file and line when the finding comes from code review.

### 2.1 Top 12 at a glance

| # | ID | What happens |
|---|---|---|
| 1 | B-S30 | Any logged-in user can **crash the whole server** with one malformed socket event (4 different payloads were verified). |
| 2 | B-S01 | Any user can **hijack another user's identity** on the socket and receive their messages, or inject fake messages "from" anyone. |
| 3 | B-C03 | The **Zego server secret is committed** in `client/next.config.js` (since the initial commit) and shipped to every browser. |
| 4 | B-C01 / B-C02 | **Voice and video calls do not work at all**: the callee never rings (`to: undefined`), and the call token URL is `undefined/<id>`. |
| 5 | B-S05 | Any user can mint a **Zego call token for any other user id**. |
| 6 | B-C14 | After logout, the **next user on the same browser sees the previous user's private messages** (cached state is never cleared). |
| 7 | B-S12 | **Onboarding with an uploaded or captured photo fails** (HTTP 413: base64 avatar vs. the 100 KB JSON limit). |
| 8 | B-S04 | **Read receipts never reach the sender** (sent to the reader instead), and anyone can mark anyone's messages read. |
| 9 | B-C24 | The **Logout and Exit menus close on the same click that opens them**, so users can barely log out. |
| 10 | B-C10 / B-C05 | A **new conversation doesn't appear** for the recipient until reload, and the sender's new chat-list entry **opens a broken chat**. |
| 11 | B-S34 | The chat list **loads the user's entire message history** on every load, and message ids grow unbounded inside the User document (16 MB cap). |
| 12 | D-01 | `next@13.4.1` has **critical** security advisories; `npm audit` reports 11 client and 14 server vulnerabilities. |

### 2.2 Security and privacy

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-S30 | Critical | Socket handlers do no input validation and have no error boundary. `read-message` with no payload, `read-message` with a malformed id (CastError in an async handler becomes an unhandled rejection), `outgoing-voice-call` with no payload, and `accept-incoming-call` with no payload **each terminate the Node process**. This is a one-line DoS for any authenticated user. | `socket.test.js › robustness against malformed events` (4 of 5 cases crash) · `server/index.js:141-194` |
| B-S01 | Critical | The socket identity is not bound to the authenticated user. (a) `add-user` trusts any id, so Mallory can register as Bob and receive Bob's live messages. (b) `send-msg` relays whatever `from` and `message` the client sends, so anyone can push fake messages "from" anyone. (c) Relayed messages don't have to exist in the DB. | `socket.test.js › [B-S01] ×3` · `index.js:75-138` |
| B-C03 | Critical | `NEXT_PUBLIC_ZEGO_SERVER_ID: "d2282e41…"` is the Zego **server secret**. It is hard-coded in `client/next.config.js`, inlined into the browser bundle, and present in git history since `f3afe5f`. It is also passed as the 2nd argument of `new ZegoExpressEngine(appId, server)`, where Zego expects a server URL. | `client/next.config.js:5-6`, `Call/Container.jsx:42-45` |
| B-S05 | High | `GET /api/auth/generate-token/:userId` issues a call token for **any** user id. This allows joining calls as someone else. | `auth.test.js › [B-S05]` |
| B-C14 | High | Logout never clears `messagesByChat`, `userContacts`, `currentChatUser`, `onlineUsers` or the axios `Authorization` default. When a second user logs in on the same tab and opens a chat with the same partner, the **first user's private messages are rendered** (for as long as the history fetch takes). | E2E `[B-C14]` (the text was present in 10/10 samples) · unit `[B-C14]` |
| B-S04 | High | `ChatContainer` emits `read-message {from: reader}`, and the server notifies `onlineUsers.get(data.from)`, which is the reader. **The sender never gets read receipts.** The server also marks any message ids read without checking that the socket user is the receiver. | `socket.test.js › [B-S04] ×2` · E2E `[B-S04]` |
| B-S02 | High | `signout` accepts any user id, so anyone can mark anyone offline. | `socket.test.js › [B-S02]` |
| B-S15 | Medium | `get-contacts` returns **every user's email address** to every user (enumeration). | `auth.test.js › [B-S15]` |
| B-S08 | Medium | `get-initial-contacts` spreads the whole populated User document into each row, leaking the partner's full `sentMessages`/`receivedMessages` id arrays (and bloating the payload). | `messages.test.js › [B-S08]` |
| B-S27 | Medium | `/uploads/images/*` and `/uploads/recordings/*` are public static files with no auth. Anyone with a link can fetch private media. | `uploads.test.js › [B-S27]` |
| B-S24 | Medium | Multer writes the file **before** the auth and sender checks. Rejected uploads (403/400/500) leave orphaned files, which allows disk-filling. | `uploads.test.js › [B-S24]` |
| B-S31 | Medium | REST uses `cors()` (all origins) while Socket.IO uses a hard-coded allow-list with `methods: ["*"]`. The policies are inconsistent and not configurable per environment. | `index.js:17, 42-53` |
| B-S38 | Medium | No rate limiting, no `helmet`, no per-socket event throttling. | code review |
| B-S37 | Low | Every socket event logs user ids, emails and the full online-user list (57 `console.log` calls across the code). This is noise and PII in logs. | code review |
| B-S39 | Low | `TokenGenerator` builds the IV and nonce with `Math.random()`. `RndNum` is also buggy: it only ever returns non-negative values. | `utils/TokenGenerator.js:14-27` |

### 2.3 Server: API and real-time correctness

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-S34 | High | `getInitialContactsWithMessages` populates **every message the user has ever sent or received**, sorts them in JS, and builds the list in memory. Message ids are also `$push`ed into unbounded arrays on the User document (16 MB document cap). Cost grows linearly with history. | `MessageController.js:338-424`, `models/user-model.js:8-9` |
| B-S35 | Medium | There are no indexes on `messages.sender/receiver/createdAt`. Every conversation query is a collection scan. | `models/message-model.js` |
| B-S03 | High | The server emits `delivered` to the sender for **every** relayed message, even when the recipient is offline. When the recipient later connects, nothing is persisted or emitted. | `socket.test.js › [B-S03] ×2` |
| B-S06 | Medium | `get-messages` marks the reader's incoming messages `read` in the DB but tells nobody. The sender's ticks stay stale. | `messages.test.js › [B-S06]` |
| B-S07 | Medium | Chat-list rows show the **partner's account creation time** instead of the last message time. The partner's `createdAt` and `updatedAt` overwrite the message's. | `messages.test.js › [B-S07]` · E2E `[B-S07]` |
| B-S09 | Medium | Loading your own chat list flips your **own outgoing** `sent` messages to `delivered`. | `messages.test.js › [B-S09]` |
| B-S28 | Medium | A user who (re)connects never receives the current online list. `add-user` only broadcasts to *others*, so presence goes stale after reconnects. | `socket.test.js › [B-S28]` |
| B-S29 | Medium | Presence is `Map<userId, socketId>` (one socket per user). With two tabs or devices, only the newest socket gets messages, and closing it marks the user offline while the other tab is still open. | `socket.test.js › [B-S29] ×2` |
| B-S26 | Low | Image and audio messages are always stored as `sent`, even when the recipient is online. Text messages become `delivered`. | `uploads.test.js › [B-S26]` |
| B-S21 | Low | The chat-list row overloads `_id` (the partner's user id) next to `messageId`, `sender` and `receiver`. The client reverse-engineers the partner id, which is fragile. | `messages.test.js › [B-S21]` |
| B-S14 | Low | `get-contacts` includes the requesting user, so you can start a chat with yourself. | `auth.test.js › [B-S14]` · E2E `[B-S14]` |
| B-S16 | Low | Contacts have no `id` field, but the client keys lists by `contact.id` (see B-C07). | `auth.test.js › [B-S16]` |

### 2.4 Server: validation and error handling

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-S12 | High | `express.json()` has the default **100 KB** limit. Avatars chosen via "Upload photo" or "Take photo" are sent as base64 data URLs (about 200 KB+), so **onboarding fails with 413** and the user sees "Could not create profile". | `auth.test.js › [B-S12]` · E2E `[B-S12]` |
| B-S17 | Medium | There is no 404 or error-handling middleware. Unknown routes and all thrown errors return Express's HTML pages; in development these include stack traces. | `auth.test.js › [B-S17]` |
| B-S18 | Medium | Malformed ObjectIds in params, body or query return **500** (CastError) instead of 400. | `messages.test.js › [B-S18] ×2` |
| B-S22 | Medium | Multer errors (disallowed MIME type, file over 5 MB) return **500 HTML** instead of 415/413 JSON. | `uploads.test.js › [B-S22] ×2` |
| B-S11 | Medium | Onboarding the same identity twice returns 500 (E11000) instead of 409. | `auth.test.js › [B-S11]` |
| B-S10 | Low | Onboarding with missing fields returns **200** with a plain-text body. | `auth.test.js › [B-S10]` |
| B-S13 | Low | Display names are not validated or trimmed server-side (1 char and 500 chars are both accepted). | `auth.test.js › [B-S13]` |
| B-S19 | Low | Whitespace-only and 20 000-char messages are accepted. | `messages.test.js › [B-S19]` |
| B-S20 | Low | A non-string `message` (for example `{ "$ne": null }`) returns 500 instead of 400. | `messages.test.js › [B-S20]` |
| B-S23 | Low | Uploads without the `from` query param crash with a TypeError (500). The null-check comes after `from.toString()`. | `uploads.test.js › [B-S23]` |
| B-S25 | Low | Image and audio uploads don't check that the receiver exists. | `uploads.test.js › [B-S25]` |
| B-S32 | Low | `connectDb` exits with code **0** on failure, and the server starts listening before the DB is connected. There is no graceful shutdown. | `utils/mongoDb.js:12`, `index.js:38-41` |
| B-S33 | Low | Mutable globals (`global.onlineUsers`, `global.chatSocket`). `chatSocket` is overwritten by every connection and never used. | `index.js:55, 74` |
| B-S36 | Low | The Message schema declares `createdAt` alongside `timestamps: true`, and `type` and `messageStatus` have no enums. | `models/message-model.js` |
| B-S40 | Low | Dead code and dependencies: Prisma client (no schema) plus large commented-out blocks. `zego-express-engine-webrtc`, `crypto` (npm), `node` and `socket.io-client` are server *dependencies*. `chai`/`mocha` are in prod deps, and `start` runs `nodemon`. | `package.json`, controllers |
| B-S41 | Low | The pre-existing `test/socket.test.js` tests a **copy** of the socket logic, not the server, so it passes regardless of server bugs. | `server/test/socket.test.js` |

### 2.5 Client: calls

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-C01 | Critical | `VideoCall`/`VoiceCall` emit `to: videoCall.id`, but the call object is built from `currentChatUser`, which only has `_id`. **The callee never rings.** Caller hang-up (`Container.endCall`) sends `from: data.id` (also undefined), so the callee's ringing never stops. | E2E `[B-C01]` · `socket.test.js › [B-C01]`, `[G-04]` |
| B-C02 | Critical | `Call/Container.jsx` imports `GET_CALL_TOKEN`, which no longer exists (it was renamed to `getCallTokenRoute`). The token request goes to `undefined/<id>`, so **no call can ever connect**. `next build` prints the import error as a warning only. | E2E `[B-C02]` · build log |
| B-C31 | Medium | Other call problems. The `accept-call` listener is never removed. The voice-call avatar check tests `callType === "audio"`, but the value is `"voice"`. The callee "accepts" via a 1 s timeout. `call-sound.mp3` exists but there is no ringtone. There is no timeout or missed-call handling. The Zego engine is never destroyed on unmount. The remote-hangup cleanup reads stale state. The call screen is white text on an undefined background class. | `Call/Container.jsx` |

### 2.6 Client: messaging and chat list

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-C10 | High | A first message from someone who isn't in your chat list is dropped by `UPDATE_CONTACT_PREVIEW` (it returns early when the contact isn't found). The **conversation only appears after a reload.** | E2E `[B-C10]` · unit `[B-C10]` |
| B-C05 | High | After a first message, `MessageBar` inserts `{...currentChatUser, lastMessage}` into the chat list without `sender`/`receiver`. `ChatListItem` then computes `_id: undefined`, and **reopening that chat shows nothing** (`GET /get-messages/<me>/undefined`). | E2E `[B-C05]` |
| B-C20 | Medium | The input is cleared only after the HTTP round-trip. With 400 ms latency, pressing Enter twice **sends the message twice**. | E2E `[B-C20]` (2 copies stored) |
| B-C04 | Medium | Every chat-list row shows the time of the **currently open chat's** last message (`messages[messages.length-1]`). | E2E `[B-C04]` |
| B-C09 | Medium | A message arriving in a background chat does not bump the unread count, the timestamp, or the row's position. | unit `[B-C09] ×2` |
| B-C12 | Low | A late `delivered` event can downgrade a message from `read`. Chat-list ticks are never updated by status events. | unit `[B-C12] ×2` |
| B-C11 | Low | The unread badge is cleared by mutating state (`data.totalUnreadMessages = 0`), which does not reliably re-render. | unit `[B-C11]` |
| B-C13 | Medium | Contact search crashes on a contact without a name, goes stale when contacts change, and a **zero-match search shows every contact**. | unit `[B-C13] ×3` · E2E `[B-C13]` |
| B-C16 | Low | In-chat message search is case-sensitive, doesn't update when new messages arrive, has no `key`s, and results aren't clickable. | E2E `[B-C16]` |
| B-C15 | Medium | `calculateTime` compares **UTC** calendar dates but prints local time. In IST, a message from 11 PM yesterday shows as today's "11:00 PM". On the 1st of the month "Yesterday" becomes a full date. "Two days ago but <48 h" shows "Yesterday". A missing date prints "Invalid Date". | unit `[B-C15] ×4` |
| B-C07 | Low | Chat-list and contact items are keyed by `contact.id` (undefined, so every key is `null`). Contact letter groups are keyed by `Date.now()+letter` (they remount on every render). | E2E `[B-C07]` |
| B-C37 | Low | The chat view always smooth-scrolls to the bottom on any update, even while the user reads history. The whole history renders (no pagination or virtualisation). | `ChatContainer.jsx:77-81` |
| — | note | **Coupling:** today the misrouted read receipt (B-S04) goes back to the reader, who then marks their own copies read, and that is what keeps `ChatContainer` from re-emitting `read-message` for every earlier message on each render. Fixing B-S04 alone would start that spam. The fix must also mark messages read locally. This is covered by the E2E regression guard (originally drafted as B-C06, which did not reproduce). | `messaging.spec.js › regression guard` |

### 2.7 Client: media

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-C19 | Medium | `CaptureAudio` wraps MediaRecorder output (webm/opus in Chromium) in `File(["…"], "recording.mp3", {type: "audio/mp3"})`. The server stores `.mp3`, and Express serves it as `audio/mpeg`. **Safari and Firefox fail to play it.** | `uploads.test.js › [B-C19]` |
| B-C23 | Medium | Voice recorder problems. It stays open after "Send", so the same clip can be re-sent. `handleStopRecording` has an `if` without braces. The microphone stream is **never released** (the browser keeps showing the mic-in-use indicator). Pressing Send while recording posts a null file. | E2E `[B-C23]` · `common/CaptureAudio.jsx:93-107` |
| B-C30 | Medium | `VoiceMessage` plays each clip **twice at once** (WaveSurfer's WebAudio backend plus a separate `new Audio()`). A `ready` listener leaks per message, and "stop" resets instead of pausing. | `Chat/VoiceMessage.jsx:44-79` |
| B-C32 | Medium | `CaptureAudio.sendRecording` and `Container.getToken` don't refresh the ID token. Image-upload failures (for example >5 MB) are only `console.log`ged, so the user gets no feedback. There are no client-side type or size checks. | code review |
| B-C34 | Medium | The avatar upload reads the file and then waits **100 ms** (a `setTimeout` race) before using the DOM `img.src`. Full-size base64 is stored in Mongo, even though `react-image-file-resizer` is installed and unused. | `common/Avatar.jsx:64-77` |
| B-C35 | Low | Image bubbles are forced to 300×300 (distorted), with no lightbox, no lazy loading, and no error state. | `Chat/ImageMessage.jsx` |

### 2.8 Client: session, auth and settings

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-C24 | High | `ContextMenu` closes itself on the same click that opens it. The outside-click check compares `event.target.id` with `"context-opener"`, but a click on the icon lands on its inner `<path>`. The **Logout** and **Exit chat** menus effectively cannot be opened. | E2E `[B-C24]` (verified with `elementFromPoint`) |
| B-C27 | High | The socket is created with a fixed `auth: {token}`. Firebase ID tokens expire after **1 h**, so any reconnect after that (network blip, laptop sleep) is rejected with `unauthorized`. Socket.IO does not retry middleware errors, so **real-time messaging silently stops** until a page reload. | `Main.jsx:79-82` |
| B-C21 | Medium | Opening `/logout` directly (bookmark or refresh) crashes with `TypeError: … reading 'current'` and shows Next's "Application error" screen. | E2E `[B-C21]` |
| B-C22 | Medium | The Profile panel renders an editable `Avatar` without `setImage`. "Remove photo" throws `setImage is not a function`, and the profile cannot actually be edited (there is no API, see G-01). | E2E `[B-C22]` |
| B-C26 | Low | `login.jsx` and `useAuthBootstrap` read `status` from the user record, but the field is `about`. **Returning users never see their About text.** | E2E `[B-C26]` |
| B-C17 | Medium | The theme resets to dark on every reload. `ThemeContext` doesn't persist or apply `html.dark`, while `login.jsx`/`onboarding.jsx` run their own separate localStorage theme. Tailwind `darkMode` is unset (`media`), so the `dark:` classes in `Input`/`PhotoLibrary` follow the OS instead of the app. | E2E `[B-C17]` |
| B-C18 | Low | The "Send on Enter" setting is read once when `MessageBar` mounts. Toggling it in Settings does nothing until a remount. | E2E `[B-C18]` |
| B-C38 | Low | The Settings "Notifications" toggle only requests permission; no notification is ever shown. The camera and microphone toggles can't be switched off. | `common/SettingModal.jsx` |
| B-C25 | Low | Onboarding calls `router.push("/")` twice (the effect and the handler), which aborts one navigation. | E2E console (filtered) |
| B-C28 | Low | The `reconnect`/`reconnect_attempt` handlers are attached to the socket instead of the Manager (`socket.io.on(...)`), so they never fire. `socketStatus` is tracked but **never displayed**. | `Main.jsx:115-124, 180-181` |
| B-C29 | Low | The socket is torn down and recreated whenever the `userInfo` object changes. The async `setupSocket` returns a Promise, so its cleanup never runs. | `Main.jsx:70-225` |
| B-C33 | Medium | `useAuthBootstrap` has no error handling. If the API is unreachable, the chat list shows a skeleton forever and the rejection goes unhandled. | `hooks/useAuthBootstrap.js` |

### 2.9 Client: UI, accessibility and hygiene

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| B-C08 | Medium | **16 Tailwind classes don't exist** (they are leftovers from a WhatsApp-clone palette): `text-icon-ack` (so **read ticks look identical to delivered**), `bg-icon-green`/`text-icon-green` (the unread badge has no background), `bg-incoming-background`/`bg-outgoing-background` (image bubbles), `bg-conversation-panel-background` (call screens are white text on nothing), `bg-dropdown-background`, `bg-panel-header-background`, `bg-search-input-container-background`, `bg-photopicker-overlay-background`, `hover:bg-background-default-hover`, `border-conversation-border`, `border-icon-green`, `border-teal-light`, `text-bubble-meta`, `text-panel-header-icon`. | E2E `[B-C08]` · compiled-CSS check |
| B-C36 | Medium | Accessibility. Clickable SVG icons have no button semantics or labels (chat header call/video/search/menu, sidebar items, recorder, play/stop, end-call). Menus aren't keyboard reachable and don't close on Escape. Modals have no focus trap. There are **6 duplicate element ids** (`context-opener` ×5, `img`). | code review |
| B-C39 | Low | `images.domains` in `next.config.js` holds a full URL (invalid) and isn't needed. The page title is "ChatApp", not Chatter. `login.jsx` contains leftover editing notes. There is a `ChatGroupContainer` stub, and `react-image-file-resizer` is unused. | code review |
| B-C40 | Low | `next build` **hard-fails** (`auth/invalid-api-key` during prerender) when the Firebase env vars are absent, and there is no `.env.example`. | build log |

### 2.10 Dependencies, tooling and documentation

| ID | Sev | Finding |
|---|---|---|
| D-01 | Critical | `next@13.4.1` has multiple critical/high advisories (client `npm audit`: 11 vulnerabilities, 2 critical). `firebase@9` is outdated. |
| D-02 | High | Server `npm audit`: 14 vulnerabilities (1 critical, via the unused `zego-express-engine-webrtc` → protobufjs). `multer@1.x` is deprecated with known vulnerabilities (fixed in 2.x). |
| D-03 | Medium | `package-lock.json` is git-ignored for both packages, so builds are not reproducible. |
| D-04 | Medium | The README is inaccurate. It documents `NEXT_PUBLIC_API_URL` (the code reads `NEXT_PUBLIC_API_HOST`), omits the required `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`, names the Zego *secret* `ZEGO_SERVER_ID`, and advertises Prisma/PostgreSQL support that doesn't exist. There is no `.env.example`. |
| D-05 | Medium | There is no CI, no ESLint config (`next lint` is interactive), and no formatter. |
| D-06 | High | Uploads live on the API server's local disk. The production API runs on Render, whose filesystem is **ephemeral**, so every redeploy or restart deletes all images and voice notes. |

### 2.11 Gaps and missing functionality

| ID | Gap |
|---|---|
| G-01 | No way to edit your profile (name, about, avatar) after onboarding. There is no API (`PATCH /api/auth/profile` → 404) and the Profile panel is read-only. |
| G-02 | No health or readiness endpoint for the hosting platform. |
| G-03 | No message pagination; the whole conversation loads at once. |
| G-04 | Call signalling is incomplete: no "user offline/unavailable" answer, no caller-cancel propagation, no busy state, no call timeout or missed-call record. |
| G-05 | No typing indicator and no "last seen". |
| G-06 | No notifications for messages or calls while the tab is in the background (the setting exists but does nothing). |
| G-07 | No delete, edit, reply or reactions for messages. |
| G-08 | No group chats (`ChatGroupContainer` is a stub). |
| G-09 | No document/file sharing, no image captions, no multi-image send. |
| G-10 | URLs in messages aren't clickable, and there are no link previews. |
| G-11 | No block or report, and no account deletion. |
| G-12 | No connection-status indicator (the state exists but is never shown) and no offline banner. |
| G-13 | No persistent object storage for media (see D-06). |
| G-14 | No structured logging or error tracking. |

---

## 3. Implementation plan (single pass)

Everything below lands as **one change set**. It is grouped by area for readability; the groups are not stages. Each item lists the finding IDs it closes. Where the server and client contracts change, both sides change together and the old socket event names stay accepted for one release, so a browser tab left open during deploy keeps working.

### 3.1 Server: structure and configuration

1. **Split `index.js`** into:
   - `src/app.js` (Express app factory);
   - `src/socket/index.js` (Socket.IO setup);
   - `src/config.js` (validated env);
   - `index.js` (bootstrap: `await connectDb()`, then listen, then graceful `SIGTERM` shutdown that closes io, http and mongoose).
   - `connectDb` exits with code 1 on failure.

   Closes B-S32 and B-S33, and makes in-process testing possible.
2. **`config.js`** validates the env at boot (zod) and fails fast with a clear message:
   - `PORT`, `MONGOURL`;
   - `CLIENT_ORIGINS` (comma list);
   - `FIREBASE_*`;
   - `ZEGO_APP_ID`, `ZEGO_SERVER_SECRET` (renamed, with a fallback to `ZEGO_SERVER_ID` for one release);
   - `STORAGE_DRIVER` (`local`|`s3`), `S3_*`;
   - body/upload limits.

   Closes B-S31 and D-04.
3. **HTTP middleware:**
   - `helmet`;
   - `cors({ origin: CLIENT_ORIGINS, credentials: true })`, sharing the same list as Socket.IO (`methods: ["GET","POST"]`);
   - `express.json({ limit: "256kb" })` (avatars move to multipart, item 3.4.2);
   - `express-rate-limit`: auth 30/min, messages 120/min, uploads 20/min per user;
   - `pino-http` request logging with user id only, no emails.

   Closes B-S31, B-S37 and B-S38.
4. **Errors:**
   - `HttpError` class plus an `asyncHandler` wrapper;
   - JSON 404 handler;
   - central error handler mapping: `CastError` → 400, `ValidationError`/zod → 400, `E11000` → 409, `MulterError LIMIT_FILE_SIZE` → 413, file-filter rejection → 415;
   - everything else → 500 with a request id and no stack in production;
   - uniform shape `{ error: { code, message } }`.

   Closes B-S10, B-S11, B-S17, B-S18, B-S20, B-S22 and B-S23.
5. **Auth middleware:**
   - After verifying the Firebase token, load the Mongo user by `firebaseUid` (falling back to email) and set `req.user = { uid, email, id }`.
   - `requireProfile` guards all `/api/messages` routes.
   - Sender identity always comes from `req.user.id`. Any `from` in the body, params or query must match it or the request gets 403 (kept for compatibility).

   Closes B-S01 (REST) and B-S05.
6. **Validation:**
   - zod schemas per route;
   - `objectId` param validator;
   - message text is a trimmed string of 1–4000 chars;
   - name is trimmed, 3–50 chars;
   - about ≤ 140 chars.

   Closes B-S13, B-S18, B-S19 and B-S20.

### 3.2 Server: data model and migration

1. **Message schema:**
   - `conversationId` (the two user ids sorted and joined);
   - enum `type` (`text|image|audio|file`), enum `status` (`sent|delivered|read`);
   - `deliveredAt`, `readAt`, `editedAt`, `deletedAt`, `replyTo`;
   - `timestamps: true` only (drop the manual `createdAt`).

   Indexes: `{conversationId:1, _id:-1}`, `{receiver:1, status:1}`, `{sender:1, receiver:1}`. Closes B-S35, B-S36, and supports G-03 and G-07.
2. **User schema:**
   - remove `sentMessages`/`receivedMessages`;
   - add `firebaseUid` (unique), `lastSeen`, `blockedUsers`, `avatarUrl`;
   - name validation.

   Closes B-S34.
3. **`scripts/migrate.js`** (idempotent):
   - backfill `conversationId`;
   - `$unset` the two arrays;
   - backfill `firebaseUid` on first login;
   - create indexes.

   Documented in the README.

### 3.3 Server: REST API

1. `POST /api/auth/check-user`, `POST /api/auth/onboard-user`: return a **public profile DTO** `{ id, name, about, avatarUrl, email }` (email only for self). Return 409 on duplicate and 400 on invalid input. Closes B-S10, B-S11, B-S13 and B-C26 (the field is `about`).
2. `PATCH /api/auth/profile` for name/about, and `POST /api/auth/avatar` (multipart; `sharp` resizes to 256 px WebP and stores via the storage adapter). Closes G-01, B-S12 and B-C34.
3. `GET /api/auth/get-contacts?q=&cursor=`:
   - excludes self and blocked users;
   - projection is `{ id, name, about, avatarUrl }` with no email;
   - grouped by letter client-side;
   - paginated.

   Closes B-S14, B-S15 and B-S16.
4. `GET /api/auth/generate-token` issues a token only for `req.user.id` (the legacy `/:userId` returns 403 on mismatch). Closes B-S05.
5. `GET /api/messages/get-messages/:from/:to?limit=50&before=<id>`:
   - cursor pagination, oldest→newest within a page;
   - marks incoming messages read;
   - **emits `read` to the sender's room** via the presence service.

   Closes G-03 and B-S06.
6. `GET /api/messages/get-initial-contacts/:from` is rewritten as a **single aggregation** over `messages` grouped by `conversationId`: last message, unread count, then partner lookup with a projection. Each row is `{ partnerId, partner: {id,name,about,avatarUrl}, lastMessage: {id,type,message,status,sender,createdAt}, unreadCount }`. Only *incoming* `sent` messages become `delivered`, and their senders are notified. Closes B-S07, B-S08, B-S09, B-S21 and B-S34.
7. `POST /api/messages/add-message`, `add-image-message`, `add-audio-message` (and new `add-file-message`):
   - Multer uses **memory storage**.
   - Validate the sender, receiver existence and block status, and sniff the real type with `file-type` **before** writing via the storage adapter.
   - Store the correct extension and MIME type (webm/ogg/mp4/mpeg).
   - Initial status is `delivered` if the receiver is online, for every message type.

   Closes B-S23, B-S24, B-S25, B-S26, B-C19 and G-09.
8. **Media access:**
   - `GET /api/media/:key` checks that the requester is the sender or receiver of the message referencing the key, then streams (local) or redirects to a 5-minute signed URL (S3/R2).
   - Remove the public `express.static` mounts.
   - The storage adapter interface is `put/get/delete/signedUrl` (local driver for dev, S3-compatible for prod).

   Closes B-S27, D-06 and G-13.
9. New endpoints:
   - `GET /health` (DB ping) (G-02);
   - `PATCH /api/messages/:id` (edit), `DELETE /api/messages/:id` (soft delete for everyone within 1 h, or for me) (G-07);
   - `POST /api/users/:id/block`, `DELETE /api/users/:id/block`, `DELETE /api/auth/account` (G-11).
10. Remove the Prisma client and all commented-out code (B-S40).

### 3.4 Server: Socket.IO

1. **Handshake:**
   - verify the ID token, then load the Mongo user and set `socket.data.userId`, rejecting with `unauthorized` or `not_onboarded`;
   - join room `user:<id>`;
   - `presence` service = `Map<userId, Set<socketId>>`;
   - online = set non-empty, and `lastSeen` is saved when the last socket leaves.

   Closes B-S01, B-S29 and G-05.
2. **On connect:**
   - emit `online-users` to the connecting socket (B-S28);
   - broadcast `user-online`;
   - mark pending incoming `sent` messages `delivered` and emit `delivered {messageIds}` to each sender (B-S03).
3. **`add-user`:** accepted but the payload is ignored; the server uses `socket.data.userId`. `signout` only affects the caller's own sockets. Closes B-S01 and B-S02.
4. **`send-msg {messageId, tempId}`:** load from the DB, require `sender === socket.data.userId`, relay to `user:<receiver>` (all tabs), and ack the sender with the DB record. Emit `delivered` **only** if the receiver has a live socket, and persist that status. Legacy payloads are accepted and reduced to `messageId`. Closes B-S01 and B-S03.
5. **`read-message {messageIds | partnerId}`:** update only messages where `receiver === socket.data.userId`, then notify each **sender's** room. Closes B-S04.
6. **Calls:** events are `call:invite`, `call:accept`, `call:reject`, `call:cancel`, `call:end`, `call:busy` and `call:unavailable`, with the legacy names aliased.
   - The server attaches the verified caller profile and routes by user id.
   - Offline callee → `call:unavailable`.
   - A per-user in-call map produces `call:busy`.
   - A 30 s ring timeout produces a missed call, stored as a `type:"call"` message.

   Closes G-04 and B-C01 (the server half).
7. **Hardening:**
   - every handler is wrapped in `safe(schema, handler)` (zod-validate, try/catch, ack `{ok:false,error}`);
   - per-socket token-bucket rate limit;
   - `process.on("unhandledRejection")` logs with context (defence in depth).

   Closes B-S30 and B-S38.
8. `typing {to}` / `stop-typing {to}` relay (G-05).

### 3.5 Client: platform

1. **`src/lib/api.js`:** an axios instance whose request interceptor always attaches a fresh `await currentUser.getIdToken()`. It normalises errors to `{code, message}`. **All** direct `axios` calls and `setAxiosAuthToken` are replaced. Closes B-C32 and B-C27 (REST side).
2. **`src/lib/socket.js` plus a `useChatSocket()` hook:**
   - `io(HOST, { auth: cb => getIdToken().then(token => cb({ token })) })`, so reconnects always use a fresh token;
   - on `connect_error: unauthorized`, force-refresh the token and `socket.connect()`;
   - Manager-level `reconnect_attempt`/`reconnect` events;
   - depends on `userInfo?.id` only;
   - listeners registered once and cleaned up synchronously.

   Closes B-C27, B-C28 and B-C29.
3. **Connection banner** driven by `socketStatus` ("Reconnecting…" / "Offline — messages will send when you're back"). Closes G-12.
4. **State:**
   - add a `RESET_SESSION` action used by logout (clears chats, contacts, current chat and presence) (B-C14);
   - replace `UPDATE_CONTACT_PREVIEW` with `RECEIVE_MESSAGE`, which upserts into the chat's cache, increments `unreadCount` when the chat isn't open, updates the preview, time and status, moves the row to the top, and **inserts a new row** for an unknown partner (fetching their public profile) (B-C09, B-C10);
   - `CHANGE_CURRENT_CHAT_USER` zeroes `unreadCount` immutably (B-C11);
   - status updates use precedence `pending<sent<delivered<read` and also update chat-list rows (B-C12);
   - contact search becomes a memoised **selector** (`useMemo` over `userContacts` + `contactSearch`), with a separate empty-result state; `filteredContacts` is removed (B-C13);
   - drop the `console.log` in the reducer.
5. **One contact shape everywhere:** `{ id, name, about, avatarUrl, lastMessage, unreadCount }`, from the new API. `ChatListItem` opens `contact.id`. Keys are `contact.id` and `letter`. Closes B-C05, B-C07 and B-S21.
6. **`utils/time.js`:** local calendar-day difference via `startOfDay`, then `Intl.DateTimeFormat` for time, weekday and date, with `""` for invalid input. Closes B-C15.
7. **Theme:**
   - Tailwind `darkMode: "class"`;
   - `ThemeContext` initialises from `localStorage` / `prefers-color-scheme`, persists, and toggles `html.dark`;
   - an inline script in `_document` applies it before paint;
   - `login`/`onboarding` use the context (their duplicate logic is deleted).

   Closes B-C17.
8. **Tailwind palette:** define the 16 missing tokens in `tailwind.config.js` (or replace them with existing `light-*`/`dark-*` tokens). Read ticks get a distinct accent colour. Add a CI check that compiled CSS contains every class used. Closes B-C08.
9. **`SettingsContext`** (persisted): enter-to-send, notifications, sounds. Consumers re-render on change. Closes B-C18.

### 3.6 Client: features and components

1. **MessageBar:**
   - a `sendingRef` guard;
   - the input clears immediately after the optimistic insert;
   - retry reuses the `tempId`;
   - emits `send-msg {messageId, tempId}`;
   - image/file picker with client-side type and size checks, an optimistic placeholder with upload progress, and an error toast;
   - emits `typing`.

   Closes B-C20, B-C32 and G-05.
2. **ChatContainer:**
   - read acknowledgements only for incoming messages not yet acknowledged, only while the document is visible, **and dispatched locally as read at the same time** (this preserves the regression guard);
   - "load older" on scroll-top with scroll anchoring;
   - date separators;
   - auto-scroll only when near the bottom or when the message is your own;
   - linkified text (`linkify-react`, `rel="noopener noreferrer"`);
   - message actions menu (reply / edit / delete).

   Closes B-S04 (client half), B-C37, G-03, G-07 and G-10.
3. **ChatListItem / List / ContactsList:**
   - timestamp from `contact.lastMessage.createdAt`;
   - no mutation;
   - badge uses the defined colour;
   - "No chats match" empty state;
   - the contacts picker uses server search with stable keys and loading/error states.

   Closes B-C04, B-C07, B-C11 and B-C13.
4. **SearchMessages:** a case-insensitive `useMemo` over `[messages, term]`, with keys. Clicking a result scrolls to it and highlights the message. Closes B-C16.
5. **ContextMenu:**
   - rendered in a portal;
   - outside-click detection via `menuRef.contains(target) || openerRef.contains(target)` (no ids);
   - Escape closes and focus returns to the opener;
   - arrow-key navigation;
   - position clamped to the viewport.

   Closes B-C24 and B-C36.
6. **Calls:**
   - use `getCallTokenRoute` through the api client (B-C02);
   - build call payloads from `currentChatUser._id` / `contact.id` (B-C01);
   - `NEXT_PUBLIC_ZEGO_APP_ID` plus `NEXT_PUBLIC_ZEGO_SERVER_URL` only, with **the secret removed from `next.config.js`, rotated in the Zego console, and optionally purged from git history** (B-C03);
   - handle `call:unavailable/busy/cancel/end` with clear UI;
   - ringtone (`call-sound.mp3`) with a 30 s timeout;
   - accept only on a real `call:accept`;
   - remove listeners and `zg.destroyEngine()` on unmount;
   - fix `"voice"` vs `"audio"`;
   - define call-screen styles.

   Closes B-C31, G-04 and G-06 (incoming-call notification).
7. **Voice notes:**
   - `CaptureAudio` picks a supported `mimeType` via `MediaRecorder.isTypeSupported` (`audio/webm;codecs=opus`, `audio/mp4` on Safari) and names the file with the matching extension;
   - stops all tracks after recording;
   - Send is disabled until the blob is final, and the recorder closes after sending;
   - errors are surfaced.
   - `VoiceMessage` uses one playback source (WaveSurfer `backend: "MediaElement"` bound to a single `<audio>`), with pause/resume and listener cleanup.

   Closes B-C19, B-C23 and B-C30.
8. **Profile:**
   - the Profile panel becomes an edit form (name, about, avatar) backed by `PATCH /profile` and `POST /avatar`;
   - `Avatar` has an explicit `editable` prop;
   - a promise-based `FileReader` plus `react-image-file-resizer` (256 px) replaces the 100 ms `setTimeout`.

   Closes G-01, B-C22 and B-C34.
9. **Session:**
   - `/logout` works without a socket: `RESET_SESSION`, disconnect the socket, `signOut`, `router.replace("/login")` (B-C21, B-C14);
   - login and bootstrap map `about` (B-C26);
   - onboarding does a single navigation (B-C25);
   - bootstrap shows an error state with a Retry button when the API is unreachable (B-C33).
10. **Images:** preserve the aspect ratio (`object-contain`, `max-w`), `loading="lazy"`, a lightbox on click, and an error placeholder. Closes B-C35.
11. **Notifications:** show a browser `Notification` for incoming messages and calls when `document.hidden` and the setting is on. Clicking it focuses the chat. The camera and mic rows become read-only status indicators. Closes G-06 and B-C38.
12. **Accessibility sweep:**
   - every clickable icon becomes a `<button aria-label>`;
   - unique ids;
   - modals get a focus trap, Escape and `role="dialog"`;
   - verified with `@axe-core/playwright` in E2E.

   Closes B-C36.
13. **Cleanup:**
   - delete `ChatGroupContainer` unless G-08 is built in the same pass (below);
   - remove `images.domains`;
   - title "Chatter";
   - remove comment noise;
   - add `client/.env.example`;
   - make the build tolerate missing Firebase env by deferring `getAuth` to the browser.

   Closes B-C39 and B-C40.

### 3.7 Recommended features included in this pass

These build directly on the reworked data model and socket layer, so they are cheapest to do now:

- **Typing indicator and last seen** in the chat header (G-05).
- **Reply, edit and delete** for messages (G-07).
- **Document/file sharing** (PDF, zip, and so on, ≤ 20 MB) through the same storage adapter (G-09).
- **Link previews** (server-side OpenGraph fetch with an SSRF-safe allow-list and cache) (G-10).
- **Block/report and account deletion** (G-11).
- **Group chats** (G-08). This is optional in this pass because it touches every message path. If included: a `Conversation` collection (`participants[]`, `type: direct|group`, `name`, `avatar`), with `conversationId` on messages already introduced above, and rooms `conv:<id>`. It replaces the `ChatGroupContainer` stub.
- **PWA manifest and service worker** for installability and background push (Web Push with VAPID keys), extending G-06.

### 3.8 Dependencies, tooling, CI and docs

1. **Upgrades:**
   - client: `next` to the current patched LTS (14.2.x or 15.x; keep the pages router), `firebase` 11+, `axios`, `socket.io-client`;
   - server: `multer` 2.x, `firebase-admin` 13, `mongoose` latest 8.x;
   - remove `@prisma/client`, `prisma`, `crypto`, `node`, `zego-express-engine-webrtc` (server);
   - move `mocha`, `chai`, `socket.io-client` to devDependencies;
   - `start: node index.js`, `dev: nodemon index.js`.

   Closes D-01, D-02 and B-S40.
2. **Commit `package-lock.json`** for server, client and e2e (remove the lockfiles from `.gitignore`). Closes D-03.
3. **Linting:** ESLint (`eslint-config-next`; `eslint:recommended` plus `plugin:n` for the server) and Prettier, with `npm run lint` in both packages. Closes D-05.
4. **GitHub Actions workflow** on every PR:
   - server `npm test` (mongodb-memory-server);
   - client `npm test` plus `next build`;
   - Playwright E2E (upload traces on failure);
   - `npm audit --omit=dev --audit-level=high`;
   - the Tailwind class check.

   Closes D-05.
5. **Delete `server/test/socket.test.js`**; the integration suite supersedes it. Closes B-S41.
6. **Docs:**
   - rewrite the README env tables for server and client;
   - architecture overview (REST + Socket.IO event contract table);
   - storage and deployment notes (object storage required on Render);
   - migration instructions;
   - a "Running tests" section;
   - `server/.env.example` and `client/.env.example`.

   Closes D-04 and D-06.
7. **Observability:** `pino` logger (no PII), Sentry (or equivalent) on client and server, and request ids in error responses. Closes G-14 and B-S37.

---

## 4. Acceptance criteria

- **Server:** `npm test` passes, taking all 47 tagged integration tests to green. The 29 baseline tests stay green.
- **Client:** `npm test` passes (all 14 tagged unit tests green).
- **E2E:** `npx playwright test` passes (all 22 tagged scenarios green, plus the 4 baseline tests and the read-receipt regression guard).
- **New tests** are added for everything this plan introduces:
  - profile update and avatar upload;
  - pagination ("load older");
  - typing indicator;
  - edit and delete;
  - file messages;
  - block;
  - call cancel, busy and unavailable;
  - media authorisation;
  - token-refresh reconnect (simulated by expiring the fake token);
  - notification permission flow;
  - an axe accessibility scan with zero serious or critical violations.
- **Audit:** `npm audit --omit=dev` reports no critical or high vulnerabilities in either package.
- **Secrets:** the Zego secret has been rotated, and no secret appears in the client bundle (CI greps `.next/static` for the secret env var names).
- **Calls, manual check** (Zego media can't run in CI): a video call between two browsers with real credentials, covering accept, reject, caller-cancel, callee offline and busy.

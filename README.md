# 💬 Chatter

Real-time chat for the web: one-to-one and group conversations, voice and video calls, media sharing, and read receipts.

Next.js 16 · React 18 · Tailwind CSS · Node.js 20+ · Express 5 · Socket.IO · MongoDB (Mongoose) · Firebase Authentication · ZEGOCLOUD (calls)

---

## Features

- **Messaging**: one-to-one and **group chats**; replies, edits (15 min), delete for me / for everyone (1 h), emoji reactions.
- **Real time**: instant delivery to every open tab and device, typing indicators, online status and last seen.
- **Receipts**: per-recipient sent → delivered → read state. In groups, "read" means every member has read the message.
- **Media**: photos (metadata stripped), voice notes, documents (PDF, Office, archives, text; up to 20 MB), and link previews.
- **Voice and video calls**: ringing, accept and decline, busy and offline detection, a 30 s ring timeout, mute and camera controls, and a call log in the chat.
- **Groups**: create, rename, set a photo and description, add and remove members, promote admins, leave.
- **Safety**: block and report users, delete your account, and media served only through signed, expiring URLs.
- **Convenience**: message search, paginated history, browser notifications, light and dark themes (persisted), Send-on-Enter, and an offline / reconnecting indicator.
- **Accessible**: real buttons with labels, keyboard-operable menus, focus-trapped dialogs, and no duplicate ids. CI checks this with an axe scan.

## Project structure

```
client/   Next.js web app (pages router)
server/   Express + Socket.IO API
  src/      config, app factory, routes, services, socket layer, models
  scripts/  migrate.js — one-off upgrade of pre-2026 data
e2e/      Playwright end-to-end tests (real client + real server)
docs/     QA report and implementation plan
```

## Getting started

### Prerequisites

- Node.js 20.9 or newer
- MongoDB 6 or newer (local or Atlas)
- A Firebase project with **Google sign-in** enabled
- Optional, for calls: a ZEGOCLOUD project

### 1. Server

```bash
cd server
cp .env.example .env      # fill in the values described below
npm install
npm run dev               # or: npm start
```

| Variable | Required | Description |
|---|---|---|
| `MONGOURL` | ✓ | MongoDB connection string |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | ✓ | Firebase **service account** (Project settings → Service accounts). Keep `\n` sequences in the key. |
| `MEDIA_URL_SECRET` | ✓ in production | ≥ 32 random characters used to sign media URLs |
| `CLIENT_ORIGINS` | | Comma-separated browser origins allowed for REST and sockets (default: `http://localhost:3000` plus the existing Vercel URLs) |
| `ZEGO_APP_ID`, `ZEGO_SERVER_SECRET` | | ZEGOCLOUD credentials. Calls are disabled without them. The secret never leaves the server. |
| `UPLOAD_DIR` | | Where media is stored (default `./uploads`). **Use a persistent disk in production.** |
| `TRUST_PROXY` | | Number of proxies in front of the app (set `1` on Render/Heroku) |

See [`server/.env.example`](server/.env.example) for every option, including rate limits, edit/delete windows, and group size.

The server refuses to start, with a clear message, if required configuration is missing. `GET /health` reports readiness.

### 2. Client

```bash
cd client
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_HOST` | URL of the API server (default `http://localhost:8000`) |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web app config (API key, auth domain, project id, …) |

Only public values belong in the client. Call tokens are issued per user by the API.

### Upgrading an existing deployment

Older versions stored messages without conversations and kept ever-growing message arrays on each user. Run the idempotent migration once against the production database **before** starting the new server:

```bash
cd server && MONGOURL="mongodb+srv://…" npm run migrate
```

Then rotate the ZEGOCLOUD **ServerSecret** in the ZEGOCLOUD console. Earlier versions committed it to `client/next.config.js`, so it must be treated as public. Set the new value as `ZEGO_SERVER_SECRET` on the server only.

## Deployment notes

- **Media storage**: uploads are written to `UPLOAD_DIR`. On hosts with an ephemeral filesystem (e.g. Render), mount a persistent disk there; otherwise media is lost on every deploy. Storage goes through `server/src/services/storage.js`, so an object-storage adapter can be swapped in later.
- **Scaling**: presence and call state are in-process. For more than one server instance, add the Socket.IO Redis adapter and move presence to Redis.
- **Proxies**: set `TRUST_PROXY` so rate limiting sees real client IPs.

## Testing

```bash
cd server && npm test          # 94 black-box integration tests (real server + in-memory MongoDB)
cd client && npm test          # unit tests (state, time formatting, persistence)
cd e2e && npm install && npx playwright install chromium && npx playwright test
                               # 40 browser scenarios against the production client build
```

- The server tests start the real `index.js` and replace only Firebase token verification. `mongodb-memory-server` downloads a MongoDB binary on first run; set `MONGOMS_SYSTEM_BINARY=/path/to/mongod` to use a local one.
- The E2E suite builds the client with the Firebase SDK aliased to a local shim, then drives two or more users in parallel browser contexts.
- Lint and format checks: `npm run lint` and `npm run format:check` in `server/` and `client/`. `npm run check:classes` in `client/` fails on Tailwind classes that produce no CSS.

CI (`.github/workflows/ci.yml`) runs all of the above, plus `npm audit` and a check that no server secrets end up in the browser bundle.

## API overview

All `/api` routes require `Authorization: Bearer <Firebase ID token>`. Errors are JSON: `{ "error": { "code", "message" } }`.

| Area | Endpoints |
|---|---|
| Account | `POST /api/auth/check-user`, `POST /api/auth/onboard-user`, `PATCH /api/auth/profile`, `POST /api/auth/avatar`, `DELETE /api/auth/account`, `GET /api/auth/generate-token` |
| Users | `GET /api/users?q=`, `GET /api/users/:id`, `POST`/`DELETE /api/users/:id/block`, `POST /api/users/:id/report` |
| Conversations | `GET /api/conversations`, `POST /api/conversations/direct`, `POST /api/conversations` (group), `GET`/`PATCH /api/conversations/:id`, `POST /api/conversations/:id/members`, `PATCH`/`DELETE /api/conversations/:id/members/:userId`, `POST /api/conversations/:id/read` |
| Messages | `GET`/`POST /api/conversations/:id/messages`, `POST /api/conversations/:id/{images,audio,files}`, `PATCH`/`DELETE /api/messages/:id`, `POST /api/messages/:id/reactions` |
| Other | `GET /api/link-preview?url=`, `GET /health`, `GET /uploads/:kind/:file` (signed or authenticated) |

The original endpoints (`/api/messages/add-message`, `get-messages/:from/:to`, `get-initial-contacts/:from`, `add-image-message`, `add-audio-message`) are still supported for older clients.

Socket events (client → server): `typing`, `stop-typing`, `read-message`, `outgoing-voice-call`, `outgoing-video-call`, `accept-incoming-call`, `reject-voice-call`, `reject-video-call`. Server → client: `msg-recieve`, `msg-updated`, `msg-removed`, `delivered`, `read`, `online-users`, `user-online`, `user-offline`, `typing`, `stop-typing`, `conversation-updated`, `conversation-removed`, `profile-updated`, `incoming-voice-call`, `incoming-video-call`, `accept-call`, `call-ended`, `call-unavailable`. Every client event is validated and rate-limited; the user's identity always comes from the handshake token.

## Contributing

Issues and pull requests are welcome: <https://github.com/Ritik-1118/Chatter/issues>. Please run the lint, format, and test commands above before opening a PR.

## License

[MIT](LICENSE)

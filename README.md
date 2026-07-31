# My Dream Board — Backend API

Backend for the **My Dream Board** mobile app and admin dashboard. Users build dream boards, place Dreams on them, then break each Dream into Goals and Milestones and track streaks and progress. Admins manage users, reference content and analytics.

The core hierarchy is **Dream Board → Dream → Goal → Milestone**. A *Dream* is what the user wants to experience, become, achieve or have — an image, a title and a Dream Story, shown on the board. Goals and Milestones are the actionable path beneath it. Progress rolls all the way up: completing a Milestone updates its Goal, which updates its Dream, which updates the Board.

Express 4 · MongoDB / Mongoose 8 · JWT (access + refresh) · Zod · Cloudinary · Firebase Cloud Messaging · node-cron. ES modules throughout.

**116 endpoints across 17 modules.** A ready-to-import Postman collection lives in [`docs/`](docs/).

---

## Quick start

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL, JWT secrets, SMTP, Cloudinary
npm run seed              # areas of life, priorities, badges, quotes, pages, super admin
npm run dev
```

Server starts on `http://localhost:5000`. Health check: `GET /health`.

The seed prints the super admin credentials (defaults: `admin@mydreamboard.app` / `Admin@1234` — change these in `.env` before deploying).

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Start for production |
| `npm run seed` | Idempotent seed — safe to re-run |
| `npm run repair:progress` | Recompute every goal's derived progress counters |
| `npm run repair:streaks` | Rebuild every user's streak from milestone history |
| `npm run migrate:dreams` | One-off migration to the Dream structure — see below |

### Migration

If you are upgrading a database created before the Dream layer existed, run once:

```bash
npm run migrate:dreams
npm run seed
```

It converts each board image into a Dream, backfills the seven default Areas of Life as global, drops the stale unique indexes that blocked user-owned categories, and recomputes every board counter. Safe to re-run.

---

## Postman

1. Import both files from [`docs/`](docs/):
   - `My-Dream-Board.postman_collection.json`
   - `My-Dream-Board.postman_environment.json`
2. Select the **My Dream Board - Local** environment.
3. Run **Auth → Register**, then **Auth → Verify Email** (in development the OTP is printed to the server console).
4. Run **Admin → Login as Admin** to populate `{{adminToken}}`.

Tokens and resource ids (`goalId`, `dreamId`, `boardId`, `milestoneId`, …) are captured into the environment automatically by test scripts, so the collection runs top-to-bottom without copy-pasting anything.

The collection also carries, for the frontend developer:

- **Saved example responses** on 48 GET requests — open a request, click "Example response", and read the exact JSON shape without sending anything
- **A screen → endpoint map** in the collection description, so you can go from a Figma frame to the right call
- **A description on all 117 requests**, naming the screen each one serves

---

## Conventions

**Success**
```json
{ "success": true, "message": "...", "meta": { "page": 1, "limit": 10, "total": 42, "totalPage": 5 }, "data": {} }
```
`meta` appears only on paginated list endpoints.

**Error**
```json
{ "success": false, "message": "Validation failed", "errorSources": [{ "path": "body.email", "message": "Must be a valid email address" }] }
```
`stack` is included outside production. Mongoose cast/validation/duplicate-key, Zod, JWT and Multer errors are all normalised into this shape.

**Auth** — `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; refresh with `POST /auth/refresh-token` (rotating — the old refresh token is revoked). Changing or resetting a password revokes every session.

**Dates** — every date field is returned as raw ISO **plus** a pre-formatted label (`dueLabel: "In 3 days"`, `updatedLabel: "Just now"`, `joiningDate: "Jul 27, 2026"`), computed in the user's timezone. Use whichever you prefer.

**Pagination** — `?page=1&limit=10&sortBy=createdAt&sortOrder=desc&searchTerm=`.

---

## Module map

Base URL `/api/v1`.

| Module | Base path | Serves |
|---|---|---|
| Auth | `/auth` | Sign Up, Sign In, Forgot Password, Enter OTP, Reset Password |
| Users | `/users` | Profile screen, Admin Settings → Personal Information |
| Home | `/home` | Home screen (one call) |
| Goals | `/goals` | Goals list, New goal, Goal detail |
| Milestones | `/milestones` | New milestone, the checkbox toggle |
| Dream Boards | `/boards` | Vision tab, Create board, board detail, collage, viewer |
| Dreams | `/boards/:id/dreams` | Add/edit a Dream, Dream detail and its Goals |
| Progress | `/progress` | Progress tab |
| Achievements | `/achievements` | Profile → Achievements |
| Notifications | `/notifications` | Notification feed, FCM device tokens |
| Settings | `/settings` | Settings toggles |
| Content | `/content` | Reference chips, cover moods, Help & Support pages |
| Admin Dashboard | `/admin/dashboard` | Stat cards, both charts, recent users |
| Admin Users | `/admin/users` | All Users table, profile modal, status/delete |
| Admin Content | `/admin/content` | Add Content page |
| Admin Notifications | `/admin/notifications` | Header bell, broadcast |
| Uploads | `/uploads` | Generic Cloudinary helpers |

Admin Settings reuses `PATCH /users/me` and `PATCH /auth/change-password` — there is no duplicate admin profile module.

---

## Behaviour worth knowing

### Goal progress is derived, never set directly
`progress`, `totalMilestones` and `completedMilestones` are persisted on the goal so list screens render without a join, but **`services/goalProgress.service.js` is the only writer**. It full-recomputes from the database rather than incrementing, so concurrent toggles converge on the truth.

- `progress = round(completedMilestones / totalMilestones × 100)`, `0` when there are no milestones
- A goal auto-completes when every milestone is done, and reverts to `active` (clearing `completedAt`) if one is un-checked
- A goal with **no** milestones can never auto-complete — use `PATCH /goals/:id/complete`
- If the numbers ever drift, `npm run repair:progress` reconciles them

### `PATCH /milestones/:id/toggle` is the hot path
One call flips the checkbox, recomputes the goal, cascades that up to the Dream and Board, writes an activity log, updates the streak and evaluates achievements — then returns `{ milestone, goal, streak }` so the Goal detail screen updates in a single round-trip.

### The Dream layer
`Dream` sits between a board and its goals. Each Dream holds an image, a `title` and a `story` (the Dream Story), and carries derived `totalGoals`, `completedGoals` and `progress`.

- **`Goal.dream` is optional.** A goal can hang under a Dream or stand alone, so nothing is forced on the user.
- Progress cascades **Milestone → Goal → Dream → Board**, each level averaging the one below it. `services/dreamProgress.service.js` is the only writer for the Dream and Board figures, same discipline as goal progress.
- Deleting a Dream **unlinks** its goals rather than deleting them — no user work is ever lost.
- Board `coverImage` falls back to the first remaining Dream's image if the cover Dream is removed.

### Areas of Life are global or user-owned
`AreaOfLife.user` is `null` for the seven seeded defaults and set for a user's own categories. `GET /content/areas` returns defaults **plus** that user's own; the admin endpoints only ever touch the globals. Users can't edit or delete a default, can't create one whose name collides with a default, and can't delete their own while any of their goals still use it.

### Subscription tiers (architecture only — no payment in this phase)
`user.subscription.tier` is `free` or `premium`, and `user.activeTier` is a virtual that automatically downgrades to `free` once `expiresAt` passes, so an expired subscription needs no cron job to take effect.

Limits live in one place, `PLAN_LIMITS` in [`constants/index.js`](constants/index.js), and are enforced by `assertWithinLimit()` at each create endpoint. `-1` means unlimited.

| Limit | Free | Premium |
|---|---|---|
| Dream boards | 2 | unlimited |
| Dreams per board | 10 | unlimited |
| Goals | 10 | unlimited |
| Milestones per goal | 15 | unlimited |
| Custom areas of life | 3 | unlimited |

`GET /users/me/subscription` returns the tier, every limit and current usage. Tier is set today by `PATCH /admin/users/:id/subscription`. When in-app purchases are added later, a payment webhook flips the same field — no restructuring, and `requireTier('premium')` is already available for gating premium-only endpoints.

### Streaks are timezone-correct
A streak day is a calendar day **in the user's timezone** with at least one milestone completed. All day arithmetic is done on `YYYY-MM-DD` strings via `Intl.DateTimeFormat`, never by subtracting milliseconds — that is what makes it survive DST.

Streaks are normalised on read: a stale streak reports `0` without needing a midnight job. `isPersonalBest` drives the "Personal best" label.

### Charts are always zero-filled
MongoDB returns nothing for an empty bucket, which would collapse a 7-bar chart to 4. Every chart endpoint generates the full bucket list first and merges counts in.

Note the deliberate difference in week start: the mobile daily chart runs **Mon–Sun**, the admin registration rate runs **Sun–Sat**, matching the designs.

### "+12% this week"
Returned as `overall.delta` with a `deltaBasis` field:
- `"activity"` — milestones completed in the last 7 days over total milestones. Used until history exists.
- `"snapshot"` — today's overall percent minus the `ProgressSnapshot` from 7 days ago. Exact. Kicks in automatically once the nightly job has 7 days of history.

The client does not need to care which.

### Admin stat cards
The design shows percentages on user *count* cards, which is ambiguous. Both endpoints return raw counts **and** percentages so the frontend can render either without a backend change:
- `activeUsers.percent` = active ÷ total (active = seen in the last 30 days)
- `totalUsers.percent` = total ÷ `ADMIN_USER_TARGET` (env var, default 100)
- `changePercent` / `trend` drive the ↑ arrow, comparing 30-day windows

> `ADMIN_USER_TARGET` is an assumption — confirm the intended meaning of the "91%" with the designer and adjust.

### User growth is cumulative with a carry-in
`GET /admin/dashboard/user-growth` returns per-month `newUsers` **and** a running `totalUsers`, seeded by `carryIn` (the user count before Jan 1). Without that seed the curve would restart at zero every January.

### Reference chips are protected
Seeded areas of life and priorities cannot be deleted, and any chip still referenced by a goal is refused with a 409 suggesting deactivation instead. Deleting a cover mood that boards still use deactivates it rather than breaking those boards.

### Notifications and cron are idempotent
Every scheduled notification carries a unique `dedupeKey` (`<type>:<refId>:<day>`). A duplicate insert is swallowed, so jobs are safe to run more than once, mid-deploy, or across multiple instances.

| Schedule (UTC) | Job |
|---|---|
| `0 8 * * *` | Milestone reminders — due in 3d / 1d / today |
| `0 9 * * *` | Goal deadline reminders — due in 7d / 3d / 1d |
| `0 7 * * *` | Daily inspiration |
| `5 0 * * *` | Nightly progress snapshots |
| `30 3 * * 0` | Cleanup of expired tokens |

All respect the per-user toggles in Settings. Set `ENABLE_CRON=false` to disable.

---

## Environment variables

See [`.env.example`](.env.example) for the full list.

| Group | Notes |
|---|---|
| `DATABASE_URL` | MongoDB connection string. Include the database name in the path. |
| `JWT_*` | Separate secrets for access, refresh and reset tokens. **Change these before deploying.** |
| `OTP_*` | 6-digit codes, 5 min expiry, 45 s resend cooldown, 5 attempts. |
| `SMTP_*` | If unset, OTP emails are logged to the console instead of sent — fine for local dev. |
| `CLOUDINARY_*` | Required for any image upload. |
| `FIREBASE_*` | Optional. If unset, push is a no-op with a warning; in-app notifications still work. `FIREBASE_PRIVATE_KEY` may contain literal `\n`, which is unescaped automatically. |
| `ADMIN_TIMEZONE` | Olson name (e.g. `Asia/Dhaka`) used for admin analytics buckets and cron. |
| `SUPER_ADMIN_*` | Credentials created by `npm run seed`. |

---

## Project structure

```
config/       env, db, cloudinary, mailer, firebase
constants/    enums and shared constants
models/       18 Mongoose models
services/     goalProgress, dreamProgress, streak, badge, notification, push,
              analytics, activity, auth, plan
controllers/  one per module
routes/       one per module, registered flat in app.js
validations/  Zod schemas per module
middlewares/  auth, requireTier, validateRequest, rateLimiter, upload,
              parseJsonBody, error handlers
utils/        ApiError, catchAsync, sendResponse, QueryBuilder, cloudinary, token, otp,
              email, dateHelper, labelHelper, pick
jobs/         cron jobs + registry
seed/         idempotent seed data
scripts/      repair + migration utilities
docs/         Postman collection + environment
```

---

## Not implemented

**Payment processing is deliberately out of scope for this phase.** The subscription *architecture* is in place — tiers, per-tier limits and enforcement — but there is no payment gateway, no receipt validation and no store integration. Premium is granted by an admin.

Adding real subscriptions later means: App Store Connect and Play Console product setup, in-app purchase handling in the mobile app, and on the backend receipt validation plus renewal webhooks and a subscription state machine. Apple and Google mandate their own in-app purchase for digital subscriptions, so Stripe is only an option on web. None of it requires changing what exists today.

The `Interactions` item visible in some admin design frames is a leftover from the reused template.
#   b a c k e n d - l _ m a s o l i  
 
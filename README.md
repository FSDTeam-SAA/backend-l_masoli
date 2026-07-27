# My Dream Board — Backend API

Backend for the **My Dream Board** mobile app and admin dashboard. Users set goals across areas of life, break them into milestones, build vision boards, and track streaks and progress. Admins manage users, reference content and analytics.

Express 4 · MongoDB / Mongoose 8 · JWT (access + refresh) · Zod · Cloudinary · Firebase Cloud Messaging · node-cron. ES modules throughout.

**107 endpoints across 16 modules.** A ready-to-import Postman collection lives in [`docs/`](docs/).

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

---

## Postman

1. Import both files from [`docs/`](docs/):
   - `My-Dream-Board.postman_collection.json`
   - `My-Dream-Board.postman_environment.json`
2. Select the **My Dream Board - Local** environment.
3. Run **Auth → Register**, then **Auth → Verify Email** (in development the OTP is printed to the server console).
4. Run **Admin → Login as Admin** to populate `{{adminToken}}`.

Tokens and resource ids (`goalId`, `boardId`, `milestoneId`, …) are captured into the environment automatically by test scripts, so the collection runs top-to-bottom without copy-pasting anything.

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
One call flips the checkbox, recomputes the goal, writes an activity log, updates the streak and evaluates achievements — then returns `{ milestone, goal, streak }` so the Goal detail screen updates in a single round-trip.

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
services/     goalProgress, streak, badge, notification, push, analytics, activity, auth
controllers/  one per module
routes/       one per module, registered flat in app.js
validations/  Zod schemas per module
middlewares/  auth, validateRequest, rateLimiter, upload, parseJsonBody, error handlers
utils/        ApiError, catchAsync, sendResponse, QueryBuilder, cloudinary, token, otp,
              email, dateHelper, labelHelper, pick
jobs/         cron jobs + registry
seed/         idempotent seed data
scripts/      repair utilities
docs/         Postman collection + environment
```

---

## Not implemented

**Subscription plans and payments** are deliberately out of scope for this phase. The `Subscription Plans` and `Interactions` items visible in some admin design frames are leftovers from the reused template.
#   b a c k e n d - l _ m a s o l i  
 
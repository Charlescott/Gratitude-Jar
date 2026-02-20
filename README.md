# Gratitude Jar

Gratitude Jar is a full-stack journaling app where users can:
- create personal gratitude entries,
- set scheduled reminder emails,
- create/join private Circles,
- share Circle entries (including anonymous posts),
- receive Circle activity notifications by email.

This repository contains:
- `client/`: React + Vite frontend
- `server/`: Express + PostgreSQL API, cron scheduler, and email delivery

## Tech Stack

### Frontend
- React 19
- React Router
- Vite

### Backend
- Node.js (ESM)
- Express 5
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcrypt`)
- Cron scheduling (`node-cron`)
- Email delivery (`nodemailer`, optional Resend API path)
- Timezone handling (`luxon`)

## Core Features

### Authentication
- Register/Login with JWT.
- Protected routes in frontend and backend (`requireUser` middleware).

### Personal Entries
- Create/read/delete personal gratitude entries.
- Optional mood tagging.

### Reminder Emails
- Per-user reminder settings:
  - `frequency`
  - `time_of_day`
  - `active`
  - `timezone`
- Cron checks reminders every minute.
- Timezone-aware matching.
- Unsubscribe endpoint supported via signed token when `JWT_SECRET` is configured.

### Circles
- Create circle (owner auto-joins).
- Join by invite key.
- View circle detail and member list.
- Share gratitude entries to circle.
- Optional anonymous posting inside circles.
- Delete own circle entries.
- Leave circle (non-owner) or delete circle (owner).

### Circle Notification Emails
- Notify existing members when:
  - a new member joins,
  - someone shares gratitude.
- Notification fan-out runs asynchronously so API responses are not blocked by email latency.

## Repository Structure

```text
gratuity-jar/
  client/
    src/
      api/
      components/
      pages/
  server/
    db/
      index.js
      schema.sql
      seed.js
      reminderCron.js
    middleware/
    routes/
      auth.js
      entries.js
      reminders.js
      circles.js
      mailer.js
    index.js
```

## Local Development

### Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm
- PostgreSQL instance

### 1) Install dependencies

```bash
cd gratuity-jar/client
npm install

cd ../server
npm install
```

### 2) Configure environment variables

Create/confirm:
- `server/.env.local`
- `client/.env.local`

#### `client/.env.local`

```env
VITE_API=http://localhost:5000
```

#### `server/.env.local` (example)

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<db>
JWT_SECRET=<your-jwt-secret>

# Email
EMAIL_USER=<smtp-user>
EMAIL_PASS=<smtp-pass>
EMAIL_FROM="Gratitude Jar <notifications@yourdomain.com>"
EMAIL_SUPPORT=support@yourdomain.com

# Optional app links
APP_URL=http://localhost:5173
APP_LOGO_URL=http://localhost:5173/logo.png
API_URL=http://localhost:5000

# Optional (preferred for production)
RESEND_API_KEY=<resend-key>
```

### 3) Run backend

```bash
cd gratuity-jar/server
npm run dev
```

### 4) Run frontend

```bash
cd gratuity-jar/client
npm run dev
```

App should be available at Vite URL (usually `http://localhost:5173`).

## Database Notes

Schema file: `server/db/schema.sql`

Important columns/features used by the current app:
- `user_reminders.timezone`
- `user_reminders.last_sent`
- `gratitude_entries.circle_id`
- `gratitude_entries.is_anonymous`

### Important migration for older local DBs

If your local DB was created before anonymous circle posts were added:

```sql
ALTER TABLE gratitude_entries
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;
```

## Scripts

### Client (`client/package.json`)
- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run preview`: preview production build
- `npm run lint`: run ESLint

### Server (`server/package.json`)
- `npm run dev`: start API with nodemon
- `npm start`: start API with node
- `npm run seed`: run DB seed script

## API Overview

Main route groups:
- `/auth`
- `/entries`
- `/reminders`
- `/circles`

Notable circle endpoints:
- `GET /circles/:id/members`
- `POST /circles/:id/entries`
- `GET /circles/:id/entries`

Notable reminder endpoint:
- `GET/POST /reminders/unsubscribe?token=...`

## Email Behavior

Email logic is in `server/routes/mailer.js`.

Current behavior:
- Reminder email supports unsubscribe metadata and fallback handling.
- Circle emails use app-style CTA button and fallback plain link.
- Domain alignment warnings are logged if sender/app domains differ.

## Deployment Notes

### Frontend (Vercel)
- Configure custom domain in Vercel settings.
- For SPA routing on Vercel, use `client/vercel.json` rewrites.

### Backend
- Ensure all env vars are set in hosting provider.
- Cron reminders run inside the API process; host must keep process alive.

## Operational Caveats

- Reminder “already sent today” logic prevents multiple sends in same calendar day (user timezone).
- If reminder time or timezone is changed after a send, reminder may not send again until next day unless `last_sent` is reset.
- Circle notification emails are asynchronous and can fail independently without failing the entry/join request.

## Security and Secrets

- Do not commit real API keys, SMTP passwords, or DB credentials.
- Rotate any previously exposed credentials immediately.
- Prefer provider-managed secrets in deployment platforms.

## Suggested Next Improvements

- Add automated tests for reminder cron behavior and circle flows.
- Add user-level notification preferences (reminder/circle toggles).
- Add migration management tool (e.g., Knex, Prisma migrations, or dbmate).
- Add centralized structured logging for cron and email outcomes.

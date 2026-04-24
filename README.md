# Employee Tracker (Next.js + MongoDB)

This is a fully functional clone of the provided employee tracker demo, rebuilt with Next.js App Router, NextAuth credentials login, and MongoDB persistence.

Each login account gets isolated data. Records created by one user are not visible in another user's workspace.

## Implemented Features

- Authentication: register/login/logout with hashed passwords.
- Dashboard: stats cards and lead pipeline summary.
- Workspace: create and persist
	- leads
	- daily activity reports
	- deal closures
	- follow-up logs
	- expense reports
	- email logs
	- attendance rows
- Leaderboard: computed from saved user activity.
- My History: unified timeline across form submissions.
- Calendar data: attendance entries grouped by month.

## Tech Stack

- Next.js 16 (App Router, TypeScript)
- MongoDB + Mongoose
- NextAuth (Credentials provider)
- Tailwind CSS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and set values:

```bash
cp .env.example .env.local
```

Required values:

- `MONGODB_URI`
- `NEXTAUTH_SECRET`

`NEXTAUTH_URL` is optional when deploying to Vercel because the app can derive the host URL from `VERCEL_URL`.

## Vercel Environment Variables (Recommended)

For production deployments, set secrets in Vercel project settings (or via `vercel env`) instead of committing any `.env` file.

- Set `MONGODB_URI` in Vercel Environment Variables.
- Set `NEXTAUTH_SECRET` in Vercel Environment Variables.
- Optionally set `NEXTAUTH_URL` if you want an explicit canonical auth URL.

## Vercel Deployment Checklist

- Framework Preset: `Next.js`
- Root Directory: repository root for this app (`employee-tracker-next`)
- Build Command: `npm run build`
- Output Directory: leave empty/default (do not set a custom output directory)
- Install Command: `npm install`
- Node.js Version: `20.x`

If you previously set a custom Output Directory in Vercel, clear it and redeploy.

3. Run in development:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
npm run start
```

## API Overview

- `POST /api/register`
- `GET|POST /api/leads`
- `GET|POST /api/daily-reports`
- `GET|POST /api/deals`
- `GET|POST /api/followups`
- `GET|POST /api/expenses`
- `GET|POST /api/emails`
- `GET|POST /api/attendance`
- `GET /api/dashboard`
- `GET /api/history`
- `GET /api/leaderboard`

All routes except register/auth require a valid session.

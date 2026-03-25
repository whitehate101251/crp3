# Construction ERP

A role-based attendance and workforce management system for construction sites.

The application is built with Next.js App Router and Supabase, and supports three operational roles:

- **Admin**: system management, approvals, exports, user/site administration.
- **Site Incharge**: attendance review and foreman oversight for assigned site.
- **Foreman**: worker management and daily attendance submission.

---

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Role Flow](#role-flow)
- [Authentication & Authorization](#authentication--authorization)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Seeding Development Data](#seeding-development-data)
- [API Overview](#api-overview)
- [Scripts](#scripts)
- [Operational Notes](#operational-notes)
- [Troubleshooting](#troubleshooting)

---

## Overview

Construction ERP helps teams track labor attendance across sites with a structured approval pipeline.

Typical daily flow:

1. Foreman marks worker attendance and submits a sheet.
2. Site Incharge reviews, corrects if needed, and forwards to Admin.
3. Admin approves final records and exports attendance reports.

The system stores attendance in normalized sheet/record tables and applies role-based route and API access controls.

---

## Core Features

- Role-based dashboards for **Admin**, **Site Incharge**, and **Foreman**.
- Site and user management with hierarchy support (`parent_id`, `site_id`).
- Worker CRUD with role-aware visibility and ownership constraints.
- Attendance lifecycle with statuses:
	- `DRAFT`
	- `SENT_TO_SI`
	- `SENT_TO_ADMIN`
	- `APPROVED`
- SI review workflow with double-check support.
- Admin approval workflow with final timestamp (`approved_at`).
- Attendance export endpoint for date-range reporting.
- SI attendance tracking endpoint and records view.
- Development seed route for local/demo bootstrap.

---

## Tech Stack

- **Frontend/Backend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling/UI**: Tailwind CSS v4, custom UI primitives
- **Database/Auth storage**: Supabase (Postgres + service role access)
- **Session auth**: Signed JWT cookie (`jose`)
- **Utilities**: `bcryptjs`, `date-fns`, `exceljs`, `jspdf`

---

## Project Structure

```text
construction-erp/
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── admin/
│   │   ├── site-incharge/
│   │   ├── foreman/
│   │   └── api/
│   │       ├── auth/
│   │       ├── users/
│   │       ├── sites/
│   │       ├── workers/
│   │       ├── attendance/
│   │       ├── dashboard/
│   │       └── seed/
│   ├── components/
│   ├── hooks/
│   └── lib/
│       ├── auth/
│       ├── supabase/
│       ├── translations/
│       └── seed.ts
├── supabase/
│   ├── migrations/
│   └── functions/
└── middleware.ts
```

---

## Role Flow

### Foreman

- Manages workers under assigned scope.
- Submits daily attendance via `POST /api/attendance/submit`.

### Site Incharge

- Reviews foreman submissions via `PATCH /api/attendance/review`.
- Manages assigned foremen and monitors site activity.

### Admin

- Approves reviewed sheets via `PATCH /api/attendance/approve`.
- Manages sites/users/workers globally.
- Uses export/report APIs and SI attendance tracking.

---

## Authentication & Authorization

- Session cookie name: `construction-erp-session`.
- Session payload includes: `sub`, `role`, `username`.
- Middleware behavior:
	- Redirects `/` → `/login`
	- Protects role routes (`/admin`, `/site-incharge`, `/foreman`)
	- Redirects logged-in users away from `/login` to role home
	- Clears invalid cookies automatically

---

## Getting Started

### 1) Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (cloud or local)

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment

Create `.env.local` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
AUTH_SESSION_SECRET=your_long_random_secret
```

### 4) Run development server

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL for browser/server clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key for browser/server helpers |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin-level DB operations in API routes |
| `AUTH_SESSION_SECRET` | Yes | Signs/verifies JWT session cookie |
| `NODE_ENV` | Runtime | Controls seed endpoint access and secure cookies |

---

## Database Setup

Migrations are stored in `supabase/migrations` and should be applied in order.

Current migration sequence:

1. `001_initial_schema.sql`
2. `002_add_password_hash.sql`
3. `003_fix_rls_for_login.sql`
4. `004_grant_api_roles_privileges.sql`
5. `005_add_worker_profile_fields.sql`
6. `006_create_si_attendance_entries.sql`
7. `007_add_approved_at_to_attendance_sheets.sql`
8. `008_add_father_name_to_users.sql`

Use your preferred Supabase workflow (CLI or SQL editor) to apply these migrations.

---

## Seeding Development Data

Use API seed route in development mode:

```bash
curl -X POST http://localhost:3000/api/seed
```

Seed route characteristics:

- Works only when `NODE_ENV=development`
- Upserts default site, users, workers, and one attendance sheet
- Returns summary counts and seeded usernames

Default development users:

- `admin` / `admin123`
- `si1` / `si123`
- `foreman1` / `foreman123`

> Change these credentials immediately in any non-local environment.

---

## API Overview

### Auth

- `POST /api/auth/login`
- `GET /api/auth/session`
- `PATCH /api/auth/change-password`
- `POST /api/auth/logout`

### Dashboard

- `GET /api/dashboard/admin`
- `GET /api/dashboard/si`
- `GET /api/dashboard/foreman`

### Users

- `GET /api/users`
- `POST /api/users/create`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### Sites

- `GET /api/sites`
- `POST /api/sites`
- `PATCH /api/sites/:id`
- `DELETE /api/sites/:id`

### Workers

- `GET /api/workers`
- `POST /api/workers`
- `PATCH /api/workers/:id`
- `DELETE /api/workers/:id`

### Attendance

- `GET /api/attendance/sheets`
- `POST /api/attendance/submit`
- `PATCH /api/attendance/review`
- `PATCH /api/attendance/approve`
- `GET /api/attendance/records`
- `PATCH /api/attendance/records`
- `DELETE /api/attendance/records`
- `GET /api/attendance/export`
- `GET /api/attendance/si-attendance`

### Utility

- `POST /api/seed` (development only)

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development server |
| `npm run build` | Build production bundle |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint checks |
| `npm run seed` | Execute `src/lib/seed.ts` utility script |

---

## Operational Notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; never expose in client code.
- Set a strong `AUTH_SESSION_SECRET` (32+ random bytes recommended).
- Ensure production cookies are served over HTTPS (`NODE_ENV=production`).
- Restrict or disable `/api/seed` outside local development.

---

## Troubleshooting

### `AUTH_SESSION_SECRET missing`

Add `AUTH_SESSION_SECRET` to `.env.local` and restart the app.

### `Missing Supabase ... environment variables`

Verify all required Supabase keys are present and correctly named.

### Login succeeds but routes redirect incorrectly

Check user `role` values in `users` table (`ADMIN`, `SITE_INCHARGE`, `FOREMAN`) and clear stale cookies.

### Seed endpoint returns 403

`POST /api/seed` is intentionally blocked unless `NODE_ENV=development`.

---

If you want, I can also generate an `API.md` with request/response examples for each endpoint.

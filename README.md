# Strategic Intelligence Hub

**by InfraBeat** — an AI-powered sales-intelligence tool. Enter a company name and the app generates a structured, multi-section intelligence report: financials, operations, supply chain, technology landscape, real decision-makers from LinkedIn, pain points mapped to InfraBeat's services, and a recommended engagement roadmap. Reports can be read in a live dashboard or exported as an InfraBeat-branded PDF.

Built with React + Vite on the front end, serverless-style Node functions on the back end, Supabase for auth/data, Brave Search for grounding, and Groq (Llama 3.3 70B) for generation.

---

## Table of contents

- [Using the app](#using-the-app) — for people using the product
- [Access levels](#access-levels) — admin / manager / user
- [Developer setup](#developer-setup) — running it yourself
- [Environment variables](#environment-variables)
- [Database setup (Supabase SQL)](#database-setup-supabase-sql)
- [Running locally](#running-locally)
- [Deployment](#deployment)
- [How it works](#how-it-works)
- [Troubleshooting](#troubleshooting)

---

## Using the app

### 1. Sign in

Open the app and sign in with your email. New accounts are created automatically the first time you sign in.

### 2. Add your Groq key (one-time)

The app uses your own free Groq API key to generate reports (this keeps it free and gives you your own rate limits). On first use you'll be prompted for it:

1. Go to [console.groq.com/keys](https://console.groq.com/keys) and create a free key.
2. Paste it into the app when prompted.

Your key is stored only in your browser (never on the server) and is tied to your account on this device.

### 3. Generate a report

1. Type a company name in the search box (e.g. "Tata Steel").
2. *(Optional)* Click **All sections** to pick only the sections you want — handy if you only need, say, financials and decision-makers.
3. Press **Generate**. The report builds section by section; you can watch it fill in live.

### 4. Read and navigate

- The report renders as a dashboard of cards. **Click any card** to expand its full detail.
- Use the floating **jump-to-section** button (bottom-right) to skip straight to a section.
- **Decision-Maker Intelligence** shows real people found on LinkedIn with clickable profile links (requires the Brave key to be configured — see setup).

### 5. Export a PDF

Click **Download PDF** to get an InfraBeat-branded report: a cover page, a contents page with page numbers, and each section on its own page. Great for sharing with clients or your team.

### 6. History

Every report is saved. Open the **history panel** to reopen a past report or resume one that was left unfinished — resuming does not use another search.

### Daily search limit

Each new company you research counts as one "search" against a daily limit (resets at midnight UTC). Reopening or resuming a saved report does **not** count. Your limit depends on your access level (see below).

---

## Access levels

The app has three roles. Regular users don't see any of the elevated features.

| Capability | Admin | Manager | User |
|---|---|---|---|
| Daily searches | 10 | 7 | 5 |
| Generate reports & PDFs | yes | yes | yes |
| See **all users'** reports | yes | yes | — |
| Analytics dashboard | yes | yes | — |
| Edit config (InfraBeat text + section titles) | yes | yes | — |
| User management (change roles, remove users) | yes | — | — |

Everyone starts as a **user**. Roles are granted by an admin (see below). Admin and manager see an **Admin** button in the header that opens the Control Center (Users, Analytics, and Config tabs).

**Config tab:** lets admins/managers edit the InfraBeat positioning text used in the opportunity/roadmap sections, and rename any of the 13 sections. Changes apply globally to all future reports.

---

## Developer setup

### Prerequisites

- **Node.js 18+** and npm
- A **Supabase** project (free tier is fine)
- A **Brave Search** API key (for company grounding + LinkedIn discovery)
- Each end user supplies their own **Groq** key in-app (nothing to configure server-side)

### Install

```bash
git clone <your-repo-url>
cd sales-intel-agent
npm install
```

---

## Environment variables

Create a `.env.local` file in the project root (it is gitignored — never commit it):

```bash
# Brave Search (server-side; powers company grounding + LinkedIn decision-makers)
BRAVE_API_KEY=your_brave_key

# Supabase — client (safe to expose; used by the browser)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# Supabase — server (SECRET; used by API routes for auth, roles, limits, admin ops)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Optional overrides (defaults shown):

```bash
DAILY_REPORT_LIMIT=5      # user daily searches
MANAGER_REPORT_LIMIT=7    # manager daily searches
ADMIN_REPORT_LIMIT=10     # admin daily searches
```

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` is a powerful secret. It is only ever used in server-side API routes, never sent to the browser. Keep `.env.local` out of git.

Where to get the keys:
- **Brave:** [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com) → create a subscription → copy the key.
- **Supabase:** your project → Settings → API. The `anon` key is the public client key; the `service_role` key is the secret server key.

---

## Database setup (Supabase SQL)

Run these files **in order** in the Supabase SQL editor (Dashboard → SQL Editor → paste → Run). Each is safe to run once.

| File | What it creates |
|---|---|
| `setup-usage.sql` | The `usage` table + policies for the daily search limit |
| `add-brief-column.sql` | Adds the `brief` column to `reports` so resuming doesn't re-search |
| `setup-roles.sql` | The `profiles` table (roles), auto-create trigger, and backfill |
| `reports-cascade.sql` | Ensures a removed user's reports are cleaned up |
| `setup-settings.sql` | The `app_settings` table for admin-editable config |

### Make yourself admin

After running `setup-roles.sql`, promote your own account (use the email you sign in with):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

From then on, you can grant **manager** or **admin** to others from the in-app Admin → Users tab (or with the same SQL, swapping the role).

---

## Running locally

```bash
npm start
```

This runs the API server and the Vite dev server together. Open the URL Vite prints (usually `http://localhost:5173`).

Other scripts:

```bash
npm run dev      # front end only (Vite)
npm run api      # API server only
npm run build    # production build
npm run preview  # preview the production build
```

> Without `BRAVE_API_KEY`, the app still runs, but the company-grounding and LinkedIn decision-maker sections degrade gracefully (they show a "no data / not configured" state instead of real results).

---

## Deployment

The app is a static front end plus serverless-style functions in `api/`. It deploys cleanly to platforms that support that split (e.g. Vercel):

1. Push the repo to GitHub.
2. Import it into your host.
3. Add **all** the environment variables above in the host's project settings (not just `.env.local`, which is local-only).
4. Ensure the Supabase SQL has been run against the same project the keys point to.
5. Deploy.

The `api/*.js` files become serverless functions; the Vite build serves the front end.

---

## How it works

**Generation pipeline (per section):**
1. On the first section, the server runs **one** Brave search for the company and caches a grounding "brief."
2. That brief is reused for every remaining section (so a full report = one grounding search).
3. Each section is formatted by Groq's Llama 3.3 70B in strict JSON mode, then rendered as dashboard cards.

**Decision-makers (section 11)** are fetched directly from Brave via a LinkedIn-targeted search and returned as real, linkable profiles — never invented. If none are publicly indexed, the section says so honestly.

**Roles & limits** are always resolved **server-side** from the validated Supabase token. Hiding admin UI is cosmetic; every privileged action (see-all-reports, analytics, user management, config writes) is re-checked on the server, so nothing can be bypassed from the browser.

**Key directories:**

```
api/                serverless functions (agent, limits, roles, admin, settings)
src/
  App.jsx           app shell, header, routing of views
  components/       Dashboard, Landing, HistoryPanel, AdminPanel, CardModal, ...
  lib/              hooks: useAgent, useHistory, useRole, useSettings, useUsage, ...
*.sql               run these in Supabase (not applied by the app)
```

---

## Troubleshooting

**"Reports generate but decision-makers / grounding are empty."**
`BRAVE_API_KEY` isn't set (or is invalid). Add it to `.env.local` locally, or to your host's env settings in production.

**"I don't see the Admin button / all-reports view."**
Your account isn't elevated yet. Run the `update ... set role = 'admin'` SQL for your email, then sign out and back in.

**"Daily limit or resume-without-search isn't working."**
The Supabase SQL hasn't been run, or the server keys (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are missing. These features need the service key to enforce server-side.

**"It asks for a Groq key every time / generation fails immediately."**
Each user must paste their own Groq key (from [console.groq.com/keys](https://console.groq.com/keys)). It's stored per-account in the browser; clearing site data removes it.

**"Removing a user fails."**
Run `reports-cascade.sql` so the user's reports cascade on delete. `usage` and `profiles` already cascade.

---

*Strategic Intelligence Hub — an internal tool by InfraBeat Technologies.*

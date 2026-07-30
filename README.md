# QA's Trust Bank - demo banking app

A practice banking application for QA work: customer onboarding, reviewer approvals,
teller funding, account closure, and a transaction ledger. All customer, account,
transaction, application, closure, and audit data lives in a shared SQLite database
behind an Express API, so several teammates can work against the same records.

## Running it

Install once:

```bash
npm install
```

### Everyone shares one host (recommended for a team)

One person runs the whole thing from a single process:

```bash
npm start          # builds the UI, then serves UI + API on http://localhost:4000
```

Teammates open `http://<that-machine>:4000` in a browser. No install needed on their side.

### Working on the code

Two terminals:

```bash
npm run server     # API + database on http://localhost:4000
npm run dev        # Vite dev server on http://localhost:5173, proxies /api to :4000
```

To develop against a colleague's database instead of your own:

```bash
BANKING_API_URL=http://192.168.1.20:4000 npm run dev
```

## Deploying to Vercel

The frontend and the API deploy together: `api/[...path].js` serves the same Express app
as a serverless function, and `vercel.json` wires it up. The only thing that can't live on
Vercel is the database file - serverless instances have no persistent, shared disk - so
production uses **Turso**, which is hosted SQLite. Same SQL, same code path.

1. Create the database and a token:

   ```bash
   turso db create banking-demo
   turso db show banking-demo --url     # libsql://banking-demo-....turso.io
   turso db tokens create banking-demo
   ```

2. In **Vercel → Project → Settings → Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | the `libsql://...` URL |
   | `TURSO_AUTH_TOKEN` | the token |
   | `BANKING_ACCESS_CODE` | any shared phrase - see below |

3. Push. The tables are created and seeded automatically on the first request.

Set both variables and it uses Turso; leave them unset and it falls back to a local
SQLite file. That is the *only* difference between your machine and production, and it is
why `npm run dev` still works with no cloud account at all.

## Keeping strangers out

A public Vercel URL is reachable by anyone who finds it, and this app has no user
accounts - the "roles" are a demo fiction, not a security boundary. Set
`BANKING_ACCESS_CODE` and the API rejects every request without a matching
`x-access-code` header; the UI asks for the code once and remembers it in that browser.

```bash
BANKING_ACCESS_CODE="whatever-your-team-agrees" npm run server
```

Leave the variable unset and the API is open, so local development and the test
suites need no setup.

Be clear-eyed about what this is: **one shared code for the whole team, held in the
browser.** It stops strangers and crawlers hitting a public URL. It does not stop
anyone who has the code - and that includes reading it out of their own browser
storage. Don't put anything real behind it.

For a stronger gate that the browser never holds, Vercel's own **Deployment
Protection** (Settings → Deployment Protection) puts SSO or a password in front of the
whole deployment before any of this code runs. It's a dashboard toggle, and password
protection needs a paid plan. The two can be used together.

To point local development at the deployed API instead of your own server:

```bash
BANKING_API_URL=https://your-app.vercel.app npm run dev
```

## The database

Locally, a SQLite file at `server/banking.db`, created and seeded automatically on first
start. It is gitignored, so everyone's local copy is their own unless they point at a
shared host or set the Turso variables.

| Table | Holds |
| --- | --- |
| `customers` | People, created when an application is approved |
| `accounts` | Account number, type, branch, status, balances |
| `transactions` | The ledger, including closure payouts |
| `applications` | Account-opening requests and their review decisions |
| `closureRequests` | Account-closing requests and their review decisions |
| `audit` | Chronological record of every state change |

Useful knobs:

- `PORT` - API port (default `4000`)
- `BANKING_DB` - path to the local database file, handy for a throwaway copy
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` - use hosted Turso instead of a local file
- `BANKING_ACCESS_CODE` - require a shared code; unset means open
- `BANKING_API_URL` - where `npm run dev` proxies `/api` to

"Reset demo data" in the app (or `POST /api/reset`) restores the seed data for **everyone**
sharing that database.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/state` | Whole dataset, in the shape the UI renders |
| `POST` | `/api/applications` | Submit an account-opening application |
| `POST` | `/api/applications/:id/decision` | Approve / reject / request info |
| `POST` | `/api/transactions` | Post a teller transaction |
| `POST` | `/api/closure-requests` | Submit an account-closure request |
| `POST` | `/api/closure-requests/:id/decision` | Approve / reject / request info |
| `POST` | `/api/reset` | Restore seed data |
| `GET` | `/api/health` | Liveness plus which database file is in use |

Every mutation replies with `{ state }` - the freshly re-read dataset - so the UI never
drifts from what is actually stored. Validation rules live in `server/rules.js` and are
imported by both the API and the browser, so the two can't disagree.

## Sign-in

Staff users (password `demo123`): `applicant`, `reviewer`, `teller`, `admin`.

Account holders sign in with an **account ID** and **date of birth** - seeded example:
account `8001200101`, DOB `1992-04-16`.

## Workflows

**Opening an account.** Applicant submits an application -> reviewer approves -> a customer
record and an account are created (`Pending Funding`) -> teller posts the opening deposit ->
account becomes `Active`.

**Closing an account.** Account holder submits a closure request from **Close Account**
(reason, payout method, confirmation) -> reviewer opens it under **Closure Requests** ->
on approval the remaining balance is paid out as a `Closure Payout` transaction, the balance
goes to zero, and the account becomes `Closed`. Closed accounts reject further transactions.
Rejecting or requesting more information leaves the account untouched.

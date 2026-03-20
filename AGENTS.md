# Gastos App

Personal expense tracker (Spanish locale, MXN currency) built with Node.js/Express + Supabase + vanilla HTML/CSS/JS.

## Cursor Cloud specific instructions

### Project layout

All application code lives under `gastos-app/`. There is no monorepo structure, no build step, no bundler, no test framework, and no linter configured.

### Running the dev server

```bash
cd gastos-app
npm run dev        # starts Express on http://localhost:3001
```

### Required environment variables

The server reads from `gastos-app/.env` (loaded via `dotenv`):

- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anonymous/public API key

The `.env` file is gitignored. Create it from the injected secrets:

```bash
cd gastos-app
echo "SUPABASE_URL=${SUPABASE_URL}" > .env
echo "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" >> .env
```

The server only throws on missing credentials when `NODE_ENV=production`; in dev mode it starts regardless but Supabase calls will fail.

### Key endpoints

| Endpoint | Auth | Description |
|---|---|---|
| `GET /health` | No | Returns `{"ok":true}` – quick liveness check |
| `GET /test-db` | No | Returns all rows from `expenses` table – verifies Supabase connectivity |
| `POST /register` | No | Create account (email/password via Supabase Auth) |
| `POST /login` | No | Sign in (returns session with access token) |
| `GET /expenses` | Bearer | List user expenses |
| `POST /expenses` | Bearer | Create an expense |
| `DELETE /expenses/:id` | Bearer | Delete an expense |

### Email confirmation bypass

When `SUPABASE_SERVICE_ROLE_KEY` is set in `.env` (or as an environment secret), the `/register` endpoint uses the Supabase Admin API to create users with `email_confirm: true`, bypassing email confirmation entirely. Without the service role key, the original `signUp` flow is used and email confirmation is required.

### Frontend config

The frontend fetches Supabase credentials dynamically from the `GET /config` endpoint at startup, so no hardcoded credentials in `public/app.js` are needed.

### Gotchas

- No automated tests, linter, or build exist in this repository.
- The server does not hot-reload; restart it after code changes (`kill` the process and re-run `npm run dev`).

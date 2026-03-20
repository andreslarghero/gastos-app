# Agents

## Cursor Cloud specific instructions

### Overview

**Gastos** is a personal expense tracker (Node.js/Express + vanilla HTML/CSS/JS frontend) backed by a hosted **Supabase** project for authentication and PostgreSQL storage.

### Services

| Service | How to run | Port |
|---|---|---|
| Express API + static frontend | `npm run dev` (from `gastos-app/`) | 3001 |

### Environment variables

The server reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` via `dotenv` from `gastos-app/.env`. These secrets are injected by the Cloud Agent environment; if `.env` is missing, create it:

```
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

### Frontend Supabase credentials

The frontend (`gastos-app/public/app.js`, lines 5-6) contains **placeholder** Supabase credentials (`YOUR-PROJECT.supabase.co` / `YOUR_SUPABASE_ANON_KEY`). There is no build step or dynamic injection; these must be replaced with real values for the browser-side auth to work. The anon key is public by design.

### Important caveats

- **No test framework**: There are no automated tests (`package.json` has no test script). Validation is done manually via the UI or API (curl).
- **No lint or build step**: The frontend is plain HTML/CSS/JS with no transpilation. There is no ESLint configuration.
- **Supabase free-tier rate limits**: Sign-up is capped at ~4 emails/hour. If you hit `email rate limit exceeded`, wait or use an existing confirmed account.
- **Email confirmation required**: `mailer_autoconfirm` is `false` on the Supabase project. New users must confirm their email before logging in.
- **Database schema**: The app requires an `expenses` table in Supabase (columns: `id`, `user_id`, `amount`, `category`, `description`, `date`). This table must already exist; there is no migration script.
- **API endpoints**: `GET /health`, `GET /test-db`, `POST /register`, `POST /login`, `GET /expenses`, `POST /expenses`, `DELETE /expenses/:id`. Auth-protected routes require `Authorization: Bearer <token>`.

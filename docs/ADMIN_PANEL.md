# Planora admin panel

Open [zc-planora.vercel.app/admin.html](https://zc-planora.vercel.app/admin.html). The page is a separate build from the student planner. Login is checked by `app/api/admin.ts` and the activity history is persisted by `app/api/admin-store.ts` in Upstash Redis. The public page contains no passwords or storage tokens.

## Two independent accounts

| Person | Default username | Vercel Environment Variable for password hash |
|---|---|---|
| Ahmed Amir | `ahmed` | `PLANORA_ADMIN_AHMED_PASSWORD_HASH` |
| Youssef Taha | `youssef` | `PLANORA_ADMIN_YOUSSEF_PASSWORD_HASH` |

The usernames can be changed with `PLANORA_ADMIN_AHMED_USERNAME` and `PLANORA_ADMIN_YOUSSEF_USERNAME`. Set all variables **privately in the Planora Vercel project**, Production Environment Variables. Do not put actual secrets into GitHub, `.env.example`, a public frontend file or a chat message. The variable list lives in `app/.env.example`.

Each person runs `node scripts/hash-admin-password.mjs` from the repository root and privately chooses their own password (12+ characters). The input is hidden. Save the generated `PLANORA_ADMIN_PASSWORD_HASH` value under *that person's* hash variable above. Run the generator separately for the second person. Take one generated `PLANORA_ADMIN_SESSION_SECRET` and put it in Vercel; changing it signs everyone out. No shared/default password is provided.

## Durable history setup

Connect an Upstash Redis database to the **Planora** project through [Vercel Marketplace](https://vercel.com/marketplace/upstash), then set/check these private Production Environment Variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Redeploy once after all variables are set. Until **both hashes, session secret and Redis credentials** are configured, the panel displays a setup message and will not accept logins or pretend edits were saved. Redis must retain data; do not delete its database or its audit keys. The user must provision a durable database in their own account: a temporary test database is insufficient for history.

## What gets recorded

Successful login and logout, each JSON draft save, and each exported draft are recorded with account, time and action. Saved changes also record the file, changed IDs/fields, method (`Planora admin JSON editor`), source/reason provided by the editor, and exact before/after JSON snapshots. See **Activity history** for paging and comparing revisions. Editing in the browser before clicking Save has no history entry. Failed or unsaved changes aren't described as saved. Concurrent saves to the same draft reject the second editor until they reload the latest draft; the draft and audit entry are written atomically.

The panel edits **private draft JSON** only. It never changes the published semester automatically. After an export, confirm all academic facts against Self-Service or data supplied by the creators; replace the matching `src/semester/*.json`, run `npm run test:data`, `npm run typecheck`, `npm run build`, and the remaining `test:*` scripts, then commit/review/publish. GitHub commit history separately records who published the verified dataset. Student reports still go to GitHub Issues, not email.

History is stored outside deployments; no delete-history button exists. The server uses an eight-hour, signed HttpOnly Secure SameSite=Strict cookie and checks origins for writes. The in-memory failed-login limit is per function instance, not a distributed account lockout. Restrict database credentials to the server.

# Planora admin panel

URL after deployment: `https://zc-planora.vercel.app/admin.html`. The page is a separate build from the student planner; login is verified on the server at `app/api/admin.ts`. No administrator password is shipped to the browser.

## Username and password

Edit the private environment variables for the **Planora** Vercel project, in Project Settings → Environment Variables, for Production:

| Variable | Value |
|---|---|
| `PLANORA_ADMIN_USERNAME` | Your chosen admin username |
| `PLANORA_ADMIN_PASSWORD_HASH` | The hash generated below |
| `PLANORA_ADMIN_SESSION_SECRET` | A separate random secret of at least 32 characters, generated below |

The names and instructions are also in `app/.env.example`. The real values belong in Vercel Environment Variables, not in that example file, GitHub, `src/`, or a frontend `.env` file. To change credentials, update these variables and redeploy once. Changing the session secret signs out existing admins.

To generate the password hash and signing secret locally, run `node scripts/hash-admin-password.mjs` from the repository root and type a unique password of at least 12 characters when prompted. Input is hidden. Copy its two output values privately into the matching Vercel variables. Do not paste the password in a terminal command argument or send it through GitHub Issues. The panel returns a setup message until all three variables are configured and deployed.

## What the panel can do

- Show the active semester, course/meeting counts, verification date and year-by-year coverage.
- Open the Planora GitHub Issues list to review student-submitted reports. Reports do **not** arrive by email automatically.
- Edit an in-memory copy of `semester.json`, `courses.json`, `majors.json` or `sch.json`; validate basic structure and export the resulting JSON. This does not change live data.

For a verified change, replace the matching file under `src/semester/`, review all course facts against the source, run `npm run test:data`, `npm run typecheck`, all remaining `test:*` scripts and `npm run build`, then commit to GitHub. The fuller CI validator reports missing rooms as warnings and blocks invalid references/times. Avoid editing existing course IDs when only names change.

The admin endpoint has a signed, HttpOnly, Secure, SameSite=Strict cookie lasting eight hours. It checks same-origin requests and limits repeated failed logins per running function instance; this simple limit is not a distributed account lockout. There is no public endpoint that edits live course data or reads private reports.

The currently published application has no admin credentials configured until the three Vercel variables are supplied. If you need live login to work, set them in the Planora project and redeploy; the student planner works independently.

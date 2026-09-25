# Planora admin panel

Open [zc-planora.vercel.app/admin.html](https://zc-planora.vercel.app/admin.html), or click **🔒 Admin** in the Planora header. The page is a separate build from the student planner. Login is checked by `app/api/admin.ts` and the activity history is persisted by `app/api/admin-store.ts` in Upstash Redis. The public page contains no passwords or storage tokens.

## Two independent accounts

The account names and login identifiers are defined in `app/admin-accounts.ts`. Each account has its own private password hash in Vercel; the corresponding variable names are documented in `app/.env.example`. Do not publish actual passwords, hashes, session secrets or database tokens.

Change the two login identifiers or displayed names in `app/admin-accounts.ts` and deploy that edit. Passwords cannot safely live in a public GitHub source file. Set the password hashes and session secret **privately in the Planora Vercel project**, Production Environment Variables. Do not put actual secrets into GitHub, `.env.example`, a public frontend file or a chat message. The variable list lives in `app/.env.example`.

Each person runs `node scripts/hash-admin-password.mjs` from the repository root and privately chooses their own password (12+ characters). The input is hidden. Save the generated `PLANORA_ADMIN_PASSWORD_HASH` value under that person's hash variable in the **Planora Vercel Production Environment Variables**, not in `app/.env.example`. Run the generator separately for the second person. Take one generated `PLANORA_ADMIN_SESSION_SECRET` and put it in Vercel; changing it signs everyone out. No shared/default password is provided.

## Durable history setup

Connect an Upstash Redis database to the **Planora** project through [Vercel Marketplace](https://vercel.com/marketplace/upstash), then set/check these private Production Environment Variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically instead, the admin API also reads that pair; no manual copying of the integration token is necessary. Make sure the database is linked to **Production**.

Redeploy once after all variables are set. Until **both hashes, session secret and Redis credentials** are configured, the panel displays a setup message and will not accept logins or pretend edits were saved. Redis must retain data; do not delete its database or its audit keys. The user must provision a durable database in their own account: a temporary test database is insufficient for history.

## What gets recorded

Successful login and logout, each JSON draft save, and each exported draft are recorded with account, time and action. Saved changes also record the file, changed IDs/fields, method (`Planora admin JSON editor`), source/reason provided by the editor, and exact before/after JSON snapshots. See **Activity history** for paging and comparing revisions. Editing in the browser before clicking Save has no history entry. Failed or unsaved changes aren't described as saved. Concurrent saves to the same draft reject the second editor until they reload the latest draft; the draft and audit entry are written atomically.

The panel edits **private draft JSON** only. It never changes the published semester automatically. After an export, confirm all academic facts against Self-Service or data supplied by the creators; replace the matching `src/semester/*.json`, run `npm run test:data`, `npm run typecheck`, `npm run build`, and the remaining `test:*` scripts, then commit/review/publish. GitHub commit history separately records who published the verified dataset.

## Import, inspect, undo

In **Data drafts**, select `courses.json` or `sch.json` and use **Edit one course** to find a specific course by code and name. Change only the verified name, code, credits, instructor, section, day, time or room. The editor stages those fields in the browser draft; the internal course ID stays stable. Use **Review before saving**, enter a source or reason, then **Save private draft & record history**. The combined validator checks edited data before export. Changes reach students only after a separate reviewed dataset commit and deployment.

Choose `courses.json` or `sch.json` in **Data drafts**. Paste copied Self-Service results containing an explicit `Subtype: Lecture | Section: 03` block, a day, time, room and instructor, or choose **Upload CSV** and **Download blank CSV template**. Fill the `courseCode,subtype,section,day,start,end,room,instructor` columns from verified Self-Service results, upload the file and click **Stage sections for review**. Excel UTF-8 BOM and quoted headers are accepted. For copied results without a course heading, select the course above the paste box. CSV may contain several courses; use `Sun`–`Thu` or the full English day. Times use `HH:MM` (24 hour) or `H:MM AM/PM`. An empty room means unpublished and produces a warning. Missing required fields and repeated sections in one import are skipped for manual review. No data changes for students until the reviewed draft is published. Review how your copied results actually look; if their layout differs, use the CSV format.

**Stage sections for review** changes only your unsaved browser draft. The comparison shows the old and proposed instructor, day, start/end time and room for each section. **Discard unsaved edits** restores the loaded private draft. Give a source and choose **Save private draft** to record an attributable snapshot in Upstash; another admin's concurrent save requires reloading. **Undo last saved draft** restores the immediately previous saved revision and records who reversed it and why. It never undoes a public deployment.

**Check whole semester** checks the current editor content with the other saved drafts (or published JSON if no draft exists). **Export last saved draft** refuses to download while the combined semester has structural errors. This is a review gate, not an automatic publication action. To release a correction, export the reviewed files, put them in `src/semester/`, run the full CI and deploy once after approval. Keep the entire history in Redis; avoid deleting the database.

Student reports are sent to `/api/reports` and stored in the private Redis inbox. Students can optionally include a name or nickname; blank is anonymous. No student ID or contact detail is requested. Students do not need a GitHub account. The admin page checks the inbox every minute while open and shows a count of new reports. Only authenticated admins can read them; each status change (checking, dismissed, correction needed, resolved) needs a review note and records the admin in the audit history. The Self-Service link opens a page for manual verification; this button does not perform automated login or compare data. An unchanged report can be dismissed; a real correction requires a separately reviewed dataset update and deployment. Reports contain student supplied text: avoid putting personal information there. The inbox is limited to 500 reports; storage failures return an error to the student rather than claiming delivery.

General student feedback has a separate footer button and private Redis inbox (`/api/feedback`). A student selects a topic and rates Planora from 1–10; the written message is optional. Rating-only submissions work without an account. Admins see all entries, filter by topic/status, record notes when reviewing/archiving/reopening, and see a summary calculated from stored entries: total, new, last seven days, average rating, and counts by topic. This is a numerical summary, not AI interpretation of private messages. The feedback inbox is limited to 500 entries, with three submissions per hour per IP; student messages should not contain identifying information. Email notification is currently for wrong-data reports only; feedback is available directly in the admin panel.

Optional email alerts use a Google Apps Script project owned by an admin. No domain purchase or Gmail password is needed; follow `docs/REPORT_EMAIL.md`. The email contains only a short summary and link; full student text stays in the private inbox. The panel shows each alert as `sent`, `failed`, or `not configured`; a delivery failure does not remove the report. Confirm delivery with a single test report after deploying and configuring both private webhook variables. Google quotas and free availability can change. There are no background browser push alerts.

History is stored outside deployments; no delete-history button exists. The server uses an eight-hour, signed HttpOnly Secure SameSite=Strict cookie and checks origins for writes. The in-memory failed-login limit is per function instance, not a distributed account lockout. Restrict database credentials to the server.

# Planora security notes

## Current boundaries

- The planner is public. Admin HTML can be opened by anyone, but every admin API read and write checks a signed, HttpOnly, Secure, SameSite=Strict cookie on the server. The static HTML contains no password hashes or private report data.
- Admin passwords are stored as scrypt hashes in private Vercel environment variables. The session signing key, Redis credential, Gemini key, and optional mail secret are server-only variables. Never put a real value in this repository or browser storage.
- Admin drafts, audit history, reports and feedback are held in private Upstash Redis. Students cannot fetch them from public APIs. Redis calls use fixed commands and fixed Lua scripts with values passed as arguments.
- Browser API POSTs require the site's own Origin and JSON content type, limit request size, and do not enable cross-origin access. Responses carrying admin/session data are not cached.
- Admin login and assistant requests use atomic, shared Redis rate limits. The assistant uses a signed, HttpOnly browser cookie plus an IP limit to accommodate campuses where many students share an IP. Reports and feedback also have shared limits.
- React renders untrusted text as text rather than HTML. Production page headers disable framing and object embedding, restrict form targets, and prevent MIME sniffing. Production browser errors do not print student state to the console.
- The optional Apps Script email receiver checks a private shared secret. Planora has no inbound webhook endpoint. The sender does not include the student's free-text report in the email.

## Not applicable to this release

Planora has no SQL database, database row-level security (RLS), self-service account registration, email-address verification flow, or server-side file upload endpoint. The admin CSV feature parses pasted text in the browser and saves validated JSON through the protected admin API. Do not turn on pretend RLS or add an email verification form without a new authentication/data design.

## Before sharing credentials or deploying

Keep real environment values in the Vercel project settings, scoped to the intended environment. Commit only `.env.example`. Check `git status` and `git check-ignore app/.env.production` before publishing. Rotate credentials immediately if they were ever committed.

The optional Anthropic pull-request review in `.github/workflows/security-review.yml` runs only for same-repository pull requests after a maintainer sets `CLAUDE_API_KEY` as a GitHub Actions secret. Anthropic warns its action is not hardened against prompt injection; do not enable it for untrusted external PRs. CI also audits dependencies. A security review cannot guarantee the absence of vulnerabilities.

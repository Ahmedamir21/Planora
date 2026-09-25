# Planora project map

Planora is an independent student planner. Its Vercel project root is `app/`; its React planner is in `Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail/` (called **planner package** below). The long directory name is inherited from the original project and remains necessary for the current build commands. Changing it means updating the Vercel build path and import paths together.

| Location | Responsibility |
| --- | --- |
| `README.md` | Public overview, setup, architecture and feature status. |
| `.github/workflows/planner-ci.yml` | Build, audit, TypeScript, data and planner test gates. |
| `assets/readme-banner.svg` | README header artwork. |
| `assets/Planora_Overview_2026.pptx` | Downloadable overview deck. |
| `app/vercel.json`, `app/package.json` | Vercel deployment configuration and build wrapper. |
| `app/admin-accounts.ts` | Public account identifiers and display names; no secrets. |
| `app/api/admin.ts`, `app/api/admin-store.ts` | Admin login, private draft workflow and durable audit history. |
| `app/api/reports.ts`, `app/api/report-email.ts` | Private course data reports and optional email alert delivery. |
| `app/api/feedback.ts` | Student rating and optional written feedback inbox. |
| `app/api/assistant.ts` | AI assistant server endpoint. |
| `app/dataset-validation.mjs` | Server-side checks for draft semester files. |
| `app/.env.example` | Names and example values for private environment settings. Never store real values here. |
| `docs/ADMIN_PANEL.md` | Admin setup and use. |
| `docs/REPORT_EMAIL.md`, `scripts/planora-report-mailer.gs` | Optional Google Apps Script email alert setup and source. |
| `docs/SEMESTER_ROLLOVER.md` | How to prepare and verify the next semester. |
| `scripts/hash-admin-password.mjs` | Generates a private password hash for a single admin. |
| Planner `src/semester/*.json` | Published semester metadata, course sections, major mappings and SCH data. Do not invent academic facts. |
| Planner `semester-template/` | Blank shape for the next term's data. |
| Planner `src/data/`, `src/config/semester.ts` | Typed adapters for the JSON semester data and planner labels. |
| Planner `src/App.tsx`, `src/admin.tsx` | Student planner and admin page entry components. |
| Planner `src/components/` | Course picker, timetable, details, AI, sharing, reports, feedback and admin UI. |
| Planner `src/lib/` | Scheduler, conflict logic, share URLs, calendar, persistence and import utilities. |
| Planner `src/types.ts`, `src/utils/` | Shared types and small helpers. |
| Planner `public/` | PWA manifest, service worker, logo and icon. `public/brand/` holds optional source brand variants. |
| Planner `scripts/` | Semester validation and PWA build stamping. |
| Planner `tests/` | Scheduler, admin, import, data, SSR and UI checks. |

The current production branch is `main`. Some reviewed work is still on the separate local `internal-planora-branding` branch. Remote `internal-planora-final` and `planora-branding-completion` each contain commits not reachable from the current `main`; they should not be deleted until their changes are reconciled. The current password for each admin is the one corresponding to that account's Vercel Production hash. There are no hard-coded fallback passwords in this project.

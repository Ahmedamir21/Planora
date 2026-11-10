# Rules for this project

Keep this app organized so a beginner can read it.

1. Screens go in `pages`.
2. Shared pieces go in `components`.
3. Saving and loading goes in `data`.
4. One job per file.
5. No file over 300 lines.
6. Before writing anything new, check if it already exists.
7. After every major change, make a backup version (a branch or a copy) that we can go back to.

Cleanup is done one folder at a time, and it must never change what the app does.
After each folder: run typecheck, build and all the tests, they must all pass.

The app lives in:
`Final_Fall_2026_ZewailCity/Templates-Final-Final-main/Zewail-City-Templates-arena-01a09711-zewail-city-templates/Final_Fall_2026_ZewailCity/Final_Fall_2026_Zewail`
(source is in `src`, tests are in `tests`)

## Cleanup progress

Backup before cleanup: branch `backup-before-cleanup-2026-11-10`

- [x] `src/lib`: saving and loading files moved to `src/data` (appState, share, recovery, stateValidation)
- [x] `src/components`: all big files split (course-picker, best-schedule, schedule-assistant, schedule-preferences), nothing over 300 lines
- [ ] `src/pages`: does not exist yet, the screens are still inside `App.tsx` (2223 lines)
- [x] `src/lib`: big files split into `bestSchedule-parts`, `scheduler-parts`, `picks-parts`, `preferences-parts` (each folder sits next to the file it came from)
- [ ] `src/index.css` (1482 lines)
- [ ] folders outside src: `docs`, `scripts`, `sync`, `assets`, root files

The json files in `src/semester` are data, not code, so the 300 lines rule does not apply to them.

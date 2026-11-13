# Contributing

A few simple rules to keep Planora easy to read, even for a beginner.

- Screens go in `pages`.
- Shared pieces go in `components`.
- Saving and loading goes in `data`.
- One job per file.
- No code file over 300 lines. (The semester JSON files in `planner/src/semester` are data, so this rule does not apply to them.)
- Before writing anything new, check if it already exists.
- After every major change, make a backup (a branch or a tag) so you can go back to it.

## Where things are

See `docs/PROJECT_MAP.md` for the folder map. The React planner lives in `planner/` and the Vercel wrapper and API live in `app/`.

## Before opening a pull request

Run these from the `planner/` folder:

```bash
npm ci
npm run typecheck
npm run build
```

Then run the test scripts listed in `.github/workflows/planner-ci.yml`.

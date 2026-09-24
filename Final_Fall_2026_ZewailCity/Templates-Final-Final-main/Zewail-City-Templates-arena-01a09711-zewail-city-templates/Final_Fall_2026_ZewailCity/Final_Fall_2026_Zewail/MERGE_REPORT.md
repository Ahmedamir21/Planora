# Merge Report — Zewail City Fall 2026 Schedule Builder (A × B → one production build)

Date: 2026-09-12 · Branch: `arena/01a0935a-arena-ai` · Verdict: **merged, built, tested green** (`tsc` clean · `vite build` clean · 81/81 engine-harness checks · SSR smoke incl. share-URL restore and 5 corrupt-URL cases).

## 1. Chosen foundation and why

**Version A is the base** for everything algorithmic and structural: the Best-Schedule engine
(most-constrained-first backtracking, real-interval conflict pruning, top-K pool retention, 200k storage
budget + 2M recount budget with `countCapped`, incremental scoring, dedup), the exact end-exclusive duration
model, the validated v3 compact share codec, the unified `zw-app-state-v2` localStorage store, the print
stylesheet, and the CSS-variable theme system. **Version B is the donor for UI/UX only**: mobile sticky
action bar, live-pulse dashboard tiles, instructor pills with reversible "N hidden" disclosure, richer share
sheet, segmented theme toggle, preference goal descriptions, compare-view section breakdowns, and the sticky
time gutter on touch — each ported onto A's components, never as a second competing system.

## 2. Scheduler engine — nothing downgraded

- `generateBestSchedules` (A) is untouched in its search strategy: MCF ordering, prefix-conflict pruning
  (`sameDay && a.start < b.end && b.start < a.end`), bounded top-K pool, early exit on a saturated
  perfect-score pool, and honest `truncated` / `earlyExit` / `countCapped` flags surfaced all the way to the
  UI ("2,000,000+"-style floor counts instead of false precision).
- "Suggest best combination" (auto-fill) uses A's bounded scan `findBestCombo`; when the 20k scan budget
  stops early the badge reads "best ranked (of scanned set)" rather than claiming global optimality.
- B's naive "first N valid combos" generator, stop-at-100 search, and gap-fudge scoring (>5 min → 0) were
  **rejected**, along with its 119-minute `:59` durations and per-render full-major regeneration.

## 3. Dynamic hiding — visible, explained, reversible

- One source of truth for option semantics in `lib/picks.ts`: `optionStates()` derives, per course/kind,
  `picked / hiddenByInstructor / disabledByConflict / conflicts[] / hardReasons[] / softNotes[]`.
  The dataset is **never mutated**; every grey-out is recomputed from current picks + filters + preferences.
- Every blocked row is still listed under "▸ Why is this hidden? (N)" with *concrete* reasons
  ("Conflicts with CSAI 201 lab", "Different instructor — X is already selected", "outside your 08:00–14:00 window (hard)").
  Removing the conflicting pick (or the pill, or the hard switch) restores the option instantly — proven by
  harness checks (`conflicting option disabled WITH reason; removing the conflict restores it`,
  `un-pin restores everything`).
- "N hidden • M conflicts" counters sit on both the card and the group headers; selected rows are always
  visible even when conflicting (never orphan a live choice).

## 4. Clear All (with confirm) — full reset, dataset intact

B's full-width **Clear All** button with a confirmation modal resets: picks, per-course instructor pills
(including explicit pins), browse filters, require-complete, auto-fill report, scroll state. **Preserved:**
the course dataset (immutable by construction), preferences (persist across a clear by design), theme.
The old `isScheduleCleared` anti-auto-populate guard from B was unnecessary: A never auto-populates on
load, so there is nothing to suppress — and no half-cleared state exists anywhere.

## 5. Credits Dashboard / Free Time

Single computation path (`lib/freeTime.ts`): window = Sun–Thu 08:00–18:00, per-day interval **union**, so
double-booked minutes count once (`overlapMinutes` is reported, never hidden). Every duration is
`end − start` exactly — 08:00–09:00 = 60 min, a two-hour block = 120 min; no padding constants exist
anymore (A's `:59` endpoints make "2:00–3:59 PM" a genuine 120-minute interval). B's dashboard layout was
ported: 4 live tiles (Selected x/5, Total Credits, Free Time with one decimal, status) + per-day strip with
load bars + exact "free time = window − classes" caption with an overlap warning line. The 5-credits/day
tile from B was dropped because it visualizes a preference, not a fact; the hard-constraint panel covers it.

## 6. Preferences — soft vs hard, no second system

One preferences object (`lib/preferences.ts`) drives everything; four goals (descriptive labels from B),
preferred/keep-free days, time window, no-before/no-after, max hours/day — each rule with an explicit
**"treat as a requirement"** toggle. Soft rules only re-rank (verified: toggling soft keep-free changes
ordering, never `totalValid`); hard rules prune candidates *inside the engine* and also grey out violating
options in the pickers with reasons. When hard constraints admit nothing, the app says exactly which
constraint blocked which course (`blockedByHard` + `unsatisfiableHard`), never silently ignoring them —
checked live by the in-app Engine Audit and by the harness. B's separate "settings" store was not ported.

## 7. Share links & LocalStorage — lossless, validated, URL-first

- Compact base64url v3 payload: major, per-course option indices, `instructorFilter` (the pill state, the
  one thing naive encoders lose), browse filters, `requireComplete`, and compact preferences (defaults
  compress to nothing → short URLs). No names/emails ever enter the URL.
- Strict decoder: unknown majors/ids/courses, out-of-range indices, non-numeric junk — dropped row-by-row
  or as a whole; a corrupt payload returns `null` and the app boots on defaults instead of crashing
  (5 hostile URL cases rendered headlessly: all fell back cleanly).
- Priority: **`?schedule=` URL state > localStorage > onboarding**, resolved once on mount; the same store
  key `zw-app-state-v2` persists everything (including `instructorFilter`, so pills survive a reload with
  zero picks). `saveAppState` swallows quota errors; `loadAppState` rejects arrays/non-objects and
  sanitizes preferences via `sanitizePreferences` (stored `false` is honored; swapped time windows are
  repaired; unknown days rejected).
- Share sheet (B's UX on A's codec): read-only link that selects on focus, `navigator.share` where
  supported, clipboard fallback with "Schedule link copied!" status, and a summary strip
  (major, course/credit counts, conflict-free badge). The Best-Schedule cards each share *that* schedule
  with its own instructor grouping, so a shared "Best #2" restores as Best #2, not as the current draft.

## 8. Mobile responsiveness & UI polish

Fixed bottom action bar (Generate / Preferences / Share / Clear) under 640px with safe-area padding and
backdrop blur; 44px `btn-tap` targets and enlarged `tap-checkbox/tap-radio/tap-row` hit areas; horizontal
scroll on the timetable keeps the **time gutter pinned** (B) while retaining A's conflict lane packing
(B's grid packing lost overlap visibility, so it was rejected); modals dock to the bottom sheet on phones
and center on desktop; `100dvh`-safe layout; active-selection auto-scroll preserved. Print CSS now also
hides filters, pickers and the action bar (`.no-print`) leaving a clean light-theme schedule. The segmented
ThemeToggle and B's About page structure (what is this / how to use / soft-vs-hard / data / privacy /
version) were ported; B's i18n scaffolding and unvalidated `?schedule=` id lookups were not.

## 9. Data integrity — zero fabrication

`src/data/courses.ts` and `src/data/majors.ts` are byte-identical to A's (which itself carries every course,
instructor, section, room and time from the original app; the A-only additions like PHYS 104 one-hour
tutorials and the unassigned "no named instructor" groups are preserved as-published — no lecturer is
invented for groups without one). Instructor grouping rules from A are kept: a group only ever pairs with
its own published kinds, sections with no lecture stay lab-only. `buildPairings('PHYS 104')` still yields
exactly 13 valid combinations (16 raw − 3 real clashes), asserted by both the test harness and the live
Engine Audit panel.

## 10. Dead code removed; conflicts resolved toward the more correct side

Deleted while merging: B's whole parallel state layer (legacy loaders, `looksValidDayList`,
`clearAppState`, `autoResolveInstructors`, `findClashes`, `conflictLabel`, `requiredKinds`, QR module,
second grid packer, per-lesson "software"-major silent fallback), A's now-unused `DAY_SHORT`,
`overlapsAny`, `dayEarliest`, plus unused imports across the tree — the repo contains **one** store,
**one** option-state engine, **one** share codec, **one** scheduler. Notable conflict resolutions
"more-correct-wins": A's end-exclusive overlaps vs B's `:59` math (A); A's `packLanes` vs B's grid (A);
A's strict `schedule` param validation vs B's raw id trust (A); B's pinned-instructor persistence vs
A's derived-only pill (superset: one `instructorFilter` map that survives Clear-picks, feeds the engine,
the share codec, and localStorage); B's dashboard tiles vs A's stat bar (both kept — different jobs,
single source of numbers); B's auto-populate-on-load (rejected: mutates user state unasked).

## Build & test evidence

- `npx tsc --noEmit` → 0 errors (strict).
- `npx vite build` → single-file `dist/index.html`, 362 KB (105 KB gzip), no warnings.
- `npm run test:harness` → 81 assertions: conflict rules, exact durations, free-time unions/clipping,
  engine invariants (conflict-free, ranked, dedup, budgets, hard-pruning + honest failure), share
  roundtrips incl. `instructorFilter` + prefs + hostile payloads, localStorage corruption matrix,
  preference sanitization, reversible filtering.
- `npm run test:ssr` → full App tree renders headlessly with **no exceptions**, including a real
  `?schedule=` restore (69 KB of plan markup) and five corrupt-URL variants falling back to onboarding.
- Dev server + preview host 200, no runtime overlay errors.

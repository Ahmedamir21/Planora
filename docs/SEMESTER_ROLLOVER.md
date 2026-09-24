# Semester Rollover Guide

This project is designed so a new semester should require **data updates, not feature rewrites**.

## Safe workflow

1. Create a new branch from the latest stable production branch.
2. Update the semester metadata in:
   `src/config/semester.ts`
3. Replace/update course data in:
   - `src/data/courses.ts`
   - `src/data/schElectives.ts`
4. Update which courses belong to each major/year in:
   - `src/data/majors.ts`
5. Update `dataLastVerified` in the semester config after checking the final dataset against Self-Service.
6. Run the full CI suite. Do not merge if any required check fails.
7. Open the preview deployment and spot-check representative majors/years before promoting it to production.

## What to change in semester.ts

Change only the current-semester fields:

- `key` — unique stable id, e.g. `spring-2027-main`
- `term`
- `year`
- `session`
- `dataLastVerified`
- `publicHostLabel` if the public domain changes
- `version` only when you intentionally change the product version

**Do not change `LEGACY_UNTAGGED_SEMESTER_KEY`.** It permanently identifies old pre-semester-key Fall 2026 links/state so future terms can reject them safely.

## Data rules enforced automatically

The CI data validator rejects:

- duplicate course IDs
- duplicate course codes in one active semester dataset
- major/year references to missing courses
- duplicate course IDs inside one year
- invalid day codes
- invalid start/end times
- zero or negative meeting durations
- missing section IDs
- invalid palette indexes
- invalid credit values
- courses marked `noFixedSchedule` that publish meetings
- scheduled courses that publish no meetings
- unassigned instructor buckets that are not marked `unassigned: true`

Missing rooms are allowed because Self-Service can legitimately omit them. CI prints them as warnings for manual review.

## IDs and share links

Keep a course `id` stable when it still represents the same course. The visible course code/name can change independently if the official data changes.

Share links are semester-tagged. A link from one semester is intentionally rejected by another semester instead of being mapped onto different section data.

Local saved planner state is also semester-tagged. Old state cannot silently populate a future semester.

## Locks and Assistant constraints

Course/section locks and persistent AI constraint chips are scoped to the current semester. Current Fall 2026 legacy values are migrated automatically; future semesters start clean.

## Before merging a new semester

Verify at least:

- one Year 1 schedule
- one Year 2 schedule
- one Year 3 schedule
- one Year 4 schedule
- one cross-year addition
- one SCH elective
- one course with multiple instructors
- one unassigned section
- one no-fixed-schedule course
- one real conflict
- one Best Schedule generation
- one share-link restore
- one Share as Image export
- one AI section change
- one AI conflict repair
- one course lock and one section lock

Then confirm CI is fully green and the preview deployment has no runtime errors.

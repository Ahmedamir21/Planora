# Fall 2026 / Main Session: time and room updates

The admin panel has a separate **Update times and rooms only** preview under **Data drafts**. It reads the latest *saved* private drafts for both `courses.json` and `sch.json`, then matches each CSV record to exactly one existing course, component and section. It never creates a course, instructor, or section, and never changes credits, names, majors, or section identifiers. A preview does not save or publish anything.

## CSV contract

UTF-8 (optionally with BOM), with exactly these seven columns, in this order:

```csv
courseCode,subtype,section,day,start,end,room
CSAI 205,Lecture,03,Tue,10:00,12:00,G006-B
```

Use the published `courseCode` and keep the exact section text (`01` is distinct from `1`). Component must be `Lecture`, `Lab` or `Tutorial`; day must be `Sun`–`Thu` or its full English name. Times use 24-hour `HH:mm` (12-hour `h:mm AM/PM` also parses) and are **exact minutes from midnight**. The schedule engine stores `[start, end)` intervals: `10:00,12:00` means 10:00 through the instant before 12:00. It does not round or add one minute. A displayed end like `11:59 AM` is **not** automatically interpreted as `12:00`; the row is excluded until the Self-Service representation is verified. Original CSV start/end strings appear beside each previewed change.

A blank room means the extraction missed it: the row is excluded, keeping the existing room and time. Only use the exact marker `ROOM_UNPUBLISHED` when Self-Service **explicitly confirms** that no room is published; this clears an existing room after review. Quote CSV fields that contain commas, including room text.

This mode accepts at most **250,000 characters per CSV**, matching the existing admin importer and draft API limit. It rejects a larger CSV in full. Split large exports at row boundaries and repeat the header in each batch. Compare batch and export totals before saving; splitting must not conceal failed pages or missing section details.

## Review and save

1. Sign in to the Planora admin panel and open **Data drafts**. Save or discard any unsaved edits already present in the JSON editor.
2. Upload or paste the verified CSV into **Update times and rooms only** and click **Preview times and rooms against both drafts**.
3. Review `Read`, `Applied`, `Unchanged`, `Excluded`, each excluded row with its reason, and every before/after change. Identical repeated rows are counted and ignored; different nonoverlapping meetings for one section and conflicting entries are all excluded. A section matching more than one instructor is also excluded. The current planner models one meeting per component selection, so multi-meeting sections need a separately reviewed model change.
4. Enter the Self-Service source/reason and save each affected draft (`courses.json` and/or `sch.json`) using the separate buttons. Each save has its own revision check, history entry and Undo. If one save fails, the other may already be saved: review both statuses and re-preview against the current drafts before retrying. **No student-facing data is automatically published.** A reviewed source commit and deployment are still required.

The older **Import published sections** mode uses eight CSV columns including `instructor` and can add missing sections; use the new mode for time and room updates. It now distinguishes identical repeats from different entries but still holds multi-meeting sections for review.

## Source access and English course data still needed

No browser scraping script has been built: the university endpoint, pagination, detail response, and session expiry behavior are not available from a verified Network sample. To implement the requested read-only Chrome DevTools Snippet, provide *sanitized* examples from the logged-in browser's Network panel for (1) a term search results page, including pagination metadata, (2) a section-detail response showing day/time/room, (3) the shape of an end-of-pages response, and (4) a redacted expired-session response. Keep only method, URL **path** (remove token-bearing query values), field names and nonpersonal example values. Remove student identity, cookies, Authorization headers, tokens, signatures and personal IDs before sharing. The script must stop and mark the export incomplete if any page/detail fails; it will never submit enrollment or edit requests. It will export the original time strings and a completion/conflict report alongside the seven-column CSV.

The current published `courses.json` and `sch.json` contain **none** of `ENGL 003`, `ENGL 004`, `ENGL 156`, `ENGL 157`. The application is prepared to offer matching verified records as optional choices across majors/years, including Cyber Security, without automatically selecting them or creating per-major copies. Publishing these four levels still requires a Self-Service source for each course's exact name, credits, instructors, sections and meeting details; until then they remain unavailable instead of showing invented options. Preserve the leading zeroes of `003` and `004` when supplying the records.

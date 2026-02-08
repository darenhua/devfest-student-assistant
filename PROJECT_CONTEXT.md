# School Assistant

## Vision
School Assistant is a personal academic life dashboard for students who are overwhelmed by scattered information across school platforms. **AI agents automatically scrape** course pages, syllabi, emails, and portals to discover assignments, office hours, exams, and events — then surface everything in a single, editable **daily markdown briefing** the student can read, annotate, and check off.

## How It Works
1. **Add a Source** — Student pastes a URL (e.g., a Canvas course page, Google Classroom, any school portal).
2. **Agents Crawl** — Specialized agents (homework, office hours, events, exams) continuously scrape sources and extract structured data.
3. **Daily Markdown** — AI generates a rich-text daily briefing document (powered by BlockNote) with headers like "Things I have to do today", checkboxes, due dates, and links. The student can edit, annotate, reorder, and check items off.
4. **Agent Dashboard** — A side panel shows live agent statuses (sleeping/working), scraped results organized by type (assignments, events, office hours, exams), and detail cards with source attribution.

## Architecture (Current Phase)
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS v4
- **Editor**: BlockNote (ProseMirror-based block editor) for the daily markdown briefing
- **Agents**: Specialized crawl agents (homework, office hours, events, exams) that scrape sources
- **Sources**: User-managed list of URLs for agents to crawl

## Design Layout
```
+------------------------------------------------------------------+
|                       School Assistant                             |
| +---------------------------+  +-------------------------------+  |
| | daily markdown   [rev #]  |  | [hw agent] [oh agent] [events]| |
| |                           |  | [exams agent]                  | |
| | Things I have to do today:|  +-------------------------------+  |
| | - [ ] stats hw 1 **imp    |  | 5 assignments found            | |
| | - [ ] office hours         |  | +----------------------------+ | |
| |                           |  | | Operating Systems HW 2     | | |
| | Things due tomorrow:      |  | | source → schedule          | | |
| | - [ ] ...                 |  | +----------------------------+ | |
| |                           |  +-------------------------------+  |
| |  (rich-text editable via  |  | 10 events | 3 OH  | 2 exams   | |
| |   BlockNote editor)       |  | [cards]   |[cards] | [cards]   | |
| +---------------------------+  +-------------------------------+  |
+------------------------------------------------------------------+
```

## Data Model
- **Assignment**: title, className, classColor, dueDate, sourceUrl, sourceName
- **Event**: title, date, time, location, sourceUrl
- **OfficeHour**: professor, course, day, startTime, endTime, location, sourceUrl
- **Exam**: title, course, date, time, location, sourceUrl
- **Source**: url, name, lastCrawled, assignmentCount
- **Agent**: name, type (homework|office_hours|events|exams), status (sleeping|working), lastRun, itemsFound

## Key Decisions
- No calendar grid — the daily markdown timeline replaces it (students think in urgency, not grids)
- AI generates the daily briefing; student edits are preserved across regenerations
- BlockNote as the editor (Notion-like block editor, fast MVP, markdown round-tripping)
- Agents are typed: each specializes in one kind of data (assignments, OH, events, exams)
- Agent status is visible (sleeping/working) so the student trusts the system is up to date
- Each scraped item links back to its source for trust and verification
- Single student use case (no multi-user/auth for now)

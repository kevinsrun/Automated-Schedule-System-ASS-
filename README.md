# ASS — Automated Scheduler System

ASS (Automated Scheduler System) is a Google Apps Script–based academic orchestration engine that integrates:

- Dual Canvas instances (AISD + UTA)
- Google Calendar
- Scholarship pipeline (Autoship)
- Syllabus-aware scheduling logic
- 80/20 scheduling rule enforcement

It converts lecture schedules, Canvas due dates, and course structure into dynamically generated daily plans.

---

## Core Features

### 1. Dual Canvas Sync (AISD + UTA)

Pulls upcoming events from:

- `AISD_CANVAS_BASE_URL`
- `UTA_CANVAS_BASE_URL`


Creates or updates:
- All-day due-date events
- 7 / 3 / 1 day reminders
- Tagged with `[CanvasKey:INSTANCE:ID]` for dedupe safety

Prevents ID collisions between AISD and UTA.

---

### 2. Lecture-Aware Daily Scheduler

Reads existing Google Calendar lecture events and:

- Computes free time blocks
- Fills only **80%** of available time
- Leaves **20% unscheduled** (flex buffer rule)
- Inserts structured study blocks
- Avoids overlap with classes

---

### 3. Syllabus Parsing Support

Supports:
- PDF → Google Doc conversion via Drive API
- Text extraction
- Parsing for:
  - Exam dates
  - Assignment weights
  - Weekly workload
  - Major project milestones

Used to weight scheduling intensity.

---

### 4. Scholarship System (Autoship Integration)

- Syncs Canvas scholarship hits
- Generates essay documents
- Creates Google Calendar deadlines
- Maintains Triage logic:
  - Immediate
  - Urgent
  - Non-Urgent
  - Satisfied
  - Cooked

---

## Architecture

Google Apps Script project containing:

- Canvas Sync Engine
- Calendar Sync Engine
- Syllabus Parser
- Scholarship Intake System
- Triage Engine
- Daily Scheduler

Uses:

- `CalendarApp`
- `DriveApp`
- Advanced Drive API
- Canvas REST API
- Script Properties for credential isolation

---


---

## Scheduling Rule

The system enforces:

> Only schedule 80% of the day.  
> Leave 20% for flexibility and volatility.

This prevents over-optimization and preserves buffer capacity.

---

## Setup

1. Install CLASP
2. Clone repository
3. `clasp login`
4. `clasp push`
5. Set Script Properties
6. Install triggers:
   - Canvas sync trigger
   - Daily scheduler trigger

---

## Design Philosophy

ASS treats:

- Time as finite compute
- Academic workload as weighted tasks
- Deadlines as hard constraints
- Energy as limited throughput

The system prioritizes:

- High-weight assignments
- Imminent deadlines
- Cross-institution load balancing
- Long-term research continuity

---

## Limitations

- Canvas does not reliably expose class meeting schedules.
- Syllabus parsing depends on document formatting quality.
- Google Calendar iCal subscriptions refresh slowly (~24 hrs).
- Requires manual API token refresh if expired.

---

## Future Extensions

- Weighted course intensity model
- Automatic midterm ramp-up detection
- Energy-based scheduling
- Multi-calendar isolation (AISD / UTA separation)
- Research block prioritization
- GPA impact projection

---

## Maintainer

Kevin Srun  
Biomedical Engineering / Pre-Med  
AISD + UTA Dual Credit  

## Required Script Properties


# Career Quest

Employee development demo with a React/Vite frontend and an Express/TypeScript
backend. The backend owns profiles, skills, career targets, recommendations,
completion effects, imports, and HR statistics. The interface stays in English.
Demo entry does not authenticate users; real authentication and AI integration
are outside this implementation. Explanations are generated deterministically
from recommendation factors; no LLM configuration or API key is needed.

## Run locally

Prerequisites: Node.js **22.12+** (verified on 24.15.0), npm, and the four starter
files in this repository's root. Run these commands from the repository root.

Terminal 1 — backend:

```sh
npm --prefix backend ci
npm --prefix backend run build
npm --prefix backend start
```

The API listens at `http://localhost:8000/api`. For automatic backend reloads,
use `npm --prefix backend run dev` instead of the build/start commands.
Optional backend environment variables: `PORT` (default `8000`), `CORS_ORIGIN`
(default `http://localhost:5173`), and `DATA_DIR` (default repository root).

Terminal 2 — frontend:

```sh
npm --prefix frontend ci
VITE_API_BASE_URL=http://localhost:8000/api npm --prefix frontend run dev -- --host localhost --port 5173 --strictPort
```

Open `http://localhost:5173` and choose **Employee preview** or **HR preview**.
`VITE_API_BASE_URL` defaults to `http://localhost:8000/api`; include `/api` when
overriding it. It can also be set in an uncommitted `frontend/.env.local`.
Restart Vite after changing it; production builds capture the value at build time.
If the frontend origin changes, set the backend's `CORS_ORIGIN` to match.

## Test the connected demo

1. Enter Employee preview; search by name, role, or ID and select an employee.
2. Inspect current target skills, trajectory, readiness milestones, and 0–3
   recommended activities with explanations, skill impacts, and history factors.
3. Select **Mark completed**. Profile, history, skills, milestones, and
   recommendations update without a reload; celebration appears only on success.
4. Open **HR overview** to fetch live counts, skill gaps, participation, and
   employees without a recommended step.
5. Import any subset of `employees.json`, `events.json`, `skills.json`, and
   `activity_history.csv` in HR. Files must use the starter-kit schema and metadata.
   HR and the employee list refresh; the selected employee is preserved if present.
6. Return to My growth and select the imported employee. The same backend logic
   handles both starter and imported profiles. API failures show an error and retry
   option; the frontend never substitutes sample data.

Completion and import changes are **in memory**. Restarting the backend reloads
the source dataset. The dataset snapshot, not the computer date, controls calculations.
The profile API exposes target skills and readiness counts, but not work format or
assessment date; those unsupported details are omitted. Milestone badges and the
progress ring visualize backend readiness counts, without recalculating skill gaps
or promotion eligibility. See [API_CONTRACT.md](API_CONTRACT.md).

## Checks

```sh
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
npm --prefix backend run typecheck
npm --prefix backend run build
```

The backend has no separate lint script. Endpoint tests require permission to
open local sockets. Frontend unit tests use Node's built-in test runner.

A dependency-free browser smoke test is also included:

```sh
npm --prefix backend run build
node frontend/scripts/browser-smoke.mjs
```

It requires Google Chrome (defaults to its macOS application path; override with
`CHROME_PATH`), starts isolated test servers on ports `18000` and `15173`, and
uses Chrome debugging port `19223`. These ports must be free. It checks selection,
search, stale responses, recommendation factors, completion failure/success,
duplicate prevention, HR, multipart import, empty recommendations, and retry.
It uses a temporary browser profile and a fresh in-memory dataset, then stops its
processes. It does not modify starter files or the normal running backend.

## Starter dataset

Synthetic data. No real people or companies.

**Snapshot date:** `2026-10-01`. Treat it as "today".
**History window:** `2024-10-01` – `2026-09-30`.

## Files

| File | Content | Size |
|---|---|---|
| `skills.json` | Skill catalog, proficiency scale, role requirements by grade | 60 skills, 8 roles × 4 grades |
| `employees.json` | Employee profiles | 200 |
| `events.json` | Development activities catalog | 40 |
| `activity_history.csv` | Participation log | 2,743 records |

## Relations

```
employees.skills ─────────────┐
role_profiles.required_skills ├──> skills.skill_id
events.develops_skills ───────┤
events.prerequisites ─────────┘
employees.(role, grade) ──────> role_profiles.(role, grade)
employees.manager_id ─────────> employees.employee_id
activity_history.employee_id ─> employees.employee_id
activity_history.event_id ────> events.event_id
```

All references are valid. IDs are unique.

## skills.json

`proficiency_scale` — meaning of levels 0–5. All skill levels in the dataset use this scale.

`skills[]`

| Field | Type | Notes |
|---|---|---|
| `skill_id` | string | e.g. `SK_SYSTEM_DESIGN` |
| `name` | string | |
| `type` | `hard` \| `soft` | |
| `category` | string | Grouping for reports |
| `description` | string | |

`role_profiles[]` — one entry per role and grade.

| Field | Type | Notes |
|---|---|---|
| `role` | string | 8 roles |
| `grade` | `Junior` \| `Middle` \| `Senior` \| `Lead` | In this order |
| `required_skills` | object | `skill_id → minimum level` for this grade |
| `critical_skills` | array | Skills that must meet the requirement to hold this grade. Key for promotion |

Requirements never decrease from grade to grade.

## employees.json

| Field | Type | Notes |
|---|---|---|
| `employee_id` | string | `E0001` … `E0200` |
| `full_name` | string | Synthetic |
| `department` | string | One department per role |
| `role`, `grade` | string | Match a `role_profiles` entry |
| `manager_id` | string \| null | A Lead of the same department. `null` for department heads |
| `hire_date` | date | |
| `tenure_months` | int | Full months from `hire_date` to snapshot date |
| `work_format` | `office` \| `hybrid` \| `remote` | |
| `preferred_language` | `kk` \| `ru` \| `en` | UI language preference |
| `career_goal` | object \| null | `{target_role, target_grade}`. `null` = no goal set |
| `skills` | object | `skill_id → level 0–5`. Missing skill = level 0 |
| `last_review_date` | date | Date of the last skill assessment |

Skill levels reflect the last assessment. Activities completed after `last_review_date` are not yet included.

## events.json

| Field | Type | Notes |
|---|---|---|
| `event_id` | string | `EV_001` … `EV_040` |
| `title`, `description` | string | |
| `type` | string | `compliance`, `onboarding`, `course`, `workshop`, `mentoring`, `certification`, `meetup` |
| `format` | `online` \| `offline` \| `self_paced` | |
| `duration_hours` | number | Total effort |
| `mandatory` | bool | Assigned by HR. Not a recommendation target |
| `target_roles`, `target_grades` | array | Who the event is for |
| `develops_skills` | array | `{skill_id, gain, max_level}`: completion raises the skill by `gain`, but not above `max_level`. Empty for compliance training |
| `prerequisites` | object | `skill_id → minimum level` needed to join |
| `upcoming_sessions` | array of dates | Future sessions. Empty for `self_paced` (available any time) |

## activity_history.csv

One row = one employee's participation in one event.

| Column | Type | Notes |
|---|---|---|
| `record_id` | string | `R000001` … |
| `employee_id`, `event_id` | string | |
| `date` | date | Session date; enrollment or assignment date for self-paced |
| `due_date` | date \| empty | Mandatory events only |
| `status` | string | See below |
| `completion_pct` | int 0–100 | |
| `score` | int 0–100 \| empty | Final assessment. Courses, certifications and compliance only |
| `feedback_rating` | int 1–5 \| empty | Employee's rating of the event. Optional |
| `assigned_by` | `self` \| `manager` \| `hr` | Who initiated participation |

**Statuses**

| Status | Meaning | `completion_pct` |
|---|---|---|
| `completed` | Finished | 100 |
| `in_progress` | Started, not finished yet | 0–95 |
| `dropped` | Started and abandoned | 5–95 |
| `no_show` | Registered for a session, did not attend. Scheduled events only | 0 |
| `declined` | Refused an assignment from manager or HR | 0 |
| `overdue` | Mandatory event not finished by `due_date` | 0–95 |

Rows are sorted by `date`, `employee_id`, `event_id`.

## Rules

- An event is not repeated after `completed`. Exception: `EV_036` (recurring club).
- Voluntary events in history always match the employee's role, grade (current or previous) and prerequisites.
- New employees complete `EV_004` in their first month.
- Evaluation uses additional employee profiles and history records in the same format. Your solution must be able to load them.

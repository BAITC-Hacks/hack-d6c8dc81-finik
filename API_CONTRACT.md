# Career Quest — frontend/backend agreement (v1)

This document is the agreement between the two teammates. The frontend owns screens and user interactions. The backend owns dataset loading, eligibility, skill calculations, ranking, explanations based on calculated facts, and HR aggregates. Both sides use the same API and field names. No frontend ranking or grade calculations.

## Basic rules

- Development API base URL: `http://localhost:8000/api` (change with `VITE_API_BASE_URL` in the frontend).
- Request and response bodies are JSON, except file upload, which uses `multipart/form-data`.
- IDs are strings from the starter kit: `employee_id` such as `E0028`, `event_id` such as `EV_009`, and skill IDs such as `SK_SYSTEM_DESIGN`.
- Dates use `YYYY-MM-DD`. Calculations use the dataset's snapshot date `2026-10-01`, rather than the machine's current date.
- Skill levels are integers 0–5. Missing skill means level 0.
- All successful endpoints return HTTP 200 (or 201 for completed activity) and the JSON shape below. Errors return `{ "error": { "code": "...", "message": "..." } }` and an appropriate HTTP status.
- The backend enables CORS for the local frontend origin (usually `http://localhost:5173`).
- These are demo endpoints using synthetic data. Role-based access is a separate production requirement; an HR navigation button is not authorization.

## 1. Employee list

`GET /api/employees`

Response:

```json
{
  "employees": [
    {
      "employee_id": "E0028",
      "full_name": "Example Employee",
      "role": "Backend Engineer",
      "grade": "Middle",
      "department": "Backend Development"
    }
  ],
  "total": 200
}
```

The frontend uses this for its employee selector. `total` is the number of returned employees. After an import, this list includes added profiles.

## 2. One employee's profile and trajectory

`GET /api/employees/{employee_id}`

Response shape (values below illustrate the format; the backend returns values from the actual uploaded dataset):

```json
{
  "employee_id": "E0028",
  "full_name": "Example Employee",
  "role": "Backend Engineer",
  "grade": "Middle",
  "target_role": "Backend Engineer",
  "target_grade": "Senior",
  "tenure_months": 52,
  "skills": [
    {
      "skill_id": "SK_SYSTEM_DESIGN",
      "name": "System Design",
      "current_level": 2,
      "required_level": 4,
      "gap": 2,
      "critical": true
    }
  ],
  "history": [
    {
      "record_id": "R000001",
      "event_id": "EV_009",
      "event_title": "Example activity",
      "date": "2026-09-15",
      "status": "completed"
    }
  ],
  "readiness": {
    "requirements_met": 4,
    "requirements_total": 10,
    "critical_requirements_met": 1,
    "critical_requirements_total": 3
  }
}
```

`gap = max(0, required_level - current_level)`. The backend uses the last assessment plus completed activities after `last_review_date`, applying each gain only once. `history` is sorted newest first. If `career_goal` names a different role, the backend may use that role's target profile and must return it in `target_role`.

## 3. Recommended next steps

`GET /api/employees/{employee_id}/recommendations`

Response:

```json
{
  "employee_id": "E0028",
  "target_role": "Backend Engineer",
  "target_grade": "Senior",
  "recommendations": [
    {
      "rank": 1,
      "event_id": "EV_009",
      "title": "Example System Design workshop",
      "type": "workshop",
      "format": "online",
      "duration_hours": 3,
      "next_session": "2026-10-12",
      "score": 12.5,
      "explanation": "System Design is 2/4 for Senior. This activity can raise it by 1; it is critical for promotion. Participation history was also considered.",
      "factors": {
        "current_grade": "Middle",
        "target_grade": "Senior",
        "skill_impacts": [
          {
            "skill_id": "SK_SYSTEM_DESIGN",
            "name": "System Design",
            "current_level": 2,
            "required_level": 4,
            "gain": 1,
            "max_level": 5,
            "expected_level": 3,
            "critical": true
          }
        ],
        "completed_similar": 1,
        "missed_or_declined_similar": 2
      }
    }
  ]
}
```

There are **0–3** recommendations, sorted by rank. An empty list is valid. The backend excludes mandatory activities, unmet prerequisites, unavailable sessions, and previously completed non-recurring activities. Ranking considers at least grade, skill gaps, next-grade requirements and participation history. `score` is useful for debugging; the frontend displays the explanation and factors, and never calculates or changes the score. Any LLM wording must be based on these computed facts and must have a deterministic fallback.

## 4. Complete an activity

`POST /api/employees/{employee_id}/complete`

Request:

```json
{ "event_id": "EV_009" }
```

Response (HTTP 201):

```json
{
  "employee_id": "E0028",
  "event_id": "EV_009",
  "record_id": "R_NEW_001",
  "status": "completed",
  "completed_on": "2026-10-01",
  "skill_changes": [
    {
      "skill_id": "SK_SYSTEM_DESIGN",
      "previous_level": 2,
      "new_level": 3,
      "gain_applied": 1
    }
  ],
  "profile": {},
  "recommendations": []
}
```

`profile` has exactly the shape from endpoint 2; `recommendations` is the array from endpoint 3. The backend records the completion and applies `min(5, event.max_level, old_level + event.gain)`. A repeated completion of a non-recurring event returns HTTP 409 and changes nothing. The frontend replaces displayed profile and recommendation cards with the returned values.

## 5. HR overview

`GET /api/hr/overview`

Response:

```json
{
  "employee_count": 200,
  "completed_activity_count": 900,
  "top_skill_gaps": [
    { "skill_id": "SK_SYSTEM_DESIGN", "name": "System Design", "employee_count": 32 }
  ],
  "participation_by_event": [
    { "event_id": "EV_009", "title": "Example activity", "completed": 18, "no_show": 3, "dropped": 2 }
  ],
  "employees_without_step": [
    { "employee_id": "E0007", "full_name": "Example Employee", "role": "Backend Engineer", "grade": "Lead" }
  ]
}
```

The counts above are placeholders, not measured results. The backend calculates them from the loaded dataset. `top_skill_gaps` is sorted by `employee_count` descending.

## 6. Import judges' files

`POST /api/import` with `multipart/form-data`. Form field name: `files`. Accept any subset of `employees.json`, `events.json`, `skills.json`, `activity_history.csv`; a single request may include multiple files.

Response:

```json
{
  "loaded": { "employees": 3, "events": 0, "skills": 0, "history": 12 },
  "total": { "employees": 203, "events": 40, "skills": 60, "history": 2755 },
  "imported_employee_ids": ["JUDGE_001", "JUDGE_002", "JUDGE_003"]
}
```

For additional employees/history, append new IDs and replace matching IDs. If complete catalogs are uploaded, replace those catalogs. Validate all references before changing the active dataset. On error, change nothing and return HTTP 400 with a readable message. Files are synthetic and processed locally for the hackathon; do not send them to an LLM by default.

## Shared completion checklist

- [ ] Frontend can show a profile using endpoint 2 with real data.
- [ ] Recommendation cards use endpoint 3 and display the explanation/factors.
- [ ] Completing an event updates the screen from endpoint 4 without refreshing.
- [ ] HR view uses endpoint 5, including the no-step list.
- [ ] Import uses endpoint 6 and makes an imported employee selectable.
- [ ] Both teammates test the same three tricky profiles and agree on the expected behavior.

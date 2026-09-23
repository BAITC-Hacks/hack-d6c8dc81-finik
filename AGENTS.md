# AGENTS.md

## Project

HackAlem 2026 — Career Quest.

Career Quest is a web application for employee career development. The backend loads synthetic employee, skill, event, and activity-history datasets; calculates career progress and skill gaps; recommends 0–3 relevant development activities; explains recommendations from computed facts; updates progress after activity completion; and provides HR aggregates.

The hackathon's core is recommendation quality and explainability. Gamification is optional and must not distract from the core workflow.

## Backend Stack

- Node.js
- Express
- JavaScript unless the existing repository already uses TypeScript
- JSON/CSV starter-kit data
- In-memory storage is acceptable for the MVP unless the existing project already has a database
- LLM integration may be used for natural-language explanations, but never as the source of truth for ranking or calculations

Do not replace the existing stack or introduce major infrastructure without first inspecting the repository and explaining why it is necessary.

## Source of Truth

Treat `API_CONTRACT.md` as the frontend/backend contract.

Do not casually change:
- endpoint paths
- HTTP methods
- request shapes
- response shapes
- field names
- status-code semantics

If implementation and the contract disagree, point out the discrepancy before changing the contract.

Important API rules:
- Base path: `/api`
- JSON for normal requests/responses
- `multipart/form-data` for imports
- IDs are strings from the starter kit
- Dates use `YYYY-MM-DD`
- Business calculations use the dataset snapshot date `2026-10-01`, not the machine's current date
- Skill levels are integers from 0 to 5
- A missing employee skill means level 0
- Errors use `{ "error": { "code": "...", "message": "..." } }`
- Enable CORS for the local frontend during development

## Required API

The backend must support:

- `GET /api/employees`
- `GET /api/employees/:employeeId`
- `GET /api/employees/:employeeId/recommendations`
- `POST /api/employees/:employeeId/complete`
- `GET /api/hr/overview`
- `POST /api/import`

Do not add alternative endpoints to solve behavior already covered by this contract unless there is a clear reason.

## Architecture

Prefer a simple layered structure:

```text
src/
  app/
  routes/
  controllers/
  services/
  engines/
  repositories/
  dataset/
  llm/
  middleware/
  config/
  utils/
```

Dependency direction should generally be:

```text
routes
  -> controllers
  -> services
  -> engines/repositories
  -> dataset store
```

Keep Express-specific objects (`req`, `res`, `next`) inside routes/controllers/middleware. Domain calculations must be callable and testable without Express.

### Controllers

Controllers are thin HTTP adapters.

They may:
- read params/body/files
- invoke services
- map known application errors to HTTP responses

They must not:
- calculate skill gaps
- rank events
- implement eligibility rules
- build HR aggregates
- contain LLM prompts

### Services

Services orchestrate application use cases.

Expected responsibilities include:
- employee profile assembly
- recommendation orchestration
- activity completion
- HR overview generation
- dataset import

Services should delegate pure business calculations to engines instead of duplicating formulas.

### Engines

Keep important decision logic explicit and independently testable.

Prefer separate responsibilities such as:
- skill calculation
- career/target-grade calculation
- event eligibility
- recommendation ranking
- explanation generation

Do not hide deterministic business rules inside an LLM prompt.

### Repositories

Services should access employees, events, skills, and history through repository interfaces/modules rather than reaching directly into raw JSON everywhere.

The first implementation may use an in-memory dataset store. Keep the boundary simple enough that persistence can be changed later without rewriting recommendation logic.

## Dataset Rules

Expected starter-kit inputs:
- `employees.json`
- `events.json`
- `skills.json`
- `activity_history.csv`

Do not invent the exact starter-kit schema before inspecting the actual files/README.

Centralize parsing and normalization. Avoid scattering assumptions about raw JSON/CSV shapes across services.

Use efficient lookup structures where helpful, for example maps keyed by employee, event, or skill ID.

The starter-kit data is synthetic. Do not send entire datasets or employee histories to an external LLM by default.

## Employee Profile and Skills

The backend, not the frontend, owns skill and trajectory calculations.

Skill gap:

```text
gap = max(0, required_level - current_level)
```

Current levels must follow the API contract: start from the relevant assessment and account for completed activities after `last_review_date`, applying each applicable gain only once.

When applying an activity gain, follow the event's dataset-defined `gain` and `max_level` rules and the global skill cap.

Do not create an independent XP system that changes actual skill levels.

Determine and return the target role/grade consistently. If `career_goal` points to another role and the dataset supports that transition, use the target profile required by the contract.

## Recommendation Pipeline

Recommendation behavior is the core of the project.

Use a pipeline conceptually equivalent to:

```text
employee
  -> current skills
  -> target role/grade requirements
  -> skill gaps
  -> eligible events
  -> deterministic multi-factor scoring
  -> sorted candidates
  -> top 0–3
  -> fact-grounded explanations
```

Never implement recommendation as:
- lowest skill only
- largest gap only
- random selection
- an LLM receiving all events and deciding which ones to choose

The judges intentionally use profiles where a single-factor rule produces a bad recommendation.

Ranking must consider multiple relevant factors, including at least:
- current grade
- target/next-grade requirements
- skill gaps
- participation history

Event skill impact and critical requirements should also be used where supported by the dataset.

Keep ranking deterministic: the same active dataset and employee state should produce the same ranking.

Keep scoring factors inspectable. A recommendation should be explainable from computed facts.

Do not overfit or hardcode behavior for known employee IDs or judge profiles.

## Eligibility Before Ranking

Filter invalid candidates before scoring them.

At minimum respect the API contract's exclusions:
- mandatory activities
- unmet prerequisites
- unavailable sessions
- previously completed non-recurring activities

Keep eligibility separate from ranking so a high score cannot make an ineligible event recommendable.

Return an empty recommendation array when nothing valid exists. Do not fabricate a recommendation merely to ensure there are three cards.

## Recommendation Explanations and LLM Use

The deterministic system decides what to recommend. The LLM, if used, may improve how the explanation is phrased.

The LLM must receive computed facts rather than raw authority to invent reasoning.

For example, explanation inputs may contain:
- current and target grade
- relevant skill
- current level
- required level
- gap
- event gain
- expected level
- critical flag
- completed similar count
- missed/declined similar count

Never let generated text contradict these values.

Every LLM-backed explanation must have a deterministic template fallback so recommendations continue to work if:
- no API key exists
- the provider is unavailable
- the request times out
- the output is invalid

Recommendation ranking must not change merely because the LLM is unavailable.

## Completing Activities

Activity completion is a state-changing operation.

Before mutation:
- validate employee
- validate event
- validate that completion is allowed
- detect repeated completion of non-recurring events

A duplicate completion of a non-recurring event must return HTTP 409 and change nothing.

After successful completion:
1. record the completion
2. calculate skill changes
3. rebuild the employee profile
4. recalculate recommendations
5. return the updated profile and recommendation array according to `API_CONTRACT.md`

Avoid applying the same historical gain twice.

## HR Overview

The HR endpoint must calculate data from the active dataset rather than return placeholder values.

It includes:
- employee count
- completed activity count
- most common skill gaps
- participation by activity
- employees without a recommended step

Do not invoke an LLM once per employee to calculate `employees_without_step`. HR analytics should use deterministic eligibility/ranking logic without generating recommendation prose.

Do not create public employee rankings. The hackathon specification explicitly rejects public performance leaderboards.

## Import

Judge-file import is a critical demo path.

`POST /api/import` accepts any supported subset of the starter-kit files.

Imports must be atomic:

```text
upload
 -> parse temporary data
 -> validate schema
 -> validate cross-references
 -> construct candidate dataset
 -> commit only if everything is valid
```

If any uploaded data is invalid:
- return HTTP 400 with a readable error
- leave the active dataset unchanged

For additional employee/history data, follow the merge/replace behavior defined in `API_CONTRACT.md`.

After a successful import, invalidate/recompute any caches that depend on the dataset.

Never hardcode the original dataset size. Imported judge employees must immediately work with the normal profile and recommendation endpoints.

## Errors

Use explicit application errors for expected failures.

Examples:
- employee not found -> 404
- event not found -> 404
- invalid import -> 400
- invalid request -> 400
- duplicate non-recurring completion -> 409
- unexpected server failure -> 500

All API errors must follow the contract error envelope.

Do not leak stack traces, secrets, prompts, or provider credentials in API responses.

## Performance

Target:
- normal interface/API operations comfortably within the hackathon's 2-second interface expectation
- AI recommendation/explanation work within the 10-second allowance

Prefer deterministic local calculations for ranking.

Avoid repeated full-dataset scans in hot paths when simple indexes/maps can solve them.

Do not make unnecessary sequential LLM requests for multiple recommendation cards. Keep the application usable without LLM access.

## Security and Privacy

This is synthetic hackathon data, but preserve good boundaries.

- Never commit `.env`, API keys, tokens, passwords, or credentials.
- Keep secrets in environment variables.
- Validate uploaded file names/types/content.
- Apply reasonable upload-size limits.
- Do not expose raw filesystem paths.
- Do not log secrets or full LLM credentials.
- Employee and HR authorization are production concerns; do not pretend that an HR navigation button is authorization.
- Do not expose one employee's engagement/history to other employees as a gamification feature.

## Testing Priorities

Business logic tests are more important than route-count tests.

Prioritize tests for:
- skill gap calculation
- activity gain and `max_level`
- avoiding duplicate gain application
- target grade/role determination
- eligibility filtering
- recommendation ranking
- participation-history effects
- zero valid recommendations
- duplicate non-recurring completion
- atomic import rollback
- imported employee becoming immediately available
- HR aggregates

Create several tricky fixtures where single-factor ranking would choose the wrong activity.

For recommendation tests, assert important ordering/factors rather than LLM prose.

Also add integration tests for the API contract's main happy paths and important error status codes.

## Hackathon Priorities

When deciding what to work on, prioritize in this order:

1. Correct dataset loading and validation
2. Correct profile/skill/trajectory calculations
3. Multi-factor deterministic recommendation quality
4. Explainability and factor visibility
5. Completion -> progress -> new recommendations
6. Judge-file import
7. HR overview
8. Reproducibility and one-command startup
9. LLM wording improvements
10. Optional gamification/polish

Do not sacrifice core correctness for optional features.

## Reproducibility

The project must be easy for judges and teammates to run.

Aim for one-command startup where practical.

Keep README instructions current whenever setup changes.

Document:
- prerequisites
- environment variables
- install/run commands
- test commands
- expected starter-kit file location
- LLM fallback behavior
- architecture at a high level

Do not claim functionality in README that has not been implemented.

## Git

- `main` is the stable branch.
- Each team member works on their own branch.
- Do not make changes directly on `main`.
- Make small, focused commits.
- Do not commit secrets, API keys, passwords, or `.env` files.
- Do not mix unrelated refactors into feature commits.

## Codex Working Rules

Before implementing a substantial feature:

1. Inspect the relevant existing files and `API_CONTRACT.md`.
2. Identify the current architecture and conventions before proposing changes.
3. Explain the intended approach briefly.
4. Call out assumptions when starter-kit fields or behavior are not documented.
5. Implement the smallest coherent change.
6. Add/update focused tests.
7. Run relevant tests, lint, and build/type checks that exist in the repository.
8. Fix regressions caused by the change.
9. Summarize what changed, tests run, and remaining issues.

Additional rules:
- Do not rewrite working architecture merely to match a preferred pattern.
- Do not silently change the API contract.
- Do not invent starter-kit fields. Inspect the actual dataset/README first.
- Do not hardcode judge outcomes, employee IDs, event IDs, counts, or recommendation results.
- Do not use an LLM where deterministic code is sufficient.
- Do not add a dependency when a small existing/native solution is adequate.
- Do not perform broad cleanup while solving a focused task.
- Preserve backward compatibility with the frontend contract.
- When requirements are ambiguous, prefer the hackathon specification and `API_CONTRACT.md`; explicitly surface unresolved conflicts.
- Keep functions/modules focused enough that recommendation logic can be tested without HTTP or an LLM.

## Definition of Done

A backend change is not complete merely because an endpoint returns HTTP 200.

For affected functionality, verify as applicable:
- response matches `API_CONTRACT.md`
- calculations use real loaded data
- recommendation factors are traceable
- invalid states are rejected without partial mutation
- tests cover important business behavior
- imported judge data is not broken
- LLM failure does not break deterministic recommendations
- lint/build/tests pass
- README is updated if setup or behavior changed

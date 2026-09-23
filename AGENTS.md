# AGENTS.md

## Project

HackAlem 2026 — Career Quest.

Career Quest is a web application for employee career development.

The application helps an employee:
1. Understand their current role, grade, skills, and development history.
2. See their target role/grade and career trajectory.
3. Understand gaps between current skills and target requirements.
4. Receive 0–3 relevant development activities.
5. Understand why each activity was recommended.
6. Complete an activity and see updated skills/progress.
7. Receive updated recommendations after progress changes.

A second user is HR, who needs visibility into:
- common skill gaps
- activity participation
- employees who currently have no recommended development step

The core hackathon challenge is the quality and explainability of recommendations.

Gamification is optional and must not distract from the required recommendation and progression flow.


## Repository Structure

This repository contains both frontend and backend code.

Expected structure:

/
├── AGENTS.md
├── API_CONTRACT.md
├── README.md
│
├── backend/
│   ├── AGENTS.md
│   └── ...
│
└── frontend/
    ├── AGENTS.md
    └── ...

This root file contains rules shared across the whole project.

When working inside `backend/`, also follow `backend/AGENTS.md`.

When working inside `frontend/`, also follow `frontend/AGENTS.md`.

More specific instructions may add implementation details, but they must not contradict the hackathon requirements or API contract.


## Sources of Truth

Use the following sources in this order:

1. Hackathon technical specification
2. `API_CONTRACT.md`
3. Starter-kit README and actual datasets
4. Existing repository architecture and conventions
5. Relevant `AGENTS.md`

Do not invent undocumented starter-kit fields or behavior.

If two sources appear to conflict, identify the conflict before changing implementation or contracts.


## API Contract

`API_CONTRACT.md` is the agreement between frontend and backend.

Do not casually change:

- endpoint paths
- HTTP methods
- request shapes
- response shapes
- field names
- status-code semantics
- shared calculation assumptions

The frontend and backend must remain compatible.

If a contract change is genuinely necessary:

1. Explain why.
2. Identify frontend and backend impact.
3. Update `API_CONTRACT.md`.
4. Update both sides as necessary.
5. Update relevant tests.

Do not create frontend workarounds for incorrect backend behavior when the contract already defines the expected behavior.

Do not create backend workarounds for incorrect frontend assumptions when the contract already defines the expected behavior.


## Responsibility Boundary

The backend owns business logic and calculations, including:

- dataset loading
- dataset validation
- employee skill calculations
- target role/grade calculations
- skill gaps
- career readiness
- activity eligibility
- recommendation ranking
- recommendation factors
- activity completion effects
- HR aggregates

The frontend owns presentation and interaction, including:

- screens
- navigation
- API calls
- loading states
- error states
- empty states
- profile presentation
- trajectory presentation
- skill visualization
- recommendation presentation
- recommendation explanation presentation
- activity completion interaction
- HR visualizations
- dataset import UI

The frontend must not independently calculate:

- recommendation scores
- recommendation ranking
- skill gaps
- current skill levels
- target grade
- grade readiness
- activity eligibility
- career decisions

There must be one source of truth for business calculations: the backend.


## Core Employee Flow

The primary end-to-end scenario is:

employee selected
    ↓
profile loaded
    ↓
current role / grade / skills shown
    ↓
target role / grade shown
    ↓
skill gaps and trajectory shown
    ↓
0–3 recommended activities shown
    ↓
employee understands why they were recommended
    ↓
employee completes an activity
    ↓
backend updates progress
    ↓
profile and trajectory update
    ↓
recommendations update

This flow has higher priority than optional features.


## Core HR Flow

HR must be able to see at least:

- employee count
- common skill gaps
- participation by activity
- employees with no recommended development step

HR values must come from the active dataset.

Do not return hardcoded demo statistics.


## Judge Import Flow

The application must support additional profiles/history supplied during judging.

Imported employees must work through the exact same logic as existing employees.

The application must not depend on the original employee list being fixed.

Never hardcode behavior for:

- known judge profiles
- specific employee IDs
- specific event IDs
- expected judge recommendations
- original dataset counts


## Recommendation Principles

Recommendation quality is the main technical challenge.

Recommendations must use multiple relevant factors.

At minimum, follow the factors required by the case and API contract:

- current grade
- skill gaps
- next/target-grade requirements
- participation history

Where supported by the dataset, additional relevant facts may include:

- whether a requirement is critical
- activity skill impact
- expected skill gain
- prerequisites
- availability
- recurrence
- previous completion
- previous no-shows
- previous refusals/declines

Do not implement recommendations as:

- lowest skill only
- largest gap only
- random activity selection
- hardcoded mappings
- an LLM choosing activities without deterministic business logic

The jury intentionally uses tricky profiles where simplistic single-factor logic gives the wrong recommendation.


## Explainability

Every recommendation must be traceable to calculated facts.

The system should be able to answer:

- Why this activity?
- Which skill gap does it address?
- What is the employee's current level?
- What level is required?
- Is the skill important for the target grade?
- What improvement can this activity produce?
- How did relevant participation history affect the recommendation?

Do not generate explanations that contradict calculated recommendation factors.

The product should emphasize understandable reasons rather than exposing an unexplained numerical score.


## AI / LLM Principles

AI is part of the solution, but it must be used deliberately.

Do not use an LLM as a substitute for deterministic calculations already defined by the dataset.

Prefer:

deterministic data
    ↓
deterministic eligibility
    ↓
deterministic ranking
    ↓
computed recommendation facts
    ↓
LLM explanation/wording

Do not use:

raw employee + all events
    ↓
LLM
    ↓
"choose the best activities"

An LLM must not invent:

- employee skills
- grade requirements
- activity gains
- activity eligibility
- participation history
- recommendation factors
- recommendation scores
- completion effects

The application should remain usable if the LLM provider is unavailable.

Important recommendation behavior must therefore have deterministic behavior and fallback explanations.

Do not send the entire dataset to an external LLM by default.


## Data Principles

Expected hackathon data includes:

- employees
- skills
- grade requirements
- development events
- activity history

The actual starter-kit files and README define the real schema.

Inspect them before implementing schema-dependent behavior.

Do not invent fields that have not been observed or documented.

Do not hardcode dataset sizes.

Judge imports may change dataset counts.


## State Consistency

Frontend and backend must agree on application state.

For example:

complete activity
    ↓
validate operation
    ↓
record completion
    ↓
apply valid skill effects
    ↓
recalculate profile
    ↓
recalculate trajectory
    ↓
recalculate recommendations
    ↓
return updated state
    ↓
frontend renders returned state

Do not independently reproduce the same business calculation in frontend and backend.

Invalid operations must not partially mutate application state.


## UX Principles

Optimize the product for understanding an employee's development path.

The employee should quickly understand:

1. Where am I now?
2. Where am I trying to go?
3. What am I missing?
4. What should I do next?
5. Why should I do it?
6. What changed after I completed something?

Required information should be understandable during a short hackathon demo.

Always consider:

- loading states
- API errors
- empty states
- zero recommendations
- missing optional data
- imported employees
- slow AI responses

Do not assume there will always be exactly three recommendations.


## Gamification

Gamification is optional.

Do not prioritize:

- points
- badges
- virtual currency
- reward stores
- elaborate quest mechanics
- social competition

until the core recommendation and progression flow works correctly.

Do not create public employee performance rankings or leaderboards.

If gamification is added, it should reinforce personal development rather than employee-to-employee competition.


## Privacy and Access

Employee and HR concerns must remain conceptually separate.

Do not expose one employee's engagement/history to other employees as a social or gamification feature.

An HR navigation button is not authorization.

If real authentication/authorization is outside MVP scope, do not describe UI separation as secure role-based access.

Never commit or expose:

- API keys
- access tokens
- passwords
- credentials
- `.env` files


## Hackathon Priorities

When choosing what to implement or fix, prioritize:

1. Correct dataset loading
2. Correct employee profile and skill calculations
3. Correct target-grade and trajectory behavior
4. Strong multi-factor recommendations
5. Clear recommendation explanations
6. Activity completion → progress → updated recommendations
7. Judge-file import
8. Required HR overview
9. Reliable frontend/backend integration
10. Reproducible startup and README
11. UI polish
12. Optional gamification

Do not sacrifice required functionality for optional polish.


## Simplicity

This is a hackathon MVP.

Prefer the simplest architecture that is:

- correct
- understandable
- testable
- reliable during the demo
- compatible with judge imports

Avoid introducing unnecessary:

- microservices
- message queues
- distributed infrastructure
- databases
- frameworks
- state-management libraries
- abstraction layers
- dependencies

unless there is a concrete requirement or the existing repository already uses them.

Do not rewrite working architecture simply to match a preferred architecture pattern.


## Git

- `main` is the stable branch.
- Each team member works on their own branch.
- Do not make changes directly on `main`.
- Make small, focused commits.
- Do not mix unrelated refactors into feature commits.
- Do not commit secrets.
- Do not commit `.env`.
- Do not commit temporary/generated files unless the repository intentionally tracks them.

Avoid unnecessary rewrites of code currently owned or actively developed by another teammate.


## Development Workflow

Before implementing a substantial feature:

1. Read the relevant `AGENTS.md`.
2. Inspect relevant existing files.
3. Read the relevant section of `API_CONTRACT.md`.
4. Inspect starter-kit files/README when dataset fields matter.
5. Understand existing conventions.
6. Briefly explain the intended approach.
7. Identify assumptions or unresolved requirements.
8. Implement the smallest coherent change.
9. Add or update focused tests where appropriate.
10. Run relevant tests.
11. Run lint/build/type checks configured by the repository.
12. Fix regressions caused by the change.
13. Summarize what changed and remaining issues.


## Codex Rules

When working autonomously:

- Inspect before editing.
- Follow the closest applicable `AGENTS.md`.
- Do not silently change architecture.
- Do not silently change `API_CONTRACT.md`.
- Do not invent starter-kit fields.
- Do not hardcode judge outcomes.
- Do not hardcode business behavior for specific employee IDs.
- Do not hardcode business behavior for specific event IDs.
- Do not use an LLM where deterministic code is sufficient.
- Do not add dependencies without a concrete need.
- Do not perform broad cleanup while solving a focused task.
- Preserve frontend/backend compatibility.
- Prefer existing project conventions when reasonable.
- Keep changes small and reviewable.
- Explicitly call out ambiguity instead of hiding assumptions.
- Never claim tests passed unless they were actually run successfully.
- Never claim functionality works without verifying the relevant path.
- Do not remove working functionality merely because it is currently unused.
- Do not create speculative features that were not requested.

When asked only to plan, analyze, or discuss architecture, do not start implementing unless explicitly requested.


## Testing Philosophy

Prioritize tests around behavior likely to fail during judging.

Important end-to-end scenarios include:

- an existing employee can be selected
- an employee profile loads from real backend data
- recommendations come from backend results
- recommendation explanations/factors render correctly
- zero recommendations render correctly
- completing an activity updates the displayed profile
- completing an activity updates recommendations
- no manual refresh is required after completion
- imported judge employees become selectable
- imported employees use normal recommendation logic
- backend/API errors are handled sensibly
- HR overview uses real backend aggregates

Recommendation correctness belongs primarily in backend tests.

Frontend tests should verify presentation and interaction rather than reproduce recommendation algorithms.


## Performance

The hackathon specification allows approximately:

- up to 2 seconds for normal interface response
- up to 10 seconds for AI recommendation work

Avoid unnecessary network waterfalls.

Avoid repeated AI requests for the same information.

Prefer local deterministic calculations for core recommendation logic.

The application should feel responsive with the starter-kit dataset.


## Reproducibility

Judges and teammates should be able to understand and run the project from repository documentation.

Keep the root `README.md` current.

Document at least:

- prerequisites
- environment setup
- frontend startup
- backend startup
- required environment variables
- starter-kit data location
- test commands
- main demo flow
- LLM configuration
- LLM fallback behavior

Aim for one-command startup for the complete application where practical.

Do not document commands or functionality that have not been verified.


## Definition of Done

A feature is not done merely because it renders or returns HTTP 200.

For affected functionality, verify as applicable:

- it follows the hackathon requirements
- it follows `API_CONTRACT.md`
- frontend and backend agree on field meanings
- calculations come from real loaded data
- business logic is not unnecessarily duplicated
- recommendation reasoning remains traceable
- loading/error/empty states are handled
- judge imports remain functional
- relevant tests pass
- configured lint/build/type checks pass
- documentation is updated when setup or behavior changes


## Final Product Goal

The final demo should allow the jury to:

1. Open an employee.
2. Understand the employee's current state.
3. Understand the target career state.
4. See relevant skill gaps.
5. Receive sensible 0–3 development recommendations.
6. Understand why those recommendations were made.
7. Complete an activity.
8. Immediately see progress change.
9. See recommendations adapt to the new state.
10. Import a new test employee and observe the same workflow.
11. Open the HR view and inspect meaningful aggregate information.

Optimize implementation decisions around making this flow correct, explainable, reproducible, and reliable.
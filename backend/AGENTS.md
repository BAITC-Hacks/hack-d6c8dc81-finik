# Backend agent instructions

## Scope

The backend is the single source of truth for Career Quest business logic. It
loads and validates the active dataset, serves the API, and calculates employee
progress, skill gaps, eligibility, recommendations, completion effects, and HR
aggregates.

Read the root `AGENTS.md` and the relevant section of `../API_CONTRACT.md`
before changing backend behavior. The API contract is shared with the frontend:
do not change its endpoints, field names, response shapes, status semantics, or
calculation rules without following the root contract-change process.

## Implementation rules

- Keep the backend stack and dependencies minimal. Do not introduce a framework,
  database, or external service without a concrete need.
- Put business calculations in reusable domain/service functions rather than
  HTTP handlers. Route handlers should validate input, call the domain logic,
  and translate known failures into contract-defined HTTP responses.
- Use the dataset snapshot date (`2026-10-01`) for dataset-defined date
  calculations; never use the machine date for them.
- Treat a missing employee skill as level `0`; keep skill levels as integers in
  the range `0`–`5`.
- Build employee skill state from the last assessment plus qualifying completed
  activities after `last_review_date`, applying each activity gain only once.
- Determine eligibility and rank recommendations deterministically. An LLM may
  improve explanation wording only from computed facts and must have a local,
  deterministic fallback.
- Return at most three recommendations. Exclude mandatory events, events with
  unmet prerequisites, unavailable events, and completed non-recurring events.
- Keep recommendation factors traceable so the explanation cannot contradict
  the ranking or underlying calculation.

## Dataset and mutation safety

- Validate IDs, references, dates, skill levels, and required fields when data
  is loaded or imported. Do not invent fields absent from the dataset schema.
- Support data beyond the starter dataset: never branch on known employee or
  event IDs, fixed counts, or expected judge outcomes.
- Import validation must be atomic: validate the prospective dataset completely
  before replacing or appending any active data. On failure, leave active state
  unchanged and return the contract-defined error.
- Completing an activity must also be atomic. Validate the employee, event,
  eligibility, and repeat-completion rules before recording history or applying
  skill gains. Return `409` for a duplicate non-recurring completion without
  mutation.
- Recalculate returned profile and recommendations from the same updated state;
  do not rely on the frontend to reconcile progress.

## API and errors

- Implement the paths, request bodies, response bodies, ordering rules, and
  status codes in `../API_CONTRACT.md` exactly.
- Use `{ "error": { "code": "...", "message": "..." } }` for API errors.
  Messages should be clear enough for the frontend to show or diagnose.
- Enable local-development CORS for the frontend origin specified in the API
  contract. Do not weaken CORS or add authentication claims beyond the MVP
  requirements without discussion.

## Tests and verification

- Prioritize unit tests for skill reconstruction, target/grade calculations,
  gaps, eligibility, ranking, imports, and completion atomicity.
- Add endpoint-level tests for every contract endpoint and its important error
  cases, including zero recommendations and imported employees.
- Use realistic fixture data that covers critical requirements, prerequisites,
  completed events, recurring events, and participation history.
- Run the configured backend tests, lint, and type checks after meaningful
  changes. Do not claim a route or calculation works without exercising it.

## Before handing off a backend change

State which API-contract section changed or was verified, summarize the
calculation assumptions, and report the tests/checks actually run. Update the
root README when backend setup, environment variables, data location, or run
commands change.

# Usability next steps verification

Baseline: `25719520a323e7cb7566e340540b309ea08eaf9d` on main.

Implemented: bundled wildlife contacts and guidance, stranded-turtle Fisheries
number, Small-only warnings before submission, cumulative multi-category cleanup,
None-left confirmation, real beach band comparison, beach-filtered cleanup
Insights, ranked volunteer needs with reasons, consistent Severe labels,
event-scoped counts with loading/error states, organiser-entered meeting points,
and larger supporting text and navigation targets.

The prior main already copies only the recovery token, requires ID and token
for Restore, and warns before Sign Out. Existing API regression coverage checks
the restore payload and recovery-token lifecycle.

Public beach and Insights aggregates exclude the uniquely identified historical
seed reports r1-r4. Database records are preserved. Deployment diagnostics no
longer contain production database deletion code.

Validation: frontend 54 files / 301 tests pass; TypeScript check and Vite production
build pass. Backend current suite: 336 pass / 22 fail. The unchanged baseline,
run in an isolated directory, has exactly the same 22 failing tests (331 pass).
There are no new failing tests. Those historical tests expect superseded endpoint
paths, catalogue counts and response shapes. The five new backend tests pass.
GCP diagnostic shell syntax and readonly regression test pass.

390px responsive check: no horizontal overflow; visible wildlife-page buttons
meet 44px height, supporting text and bottom navigation use 12px minimum.

External acceptance remains open: Malaysian mobile-operator connectivity and
five real users on their own phones require real participants/networks. Existing
events without a verified meeting point remain explicitly unconfirmed. No
production database records were deleted, and no event meeting place is invented.

The supplied legacy Render frontend and the GCP same-origin deployment must be
verified separately after release. A SPA HTML response to /api/health is not API
health evidence.

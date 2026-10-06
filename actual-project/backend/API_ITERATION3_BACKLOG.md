# Historical API contracts excluded from the confirmed Iteration 3 AC

The contracts in this document came from the teammate source branch linked below. They are
retained as historical interface references and use the existing JSON error shape:
`{ "code": "...", "message": "..." }`.

## Delivery status and source

This document describes four interface groups from the teammate backend source branch
[`iteration3-backend`](https://github.com/huangguan-giegie/radar_sampah/tree/iteration3-backend)
at source commit `bc382988d0dd6e9221861a60b0d5d41a2f1911e5`.

The team removed all four groups below from the confirmed Iteration 3 acceptance criteria.
They are out of scope, not queued for implementation or frontend integration. Their
application behavior is not implemented on the current `main` or `iteration3` branches or in
production release `1fd13e06819973002ceebd30d861d4eb06c5238c`.

The deployed species feature continues to provide approved, prepared species Q&A through the
existing flows. That content is separate from the excluded marine-life quiz proposal below.
Likewise, the deployed public `/wildlife-risks` resource is a general approved risk library;
the beach-specific risk-card proposal below is excluded. The excluded weekly-reporting field
and first-cleanup badge are not Iteration 3 deliverables.

Related project documents:

- [`docs/iteration3-backend-release.md`](../../docs/iteration3-backend-release.md)
- [`docs/iteration3-test-report.md`](../../docs/iteration3-test-report.md)
- [`docs/iteration3-model-integration-test-report.md`](../../docs/iteration3-model-integration-test-report.md)
- [`docs/beach-coordinate-sources-52.md`](../../docs/beach-coordinate-sources-52.md)

## Marine-life quiz

`GET /species-cards/:cardId/quiz` is public. It returns three questions built from the approved
species card. When the request includes a valid bearer token, `completed` indicates whether the
participant has already completed this card's quiz.

`POST /species-cards/:cardId/quiz/answer` is public. Send exactly
`{ "questionId": "0", "optionId": "approved" }`. The response contains `correct`, the approved
answer explanation, and the card's sources. The option IDs are `approved`, `context`, and
`sighting`.

`POST /species-cards/:cardId/quiz/complete` requires a bearer token. Send each question once:

```json
{
  "answers": [
    { "questionId": "0", "optionId": "approved" },
    { "questionId": "1", "optionId": "context" },
    { "questionId": "2", "optionId": "approved" }
  ]
}
```

The endpoint records completion idempotently and returns `{ "cardId", "completed": true,
"recorded": true|false }`.

## Beach wildlife-risk cards

`GET /beaches/:beachId/wildlife-risks` is public. It returns up to three approved risk cards for
the beach's recent active Counted categories. `reportedShare` is the current reported category
share. The response includes an evidence note that this is beach-level context, not evidence of
local wildlife harm. Unknown beaches return 404.

## Weekly reporting activity

`GET /insights/participation` keeps the existing response and adds `weeklyReporting`:

```json
{
  "weeks": [
    {
      "weekStart": "2026-10-05",
      "countedReports": 4,
      "distinctReporters": "Fewer than 3"
    }
  ],
  "timezone": "Asia/Kuala_Lumpur",
  "smallCountLabel": "Fewer than 3"
}
```

There are always twelve Monday-starting weeks in the `Asia/Kuala_Lumpur` timezone. Counts below
three are withheld and displayed as `Fewer than 3`.

## First-cleanup badge

`GET /badges` requires a bearer token and returns the participant's earned badges. The first
non-empty cleanup earns:

```json
[
  {
    "id": "shoreline-scout",
    "name": "Shoreline Scout",
    "description": "Recorded your first cleanup.",
    "earnedAt": "2026-10-05T12:00:00+08:00"
  }
]
```

Before the first cleanup the response is an empty array. The endpoint derives the badge from
the participant's earliest recorded non-empty cleanup and returns it once. It is private and
uses `Cache-Control: private, no-store`.

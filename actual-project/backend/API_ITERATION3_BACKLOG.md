# Iteration 3 backlog API interfaces

These read/write contracts are ready for the frontend to integrate. They use the existing JSON
error shape: `{ "code": "...", "message": "..." }`.

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

There are always twelve Monday-starting weeks. Counts below three are withheld.

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

Before the first cleanup the response is an empty array. The endpoint is private and uses
`Cache-Control: private, no-store`.

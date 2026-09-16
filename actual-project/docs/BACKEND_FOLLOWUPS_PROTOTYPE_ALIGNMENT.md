# Backend follow-ups from the Iteration 2 prototype alignment

The frontend branch `align-with-figma-prototype` brings the app in line with the
Iteration 2 Figma prototype (file `Cx5DPF8q3l4huFbsr4edMK`, page "Web Build ·
Iteration 2 prototype"). Nothing under `backend/` was changed.

Some prototype screens could not be matched from the frontend alone, because the
API does not return the data they show, or because the prototype and the current
backend disagree on a rule. They are listed here. The frontend currently keeps the
existing behaviour for each of them.

Frame IDs refer to the Figma file above.

---

## 1. Security review of the restore flow (high priority)

`POST /auth/restore` needs a security review before the app is used with real
participants. The details have been shared with the backend owner directly
instead of being written here, because this repository is public.

**What the prototype expects.** Frames `549:10` and `876:2` restore a profile with
the recovery token, and the copy says "Your participant ID is public. Restore
access with your private recovery token."

- [ ] Review the restore flow (details shared privately).
- [ ] Decide whether restore should work from the recovery token alone, as the prototype shows.
- [ ] Decide what happens to existing accounts whose owners never saved a token.

Once this is decided, the frontend can add the prototype's restore copy and the
Account line "Keep your recovery token to restore this profile." Both are held
back for now.

---

## 2. Data the prototype shows that the API does not return

| # | Screen (frame) | Needed from the backend | Where it is missing today |
|---|---|---|---|
| 2.1 | Beach page, "REPORTED LITTER · QUANTITY BANDS" (`549:16`, `589:7`, `664:7`) | Quantity band per category (Small / Medium / Large / Very Large) for the beach, instead of or alongside percentages | `BeachDetail.composition` only has `percentage`; a band cannot be derived from it |
| 2.2 | Beach after cleanup, "TOP 4 OLDER BANDS" (`589:12`, AC4.3.4) | Archived per-category bands for a beach that currently has no band | No field carries them |
| 2.3 | Litter gallery cards (`950:62`) | Per photo: categories, size bands, participant ID, report status (Counted), and a "metadata removed" flag | Gallery entries only have `reportId`, `reportedAt`, `photoUrl` |
| 2.4 | AI suggestion result (`664:4`, AC2.3.2) | A confidence value and detection boxes (label, score, box) | The suggestion response has neither |
| 2.5 | "Updated observation saved" sheet (`664:6`, AC3.1.4) | A flag on the saved report saying a nearby report with a different category or band was found and the location reference was updated | The create-report response has no such field |
| 2.6 | Cleanup point card, "R-2041 · 4 m from where you are" (`589:9`, `664:8`) | Distance from the volunteer to the cleanup target, or the target's coordinates so it can be computed on device | `CleanupTarget` has no location |
| 2.7 | Event details (`589:14`) and event result (`589:11`) | Meeting point text, and a start/end time | The event payload has neither field |

---

## 3. Rules where the prototype and the backend disagree

These need a team decision before either side changes.

- [ ] **Duplicate report: block or keep?** Frame `589:4` blocks a matching report
      ("This report was not saved") and links to the existing one. The backend saves
      the match as `Duplicate` and returns `201`. The frontend shows a warning and lets
      the volunteer submit anyway, matching the backend.
- [ ] **Duplicate note wording.** The backend writes the exclusion note on duplicate
      reports (`backend/app_core.py`, around lines 116–118). The prototype's note reads
      "Matching category and band within 10 m." Please make the stored note describe
      the rule the backend actually applies.
- [ ] **Attendance step order.** The prototype lists "Confirmed you were there" before
      "Report or cleanup for this event and beach" (`589:15`, `664:9`, `664:12`).
      The backend refuses to confirm attendance until a linked report or cleanup exists
      (`EVENT_EVIDENCE_REQUIRED`, `backend/v3_contract.py` around line 311). The frontend
      uses the prototype wording but keeps the backend's order.

---

## 4. Checked and already fine

- `GET /cleanup-targets/<beach_id>` exists and returns `remainingBands` for Counted reports.
- `GET /cleanups/<id>` returns `beforeBand` / `afterBand` for band-based cleanups, so the
  cleanup result table shows removed bands correctly. Old count-only cleanups show "—".
- The all-Small report rule returns `422 SMALL_ONLY_REPORT`, which the frontend now handles
  as its own outcome rather than a generic save error.

---

## Backend status

Reviewed and implemented on 16 September 2026. The frontend can build against everything
listed here today; nothing else under `backend/` changed.

### 1. Restore flow

The hole is closed. `POST /auth/restore` used to issue a session when the token was simply
absent, so anyone who knew a public participant ID could take over that account. Restoring
now requires the recovery token in every case.

- A missing token returns `401 RECOVERY_TOKEN_REQUIRED`; the screen can ask for the token
  instead of reporting a wrong one.
- A wrong token still returns `401 INVALID_RECOVERY_TOKEN`.
- Tokens issued before the digest was stored still work, because they are derived from the
  server signing secret and cannot be re-derived from the public participant ID.
- Accounts whose owner never saved a token cannot be restored. That is the point: the
  alternative is an ID-only path that grants sessions to anybody.
- `tests/test_auth_restore_security.py` fails if the ID-only path comes back.

The prototype copy about the token is now accurate, so the frontend can add it.

### 2. Data the screens need

| # | Status | What the API returns now |
|---|---|---|
| 2.1 | Done | Each `composition` row carries `band`, the highest current band for that category across the active set: `{ "category": "Plastic", "percentage": 25, "band": "Large" }` |
| 2.2 | Done | `GET /beaches/{id}` always returns `recentReportBands`: the bands recorded by up to four newest `Counted` reports, newest first, with `reportId`, `reportedAt` and `bands`. These are the bands as submitted, so a beach that has no public band *because* everything was cleaned still shows what was found |
| 2.3 | Done, except the participant id | Gallery entries now carry `categories`, `bands`, `status` and `metadataStripped`. `participantId` is deliberately not sent on this public route; see the note below |
| 2.4 | Already available | `/recognitions` has returned `detections` all along: each item has `box` (`[left, top, right, bottom]`), `modelClass`, `category` and `confidence`. No backend change was needed |
| 2.5 | Done | The create-report response carries `nearbyReportFound: true` and `locationReferenceUpdated: true` when a nearby report with a different category or band was found and the location reference moved. The other report is never identified |
| 2.6 | Declined, with an alternative | See below |
| 2.7 | Done | Every event payload carries `meetingPoint` (null until a moderator sets one) plus the existing local `startsAt` and `endsAt`. `POST /events` accepts an optional `meetingPoint` of up to 160 characters |

On 2.3, a participant id on the public gallery would let anyone link one person's photos,
dates and beaches into a movement trail, and the reviewed backend contract already forbids
it. If the team wants attribution on the cards, the honest path is to show it only to a
signed-in owner or moderator, which is a separate decision.

On 2.6, the backend cannot compute the distance to a cleanup target: the coordinates are
discarded on upload and only a target-scoped HMAC of an approximately one-metre grid cell
remains, so there is nothing to measure against. Exposing a distance would also become a
location oracle, because anyone could probe positions until the distance changed and
recover roughly where the litter is. The beach itself is public (`GET /beaches/{id}` has
`lat`/`lng`), so the cleanup card can say how far the volunteer is from the beach, or name
it, without weakening the report-location rule.

### 3. Rules

- **Duplicate: block or keep** - kept, as the backend already did. A match is stored with
  `201` and status `Duplicate` and excluded from Beach Attention, so history and audit stay
  intact while the score stays correct. The prototype's "not saved" screen should follow.
- **Duplicate note wording** - rewritten to describe the rule the API applies: "Matching
  report within 10 metres: an active report already records the same current categories and
  quantity bands. This report is saved here but left out of the beach rating." The word
  "current" matters, because the comparison uses the bands after any cleanup.
- **Attendance order** - the backend keeps requiring evidence before attendance can be
  confirmed, and the frontend already lists the steps in that order. No change on either
  side; the prototype's ordering should follow.

### 4. Terminology

The contract value stays `Severe`. The app displays **Very high**, decided by the team
because "Severe" reads like an official hazard warning that volunteer counts cannot
support. The scoring document should record that mapping in one sentence so the two words
are never mistaken for two bands.

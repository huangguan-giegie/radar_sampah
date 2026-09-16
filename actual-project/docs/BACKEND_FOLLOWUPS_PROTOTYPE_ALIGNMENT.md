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

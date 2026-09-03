# Radar Sampah Defect Log

Compiled from the GitHub commit and pull-request history on `main`. Each row
links to the PR/commit that fixed the defect, so a reviewer can open it and
read the actual diff, discussion and test evidence rather than trusting this
summary alone.

| ID | Defect | Priority | Owner | Fix | Retest result |
|---|---|---|---|---|---|
| D1 | Beach page/map issues from Darli's usability review: attention-score number shown with no acceptance criterion asking for it; map legend clipped on common phone widths (17px cut at 390px, 52px at 320px); glass map card let map tiles smear through; severity row clipped "6 counted reports" to "6 counted repor"; green tick on Home read as "passed" beside a red HIGH badge; biodiversity small print failed the 4.5:1 AA contrast floor (measured 2.16:1) | High (AC4.2.3 marked Blocker) | qjia0033-dev | [`97ff9b9`](https://github.com/huangguan-giegie/radar_sampah/commit/97ff9b9) | Typecheck clean, 43 tests passing, verified on the running app at six widths |
| D2 | Submitting an ordinary ~1.9 MB phone photo crashed with the browser's raw `Failed to execute 'setItem' on 'Storage'` error; the mock upload path stored the original file (~2.6 MB as base64) instead of the same re-encoded size the real path uses, overflowing the ~5 MB localStorage quota; a quota failure could also leave a report referencing a broken image after reload | High | qjia0033-dev | [`e1f6706`](https://github.com/huangguan-giegie/radar_sampah/commit/e1f6706) | Verified: three consecutive 1.9 MB photos all submit, previews survive reload |
| D3 | PR #20 (D1's fix) was reverted in full with no reason recorded, silently re-introducing D1 and D2 on `main` after PR #23 landed on top of the revert | High (process defect — regression re-entered `main` unreviewed) | Revert: huangguan-giegie · Restore: qjia0033-dev | Revert [`98fc0f5`](https://github.com/huangguan-giegie/radar_sampah/commit/98fc0f5) (PR #22) → Restore [`42c69f6`](https://github.com/huangguan-giegie/radar_sampah/commit/42c69f6) (PR #24) | Restore commit measured both builds first (attention score visible again, 21px overflow on the beach page, 1.9 MB photo submit failing with the raw storage error), then re-applied the exact 208 lines the revert had removed; typecheck clean, 44 tests, build clean |
| D4 | Three out of five malformed `localStorage` values (a plain string, an array, a truncated write from a tab closed mid-save) rendered a completely blank page — zero content, no error, no way back except manually clearing site data | High | qjia0033-dev | [`80e20b5`](https://github.com/huangguan-giegie/radar_sampah/commit/80e20b5) | Verified: all five junk values now render Home; added an `ErrorBoundary` above the router with a "Start again" recovery action |
| D5 | A report excluded for an unreadable photo (`Incomplete`) skipped the photo-correction step entirely and could be resubmitted as `Counted` while still missing a photo, contradicting both the status guide ("correctable") and the method page ("never counted at all"); separately, the photo-type hint listed HEIC as accepted, the error message told users to use HEIC, but HEIC uploads were then refused | Medium | qjia0033-dev | [`d2ceed6`](https://github.com/huangguan-giegie/radar_sampah/commit/d2ceed6) | 44 tests passing; verified the Incomplete card now lands on the photo step, and a HEIC upload is refused with a clear reason instead of a silent contradiction |

## How to verify a row yourself

Each commit hash links to `https://github.com/huangguan-giegie/radar_sampah/commit/<hash>`.
Open the link, then "Browse files" at that commit (or the parent PR, where noted)
to see the full diff and any review comments.

## Scope note

This log only covers defects with a traceable commit message describing the
defect, the fix and a retest result. It does not include every commit on
`main` — routine feature work and documentation-only commits are excluded.
If the team is also tracking defects in LeanKit or GitHub Issues, add those
references here rather than duplicating this table.

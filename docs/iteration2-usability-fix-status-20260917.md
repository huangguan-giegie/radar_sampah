# Iteration 2 usability findings - fix status

17 September 2026

## Scope

The Iteration 2 peer usability round raised eleven findings (F1-F11) against the
live site. This record says which suggestions we accepted, which we did not, and
why. It follows the deployed build rather than a plan: every claim below was
checked in a browser against production, not only in code.

- Baseline reviewed: `663cb81`.
- This update: `49af6ea`, merged to `main` and deployed. The status record
  itself is `708c9eb` and later.
- Accepted from the report and shipped: F2 (a way out of the beach sheet), F3,
  F5, F7, F11 (drag and drop).
- Not accepted: F1, and the F2 bottom-navigation, F4 keep/edit logging, F8
  duplicate-rule and F11 wide-screen text-size suggestions. The reasons are in
  "Not accepted" below, so this is a decision record and not a to-do list.

## Fixed in this update

- **F2 - a way out of the beach sheet.** Tapping the map behind the
  "Choose your beach" panel now leaves the screen, the same as the back button.
  The map on that screen is not interactive (`MiniMap`), so the layer that
  catches the tap costs nothing. Every report and cleanup screen already had a
  back control before this change.
- **F3 - quantity bands.** The four bands now carry the everyday wording from
  `QUANTITY_DESC` - "Fits in one hand", "About a grocery bag", "Several bags",
  "Large scattered pile" - on the report details screen and above the
  after-cleanup bands. The constant already existed but had no callers, which is
  why the wording was in Iteration 1 and missing in Iteration 2.
- **F5 - what the severity band means.** The map legend is titled
  "LITTER SEVERITY" and adds one line: "How much litter was counted here - not
  how busy the beach is." Testers had read the bands as how crowded a beach is.
  The colour key, the "counted reports only" note and the link to the full
  method page stay as they were.
- **F7 - getting the recovery token again.** The token is now kept in this
  browser when a number is claimed or restored, and the Account screen offers
  "Save your recovery details" to download the participant ID and token a second
  time. The server stores only a digest of the token, so a browser copy is the
  only way to offer this without a new endpoint.
- **F11 - desktop drag and drop.** A photo can be dragged onto the photo step of
  the report flow. The dropped file passes through the same `handleFile` gate as
  the picker, so the size, type and HEIC answers are identical.

## Already in place before this update

These were reproduced as working on the deployed build and were left alone.

- **F4 - AI suggestion.** The photo step says a check follows and that the
  suggestion can be changed; the AI check is step 4, before manual category
  entry; correcting a report keeps the previous values and does not rerun
  recognition; "Confirm suggestions" is the full-width primary action.
- **F6 - refreshed drafts keep the photo.** Landed in `2964533`.
- **F8 - the duplicate rule is explained.** The review screen and the reports
  list both state that duplicate or incomplete reports are excluded from the
  severity calculation, and the method page defines those words.
- **F9 - biodiversity context.** Real photographs with relative scores, Latin
  names and an OBIS source note replaced the earlier icons.
- **F10 - background data.** The source links open in a new tab, and the chart
  year and publisher are labelled.

## Not accepted

These are the suggestions from the report that we are not taking forward. Each
line states what was suggested, what the code does today, and why we are
leaving it. Recording them as decisions rather than as an unfinished list is
deliberate: a later round can re-open one on purpose instead of finding it in a
backlog of half-promises.

- **F1 - server errors and endless loading.** Not accepted as a code change.
  The suggestion was a "waking up the server" state, self-retrying writes and
  more empty states. The cause is the free Render instance sleeping between
  visits, so those additions would dress the symptom rather than remove it, and
  a retry on a write risks a duplicate submission. What the app does today is
  fail honestly: reads time out at 15 seconds (60 seconds for the public beach
  list), reads retry, and the session bar says the refresh failed instead of
  spinning. The remedy we are relying on is operational - keep the API warm for
  test and event days, or move off the free tier before the next round.
- **F2 - bottom navigation inside the report and cleanup flows.** Not accepted.
  The suggestion was to keep the tab bar visible during those flows. The report
  and cleanup screens override their bottom padding to 34px precisely because
  they do not show the tab bar (`TAB_ROUTES` in `App.tsx`); showing it there
  without a layout pass across six screens would cover the Continue action. The
  part of F2 that mattered - being able to leave - is shipped: every flow screen
  has a back control, the browser back button follows the step URLs, and the
  beach sheet now closes on an outside tap.
- **F4 - logging how often a suggestion is kept or edited.** Not accepted. The
  suggestion was to measure AI accuracy from that rate. It needs a new backend
  field, a decision about what is stored against an anonymous participant, and
  a baseline to compare against; without all three the number would be reported
  without meaning. The review step that produces the signal is already in the
  flow, so the measurement can be added when someone owns the analysis.
- **F8 - deciding what counts as a duplicate.** Not accepted as a code change.
  The suggestion was to settle the rule. The wording now appears on the review
  screen, in the reports list and on the method page, so the app explains
  itself; whether the same photo or place from different participants should
  count once is a product and scoring decision, and making it in the frontend
  would have changed severity numbers without the team agreeing to it.
- **F11 - raising the text size on a laptop.** Not accepted. Every size in the
  app is an inline pixel value, so there is no single token to raise, and the
  one-line alternative - a CSS `zoom` on the shell - scales the Leaflet
  containers with it and can shift marker placement and click coordinates on
  the map the rest of the app depends on. A proper type-scale pass is a design
  change of its own and is not worth taking on in this iteration.

## Verification

- Frontend: TypeScript build clean; 120 tests across 14 files pass, including a
  new test that claims a number, reads the stored recovery token back, and
  checks that signing out clears it; Vite production build passes.
- Production browser checks on the deployed build: the beach sheet closes on an
  outside tap; both quantity-band groups show the wording, and the cleanup
  screen shows the same line; the map legend reads "LITTER SEVERITY" with its
  explanation; a refreshed draft keeps the beach, categories, bands and photo;
  claiming a number produces the recovery file, the Account row appears, and
  that row downloads the same file with the same token; the review screen still
  carries the duplicate note; the beach page still renders the biodiversity
  photographs.
- Limit: the drag-and-drop drop itself could not be simulated in the controlled
  browser (the CDP drag command is refused and the scripted page scope has no
  `DragEvent` or `DataTransfer` constructor). Only the shared `handleFile` path
  was exercised, through the file picker. The drop itself needs one manual
  check on a desktop browser.
- No report was submitted and no cleanup was completed during production
  checks. One sample photo was uploaded into an unsubmitted draft, and one
  anonymous test participant was created.

## Known trade-off

The recovery token is now written to browser storage, cleared on sign out. It is
a long-lived credential, but the browser already holds a session token for the
same account, so the additional exposure is small and it is the only way to keep
the promised "you can get your details again" without a new endpoint. If that is
not acceptable, the alternative is a short-lived re-issue endpoint that returns
the token once, authenticated by the current session.

## Rollback

The previous deployed version is `663cb81`. This update is `49af6ea` and touches
the frontend only; no schema, data or API change is involved.

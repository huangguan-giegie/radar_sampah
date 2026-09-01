// The rules of the report flow, pulled out of the screens so they can be
// tested on their own (see flowRules.test.ts).
//
// Nothing in this file touches React or the browser. Give it a draft, it gives
// back a decision. That is what makes it testable, and it is also why the same
// rules cannot drift apart between the five report screens.
import type { ReportDraft } from './AppContext';
import type { CreateReportInput, LitterCategory, ReportStatus } from './types';


/**
 * Clean a "?next=..." value before we redirect to it.
 *
 * After login we send the user back where they were trying to go, and that
 * target comes from the URL - which anyone can type or put in a link. If we
 * followed it blindly, a link like ?next=https://evil.example could bounce our
 * user to another site straight after they log in (an open redirect).
 *
 * So we only accept a path inside our own app: it must start with a single
 * "/", and "//host" and backslashes are rejected because browsers read those
 * as another site. Anything else falls back to /home.
 */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/home';
  }
  return value;
}


/*
 * The guard for the report flow.
 *
 * WHY WE NEED THIS AT ALL - this is a web app, so /report/review is a real
 * URL. Once a user is logged in they can type it in the address bar, or open
 * an old bookmark. RequireAuth only checks that they are logged in, not how
 * far through the flow they are. Without this guard they would land on a page
 * saying "Not selected", with a submit button that does nothing and no way
 * back. A phone app has no address bar, so this problem does not exist there;
 * it appears the moment we run in a browser.
 *
 * HOW IT DECIDES - the rule is worked out from the draft itself. We do not
 * keep a list of "pages you have visited". That matters because the draft
 * survives a refresh: after a reload there is no visit history, but the draft
 * is still there, so the user can carry on from where they were. Storing
 * visited-page flags would fight the saved draft instead of working with it.
 */
export type ReportStep = 'photo' | 'location' | 'confirm' | 'details' | 'review';

const STEP_ORDER: ReportStep[] = ['photo', 'location', 'confirm', 'details', 'review'];

const STEP_PATH: Record<ReportStep, string> = {
  photo: '/report/photo',
  location: '/report/location',
  confirm: '/report/confirm',
  details: '/report/details',
  review: '/report/review',
};

/**
 * Is there anything in this draft worth keeping?
 *
 * The home and beach screens ask before they throw a draft away. Without this
 * check, a report abandoned days ago would quietly come back with its old
 * photo and old beach already filled in, and that stale beach could be
 * submitted without the user noticing.
 */
export function hasDraftProgress(draft: ReportDraft): boolean {
  return Boolean(
    draft.photo ||
    draft.existingPhotoUrl ||
    draft.existingPhotoKey ||
    draft.beachId ||
    draft.editingReportId ||
    Object.keys(draft.quantities).length > 0,
  );
}


/** The furthest step this draft has earned the right to be on. */
export function reachableStep(draft: ReportDraft): ReportStep {

  // When correcting an existing report the user may keep the old photo, so any
  // of these four counts as "has a photo": a new upload, a preview URL for the
  // old photo, the storage key for it, or simply being in edit mode. This
  // matches the update branch in buildReportSubmission - if the two disagreed,
  // the guard would block a submission the builder is happy to make.
  const hasPhoto = !!draft.photo || !!draft.existingPhotoUrl || !!draft.existingPhotoKey || !!draft.editingReportId;
  if (!hasPhoto) return 'photo';


  // Note this returns 'confirm', the beach-confirmation step, not 'location'.
  // The confirm screen has a "choose a different beach" button that clears
  // beachId. If we demanded a beach to stand on this step, that button would
  // instantly kick the user off the very page where they pick one.
  if (!draft.beachId) return 'confirm';
  // Half-filled counts as not filled: a category that was ticked but has no
  // amount yet would be sent to the backend as an incomplete report.
  const picked = Object.keys(draft.quantities) as LitterCategory[];
  if (picked.length === 0 || picked.some((c) => !draft.quantities[c])) return 'details';
  return 'review';
}


/**
 * Should we block this page? null means "let them through"; a string is the
 * URL to send them to instead.
 *
 * It only ever pushes users BACK, never forward. The "correct my report" path
 * starts at step 1 with an already complete draft, so a forward push would
 * throw the user straight to the review page and they could never reach the
 * photo step to change the photo - which is the whole reason they came.
 */
export function guardStep(target: ReportStep, draft: ReportDraft): string | null {
  const furthest = reachableStep(draft);
  return STEP_ORDER.indexOf(target) <= STEP_ORDER.indexOf(furthest) ? null : STEP_PATH[furthest];
}

export function resumePath(draft: ReportDraft): string {
  return STEP_PATH[reachableStep(draft)];
}

/**
 * Creating a new report and correcting an old one send different things:
 * a create must carry a photo key, an update sends only what changed.
 *
 * This is a discriminated union, so TypeScript will not let a caller read
 * .reportId without first checking kind === 'update'. The compiler enforces
 * the difference instead of us remembering to.
 */
export type ReportSubmission =
  | { kind: 'create'; payload: CreateReportInput }
  | { kind: 'update'; reportId: string; changes: Partial<CreateReportInput> };

/**
 * Turn the draft the user built up across five screens into the exact object
 * the API expects - or throw with a message the user can act on.
 *
 * Every check here is a LAST line of defence. The screens already stop these
 * cases with disabled buttons, and the backend checks them again. We still
 * check, because a restored draft or a typed URL can reach this function
 * without ever passing the buttons.
 */
export function buildReportSubmission(draft: ReportDraft): ReportSubmission {
  const picked = Object.keys(draft.quantities) as LitterCategory[];
  if (!draft.beachId || picked.length === 0) {
    throw new Error('This report is missing a required field. Go back and complete it.');
  }

  // A category with no amount is a half-filled row. Name the offending
  // categories in the error, so the user knows which row to go and fix.
  const noBand = picked.filter((c) => !draft.quantities[c]);
  if (noBand.length > 0) {
    throw new Error(`Pick how much for: ${noBand.join(', ')}.`);
  }

  // Only claim 'gps' when we really do have coordinates. Saying 'gps' with no
  // coords would tell the backend the beach was measured when it was guessed,
  // and the duplicate check relies on that flag being honest.
  //
  // One case is different, and that is why locationSource is spread in rather
  // than always set: a correction is pre-filled from a saved report with coords
  // reset to null. If that report was originally located by GPS, sending
  // 'manual' would downgrade a fact the user never touched, so we leave the
  // field out of the update completely and the stored value stands.
  const usesGps = draft.locationSource === 'gps' && draft.coords !== null;
  const common = {
    beachId: draft.beachId,
    quantities: draft.quantities,
    ...(draft.editingReportId && draft.locationSource === 'gps' && draft.coords === null
      ? {}
      : { locationSource: usesGps ? ('gps' as const) : ('manual' as const) }),
    ...(usesGps ? { coords: draft.coords! } : {}),
  };

  // Correcting an existing report: the photo is optional, because keeping the
  // original one is normal. But IF they attached a new photo, it still has to
  // be stripped of location metadata - the rule does not get weaker on edit.
  if (draft.editingReportId) {
    if (draft.photo && !draft.photo.metadataStripped) {
      throw new Error('The replacement photo still contains location metadata.');
    }
    return {
      kind: 'update',
      reportId: draft.editingReportId,
      changes: {
        ...common,
        ...(draft.photo ? { photoKey: draft.photo.photoKey } : {}),
      },
    };
  }

  // A new report must have a photo: the photo IS the evidence.
  if (!draft.photo) {
    throw new Error('This report needs a photo. Go back and add one.');
  }
  // Refuse to submit a photo that still carries its EXIF location. Publishing
  // that would leak where the volunteer was standing, which we promised in the
  // privacy note we would not do.
  if (!draft.photo.metadataStripped) {
    throw new Error('The photo still contains location metadata.');
  }

  // locationSource and coords are set again here even though `common` usually
  // carries them. Because the spread above can leave locationSource out, its
  // type is optional, and a create must always say how the beach was located.
  return {
    kind: 'create',
    payload: {
      ...common,
      photoKey: draft.photo.photoKey,
      locationSource: usesGps ? 'gps' : 'manual',
      ...(usesGps ? { coords: draft.coords! } : {}),
    },
  };
}

/** What the "submitted" screen shows for each of the three statuses. */
export type ReportOutcome = {
  title: string;
  badge: string;
  message: string;
  tone: 'success' | 'neutral' | 'warning';
};

/**
 * The wording for the result screen.
 *
 * It lives here, next to the rules, so that all three outcomes are written in
 * one place and get the same care. Duplicate and Incomplete are deliberately
 * NOT failures: the report is still saved in the volunteer's own reports, and
 * the text says so. Telling someone their work was thrown away is how you
 * lose a volunteer.
 */
export function reportOutcome(status: ReportStatus): ReportOutcome {
  if (status === 'Counted') {
    return {
      title: "Nice one — it's on the map",
      badge: 'COUNTED · NOT A DUPLICATE',
      message:
        "Thanks for this. Your report passed the checks, so it now counts toward this beach's rating — that's one more piece of evidence for the coast.",
      tone: 'success',
    };
  }
  if (status === 'Duplicate') {
    return {
      title: 'Saved — but not counted',
      badge: 'DUPLICATE · EXCLUDED',
      message:
        'This is a same-participant, same-beach, same-local-day submission. It is saved in your reports but excluded from the beach rating.',
      tone: 'neutral',
    };
  }
  return {
    title: 'Saved — correction needed',
    badge: 'INCOMPLETE · EXCLUDED',
    message:
      'This report is saved in your reports but is excluded from the beach rating until the missing or unusable information is corrected.',
    tone: 'warning',
  };
}


/*
 * Going back from the review page: pop the history, or replace the URL?
 *
 * WHY IT IS A SEPARATE FUNCTION - so it can be tested. This decision used to
 * sit inside ReviewScreen. An edit once replaced its fallback branch with a
 * call to itself, so when idx was 0 it called itself forever, the stack
 * overflowed, and every "Change" link and the back arrow stopped working. A
 * branch buried inside a component had no test that could catch it. Out here
 * it has four.
 *
 * WHAT idx IS - react-router stores a position in history.state. 0 means the
 * review page is the FIRST entry in this tab's history, so nav(-1) would leave
 * our app entirely. That is not a rare case: the draft now survives a refresh,
 * so typing /report/review or opening a bookmark lands exactly here.
 */
export type BackFromReview = { pop: true } | { pop: false; to: string };

export function backFromReview(historyIdx: number | null | undefined): BackFromReview {
  return (historyIdx ?? 0) > 0 ? { pop: true } : { pop: false, to: '/report/details' };
}

/**
 * The navigate function, narrowed to exactly the one call we allow.
 *
 * Typing it this tightly is deliberate: it documents at the type level that
 * this helper does one thing, and it stops a future edit from quietly reusing
 * it to jump somewhere else with different options.
 */
type SavedRouteNavigate = (
  to: '/report/saved',
  options: { replace: true; flushSync: true },
) => void;

/**
 * Move to the confirmation screen the moment a report is saved.
 *
 * WHY THIS IS NOT JUST nav('/report/saved'). Submitting clears the draft, and
 * the review route is guarded by a rule that reads the draft. With React's
 * normal batching, the draft could be cleared before the navigation had
 * actually committed - so for one render the guard would look at an empty
 * draft, decide the user does not belong on the review page, and bounce them
 * back to step 1 instead of showing the confirmation they just earned.
 *
 * flushSync commits the navigation immediately, while the draft is still
 * there. The confirmation screen then clears it after it has mounted, so the
 * guard never sees the in-between state.
 */
export function finishReportSubmission(
  navigate: SavedRouteNavigate,
) {
  navigate('/report/saved', { replace: true, flushSync: true });
}

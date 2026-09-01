import type { ReportDraft } from './AppContext';
import type { CreateReportInput, LitterCategory, ReportStatus } from './types';

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/home';
  }
  return value;
}


export type ReportStep = 'photo' | 'location' | 'confirm' | 'details' | 'review';

const STEP_ORDER: ReportStep[] = ['photo', 'location', 'confirm', 'details', 'review'];

const STEP_PATH: Record<ReportStep, string> = {
  photo: '/report/photo',
  location: '/report/location',
  confirm: '/report/confirm',
  details: '/report/details',
  review: '/report/review',
};

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


export function reachableStep(draft: ReportDraft): ReportStep {

  const hasPhoto = !!draft.photo || !!draft.existingPhotoUrl || !!draft.existingPhotoKey || !!draft.editingReportId;
  if (!hasPhoto) return 'photo';


  if (!draft.beachId) return 'confirm';
  const picked = Object.keys(draft.quantities) as LitterCategory[];
  if (picked.length === 0 || picked.some((c) => !draft.quantities[c])) return 'details';
  return 'review';
}


export function guardStep(target: ReportStep, draft: ReportDraft): string | null {
  const furthest = reachableStep(draft);
  return STEP_ORDER.indexOf(target) <= STEP_ORDER.indexOf(furthest) ? null : STEP_PATH[furthest];
}

export function resumePath(draft: ReportDraft): string {
  return STEP_PATH[reachableStep(draft)];
}

export type ReportSubmission =
  | { kind: 'create'; payload: CreateReportInput }
  | { kind: 'update'; reportId: string; changes: Partial<CreateReportInput> };

export function buildReportSubmission(draft: ReportDraft): ReportSubmission {
  const picked = Object.keys(draft.quantities) as LitterCategory[];
  if (!draft.beachId || picked.length === 0) {
    throw new Error('This report is missing a required field. Go back and complete it.');
  }

  const noBand = picked.filter((c) => !draft.quantities[c]);
  if (noBand.length > 0) {
    throw new Error(`Pick how much for: ${noBand.join(', ')}.`);
  }

  const usesGps = draft.locationSource === 'gps' && draft.coords !== null;
  const common = {
    beachId: draft.beachId,
    quantities: draft.quantities,
    ...(draft.editingReportId && draft.locationSource === 'gps' && draft.coords === null
      ? {}
      : { locationSource: usesGps ? ('gps' as const) : ('manual' as const) }),
    ...(usesGps ? { coords: draft.coords! } : {}),
  };

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

  if (!draft.photo) {
    throw new Error('This report needs a photo. Go back and add one.');
  }
  if (!draft.photo.metadataStripped) {
    throw new Error('The photo still contains location metadata.');
  }

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

export type ReportOutcome = {
  title: string;
  badge: string;
  message: string;
  tone: 'success' | 'neutral' | 'warning';
};

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


export type BackFromReview = { pop: true } | { pop: false; to: string };

/** The marker RecordScreen attaches when it sends the user to the review page. */
export const CAME_FROM_DETAILS = 'details';

/**
 * Going back from the review page: pop the history, or replace the URL?
 *
 * IT ASKS THE RIGHT QUESTION NOW. This used to test the history index: "is
 * there anything behind me?" That is not the same question as "is the details
 * screen behind me?", and the difference is a real bug. resumePath() can send
 * a restored draft straight to /report/review from the home or beach screen,
 * which pushes an entry - so the index is above zero, but the previous page is
 * /home. Popping there threw the user out of the report flow altogether. That
 * path matters: while the confirmation screen's buttons were broken it was the
 * only way back into an unfinished report.
 *
 * So we no longer guess from the index. RecordScreen stamps the navigation
 * with { from: 'details' }, and only that stamp earns a pop. Anything else -
 * a resume, a bookmark, a typed URL, a refresh - gets an explicit path.
 *
 * (The earlier version of this function called itself in the fallback branch
 * and overflowed the stack at index 0, which is why it lives out here with
 * tests rather than inside the component.)
 */
export function backFromReview(state: { from?: string } | null | undefined): BackFromReview {
  return state?.from === CAME_FROM_DETAILS ? { pop: true } : { pop: false, to: '/report/details' };
}

type SavedRouteNavigate = (
  to: '/report/saved',
  options: { replace: true; flushSync: true },
) => void;

/**
 * Commit the saved-route navigation while the review draft is still present.
 * The confirmation screen clears the draft after it has mounted, so the
 * review route guard cannot redirect during this transition.
 */
export function finishReportSubmission(
  navigate: SavedRouteNavigate,
) {
  navigate('/report/saved', { replace: true, flushSync: true });
}

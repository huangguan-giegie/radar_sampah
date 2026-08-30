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


export function reachableStep(draft: ReportDraft): ReportStep {

  const hasPhoto = !!draft.photo || !!draft.existingPhotoUrl || !!draft.editingReportId;
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
    locationSource: usesGps ? ('gps' as const) : ('manual' as const),
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
    payload: { ...common, photoKey: draft.photo.photoKey },
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
      badge: 'VALID · NOT A DUPLICATE · COUNTED',
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
        'This report matches an existing record for the same beach and day, so it is saved in your records but excluded from the beach rating.',
      tone: 'neutral',
    };
  }
  return {
    title: 'Saved — correction needed',
    badge: 'INCOMPLETE · EXCLUDED',
    message:
      'This report is saved in your records but is excluded from the beach rating until the missing or unusable information is corrected.',
    tone: 'warning',
  };
}


export type BackFromReview = { pop: true } | { pop: false; to: string };

export function backFromReview(historyIdx: number | null | undefined): BackFromReview {
  return (historyIdx ?? 0) > 0 ? { pop: true } : { pop: false, to: '/report/details' };
}

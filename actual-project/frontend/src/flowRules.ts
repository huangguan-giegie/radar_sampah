import type { ReportDraft } from './AppContext';
import type { CreateReportInput, LitterCategory, ReportStatus } from './types';

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/home';
  }
  return value;
}

/*
 * 上报流程的守卫。
 *
 * /report/review 这些是真网址：登录了就能直接输进地址栏、或者从书签打开。
 * RequireAuth 只查有没有登录，不查流程走到哪一步，所以直接跳进去开出来的是
 * 一页 "Not selected"，提交按钮点不动，也退不出去。手机 app 没有地址栏，
 * 不会有这个问题。
 *
 * 规则是从草稿本身推出来的，不记「访问过哪几页」的标记。这样刷新之后
 * 恢复出来的草稿一样能继续往下走 —— 草稿持久化和这个守卫互相配合，
 * 而不是互相打架。
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

/** 这份草稿最远能走到哪一步 */
export function reachableStep(draft: ReportDraft): ReportStep {
  // 修正已有记录时可以不换新照片 —— 和 buildReportSubmission 的 update 分支一致
  const hasPhoto = !!draft.photo || !!draft.existingPhotoUrl || !!draft.editingReportId;
  if (!hasPhoto) return 'photo';
  // 注意这里判的是照片不是海滩：确认页上有个「换一片海滩」会把 beachId 清空，
  // 如果这一步要求有海滩，那个按钮会把用户从选海滩的页面上赶出去。
  if (!draft.beachId) return 'confirm';
  const picked = Object.keys(draft.quantities) as LitterCategory[];
  if (picked.length === 0 || picked.some((c) => !draft.quantities[c])) return 'details';
  return 'review';
}

/**
 * 该不该拦。返回 null 表示放行，返回字符串是要跳去的网址。
 * 只往回赶，不往前推 —— 「修正记录」那条路径带着一份填满的草稿从第 1 步进来，
 * 往前推会让他没法换照片。
 */
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
  // 选了类别却没选数量档的，不能放过去
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

/*
 * 从复核页回详情页时该弹栈还是该替换。
 *
 * 抽成纯函数是为了能测：这个判断原来写在 ReviewScreen 里，某次改动把它的
 * 兜底分支换成了对自己的调用，于是 idx 为 0 时无限递归、堆栈溢出，页面上
 * 每个「Change」和返回键都点不动。组件内的分支没有测试能盖到它。
 *
 * idx 是 react-router 写在 history.state 里的位置。为 0 意味着复核页就是
 * 这个标签页历史里的第一条 —— 草稿现在能活过刷新，所以在地址栏直接输
 * /report/review 或从书签打开就会落到这个分支，不是罕见情况。
 */
export type BackFromReview = { pop: true } | { pop: false; to: string };

export function backFromReview(historyIdx: number | null | undefined): BackFromReview {
  return (historyIdx ?? 0) > 0 ? { pop: true } : { pop: false, to: '/report/details' };
}

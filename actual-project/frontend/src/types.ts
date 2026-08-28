// 全项目的数据类型。这份就是前端和后端约好的数据长什么样（详见 API.md）。
// 后端字段名如果和这里对不上，改这个文件 + src/api.ts，页面不用动。

export type SeverityBand = 'Low' | 'Moderate' | 'High' | 'Severe';
export type LitterCategory = 'Plastic' | 'Fishing gear' | 'Glass' | 'Metal' | 'Paper' | 'Other';
export type QuantityBand = 'Small' | 'Medium' | 'Large' | 'Very Large';
export type ReportStatus = 'Counted' | 'Duplicate' | 'Incomplete';
export type FreshnessKind = 'ok' | 'aging' | 'stale';
export type MapLayer = 'litter' | 'bio';

/** 生物图标类型，前端用它挑对应的线稿 svg */
export type SpeciesGlyph = 'turtle' | 'bird' | 'mangrove' | 'grass' | 'crab' | 'fish';

/**
 * Epic 5 的建模出现概率（Su 负责，Iteration 1 上线）。
 * 这是**估算值不是观测结果**，界面上必须标注清楚，且绝不能和垃圾严重度合并成一个数。
 */
export interface SpeciesLikelihood {
  /** 0-100 */
  percent: number;
  /** 模型或数据依据，界面上要显示出来，例如「Habitat match + 2024 survey」 */
  basis: string;
}

/**
 * 卡片讲的是一个物种、一个生境、还是一类动物的统称。
 * 只有 'species' 才可能有学名和受威胁等级 —— 生境和统称没有。
 */
export type SpeciesKind = 'species' | 'habitat' | 'group';

/** 数据来自哪个开放数据集。DMP §2 的来源登记表只认这两个。 */
export type SourceDataset = 'FishBase' | 'OBIS' | 'other' | 'pending';

/**
 * 数据出处。CC BY-NC 要求署名必须显示出来，DMP §9 还要求保留源 URL 和访问日期。
 * 所以这三样都是数据的一部分，不是注释。
 */
export interface SpeciesSource {
  dataset: SourceDataset;
  /** 界面上原样显示的完整署名 */
  citation: string;
  url: string | null;
  /** ISO 日期。DMP §9：preserve source URLs, access dates, and transformation notes */
  accessedAt: string | null;
}

export interface Species {
  name: string;
  kind: SpeciesKind;
  /** 学名。生境和统称为 null */
  scientificName: string | null;
  /** 受威胁等级，来自 FishBase 抽取。没拉到就是 null —— 不要猜 */
  threatCategory: string | null;
  glyph: SpeciesGlyph;
  text: string;
  source: SpeciesSource;
  /** FishBase 的 picture_url。图片版权独立于数据集，用前要单独确认 */
  pictureUrl?: string | null;
  /** 没有建模结果时为 null / 省略 —— 前端会退回纯科普展示 */
  likelihood?: SpeciesLikelihood | null;
}

export interface CompositionSlice {
  category: LitterCategory;
  /** 百分比，0-100，四舍五入到整数 */
  percent: number;
}

/** 地图列表用的精简海滩对象 */
export interface BeachSummary {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  /** 有效记录不足 3 条时后端返回 null —— 不是「干净」，是「证据不足」 */
  severity: SeverityBand | null;
  /** 1-4，对应严重度条形图；severity 为 null 时也为 null */
  band: number | null;
  insufficientData: boolean;
  validReports: number;
  /** ISO 8601；用于计算「多少天前」 */
  lastReportedAt: string | null;
  freshnessKind: FreshnessKind;
  /** 生物多样性图层用 */
  habitat: string;
  habitatTag: string;
  sensitivity: string;
  /** 生物图层标记里显示的代表性物种图标 */
  primarySpeciesGlyph: SpeciesGlyph;
  /** 真实封面照片；后端没有图时返回 null，前端退回 scene 渐变 */
  coverImageUrl: string | null;
  /** 无封面照片时的 CSS 渐变占位，后端原样下发 */
  scene: string;
}

/** 海滩详情页用的完整对象 */
export interface BeachDetail extends BeachSummary {
  composition: CompositionSlice[] | null;
  species: Species[];
  ecologicalNote: string;
}

export interface ScoringMethod {
  categoryWeights: { category: LitterCategory; weight: number }[];
  quantityWeights: { quantity: QuantityBand; weight: number }[];
  bands: { band: SeverityBand; range: string; color: string }[];
  /** 计分窗口天数，界面文案里的「90 days」 */
  windowDays: number;
  /** 出严重度需要的最少有效记录数，界面文案里的「fewer than three」 */
  minReports: number;
}

export interface LitterReport {
  id: string;
  beachId: string;
  beachName: string;
  category: LitterCategory;
  quantity: QuantityBand;
  /** 展示用日期字符串，后端给 ISO，前端格式化 */
  createdAt: string;
  status: ReportStatus;
  /** 被排除时的原因说明，后端下发，前端直出 */
  statusNote?: string;
  photoUrl?: string;
}

export interface CreateReportInput {
  beachId: string;
  category: LitterCategory;
  quantity: QuantityBand;
  /** 上传接口返回的 id */
  photoId: string;
  /** 'gps' = 由定位推断，'manual' = 用户手选 */
  locationSource: 'gps' | 'manual';
  /** 仅在 locationSource === 'gps' 时携带；后端只用于匹配海滩和查重，绝不公开 */
  coords?: { lat: number; lng: number };
}

export interface User {
  id: string;
  /** 参与者编号，例如 "1637"。不收集姓名和邮箱。 */
  participantId: string;
  role: 'volunteer' | 'moderator';
}

export interface AuthSession {
  token: string;
  user: User;
}


export interface UploadedPhoto {
  id: string;
  url: string;
  /** 后端已剥离 EXIF 定位信息 —— 界面上那句「LOCATION METADATA REMOVED」靠它 */
  metadataStripped: boolean;
}

export interface ReportCounts {
  counted: number;
  duplicate: number;
  incomplete: number;
}

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
/**
 * Epic 5 的模型输出。
 *
 * ⚠️ 这**不是**出现概率。模型只用了 OBIS 的出现记录、生成的背景点和经纬度，
 * 输出的是「相对出现分数」，没有经过校准。界面上绝不能显示成百分号。
 * 覆盖的四个物种：绿海龟、公子小丑鱼、伊洛瓦底海豚、镰鳍角蝶鱼。
 */
export interface SpeciesLikelihood {
  /**
   * ready       模型接进来了，score 有值
   * pending     这个物种在覆盖范围内，但后端还没接上
   * unavailable 这个物种不在那四个里 —— 这一版不会有数字
   *
   * pending 和 unavailable 要分开说：一个是「还没做」，一个是「做不了」。
   */
  state: 'ready' | 'pending' | 'unavailable';
  /** 相对出现分数 0-100，**不是概率**。只在 state = 'ready' 时有。 */
  score?: number;
  /** 这个数怎么来的，界面上原样显示，不能留空。 */
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

/**
 * 成分现在取「该海滩最新一条 Counted 记录」的六列，不是窗口内的聚合。
 * 只列非空的类别，按类别权重降序。
 */
export interface CompositionSlice {
  category: LitterCategory;
  quantity: QuantityBand;
}

/** 成分来自哪一条记录 —— 界面上要显示日期，不能再说「N 条记录的占比」 */
export interface CompositionSource {
  reportId: string;
  createdAt: string;
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
  /** composition 为 null 时这里也是 null */
  compositionSource: CompositionSource | null;
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
  /** 这条记录实际记了哪些类别。改正时按它回填，否则会把没动过的类别清空 */
  quantities: QuantityByCategory;
  /** 派生：quantities 里权重最高的那个类别 */
  category: LitterCategory;
  /** 派生：该类别对应的档 */
  quantity: QuantityBand;
  /** 展示用日期字符串，后端给 ISO，前端格式化 */
  createdAt: string;
  status: ReportStatus;
  /** 被排除时的原因说明，后端下发，前端直出 */
  statusNote?: string | null;
  /** 短时效签名地址，只有记录本人才拿得到。别缓存，过期就失效 */
  photoUrl?: string | null;
}

/**
 * 一次上报里「每个类别各一个数量档」。
 * 键是 LitterCategory 原文，后端映射到 reports 的 qty_* 六列。
 * 至少要有一项 —— 对应 DB 上的 reports_at_least_one_category。
 */
export type QuantityByCategory = Partial<Record<LitterCategory, QuantityBand>>;

export interface CreateReportInput {
  beachId: string;
  /** 至少一项。category / quantity 由后端从这里派生，前端不再发 */
  quantities: QuantityByCategory;
  /** 上传接口返回的存储键 */
  photoKey: string;
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
  /**
   * 存储键，不是可访问地址 —— 桶在公开 Web 根目录之外且不可公开读（API.md §5）。
   * 提交记录时原样发回去。
   */
  photoKey: string;
  /** 本地预览用。上传后由前端自己用 URL.createObjectURL 生成，不来自后端 */
  previewUrl: string;
  /** 后端已剥离 EXIF 定位信息 —— 界面上那句「LOCATION METADATA REMOVED」靠它 */
  metadataStripped: boolean;
}

export interface ReportCounts {
  counted: number;
  duplicate: number;
  incomplete: number;
}

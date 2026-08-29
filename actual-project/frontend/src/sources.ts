// 开放数据集的正式署名。
//
// DMP §2 的来源登记表只认这两个数据集，§9 要求署名必须显示、源 URL 和访问日期必须保留。
// 两个都是 CC BY-NC —— 仅限非商业使用。
//
// ⚠️ 这些常量是「拉到数据之后该怎么署名」，不代表已经拉过。
//    在真正跑过 ingestion 之前，物种数据的 source 一律用 PENDING_SOURCE。

import type { SpeciesSource } from './types';

export const FISHBASE = (accessedAt: string): SpeciesSource => ({
  dataset: 'FishBase',
  citation: 'Froese, R. and D. Pauly, Editors. FishBase. www.fishbase.org — CC BY-NC 4.0',
  url: 'https://www.fishbase.se/country/CountryChecklist.php?c_code=458&vhabitat=threatened',
  accessedAt,
});

export const OBIS = (accessedAt: string): SpeciesSource => ({
  dataset: 'OBIS',
  citation:
    'OBIS — Ocean Biodiversity Information System. Intergovernmental Oceanographic ' +
    'Commission of UNESCO. www.obis.org — CC BY-NC (strictest applicable licence)',
  url: 'https://api.obis.org/occurrence',
  accessedAt,
});

/** 非 FishBase / OBIS 的来源（红树、海草、鸟类都不在那两个库里）。 */
export const OTHER = (citation: string, url: string | null, accessedAt: string): SpeciesSource => ({
  dataset: 'other',
  citation,
  url,
  accessedAt,
});

/**
 * 还没有真实出处。
 *
 * 界面上会显示成琥珀色的 PLACEHOLDER 角标，而不是伪装成一条真署名 ——
 * 宁可露出来，也不能让一条编出来的引用混进演示或报告里。
 */
export const PENDING_SOURCE: SpeciesSource = {
  dataset: 'pending',
  citation: 'Awaiting FishBase / OBIS extract — not yet sourced',
  url: null,
  accessedAt: null,
};

/** 非商业声明。CC BY-NC 要求，界面上要能看到。 */
export const NON_COMMERCIAL_NOTICE =
  'Biodiversity reference data is used under CC BY-NC for non-commercial academic work. ' +
  'Individual images may carry separate copyright.';

// US4.3 —— 公布的严重度评分规则。
//
// 这份规则由前端提供（团队决议：US4.3 是 non-blocking stretch），
// 所以「评分说明」那一页不依赖后端，离线也能打开。
//
// ⚠️ 同时它也是给后端的规范：后端算 beach score 时必须用同一组数字（API.md §3）。
// 页面上写 0.85、后端按 0.9 算的话，US4.3 就白做了。
//
// 改这里任何一个数字 = 改变对外公布的规则，记得同步 API.md。

import type { ScoringMethod } from './types';

export const SCORING_METHOD: ScoringMethod = {
  // 类别权重：越难降解、危害越大的，权重越高
  categoryWeights: [
    { category: 'Fishing gear', weight: 1.0 },
    { category: 'Plastic', weight: 0.85 },
    { category: 'Glass', weight: 0.7 },
    { category: 'Metal', weight: 0.6 },
    { category: 'Other', weight: 0.5 },
    { category: 'Paper', weight: 0.35 },
  ],

  // 数量档：志愿者目测估算，不称重
  quantityWeights: [
    { quantity: 'Small', weight: 1 },
    { quantity: 'Medium', weight: 2 },
    { quantity: 'Large', weight: 3 },
    { quantity: 'Very Large', weight: 4 },
  ],

  // 四段固定阈值，所有海滩通用
  bands: [
    { band: 'Low', range: 'below 1.5', color: '#7CA98B' },
    { band: 'Moderate', range: '1.5 – 2.4', color: '#D9A24B' },
    { band: 'High', range: '2.5 – 3.4', color: '#CE6B45' },
    { band: 'Severe', range: '3.5 and above', color: '#B84A3F' },
  ],

  windowDays: 90, // 只算最近 90 天的记录
  minReports: 3, // 不足 3 条就不给等级，显示「证据不足」
};

# Iteration 1 · LeanKit 卡片内容（Epic → Story → AC）

> 每条 AC 都对得上**已经实现并跑通的前端**或 **API.md 里的接口契约**，右列写了
> 落在哪个文件 / 哪个接口。这就是 Keith 要的 story–AC traceability 的底稿。
>
> **字段写进 LeanKit 原生字段，别塞进 Title。** Owner → Assigned Members，
> Must/Should → Priority，I1 → Lane 或 Tag，日期 → Planned Start/Finish。
> 标题里再写一遍会和字段打架（现在 E1 卡的标题写 `Must`、Priority 字段是 `Normal`）。

---

## Epic 2 — Manual litter reporting　　Owner: Jiang　Priority: Must

### US2.1　As a volunteer, I can record a standardised litter observation

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 没有 ID 时点「Report Litter」跳领号页，领完**自动回到拍照步骤**，不用重新开始 | `App.tsx` RequireAuth + `?next=` |
| 2 | 照片必填，没照片不出现「Continue」 | `PhotoScreen.tsx` |
| 3 | 上传失败显示可重试的错误，**草稿不丢** | `PhotoScreen.tsx` uploadError |
| 4 | 「Allow Once」只取一次坐标，用于反查海滩 | `GpsScreen.tsx` → `POST /geo/resolve-beach` |
| 5 | 定位被拒 → 自动进手选海滩，顶部显示黄色提示条 | `ConfirmBeachScreen.tsx` gpsDenied |
| 6 | GPS 推断出海滩后**必须用户确认**，且可改选别的 | `ConfirmBeachScreen.tsx` |
| 7 | 类别 6 选 1、数量 4 选 1，两者都必填 | `RecordScreen.tsx` |
| 8 | 缺字段点 Continue → 显示 REQUIRED 角标 + 错误块，**不跳页** | `RecordScreen.tsx` showErrors |
| 9 | 25 km 内没有支持的海滩时，不硬塞一个，转手选 | API.md §4 |

### US2.2　As a volunteer, I can review and correct a record before it counts

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 复核页列出海滩 / 类别 / 数量 / 位置，前三项可点「Change」回去改 | `ReviewScreen.tsx` |
| 2 | 保存后进「Record saved」，显示后端返回的判定结果 | `SubmittedScreen.tsx` |
| 3 | 新记录立刻出现在「我的记录」顶部，计数同步更新 | `MyReportsScreen.tsx` |
| 4 | `Incomplete` 的记录可点进去带原值修正，改完**重跑判定**变回 Counted | `PATCH /reports/:id`，API.md §6 |

---

## Epic 4 — Beach attention & severity map　　Owner: Darli　Priority: Must

### US4.1　As a visitor, I can see reported litter severity for each beach on a map

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 地图显示全部支持的海滩，**无需登录** | `MapScreen.tsx`，`GET /beaches` |
| 2 | 标记显示等级文字 + 4 格强度条，颜色对应四个等级 | `BeachMarker.ts` |
| 3 | 点标记弹卡片：名称、区域、等级、有效记录数、新鲜度 | `MapScreen.tsx` SelectedCard |
| 4 | 卡片标注「BROAD AREA SHOWN — EXACT GPS IS PRIVATE」 | `MapScreen.tsx` |
| 5 | 「View Beach」进详情页，含成分构成 | `BeachScreen.tsx` |
| 6 | 离线时显示横幅，说明看到的是上次同步的数据 | `MapScreen.tsx` offline |

### US4.2　As a visitor, I can tell when the evidence is insufficient or out of date

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 有效记录 < 3 → **不显示任何等级**，显示虚线 INSUFFICIENT DATA 徽章 | `severity: null`，API.md §2 |
| 2 | 同时显示「This does not mean the beach is clean」 | `MapScreen.tsx` / `BeachScreen.tsx` |
| 3 | 成分图换成虚线占位框，不显示空图表 | `composition: null` |
| 4 | 最近一条有效记录 > 90 天 → 「Not recently reported」+ 详情页时钟提示条 | `freshnessKind: 'stale'` |
| 5 | 新鲜度和严重度**分开显示**，不合成一个指标 | 设计稿要求 |

### US4.3　As a visitor, I can read the exact rule behind the severity band

**Priority: Should（non-blocking stretch）· 交付方：前端 · 不依赖后端**

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 说明页可从**首页 / 海滩详情 / 账户 / 保存成功**四处进入 | `MethodScreen.tsx` |
| 2 | 显示公式：`record score = 类别权重 × 数量档`，`beach score = 窗口内均值` | `MethodScreen.tsx` |
| 3 | 显示两张权重表（6 类别 + 4 数量档）和四段阈值区间 | `GET /scoring-method` |
| 4 | 显示缺数据规则（< 3 条、90 天、Duplicate/Incomplete 排除） | `MethodScreen.tsx` |
| 5 | 显示敏感性分析结论和四条局限性声明 | `MethodScreen.tsx` |
| 6 | 说明页**不依赖后端**：规则常量在前端，离线 / 后端未就绪都能正常打开 | `src/config/scoring.ts` |
| 7 | 后端算严重度必须用同一组数字；不一致时前端以后端为准并在 dev 告警 | `describeScoringDrift()`，API.md §3 |

> **已按团队决议落地为「前端交付」。** 规则（6 个类别权重、4 个数量档、4 段阈值、
> 90 天窗口、最少 3 条）写在 `src/config/scoring.ts`，说明页直出，后端不做
> `/scoring-method` 也不影响这一页 —— 所以它现在是真正意义上的 non-blocking。
>
> 唯一还需要 Darli 那边配合的一件事：**后端算 beach score 时用同一组数字**
> （API.md §3）。页面上写 0.85、后端按 0.9 算的话，US4.3 就白做了。

---

## Epic 5 — Biodiversity context　　Owner: Su　Priority: Should

### US5.1　As a visitor, I can switch to a biodiversity layer on the map

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | Litter / Biodiversity 两个图层可切换 | `MapScreen.tsx` |
| 2 | 生物图层标记显示栖息地图标 + 类型标签（MUDFLAT / MANGROVE / SEAGRASS） | `BeachMarker.ts` |
| 3 | 卡片显示 HABITAT 和 RELEVANCE 两行 | `MapScreen.tsx` |
| 4 | 图例标注「HABITAT CONTEXT · BROAD AREAS ONLY」 | `MapScreen.tsx` |

### US5.2　As a visitor, I can see why litter may matter ecologically at this beach

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 物种卡片横向滑动，每张含名称、说明、**数据来源署名** | `BeachScreen.tsx` |
| 2 | 「WHY LITTER MAY MATTER HERE」一段，按海滩不同 | `ecologicalNote` |
| 3 | 必须显示免责声明「context only, **never proof of current presence** or of ecological recovery」 | `BeachScreen.tsx:281` |
| 4 | 科普内容本身是静态数据，**不随记录变、不参与垃圾严重度计算** | API.md §2 |

### US5.3（新增）　As a visitor, I can see a modelled likelihood that a species occurs here

**Owner: Su · Iteration 1 上线 · 前端槽位已就绪，等模型数据**

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 物种卡片显示百分比 + 依据说明；没有建模结果时**不显示任何百分比** | `species[].likelihood`，API.md §2b |
| 2 | 视觉上和垃圾严重度**完全区分**（蓝色虚线框，非严重度四色，非条形图） | `BeachScreen.tsx` |
| 3 | 明确标注 `MODELLED · ESTIMATE` | `BeachScreen.tsx` |
| 4 | 有概率时免责声明自动换成「an estimate … never a confirmed sighting」 | `BeachScreen.tsx` 条件文案 |
| 5 | 评分说明页把「No model, no judgement call」**限定在垃圾严重度**上，并声明两者不合并 | `MethodScreen.tsx` |
| 6 | 概率**绝不参与**严重度计算，也不和它合成任何单一指标 | API.md §2b 硬约束 |

> 待 Su 确认字段形状：`percent` 是 0–100 整数还是 0–1 小数？`basis` 要不要带模型版本号？
> 有没有置信区间要展示？确认后前端改 `types.ts` 一处即可。

---

## 横切工作项（不是 Epic，是跨 Epic 的规则）　　Owner: LiHanXia

> 建议标题改成 **duplicate / incomplete handling** —— 「rejected」暗示有人工驳回，
> 而 peer/moderator review 明确不在 Iteration 1。

| # | 验收标准 | 实现位置 |
| --- | --- | --- |
| 1 | 三个状态只有 `Counted` / `Duplicate` / `Incomplete`，没有第四个 | API.md §6 |
| 2 | 查重规则：同一人 + 同一海滩 + 同一自然日（吉隆坡时区） | API.md §6 |
| 3 | 重复记录返回 **201 + status=Duplicate**，不是报错 | API.md §0 |
| 4 | `validReports` 只数 Counted，Duplicate / Incomplete 不进计数、不进计算、不上地图 | API.md §7 |
| 5 | 排除原因由后端下发英文成句，前端原样显示 | `statusNote` |
| 6 | 精确坐标存独立私有表，**任何响应都不返回** | API.md §6 隐私 |
| 7 | 照片 EXIF 定位信息由后端剥离，剥净才返回 `metadataStripped: true` | API.md §5 |
| 8 | 账号体系不存任何个人数据：无姓名、无邮箱、无密码 | API.md §1 |
| 9 | 领号后把编号显示出来，提示用户记下；账户页随时可查 | `IdentityScreen.tsx` |
| 10 | 编号忘了就领新号；已提交记录不受影响，只是无法再查看/修正 | `IdentityScreen.tsx` |

---

## 明确不在 Iteration 1（建议各开一张卡放 Iteration 2 Lane，别留在 I1 backlog）

US2.3 AI 分类建议 · Peer/moderator 审核流程 · **Epic 1 活动** · Epic 3（已移除）·
Epic 6 成果 · Epic 7 周期性 · Epic 8 荣誉 · US5.4 物种卡片

（原「US5.3 测验」在设计稿里是 quizzes；本次新增的概率评分也编为 US5.3，
如果编号冲突请 Keith 统一一下。）

# Figma frontend preview · 03-10-2026

Delivery branch: `iteration3-frontend-v1` — first Iteration 3 frontend handoff, including the Figma review fixes and the user-approved layout refinements. Remaining photo and drop-off placeholders are retained for later follow-up.

This branch implements the mobile frontend from the team's Radar-Sampah-frontend-bundle and its 02/03 October change notes. The existing report/authentication and API integration are reused. No backend or model files are changed.

Delivery order confirmed by the user: complete and refine the Iteration 3 frontend first; the teammate will implement its backend afterwards. The retained backend and API contracts belong to Iteration 2. Their current limits describe compatibility and pending integration, not final Iteration 3 requirements. Local preview verification does not certify the new backend.

## Run and review

### 用户确认的三项小幅优化（03-10-2026）

- 首页：Report Litter、Join Cleanup、Log Cleanup 整组移到问候语下方、推荐海滩卡之前，保留原来的大小、样式和操作。
- 海滩详情：What You Can Do Here 移到 Litter Severity 之后、Marine Life & Habitat 之前，让状态与行动相邻。图库及其他内容保留。
- 活动分享：移除与 Share… 重复的 Share Event Details 按钮，保留 WhatsApp、Share…、Copy link。

验证：195 项现有测试、类型检查及生产构建通过；402/320 像素检查无横向溢出；首页报告返回首页、记录清理先选海滩、海滩活动入口及活动返回原海滩均正常。分享仍沿用现有服务连接条件。本轮没有修改数据、后端或之前的草稿/返回处理。

### 本轮原型复查与修改（03-10-2026 晚）

- 补齐 Biodiversity 地图：全国 6 个物种图片标记、东马 3 个栖息地入口、9 个地区共 16 个记录标记。点标记可看对应记录，再进入物种介绍或地区页面。
- 修正“查看栖息地”、Cleanup History 的“View Beach”和扩展海滩图库的错误去向；从海滩进入生物页面后，地图与返回操作保留原海滩。
- Wildlife Nearby 恢复原型的 4 个海滩、栖息地和物种标签卡片；仍明确标注设计预览，未接入模型预测。
- 活动列表接收海滩筛选，详情返回保留筛选；Insights 的搜索和筛选也保留。志愿者优先列表按 Moderate 及以上、近 30 天无清理或下一场报名少于 3 人的规则展示，不能只筛 High。
- 补回原型来源的螃蟹、管栖蠕虫图片，修正 48 处照片署名误带下一条名称的问题；统一 Very high 的显示文字。
- 验证：195 项测试、类型检查、生产构建通过；402/320 像素下 9 地区共 16 个生物标记完整显示，402 像素逐个点击预览正确，全国 6 个入口及主要返回链路通过。

仍待素材补齐的 7 个物种：Halophila ovalis、Shorebirds、Grubeulepis malayensis、Thalassina Kelanang、Indo-Pacific finless porpoise、Syringodium isoetifolium、Rhizophora stylosa。未用其他物种图片替代。后端、模型及原先明确保留的预览/集成边界不变。

这一轮主要修正内容和浏览路径，未重做首页或整体结构。

Use Node 20.19+ and the existing package manager to install dependencies, then run `pnpm dev --host 127.0.0.1 --port 5176`. The current review server is at http://127.0.0.1:5176/home. `VITE_API_BASE_URL` unset enables the clearly labelled local preview. Set it to the API base URL to use live data; design fixtures never replace failed live requests.

The design viewport is 402 px. The app also adapts to smaller phones and a centred desktop column. Review Home → Map → a region → See Beaches → Beach, Home → Marine Life, Insights and Account. A local anonymous profile can be created through the normal identity screen.

## Implemented

- Five-tab navigation; guest and participant Home; About Us retaining the original ocean-plastic background.
- National/regional map, litter and biodiversity layers, regional beach sheets, search, map key and private contribution summary. Region centres are broad navigation locations, not beach coordinates.
- A reusable beach template with all 101 named design entries. Actual pilot beach data, composition and cleanup actions still use the existing API.
- Marine catalogue: 38 species/groups (26 animals, 12 plants), individual sourced introductions, 9 habitat pages, and 9 regional record collections. Questions navigate to the supplied source-based answers; they do not call a live chat model.
- Insights hub, trends/search/filters, beach trend, cleanup patterns/history, participation filters, wildlife and volunteer entries; explicit loading/error/insufficient-data views.
- Community date/joined/nearby filters, beach-need list, joining, existing check-in workflow, preparation/sorting/drop-off guidance, wildlife help, event results without cleanup scores.
- One cleanup journey from Home, beach or event: linked report → choose amount or review photo suggestion → recorded change. Done returns to the originating event, otherwise Home. Other litter categories retain their previous amounts. The event shows only the final drop-off step after the current participant records a cleanup.
- Account, private contribution history, recovery details, privacy sheet; device-only nickname and opt-in leaderboard preview. Preview points follow the supplied +5 attendance / +1 counted-report rule.
- Photo/source credits. 80 credited coastal photos and 11 supplied cleanup-guide photos are stored locally. The two additional photos are the USGS mangrove crab and the unmodified embedded Figure 1 from Wibowo et al. (2025), PDF page 2; both use the prototype's own source links and retain their credits.

## Explicit differences and integration work

1. The Figma connector requires edit access, but the online design was successfully inspected through the browser during the map follow-up. Implementation also uses the supplied full-length screenshots, raw layer text and written specifications. The 319 frames are a reference inventory, not a claim of 319 individually verified screens.
2. The repository/API supplies four operational pilot beaches. The other 97 design entries now have sourced, display-only reference positions in preview, giving all 101 catalogue entries a map location. These do not enable submissions or validate operational beach boundaries; canonical backend IDs and coordinates remain integration work. Sources and precision limits are recorded in [MAP_LOCATION_SOURCES_2026-10-03.md](MAP_LOCATION_SOURCES_2026-10-03.md). Region counts are summed from available entries, so they differ from the independent numbers drawn in Figma.
3. Insights aggregates and the sample leaderboard are design fixtures with their original as-of date. The live API has no verified endpoint for them, so live mode displays an unavailable state. Nicknames, opt-in/rank/points persistence and aggregate insight endpoints remain integration work. The preview does not calculate a fictitious personal rank.
4. The personal map sheet calculates a limited report-based summary. The three-section recurrence/persistence version needs per-participant cleanup/follow-up data and approved aggregation rules.
5. Galleries retain the existing authorised public-report-photo contract. Generic Figma reference photos were not extracted from screenshots or relabelled as beach evidence; an empty gallery displays its real empty state.
6. The backend quantity-band contract begins at Small. None is visibly unavailable instead of being silently submitted as Small. API support for a genuine zero amount is needed to enable it. Cleanup availability still has separate loading, error, no-target and target states.
7. Drop-off names/date remain the supplied placeholders and Open in Maps stays disabled. No location was invented. Public share creation requires the shared service and is disabled in local preview.
8. Some species have no supplied/verified downloadable image; their cards say Photo unavailable. Habitat illustration photos are explicitly labelled as illustrations, not photographs of the named site. No image is generated or borrowed from a different species to conceal a gap.

## Verification

- TypeScript type check and production bundle pass.
- 195 tests pass (29 files), including the existing API/authentication/report suite plus cleanup origin routing, unchanged-category preservation, guide states, nickname isolation, catalogue integrity, safe returns, cleanup draft retention, pending report saves, event-time boundaries, map geometry/grouping, label placement, compact-map regressions, display-coordinate isolation, biodiversity destinations and volunteer thresholds.
- Browser checks at 402 × 874: guest identity redirect preserves cleanup destination; standalone cleanup saves a band transition and Done returns Home; event-linked cleanup returns to its event and displays Last step without preparation/sorting; joined state restores after refresh; national map/region/beach navigation renders.
- Eight additional catalogue/detail/insight/wildlife routes rendered at 402 px without horizontal overflow. Seven main pages (including a long beach title) were checked at 320 px without horizontal overflow. Nickname save, the 12-item Plants filter, search empty state and Insights retry were exercised in the browser. These checks are in `UI_REVIEW_2026-10-03.json`.
- Live backend/model recognition and geolocation permission granting were not exercised in this run. A local mock session was used for all browser mutations. No production data was created.

## Reference index and content updates

### Navigation and core-flow corrections (03-10-2026)

This follow-up keeps the current layout and help content. It addresses blocked or misleading actions and lost navigation context:

- Detail and form Back controls return through app history, with an in-app parent fallback for direct links. Loading/error views retain an exit; successful cleanup Done keeps its explicit Home/event destination.
- Marine Life search/category, Community filter and the map beach list/search survive a detail-page round trip. Directory Back no longer alternates between Marine Life and Habitats.
- Home Report Litter starts without assuming a beach. Home Log Cleanup asks for a supported beach in the existing sheet style.
- Cleanup choices survive leaving and reopening the same target in this tab. A changed target invalidates the old choices; photos and cleanup choices are not persisted across reloads.
- Report steps return without adding duplicate form entries. Existing draft dialogs can be cancelled, and editing a different report no longer silently replaces an unfinished draft.
- Late location/photo/save callbacks cannot pull users back into a flow they already left or overwrite a later draft. Save buttons guard repeated clicks.
- Ended activities are excluded from upcoming recommendations. Joining can happen before an activity; check-in becomes available during its scheduled time. Account loading failures remain distinct from zero contributions.

Additional browser checks passed in the local preview: the Marine Life/Habitats return sequence; report Photo → Location → manual beach → Suggestions and the reverse sequence; retained photo; draft Cancel; retained cleanup amount; direct credits Back; guest identity Back; failed check-in exit; retained Marine Life search/category; retained Community Joined filter; and retained map region/list/search. No report or cleanup was submitted during this follow-up browser pass.

### Map zoom/display corrections (03-10-2026)

- Compared all nine regional maps in the supplied screenshots/specifications and inspected the online Figma map frames through the browser. The connector still requires edit access. The prototype specifies regional drill-down and nearby-point clusters, but no numeric zoom thresholds.
- National, regional and Borneo views fit their broad navigation extents to the available map viewport. The header and bottom card reserve their own space, so they no longer cover the map attribution or the initial fitted extent. Short screens use more compact spacing and region circles.
- Removed the delayed initial-view reset. Data/size refreshes preserve user pan/zoom within the mounted page. Full Map and region selection explicitly fit the requested area; returning from a detail page retains the region but starts its overview again.
- The main map updates zoom immediately so regrouping and route teardown cannot leave a Leaflet zoom-transition callback behind. Rapid zoom/cluster/detail navigation produced no new browser errors after this correction.
- Each region initially displays its main prototype beach names, band badges, coastal dots and leader lines. The 51 main names retain individual markers; secondary nearby points use compact +N clusters. Tapping a cluster fits its members, and more names appear on zoom; coincident/max-zoom points open the existing beach list.
- Replaced the earlier region-list placeholder with individual map locations for all 101 catalogue entries. The 97 added source records are used only by the preview map adapter, without mutating beach data or enabling backend/report/check-in actions. Some sources describe island reference points or coastal sampling sites; see the source handoff above.
- Labels avoid one another and the map controls, and update after pan/zoom. Labels and individual dots open their own beach detail; See Beaches remains a supplementary directory. Full Map returns to the national overview.
- Short map viewports use compact labels and responsive widths. Preferred labels reuse available slots to shorten leader lines; the fallback packing starts below map hints so fractional element heights do not waste a whole row.
- Biodiversity now uses the prototype's photo pins and record preview sheets, with published-record wording and an About entry. This supersedes the earlier regional count rings. Litter labels use the shared Very high display wording.
- Local browser checks at 402 × 874: all nine regional maps display all 51 main labels without horizontal overflow; each of the 51 labels opens its matching detail and Back returns to its region. North's +5 cluster expands into named Langkawi beaches; Pantai Kok opens its own detail and returns correctly. Plus/minus controls recompute labels and clusters. Earlier national framing, biodiversity and 320 × 640 national-layout checks remain recorded. No backend/model changes or submissions.
- Final 320 × 640 checks retain all main labels in North (5), Selangor (7) and Negeri Sembilan/Melaka (7), without horizontal overflow. Map verification tabs reported no console warnings/errors. Nine regional screenshots and the 51 detail/return journeys are saved under the workspace's `work/figma-frontend-20261003/` review folder.

### Team update: AC4.4.4 — Expanded Beach Dataset (03-10-2026)

The newly shared [Iteration 3 requirements](https://docs.google.com/document/d/1JNCNzTpXhb4zT0J2NJM1D5ifM5AfYT-e/edit) specify 82 BeachSearcher entries **in addition to** the four MVP beaches. This is a SHOULD HAVE criterion, currently marked Not started with owner/date TBD in the source document. It covers map display, Beach Attention and litter reporting, with the same cleanup, eligibility, duplicate and privacy rules. Fewer than three eligible reports must display Insufficient data.

This requirement is different from the 101 Figma beach-page entries described above: those already include the four MVP beaches and are a presentation catalogue, not the expanded operational dataset. Neither 101 nor a final unique total of 86 has been validated against the supplied list. Keep the existing `morib`, `remis`, `kelanang` and `bagan` IDs so historical records continue to resolve.

The shared [Iteration 3 folder](https://drive.google.com/drive/folders/1z05EgiMa9KdlOrU4MNdPVQFbWNeYR8bU) contains `Beach_names.csv`. Its preview has one `Beach Name` column. The companion [Beaches-searcher dataset document](https://docs.google.com/document/d/1Hs2LRPobpmfS-B_xW8qdJX1B6Z_Vhox9Ilhu58AbTWE/edit) records the source URL and filters (Beaches · Rating & Reviews; Public; Natural / Rural; River; Ocean / sea), but no row-level region, water type or coordinates. Browser download returned an HTTP error; only the visible preview was inspected, so the full CSV row count and uniqueness are not certified by this review. The review date is not a substitute for the original dataset retrieval date.

Before enabling the expanded set:

- Obtain the complete export and confirm each place using region, water type, coordinates and a stable source reference. Resolve repeated/ambiguous names and any overlap with the four MVP beaches before stating the unique total.
- Preserve source, exact filters and original retrieval date in dataset metadata; review the source's reuse terms and attribution as the AC requires. The earlier double-underscore filter URL is the one present in the requirements and companion document; the differently formatted forwarded URL is not assumed equivalent.
- Register the canonical IDs in the existing backend beach dataset and return them through `/beaches` and `/beaches/:id`. Match those IDs to display content; the current frontend region lookup depends on the four known/prototype IDs, so new IDs need an explicit mapping before regional filtering is complete.
- Keep the MVP subset flagged as validated core. New entries start without community evidence; do not import the Figma example counts, bands or wildlife predictions as real records.
- Verify map positions, beach selection for reports, scoring below the three-report threshold, report/cleanup eligibility, and preservation of old report/event links.

No production dataset, backend/model code or active preview catalogue was changed by this requirements review. AC4.4.4 remains integration work; the frontend preview should not be presented as having completed it.

`FIGMA_FRAME_INDEX.json` lists all 319 source frames and their screen-family coverage, including simplified or pending states. To regenerate static content after receiving a refreshed export, run `python scripts/import-figma-content.py /path/to/Radar-Sampah-frontend-bundle`. It reuses locally available photos and writes the frame inventory/download manifest to the ignored `.figma-import` folder. Review generated content and credits before committing.

The PERHILITAN contact supplied by the design was checked against its [official contact page](https://www.wildlife.gov.my/en/hubungi-kami/) on 03-10-2026. There are no new backend endpoints or dependency changes in the application.

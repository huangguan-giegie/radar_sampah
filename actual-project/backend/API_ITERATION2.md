# Radar Sampah 后端接口约定（Iteration 2）

本文补足 Iteration 1 `frontend/API.md` 尚未定义的模型识别、清理目标、社区活动和管理员接口。现有海滩、照片、报告列表等接口保持兼容；新增接口均以 HTTPS、JSON 为准，照片上传使用 `multipart/form-data`。所有时间在响应中使用带时区的 ISO 8601，业务时区为 `Asia/Kuala_Lumpur`。

## Iteration 2 决议

- `moderator` 是活动管理员，可以创建、修改和关闭社区活动；举报审核仍不在本迭代范围内。普通匿名参与者是 `volunteer`。
- 清理目标只从 `Counted` 报告产生。`Duplicate`、`Incomplete` 报告不产生目标。
- 模型输出和人工确认的实际件数用 `itemCounts` 保存；旧版 `quantities` 仍是四档数量，用于与 Iteration 1 前端兼容。两者不能互相替代。
- 模型类别映射：`plastic → Plastic`、`metal → Metal`、`glass → Glass`、`paper_cardboard → Paper`、`styrofoam → Other`、`fishing_gear → Fishing gear`。
- 由实际件数导出旧版档位：1–5 件 `Small`，6–20 件 `Medium`，21–50 件 `Large`，51 件及以上 `Very Large`。例如 8 件塑料对应 `itemCounts: {"Plastic": 8}`，兼容字段为 `quantities: {"Plastic": "Medium"}`。`styrofoam` 不会新增前端类别，而会计入 `Other`。
- 部分清理可针对同一报告重复提交，直到剩余件数为零；每次是独立、不可覆盖的清理流水。只有相同请求重试才复用同一个 `idempotencyKey`。
- 清理记录的 `score` 是移除件数总和，不是积分；不发放积分。
- 自动活动为每片海滩未来四个周六的 09:00–12:00（马来西亚时间），读取 `/events` 时幂等补齐。管理员也可创建其他日期的活动。
- 出席由三项共同确认：加入该活动、签到位置通过、活动时段内在该海滩有 `Counted` 报告或带该活动 ID 的清理记录。位置通过阈值为海滩中心 25 km，和迭代二界面原型一致。
- GPS 坐标只用于请求时的海滩签到与 10 米重复目标检查。迭代二报告不保存原始坐标；只保存带服务端密钥的目标专属 1 米网格 HMAC。它不是加密坐标，不能还原坐标。签到只保存“通过/时间”，不保存坐标。
- 清理后的照片仅在服务器内存中做识别，不写入照片目录或数据库。初始报告照片保留原来的私有审计存储规则。

## 认证

所有需要登录的接口使用 `Authorization: Bearer <token>`。

### `POST /auth/anonymous`

创建匿名志愿者。响应 `201`：

```json
{
  "token": "<session JWT>",
  "recoveryToken": "<show once and store securely>",
  "user": {"id": "u_…", "participantId": "1637", "role": "volunteer"}
}
```

服务端仅保存恢复令牌的 SHA-256 摘要。

### `POST /auth/restore`

请求 `{ "participantId": "1637", "token": "<recoveryToken>" }`。返回 `{ "token": "<session JWT>", "user": {…} }`。错误恢复令牌返回 `401 INVALID_RECOVERY_TOKEN`。只有显式配置的演示账号 `DEMO_PARTICIPANT_ID` 可继续使用仅编号恢复。

### Moderator 账号

使用 `python scripts/provision_moderator.py` 创建 moderator。命令只显示一次恢复令牌；通过可信的私下渠道交给活动管理员。不要用普通注册接口提升角色，也不要把恢复令牌写入仓库。

## AI 识别

### `POST /recognitions`

对当前用户已上传的报告照片运行一次识别。请求 `{ "photoKey": "<owned photo key>" }`。响应：

```json
{
  "state": "ready",
  "modelVersion": "sea-taco-yolo11m-best/1",
  "counts": {"Fishing gear": 0, "Plastic": 2, "Glass": 0, "Metal": 0, "Other": 1, "Paper": 0},
  "quantityBands": {"Plastic": "Small", "Other": "Small"},
  "detections": [{"modelClass": "styrofoam", "category": "Other", "confidence": 0.91, "box": [12, 20, 90, 130]}],
  "manualEntryRequired": false,
  "reason": null
}
```

`state` 为 `ready`、`unavailable` 或 `failed`。模型不可用、推理失败或识别结果为空时，返回空/零件数并设置 `manualEntryRequired: true`，前端允许人工录入和确认，不把识别失败解释为“没有垃圾”。响应包含模型版本。置信度阈值 0.25、IoU 阈值 0.7。

### `POST /recognitions/cleanup-photo`

可选清理后照片的识别接口，`multipart/form-data`，字段 `photo`。最多 10 MB，仅接受 JPEG、PNG、HEIC。响应结构与 `/recognitions` 相同；照片只在内存中处理后即丢弃。

## 报告和清理目标

### `POST /reports`

保留 Iteration 1 字段，并为 Iteration 2 增加可选 `itemCounts` 和 `eventId`：

```json
{
  "beachId": "morib",
  "photoKey": "<uploaded key>",
  "locationSource": "gps",
  "coords": {"lat": 2.74614, "lng": 101.44024},
  "itemCounts": {"Plastic": 8, "Other": 2},
  "quantities": {"Plastic": "Medium", "Other": "Small"},
  "eventId": "morib-2026-09-19"
}
```

`itemCounts` 可由模型识别后经参与者确认，也可在模型不可用时人工录入。至少有一个正整数类别，单类上限 100,000。若同时传 `quantities`，必须与件数档位一致；也可以省略，由服务端生成兼容档位。GPS 模式仍需在请求里带精确坐标，但迭代二报告不会持久化原坐标。若坐标与未清空目标相距约 10 米以内，返回 `409 ACTIVE_CLEANUP_TARGET_NEARBY`。显式提供的 `eventId` 必须与海滩相同，且提交时间落在活动时段内。

响应沿用 `LitterReport`，另外包含：

```json
{
  "itemCounts": {"Plastic": 8, "Other": 2},
  "remainingItemCounts": {"Plastic": 8, "Other": 2},
  "eventId": "morib-2026-09-19"
}
```

报告件数和照片是原始审计记录。发生清理后 `itemCounts` 保持原值，`remainingItemCounts` 由后端根据不可变清理流水实时计算。

### `GET /cleanup-targets?beachId=morib`

公开返回仍有剩余件数的 `Counted` 报告：

```json
[{"reportId":"r_…","targetReportId":"r_…","beachId":"morib","beachName":"Pantai Morib","createdAt":"…+08:00","itemCounts":{"Plastic":5},"remaining":{"Plastic":5},"remainingTotal":5}]
```

已清零的目标不再返回。没有 `itemCounts` 的旧版报告因缺少实际件数，不会成为可清理目标。

### `POST /cleanup-actions`

请求：

```json
{
  "targetReportId": "r_…",
  "removedCounts": {"Plastic": 3},
  "handling": "Recycled / handled",
  "note": "Optional, at most 500 characters",
  "eventId": "morib-2026-09-19",
  "idempotencyKey": "a unique UUID for this cleanup submission"
}
```

`eventId`、`note` 可省略。`handling` 只能是 `Collected for disposal`、`Recycled / handled`、`Not recorded`。移除件数不能超过当前剩余件数。重复部分清理使用新的 `idempotencyKey`；同一个 key + 同一请求安全重试，key 被用于不同请求时返回 `409 IDEMPOTENCY_CONFLICT`。提交成功返回 `201`；相同请求重试返回 `200`：

```json
{
  "id":"c_…","participantId":"u_…","targetReportId":"r_…","eventId":null,
  "beachId":"morib","createdAt":"…+08:00",
  "rows":[{"category":"Plastic","removed":3,"before":8,"after":5}],
  "score":3,"handling":"Recycled / handled","note":null,
  "status":"Cleanup recorded — awaiting follow-up"
}
```

允许后续对同一 `targetReportId` 再提交，例如剩 5 件时再清 5 件。超过剩余量返回 `409 REMOVED_COUNT_EXCEEDS_REMAINING`；目标清零后再次提交返回 `409 CLEANUP_TARGET_COMPLETE`。报告和旧清理流水不更新、不删除。

### `GET /cleanups/mine`

当前参与者自己的清理记录，按时间倒序，元素结构同上。

## 社区活动

活动对象包含原型字段 `id`、`beachId`、`date`、`start`、`end`、`status`、`source`、`participantCount`、`joinedBy`、`checkIns`、`attendanceBy`、`cleanupIds`，以及便于审计的 `startsAt`、`endsAt`、`beachName`、`checkedInCount`、`attendanceCount`。`joinedBy`、`checkIns`、`attendanceBy` 是参与者编号列表，不包含姓名等个人信息；另有当前登录者的 `joined`、`checkedIn`、`attendanceConfirmed`，匿名浏览时后三项均为 `false`。

### `GET /events?beachId=morib`

公开列出最近和未来活动；读取时为每片海滩补齐未来四个周六的活动。可选按海滩筛选。状态为 `Open` 或 `Closed`，来源为 `scheduled` 或 `moderator`。

### `GET /events/{id}`

公开读取单个活动。

### `POST /events`（moderator）

创建额外活动，请求 `{ "beachId": "morib", "startsAt": "2026-09-19T09:00:00+08:00", "endsAt": "2026-09-19T12:00:00+08:00" }`。时间必须带时区，活动时长不能超过 12 小时。

### `PATCH /events/{id}`（moderator）

修改 `startsAt`、`endsAt` 和/或 `status` (`Open`/`Closed`)。不能重新开放已结束的活动。

### `POST /events/{id}/join`（登录）

加入未关闭活动。重复调用幂等。

### `POST /events/{id}/check-in`（登录）

请求 `{ "lat": 2.74614, "lng": 101.44024 }`。必须先加入，并在活动时段内签到。距离活动海滩中心不超过 25 km 即通过；精确坐标只用于这次请求，不保存。没有加入返回 `409 JOIN_REQUIRED`，不在范围返回 `403 LOCATION_OUT_OF_RANGE`。

## 错误码

新增错误均继续使用 `{ "code": "…", "message": "English sentence for display" }`：

| HTTP | code | 含义 |
| --- | --- | --- |
| 401 | `INVALID_RECOVERY_TOKEN` | 恢复令牌错误 |
| 403 | `MODERATOR_REQUIRED` | 活动管理接口需要 moderator |
| 403 | `LOCATION_OUT_OF_RANGE` | 签到位置不在范围内 |
| 409 | `ACTIVE_CLEANUP_TARGET_NEARBY` | 已有约 10 米内的活动清理目标 |
| 409 | `REMOVED_COUNT_EXCEEDS_REMAINING` | 移除件数大于目标剩余件数 |
| 409 | `CLEANUP_TARGET_COMPLETE` | 目标已经清零 |
| 409 | `IDEMPOTENCY_CONFLICT` | 幂等键与已提交的不同请求冲突 |
| 409 | `JOIN_REQUIRED` / `EVENT_CHECKIN_REQUIRED` | 活动相关操作未先加入/签到 |
| 409 | `EVENT_NOT_ACTIVE` / `EVENT_CLOSED` | 活动当前不接受签到或清理关联 |

## 海滩注意度

`GET /beaches` 和 `GET /beaches/{id}` 保持原响应字段。Iteration 2 有至少三条最近 90 天 `Counted` 报告时，注意度改为：按类别加总**所有仍未清理的件数**，每个类别依上述阈值转档，套用现有类别权重和档位权重，再取最高类别分数。清理后这个值会即时下降；所有计数目标清零时为 0（Low）。不足三条时仍返回 `severity: null`、`band: null`、`attentionScore: null`。只有旧版档位、没有真实件数的历史数据仍使用 Iteration 1 的中位数算法；有真实件数时不将未知历史档位伪造成件数。

## 部署配置

- `GEO_PRIVACY_HMAC_KEY`：生产必须配置的随机服务端密钥，保持稳定；数据库只保存 HMAC 网格引用。未配置时本地开发回退到 JWT 密钥派生值。
- `LITTER_MODEL_PATH`：可选，默认指向 `actual-project/ml-model/models/sea_taco_yolo11m_best.pt`。
- `LITTER_MODEL_VERSION`：可选，默认 `sea-taco-yolo11m-best/1`。
- `requirements-ml.txt` 安装 YOLO 依赖。当前仓库权重用 Git LFS 管理；需要先取回 LFS 文件。权重缺失或依赖未安装时 API 仍启动，但识别返回 `unavailable`，前端应让参与者人工录入。
- `MODERATOR` 通过 `scripts/provision_moderator.py` 创建，普通用户不能自行更改 `role`。

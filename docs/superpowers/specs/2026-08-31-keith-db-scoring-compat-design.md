# Keith 数据库变更与评分兼容修复设计

## 目标

将 Keith 的数据库连接与迁移成果安全合并到当前 `main`，同时保留已经部署的 Radar Sampah 前端契约和 New Scoring Model。

## 当前问题

Keith 的 `feature/add-database-connection-2`（`5c274bd`）将运行时表改为 `reports`，并提供从旧 `frontend_reports` 表迁移的逻辑；但该分支基于评分模型合并前的 `e9912cf`，仍使用 mean 评分，报告响应缺少 `categoryScores` 和 `reportScore`。直接合并会与 `main` 的 `7de8fdb` 冲突并回退已部署行为。

## 设计决策

1. 以当前 `main`（Max + Median）为行为基线，在独立修复分支整合 Keith 的迁移代码。
2. 运行时使用 `reports` 表；启动时仅在新表不存在且旧 `frontend_reports` 存在时执行幂等重命名，并回填六个数量列、派生类别和状态。任何同时存在两张表的情况都停止并报错，避免静默分叉数据。
3. 保留 `categoryScores`、`reportScore`、`attentionScore`、`eligibleReportCount` 以及旧 `/api/*` 兼容接口；评分继续按每报告最高类别分数、海滩最近 90 天合格报告中位数计算。
4. PostgreSQL 默认继续使用现有连接的默认 schema；仅在明确设置 `DATABASE_SCHEMA` 时启用 schema 映射，并确保目标 schema 在启动前存在。Render 不因本次合并强制切换现有数据库 schema。
5. 报告响应继续隐藏精确坐标和照片二进制；迁移不删除历史报告。

## 验证边界

- 先新增迁移和评分回归测试并确认失败，再修改后端。
- 后端完整测试、前端 typecheck/test/build 必须通过。
- 本地真实 HTTP 流程验证匿名登录、海滩读取、上传、提交、多类别报告、保存页、My Reports 和修正。
- 推送 `main` 后验证当前 Render 兼容前端/API；若新 `radar-sampah-*.onrender.com` 仍未配置，明确记录而不冒充线上可用。
- 最后更新 Code Walkthrough、QA Question Bank 和 PM context。

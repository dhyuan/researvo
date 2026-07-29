# Feedback 全量缓存实施计划

日期：2026-07-29

设计文档：

- `doc/architecture/2026-07-29-feedback-full-cache-design.md`

## 实施原则

- 保持现有 HTTP 契约。
- 数据库优先，缓存随后同步。
- 读取不按单个 key 回源；缓存不可用时只做全量重建。
- 使用单独的缓存模块封装状态和同步，不让 route handler 直接维护 Map。
- 所有新增 Admin API 复用现有 Admin session 认证。
- 用测试证明缓存就绪后的读取没有 Prisma 调用。

## Terra：后端缓存、统计和 API

### 1. 数据模型和迁移

- 在 `prisma/schema.prisma` 添加 `FeedbackMetric`。
- 新增 migration 创建统计表。
- 固定统计 key 为 `client_thread_cache_queries`。
- 新增 `FeedbackQueryClient`，只保存 `sourceApp + installIdHash`，用于跨重启恢复不同查询客户端数量。

### 2. 全量缓存模块

新增 `lib/feedback/feedbackCache.ts`：

- 定义缓存实体和 snapshot 类型；
- 使用 `globalThis` 保存生产实例内状态；
- 实现 single-flight `ensureFeedbackCacheReady()`；
- 实现构建后原子交换的 `rebuildFeedbackCache()`；
- 提供 app/thread/message 索引读取方法；
- 提供 thread upsert、delete、read-state 和 IP location 更新方法；
- 提供缓存状态快照；
- 测试时提供明确的 reset helper。

全量加载应尽量用一次 Prisma 查询树：

```text
feedbackApp.findMany({
  include: {
    threads: {
      include: {
        messages: { orderBy: createdAt asc }
      }
    }
  }
})
```

统计行可与初始化并行读取。

### 3. 读取服务迁移

重构 `lib/feedback/feedbackService.ts`：

- `findAuthorizedApp`
- `listFeedbackForInstall`
- `getFeedbackDetail`
- `getCurrentFeedbackThread`
- `listFeedbackThreadsForAdmin`
- `getFeedbackThreadForAdmin`

全部从缓存读取。

保持原响应结构、排序、筛选、搜索、分页和 404/401 行为。

### 4. 写后同步

覆盖并测试：

- `submitFeedback`
- `sendUserFeedbackMessage`
- `markFeedbackRepliesRead`
- `markCurrentFeedbackThreadRead`
- `replyToFeedbackAsAdmin`
- `deleteFeedbackThreadAsAdmin`
- `updateAdminFeedbackMessage`
- `updateFeedbackStatusAsAdmin`
- `enrichMessageIpLocation`

DB 成功后更新缓存。缓存同步失败时将缓存标记为未就绪。

### 5. 查询统计

- 在 token 验证通过的 `GET /api/feedback/thread` 中记录查询。
- 200 和业务 404 都计数。
- 每 100 次通过 Prisma `increment` 原子持久化。
- 每五小时对不足 100 次的低流量 pending 数据执行一次 best-effort flush。
- 同一批次使用去重写入持久化新发现的 installId 哈希。
- flush 失败恢复 pending。
- 缓存状态 API 不访问数据库。

### 6. Admin API

新增：

- `GET /api/admin/feedback/cache`
- `POST /api/internal/feedback/cache/rebuild`

两者复用 `isFeedbackAdminAuthorized()`。

### 7. 后端测试

新增或扩展 Vitest：

- single-flight 初始化；
- 全量缓存索引；
- 不存在 installId 的缓存 404；
- 缓存就绪后 GET 不调用 Prisma；
- Admin 筛选/搜索/分页；
- 每条写路径同步缓存；
- IP location 同步；
- 每 100 次持久化；
- 不同 installId 实时去重及跨重启恢复；
- flush 失败恢复 pending；
- 重建成功原子替换；
- 重建失败保留旧快照；
- Admin API 认证和响应。

## Luna：Admin UI 和交互测试

### 1. 缓存状态 UI

修改 `components/feedback-admin/FeedbackInboxClient.tsx`：

- 增加缓存状态类型和 state；
- 从 `GET /api/admin/feedback/cache` 加载状态；
- 在 Admin 页面增加紧凑的缓存状态区域；
- 展示累计客户端查询、thread/message 数量和时间；
- 页面首次加载、可见性恢复及手动刷新时同步刷新状态。

### 2. 手动重建

- 增加“重新加载全部缓存”按钮；
- 点击前确认；
- 调用 `POST /api/internal/feedback/cache/rebuild`；
- 重建期间禁用重复操作；
- 成功后刷新缓存状态、列表和当前详情；
- 使用 toast 展示数量和耗时；
- 401 时沿用现有登录跳转；
- 错误时保留当前 UI 数据。

### 3. 前端测试

按照仓库现有测试方式覆盖：

- 正常状态展示；
- 加载/错误状态；
- 用户取消确认时不请求；
- 重建成功后的三类刷新；
- 重建失败提示；
- 未授权跳转。

## 主代理：集成和验收

1. 审查 Terra 和 Luna 的修改是否遵守同一 API contract。
2. 处理共享文件冲突和类型差异。
3. 检查缓存同步是否遗漏异步 IP location 路径。
4. 检查所有 Feedback GET 在缓存 ready 后不访问 Prisma。
5. 检查写成功、缓存失败时的降级行为。
6. 运行：

```bash
npm run prisma:generate
npm run lint
npm run test
npm run build
```

7. 根据失败结果修复，直到全部通过。

## 交付文件预期

```text
doc/architecture/2026-07-29-feedback-full-cache-design.md
docs/superpowers/plans/2026-07-29-feedback-full-cache-implementation.md
lib/feedback/feedbackCache.ts
lib/feedback/feedbackService.ts
lib/feedback/ipLocation.ts
app/api/admin/feedback/cache/route.ts
app/api/internal/feedback/cache/rebuild/route.ts
components/feedback-admin/FeedbackInboxClient.tsx
prisma/schema.prisma
prisma/migrations/<timestamp>_feedback_cache_metrics/migration.sql
prisma/migrations/<timestamp>_feedback_unique_query_clients/migration.sql
tests/feedback/*
```

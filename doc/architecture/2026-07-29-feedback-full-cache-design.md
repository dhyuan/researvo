# Feedback 全量缓存与访问统计设计

日期：2026-07-29

## 背景

`ChineseHandCopy` 会在应用首页初始化、进入反馈页面、发送消息后刷新等时机调用 Researvo Feedback API。当前移动端主要查询：

- `GET /api/feedback/thread`

现有后端每次查询都会：

1. 查询 `FeedbackApp` 校验 `sourceApp + token`；
2. 查询 `FeedbackThread` 及其消息。

即使某个 `installId` 从未创建反馈会话，也会访问 Neon。Admin 后台的列表、详情和五分钟定时刷新同样直接访问数据库。

当前反馈数据量很小：

- 现有消息不足 100 条；
- 预计每年最多约 5000 条；
- 当前只服务 `ChineseHandCopy`。

因此，Feedback 数据适合全量加载到缓存，Neon 继续作为唯一持久化数据源。

## 目标

1. 缓存就绪后，所有 Feedback 读取只访问缓存。
2. 普通客户端查询不得因为某个 `installId` 不存在而回源数据库。
3. 所有写操作先提交数据库，再同步缓存。
4. 应用实例启动或缓存不可用时，从数据库全量重建缓存。
5. Admin 可以查看缓存状态、客户端缓存查询次数，并手动触发全量重建。
6. 客户端 API 的现有 HTTP 契约保持不变。

## 非目标

- 不修改 Flutter 的 Feedback API 请求或响应格式。
- 不将缓存作为持久化数据源。
- 不追求客户端查询次数逐次精确持久化。
- 不缓存 Feedback 之外的调查、用户或推送投递数据。

## 部署约束

当前代码是标准 Next.js App Router，生产响应来自 Vercel。仓库中没有自定义 Node server、Docker、PM2 或单实例部署配置。

低流量下 Vercel 通常会复用温热 Node 实例，但不能保证实例永久存在。实现必须满足：

- 缓存可在实例启动后自动重建；
- 重建期间旧缓存继续可用；
- 实例终止时允许丢失不足一个批次的未持久化查询计数；
- 数据库中的统计增量必须使用原子 `increment`，以容忍偶然出现的多个实例。

首版采用进程内全量缓存，以当前低流量和单区域部署为前提。若未来出现多个长期并行实例或多区域部署，再将相同缓存接口替换为共享缓存，不改变业务服务层调用方式。

## 全量缓存模型

新增专用 `FeedbackCache`，不要把缓存逻辑分散在 route handler 中。

缓存快照包含：

```text
FeedbackCacheSnapshot
├── appsBySourceApp
├── threadsById
├── threadIdBySourceAppAndInstallId
├── messageToThreadId
├── loadedAt
├── threadCount
└── messageCount
```

线程对象保存 Admin 所需的完整字段，包括：

- thread 基础字段；
- `userLastReadAt`；
- 全部消息；
- `appVersion`；
- `ipAddress`；
- `ipLocation`。

移动端摘要、完整会话和 Admin 列表均由同一个规范化缓存对象派生，避免维护多份容易失效的数据。

## 初始化和重建

缓存模块提供 single-flight 初始化：

```text
ensureFeedbackCacheReady()
  ├── 缓存 ready：直接返回当前快照
  ├── 已在 loading：等待同一个 Promise
  └── 未初始化：从 DB 全量加载并构建新快照
```

全量重建必须使用“构建后交换”：

1. 保留当前快照；
2. 从 DB 读取全部 `FeedbackApp`、`FeedbackThread` 和 `FeedbackMessage`；
3. 在临时对象中构建并校验新快照；
4. 全部成功后原子替换快照引用；
5. 如果加载失败，继续使用旧快照。

不能先清空旧缓存再读取数据库。

## 读取语义

### 客户端当前会话

`GET /api/feedback/thread`：

```text
缓存未就绪
  → 全量初始化

token 非法
  → 401 INVALID_FEEDBACK_TOKEN

缓存中找到 sourceApp + installId
  → 200 FeedbackThread

缓存中未找到 sourceApp + installId
  → 404 FEEDBACK_NOT_FOUND
  → 不访问 DB
```

这里的 404 是现有业务契约，表示该安装实例尚无反馈会话，不表示缓存 miss。Flutter 已将 404 处理为 `null`，现有测试也锁定该行为。

### 其他读取

以下读取全部改为缓存派生：

- `GET /api/feedback`
- `GET /api/feedback/[feedbackId]`
- `GET /api/admin/feedback`
- `GET /api/admin/feedback/[feedbackId]`

Admin 的筛选、搜索、排序和分页直接在内存中执行。当前规模下无需缓存每个筛选组合。

## 写后同步

Neon 始终是唯一事实来源。所有写操作遵循：

```text
提交 DB transaction
  → DB 成功
  → 刷新或修改受影响的缓存对象
  → 返回 API 响应
```

必须覆盖：

- 用户首次发送反馈；
- 用户追加消息；
- Admin 回复；
- Admin 编辑回复内容；
- Admin 修改状态；
- Admin 删除会话；
- 用户标记 Admin 回复已读；
- IP 地址异步解析完成后更新 `ipLocation`。

实现优先在数据库 transaction 返回足够字段，然后更新缓存。若无法可靠地局部更新，可在写成功后读取受影响 thread 并替换缓存；写请求远少于读请求，这一次数据库读取可以接受。

如果 DB 写成功但缓存同步失败：

1. 不回滚已提交的 DB 数据；
2. 将缓存标记为未就绪；
3. 下一次 Feedback 读取触发全量重建；
4. 记录服务器错误日志。

## 客户端缓存查询统计

只统计高频启动查询：

- `GET /api/feedback/thread`

计数条件：

- 参数合法；
- token 合法；
- 请求通过已经就绪或刚初始化完成的全量缓存处理。

以下都计数：

- 返回 200 的已有会话；
- 返回 404 的不存在会话，因为该请求同样避免了数据库查询。

以下不计数：

- 参数错误；
- token 非法；
- Admin API；
- 写请求；
- 手动缓存重建。

### 批量持久化

新增单行统计模型：

```prisma
model FeedbackMetric {
  key       String   @id
  total     BigInt   @default(0)
  updatedAt DateTime @updatedAt
}
```

固定 key：

```text
client_thread_cache_queries
```

内存维护：

- `persistedTotal`
- `pendingCount`
- `lastPersistedAt`
- 串行化的 flush Promise

每次有效查询将 `pendingCount` 加一。达到 100 后：

1. 捕获当前批次数量；
2. 将内存 pending 清零；
3. 使用 Prisma 原子 `increment` 写入数据库；
4. 更新内存中的 `persistedTotal` 和 `lastPersistedAt`；
5. 写入失败时把批次数量加回 pending，并记录错误。

进程意外结束最多丢失 99 次，因此该统计是近似累计值。Admin UI 应使用“约”或“已累计”的表述，不宣传为审计级精确数据。

## Admin API

### 获取缓存状态

```text
GET /api/admin/feedback/cache
```

必须复用现有 Admin session 认证。

响应：

```json
{
  "status": "ready",
  "clientQueryCount": 12337,
  "persistedClientQueryCount": 12300,
  "pendingClientQueryCount": 37,
  "appCount": 1,
  "threadCount": 82,
  "messageCount": 146,
  "loadedAt": "2026-07-29T10:00:00.000Z",
  "lastPersistedAt": "2026-07-29T09:52:00.000Z",
  "rebuilding": false
}
```

该接口先调用 `ensureFeedbackCacheReady()`。缓存已经就绪时只读内存；尚未初始化时执行一次全量加载，从而保证 Admin 首次打开页面就能看到有效状态。它不会执行按 thread 或按 `installId` 的零散回源查询。

### 手动全量重建

```text
POST /api/internal/feedback/cache/rebuild
```

要求：

- 复用现有 Admin session 认证；
- 防止并发重建；
- 不重置查询次数；
- 失败时保留旧快照；
- 返回加载数量和耗时。

成功响应：

```json
{
  "ok": true,
  "appCount": 1,
  "threadCount": 82,
  "messageCount": 146,
  "durationMs": 127,
  "rebuiltAt": "2026-07-29T10:30:00.000Z"
}
```

## Admin 页面

在 `/admin/feedback` 增加缓存状态区域：

- 缓存状态；
- 客户端缓存查询累计次数；
- thread 数量；
- message 数量；
- 最近加载时间；
- 最近统计持久化时间；
- “重新加载全部缓存”按钮。

点击重建按钮时：

1. 显示确认对话；
2. 禁用按钮并展示加载状态；
3. 调用重建 API；
4. 成功后刷新缓存状态、Admin 列表和当前详情；
5. toast 显示 thread/message 数量和耗时；
6. 失败时保留现有页面数据并展示错误。

## 可观测性

缓存状态至少记录：

- 初始化/重建开始和结束；
- 重建耗时；
- thread/message 数量；
- 缓存同步失败；
- 统计批量持久化失败。

不得记录 Feedback token、完整消息正文或用户 IP 到普通日志。

## 验收标准

1. 缓存就绪后，所有 Feedback GET 不调用 Prisma。
2. 不存在的 `installId` 从缓存直接返回现有 404 契约。
3. 每条写路径之后，移动端和 Admin 读取立即看到新数据。
4. IP 地址解析完成后 Admin 缓存内容同步更新。
5. 并发初始化只执行一次全量 DB 加载。
6. 重建失败时旧缓存仍可读取。
7. 每 100 次有效客户端缓存查询使用一次原子数据库增量。
8. Admin 可以查看状态并手动重建。
9. Flutter 端无需修改。

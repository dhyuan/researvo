# Admin PWA 与 Web Push 实施计划

> 对应 PRD：[`doc/pdd/2026-07-23-admin-pwa-push-prd.md`](../../../doc/pdd/2026-07-23-admin-pwa-push-prd.md)
>
> 实施状态：代码、迁移和自动化测试已完成；生产 VAPID、HTTPS 调度器与 Android/iOS/桌面真机验收待部署环境执行。

## 1. 技术方案摘要

推荐采用“事务内写 Push Outbox + 提交后立即尝试派发 + 定时任务补偿”的方案：

```text
用户消息 API
  -> Prisma 事务：写 FeedbackMessage + PushEvent
  -> 事务提交
  -> best-effort 触发 dispatcher（不阻塞消息成功）
  -> Web Push Service
  -> /admin/sw.js 收到 push
  -> showNotification()
  -> 点击后 /admin/feedback?thread=<id>

定时 dispatcher
  -> 扫描 pending/retry PushEvent
  -> 补发因进程中断或临时网络错误遗漏的事件
```

这比直接在请求事务中调用 Push Service 更可靠：消息写入与“需要推送”保持原子性，外部 Push Service 故障不会影响用户提交反馈。部署平台必须提供每分钟级调度器；若暂时没有调度能力，可以先启用提交后的立即派发，但不能把这种模式宣称为可靠补偿。

Service Worker 只负责 Push、通知点击、客户端消息和可选 Badge，不实现 Admin 数据离线缓存。

PWA 是现有 `/admin/feedback` 的安装与通知外壳，不是另一套应用。安装模式和普通浏览器模式共用 `FeedbackInboxClient`、`AdminLogin`、Admin Session API、Feedback API 与 `feedbackService`；不得复制收件箱、会话、回复或认证逻辑。

## 2. 预期文件变更

### 新增

- `app/admin/layout.tsx`
- `app/admin/manifest.webmanifest/route.ts` 或等价的 Admin 专属静态 Manifest
- `public/admin/sw.js`
- `public/admin/icons/admin-192.png`
- `public/admin/icons/admin-512.png`
- `public/admin/icons/admin-maskable-512.png`
- `public/admin/icons/apple-touch-icon.png`
- `public/admin/icons/notification-icon.png`
- `components/feedback-admin/PushNotificationControl.tsx`
- `lib/push/pushConfig.ts`
- `lib/push/pushSubscriptions.ts`
- `lib/push/pushOutbox.ts`
- `lib/push/pushDispatcher.ts`
- `app/api/admin/push/public-key/route.ts`
- `app/api/admin/push/subscriptions/route.ts`
- `app/api/admin/push/test/route.ts`
- `app/api/internal/push/drain/route.ts`（或部署平台等价任务入口）
- `prisma/migrations/<timestamp>_admin_web_push/migration.sql`
- `tests/push/*`

### 修改

- `prisma/schema.prisma`
- `lib/feedback/feedbackService.ts`
- `components/feedback-admin/FeedbackInboxClient.tsx`
- `components/feedback-admin/AdminLogin.tsx`
- `app/api/admin/session/route.ts`
- `.env.example`
- `README.md`
- `next.config.mjs`
- `package.json`
- 部署调度配置文件（平台确定后）

Manifest 路径最终必须是 `/admin/manifest.webmanifest`，Service Worker 路径必须是 `/admin/sw.js`。如果 Next.js 路由方式不能稳定返回正确 Content-Type 或缓存头，优先使用 `public/admin/` 静态文件。

## 3. 环境变量与依赖

新增服务端变量：

```dotenv
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com
PUSH_DISPATCH_SECRET=
ADMIN_WEB_PUSH_ENABLED=false
```

要求：

- 使用同一组长期 VAPID 密钥；私钥不可带 `NEXT_PUBLIC_`。
- `WEB_PUSH_VAPID_SUBJECT` 使用可联系的 `mailto:` 或 HTTPS URL。
- 公钥通过已认证 API 返回，不需要写入客户端构建环境。
- 引入维护中的标准 Web Push 服务端库，并锁定版本；生成密钥的命令写入 README。
- `.env.example` 一并补充现有文档已使用但尚未列出的 `FEEDBACK_ADMIN_TOKEN`，不得提交任何真实 Token 或 VAPID 私钥。
- `package.json` 增加 Web Push 依赖、所需类型和生产迁移脚本（例如 `prisma migrate deploy`）。
- 启动时验证密钥成对存在。未配置时消息系统继续工作，Admin 显示“服务端未配置推送”。

## 4. 数据模型

建议新增：

```prisma
model AdminPushSubscription {
  id                 String   @id @default(cuid())
  endpoint           String   @db.Text
  endpointHash       String   @unique
  p256dh             String   @db.Text
  auth               String   @db.Text
  expirationTime     BigInt?
  userAgent          String?  @db.Text
  adminAuthVersion   String
  status             String   @default("active")
  failureCount       Int      @default(0)
  lastSuccessAt      DateTime?
  lastFailureAt      DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([status, adminAuthVersion])
  @@map("admin_push_subscriptions")
}

model FeedbackPushEvent {
  id             String   @id @default(cuid())
  feedbackId     String
  messageId      String   @unique
  eventType      String   @default("user_feedback_message")
  status         String   @default("pending")
  attemptCount   Int      @default(0)
  nextAttemptAt  DateTime @default(now())
  lockedAt       DateTime?
  deliveredAt    DateTime?
  lastErrorCode  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([status, nextAttemptAt])
  @@map("feedback_push_events")
}

model FeedbackPushDelivery {
  id             String   @id @default(cuid())
  eventId        String
  subscriptionId String
  status         String   @default("pending")
  attemptCount   Int      @default(0)
  deliveredAt    DateTime?
  lastErrorCode  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([eventId, subscriptionId])
  @@index([eventId, status])
  @@map("feedback_push_deliveries")
}
```

说明：

- `messageId @unique` 是业务幂等键，确保每条用户消息只入队一次。
- `endpointHash` 是 endpoint 的 SHA-256，用作定长唯一索引，避免直接对可能很长的 endpoint 建唯一索引；endpoint 原文仍用于实际投递。
- Subscription 不关联普通 `User`，因为现有后台是共享 `FEEDBACK_ADMIN_TOKEN` 会话。
- `adminAuthVersion` 是服务端根据当前 Admin Token 生成的不可逆版本指纹，不保存 Token；Token 轮换后只投递当前版本订阅。
- 如果 Prisma/数据库对 `BigInt` JSON 序列化造成额外负担，可把 `expirationTime` 保存为 `String?` 或 `DateTime?`。
- `FeedbackPushDelivery` 记录 event×subscription 的投递状态。事件重试时跳过已成功或永久失败的设备，只重发临时失败设备，避免一台设备失败导致其他设备重复收到通知。

## 5. 分阶段任务

### Phase 0：部署前置与设计确认（0.5 天）

- [ ] 确认生产域名和 HTTPS 已启用。
- [ ] 确认部署平台支持定时调用受保护的 drain endpoint，目标周期 1 分钟。
- [ ] 确认出站网络允许浏览器 Push endpoint；iOS 相关网络策略允许 `*.push.apple.com`。
- [ ] 生成并安全保存 VAPID 密钥与 dispatcher secret。
- [ ] 以现有 Researvo Admin 视觉生成 192、512、maskable、Apple Touch 和单色通知图标。
- [ ] 确认 P0 默认通知文案和 5 分钟轮询间隔。

完成标准：staging HTTPS、环境变量保存位置、定时任务能力和图标源文件均明确。

### Phase 1：Admin PWA 外壳（1 天）

- [ ] 新增 `app/admin/layout.tsx`，只在 Admin tree 合并 Manifest、theme color、Apple Web App 和图标 metadata。
- [ ] 创建 `/admin/manifest.webmanifest`，写入 PRD 中固定的 `id/name/short_name/start_url/scope/display`。
- [ ] 新增 `/admin/sw.js`，先实现 install/activate、`skipWaiting`、`clients.claim` 和版本日志。
- [ ] 在 `next.config.mjs` 为 `/admin/sw.js` 设置 `Cache-Control: no-cache`（或 `max-age=0, must-revalidate`），避免长期受旧 Worker 控制。
- [ ] 在 Admin 客户端组件中注册 `/admin/sw.js`，显式传入 `{ scope: "/admin/" }`。
- [ ] 不注册 fetch handler；若未来增加，Admin HTML/API 默认 network-only 且不落 Cache Storage。
- [ ] 添加 Manifest 与 Service Worker scope 的自动化检查。

完成标准：Admin 可安装；普通页面 head 中无 Admin Manifest；DevTools 显示 SW scope 仅为 `/admin/`。

### Phase 2：订阅模型与受保护 API（1.5 天）

- [ ] 增加 Prisma models、migration 和 repository/service 层。
- [ ] 实现 VAPID 配置校验、公钥读取和 Admin Token 版本指纹。
- [ ] 实现 `GET /api/admin/push/public-key`：
  - 要求 Admin 会话；
  - 返回公钥与 `configured`；
  - 不返回任何私钥或订阅详情。
- [ ] 实现 `POST /api/admin/push/subscriptions`：
  - Zod 校验 endpoint、keys 和 expiration；
  - endpointHash 幂等 upsert；
  - 重置为 active 并记录当前 auth version；
  - 限制 body 大小，禁止敏感字段日志。
- [ ] 实现 `DELETE /api/admin/push/subscriptions`：
  - 要求 Admin 会话；
  - 只删除/禁用提交的当前 endpoint；
  - 重复删除仍返回成功。
- [ ] 实现受限的测试通知 API，只投递当前设备，增加基础速率限制。
- [ ] 对 POST/DELETE/test 等变更请求校验同源 `Origin`，作为现有 SameSite Cookie 之外的 CSRF 纵深防御。
- [ ] 为所有 API 覆盖 401、配置缺失、校验失败、幂等和删除测试。

完成标准：已登录浏览器可以创建、刷新、测试和删除唯一订阅；未登录请求全部为 401。

### Phase 3：通知设置 UI 与平台引导（1.5 天）

- [ ] 新增 `PushNotificationControl` 并放入 Admin 顶栏或侧栏的可发现位置。
- [ ] 仅在点击“开启新消息提醒”后调用 `requestPermission()`。
- [ ] 实现 Base64URL VAPID 公钥转换和 `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`。
- [ ] 页面初始化时读取 `registration.pushManager.getSubscription()`，与服务端幂等同步。
- [ ] 实现 unsupported、insecure、default、denied、subscribing、enabled、server-misconfigured 状态。
- [ ] iOS 非 standalone 时展示“分享 → 添加到主屏幕 → 从图标打开 → 再开启提醒”。
- [ ] “关闭提醒”先通知服务端，再调用 `unsubscribe()`；任一步失败都给出可恢复提示。
- [ ] 主动退出时尽力注销当前设备订阅；注销失败不能阻止清除登录 Cookie，但需明确提示可能仍收到通用提醒。

完成标准：权限不会自动弹出；各状态可恢复；Android、iOS 主屏幕和桌面文案符合 PRD。

### Phase 4：事务 Outbox 与推送派发（2 天）

- [ ] 重构 `submitFeedback` 和 `sendUserFeedbackMessage`，在同一个 Prisma 事务内：
  - 创建用户消息；
  - 获得 `feedbackId` 和 `messageId`；
  - 以 `messageId` 幂等创建 `FeedbackPushEvent`。
- [ ] 确保旧接口响应字段保持兼容；为两个入口增加 outbox 测试。
- [ ] 实现 dispatcher：
  - 小批量领取到期 pending/retry 事件；
  - 只读取 active 且 auth version 当前的订阅；
  - payload 不含正文；
  - 对全部订阅 `Promise.allSettled`，设置并发上限和单次超时；
  - 404/410 订阅立即 invalidated；
  - 429/5xx/网络错误指数退避并加入抖动；
  - 单个订阅失败不阻断其他订阅；
  - 使用 `FeedbackPushDelivery` 逐设备幂等，重试不重复发送已成功设备；
  - 没有 active subscription 时把事件标记为 completed/no_recipients。
- [ ] 处理 worker 并发：
  - 使用数据库行锁/原子状态更新领取事件；
  - 设置 stale lock 恢复时间；
  - dispatcher 重入不产生重复领取。
- [ ] 消息事务提交后 best-effort 调用 dispatcher；调用失败只记录事件，不改变反馈 API 响应。
- [ ] 新增受 `PUSH_DISPATCH_SECRET` 保护的定时 drain endpoint，并设置最大运行时间与批量上限。
- [ ] 配置部署平台每分钟调用。

建议 payload：

```json
{
  "v": 1,
  "eventId": "push_event_id",
  "feedbackId": "feedback_thread_id",
  "url": "/admin/feedback?thread=feedback_thread_id",
  "title": "Researvo Admin",
  "body": "收到 1 条新的用户反馈",
  "badgeCount": 1
}
```

完成标准：数据库提交与事件入队原子；外部 Push 故障不影响反馈写入；临时失败可由定时任务恢复。

### Phase 5：Service Worker 持久通知与深链（1 天）

- [ ] 在 `push` 事件中安全解析版本化 payload；数据缺失时仍展示通用通知并打开收件箱。
- [ ] 使用 `registration.showNotification()`，设置通用 title/body、icon、badge、`tag: feedback:<id>` 和 `data.url`。
- [ ] 使用 `event.waitUntil()` 覆盖异步通知流程。
- [ ] 在 `notificationclick` 中校验目标 URL 必须是同源 `/admin/`。
- [ ] 优先匹配并聚焦现有 Admin client，再 `navigate()`；没有窗口时 `clients.openWindow()`。
- [ ] 通过 `postMessage` 通知已打开页面立即刷新。
- [ ] 修改 `FeedbackInboxClient`：
  - 从 `searchParams` 读取 `thread`；
  - 列表加载后优先选中该 ID；
  - 当前筛选隐藏目标时仍按 ID加载详情，或切换到可见状态；
  - 不存在时提示并清理无效参数。
- [ ] 修改登录流程，保存并校验 `/admin/*` 的 `next`，登录后恢复深链。
- [ ] 防止 `javascript:`、`//host`、编码绕过和非 Admin 路径开放重定向。

完成标准：关闭页面后可显示持久通知；点击能在有效/过期会话两种情况下到达目标反馈。

### Phase 6：页面轮询兜底与 Badge（P0 0.5 天，P1 另计）

- [ ] 页面 visible 且 authorized 时每 5 分钟调用现有 `loadInbox()`。
- [ ] hidden 时清除 timer；visible、focus、online 时立即刷新。
- [ ] 失败后按 5/10/20 分钟退避，成功后恢复 5 分钟。
- [ ] 避免轮询、筛选和手动刷新产生并发旧响应覆盖，可使用 AbortController 或请求序号。
- [ ] SW `postMessage` 到达时立即刷新，但做短时间去抖。
- [ ] P1：计算 Admin 待回复线程数，在页面与 push event 中调用 `setAppBadge()`，为 0 时 `clearAppBadge()`；API 不支持时静默跳过。

完成标准：关闭 Push 后仍能在最多约 5 分钟内看到新消息，隐藏页面不持续轮询。

### Phase 7：验证、观测与发布（1 天）

- [ ] 单元测试：VAPID key 转换、payload 最小化、URL 白名单、重试分类、auth version。
- [ ] Service 测试：两个消息入口事务入队、messageId 幂等、失败不产生孤儿事件。
- [ ] API 测试：认证、Zod、upsert、unsubscribe、test push 速率限制、drain secret。
- [ ] Dispatcher 测试：成功、部分失败、404/410 清理、429/5xx 重试、无订阅、并发领取。
- [ ] 浏览器测试：Manifest 只在 Admin、SW scope、按钮手势、深链参数、登录恢复、轮询 visibility。
- [ ] staging 真机矩阵：
  - Android Chrome：安装前/安装后、页面关闭、通知点击；
  - iPhone Chrome/Safari，iOS 16.4+：普通标签页引导、添加主屏幕、授权、锁屏通知、点击；
  - 桌面 Chrome：前台、后台、关闭 Admin 标签页；
  - 权限 denied、系统通知关闭、离线恢复、订阅过期。
- [ ] 验证 `/workspace`、`/surveys` 和公开问卷不受 SW 控制。
- [ ] 增加结构化日志和 PRD 指标，不记录 endpoint、keys、正文或 Token。
- [ ] 先在 staging 使用单个管理员设备观察 24 小时，再小范围生产启用。

完成标准：PRD 全部 P0 验收项通过，回滚步骤完成演练。

## 6. 测试用例重点

| 场景 | 预期 |
|---|---|
| 首次用户反馈 | 写消息与 PushEvent 同时成功，通知一次 |
| 会话内追加消息 | 同上，深链为原 feedbackId |
| 数据库事务失败 | 无消息、无 PushEvent |
| Push Service 5xx | 消息接口成功，事件进入 retry |
| Push endpoint 410 | 当前订阅 invalidated，其他设备继续收到 |
| 同一 endpoint 重复订阅 | 数据库只有一条 active 记录 |
| Admin Cookie 过期 | 仍可收到通用通知，点击要求登录 |
| Admin Token 轮换 | 旧 Cookie 失效，旧 auth version 订阅不投递 |
| iOS 普通标签页 | 不请求权限，展示主屏幕安装说明 |
| 通知 payload URL 被篡改 | 只能打开同源 `/admin/` 默认页 |
| Push 不支持 | 无报错循环，5 分钟轮询继续 |
| 普通页面打开 | 无 Admin Manifest，未被 `/admin/` SW 控制 |

## 7. 可靠性与重试策略

- 事件领取批次建议 50，订阅发送并发建议 10；最终以压测结果调整。
- 临时失败建议 1、5、15、60 分钟退避，最多 8 次；加入随机抖动。
- 404/410 是永久订阅失效，不重试该订阅。
- 401/403 通常表示 VAPID/配置问题，应记录告警并停止无意义高频重试。
- 事件只有在所有当前目标都成功、永久失效或不存在目标时完成；临时失败则保留 retry。
- Push 消息可能由平台重复投递，Service Worker 用 `tag` 折叠；业务端仍以 `messageId` 保证事件唯一。
- drain endpoint 必须限制单次运行时间，避免 serverless 超时；剩余事件留给下一轮。

## 8. 安全检查清单

- [ ] 所有 Admin Push API 调用 `isFeedbackAdminAuthorized()`。
- [ ] drain endpoint 使用独立 secret，使用 timing-safe 比较。
- [ ] VAPID 私钥和 Subscription keys 不进入客户端日志、服务端普通日志或 analytics。
- [ ] Subscription request 有 schema、长度限制和协议检查（仅 HTTPS endpoint，localhost 测试除外）。
- [ ] Cookie 认证的订阅变更请求校验同源 Origin。
- [ ] 通知 payload 无反馈正文、sourceApp、installId、device、IP。
- [ ] 深链只接受同源 `/admin/*`。
- [ ] Admin API 和页面不进入 Cache Storage。
- [ ] 主动退出尽力撤销当前设备订阅。
- [ ] Token/VAPID 轮换流程写入 runbook。

## 9. 运维与回滚

### 监控

- pending/retry 事件数量和最老事件年龄；
- Push Service 接受率、错误码分布和 P95 派发延迟；
- active/invalidated 订阅数；
- dispatcher 调度遗漏或连续失败；
- VAPID 配置错误。

### 回滚顺序

1. 关闭 dispatcher 定时任务和提交后立即派发开关。
2. 保留反馈消息写入和页面轮询。
3. 发布一个新的 SW 版本，不再处理 push，但继续安全处理 notification click。
4. Manifest 可继续保留，不影响主站；必要时从 Admin layout 移除。
5. PushEvent/Subscription 表暂不删除，待确认无需恢复后再单独迁移清理。

推送功能必须有服务端 feature flag，例如 `ADMIN_WEB_PUSH_ENABLED`。关闭 flag 时不再创建新事件/派发，Admin UI 显示不可用，反馈主流程保持正常。

## 10. 交付定义

以下条件全部满足才视为完成：

- PRD 的所有 P0 验收标准通过；
- Prisma migration 可在空库和现有库执行；
- lint、unit、build 和已有回归测试通过；
- staging HTTPS 上完成 Android、iOS 主屏幕和桌面 Chrome 真机验证；
- 生产 VAPID、dispatcher secret、调度器、监控和告警已配置；
- README/runbook 说明密钥生成、轮换、设备重新订阅、故障排查和回滚；
- 未发现 Admin 之外的路由被 Service Worker 控制或缓存。

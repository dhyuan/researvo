# Researvo Admin PWA 与新反馈推送 PRD

- 状态：Implemented；等待部署启用与真机 Push 验收
- 日期：2026-07-23
- 范围：仅 `/admin/*`
- 产品名称：Researvo Feedback Admin
- 关联实施计划：[`docs/superpowers/plans/2026-07-23-admin-pwa-push-implementation.md`](../../docs/superpowers/plans/2026-07-23-admin-pwa-push-implementation.md)

## 1. 决策摘要

把现有 `/admin` 反馈后台做成一款独立、可安装的 PWA，并使用标准 Web Push：服务器在收到新的用户反馈消息后，通过 Push Service 唤醒 `/admin/` scope 下的 Service Worker，再由 Service Worker 创建持久系统通知。

采用以下产品决策：

1. PWA 仅覆盖 `/admin/*`，不影响 `/workspace`、`/surveys`、公开问卷或其他普通页面。
2. 通知权限只能由管理员点击“开启新消息提醒”后申请，不在页面加载时弹出。
3. 锁屏通知不包含反馈正文、来源应用、设备或用户标识，只显示：
   - 标题：`Researvo Admin`
   - 正文：`收到 1 条新的用户反馈`
4. 点击通知打开 `/admin/feedback?thread=<feedbackId>`。会话有效时直接选中对应反馈；会话过期时先进入登录页，认证后回到原会话。
5. Push Subscription 持久保存到服务端；Cookie 自然过期不会取消订阅，点击通知仍必须重新认证。
6. 管理员主动“关闭提醒”或退出后台时，注销当前设备的订阅。管理 Token 轮换后，旧 Token 版本创建的订阅停止投递。
7. 保留页面内轮询作为兜底：页面可见时每 5 分钟刷新，重新聚焦或恢复网络时立即刷新。
8. P0 使用持久通知；应用图标 Badge 列为 P1，数据和 Service Worker 协议在 P0 预留。
9. 生产环境必须使用 HTTPS。开发环境只把 `localhost`/`127.0.0.1` 视为安全上下文，手机访问局域网 HTTP 地址不属于该例外。
10. PWA 与浏览器中的 `/admin/feedback` 共用现有 UI、认证、API 和反馈业务逻辑，不维护第二套后台；PWA 只增加可安装外壳与后台通知能力。

## 2. 背景与现状

当前仓库是 Next.js 16 App Router + Prisma/PostgreSQL：

- `/admin` 重定向到 `/admin/feedback`。
- `/admin/feedback` 使用独立的 `FEEDBACK_ADMIN_TOKEN` 登录，不复用普通 Researvo 账号。
- 后台认证保存在 HttpOnly、SameSite=Strict、生产环境 Secure 的 Cookie 中，有效期 12 小时。
- 新用户消息有两个写入入口：
  - `POST /api/feedback`：首次提交或兼容入口；
  - `POST /api/feedback/thread/messages`：已有会话追加消息。
- 后台列表目前在进入页面、筛选变化和手动点击刷新时拉取，没有定时轮询。
- 仓库目前没有 Admin 专属 layout、Web App Manifest、图标、Service Worker、Push Subscription 数据表或推送服务。

浏览器页面内的 `new Notification()` 属于非持久通知，生命周期与页面相关；移动端需要由 Service Worker 调用 `showNotification()` 创建持久通知。通知权限还必须在用户手势中申请。[MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

iOS/iPadOS 16.4 起支持主屏幕 Web App 的 Web Push。第三方浏览器可以把网站添加到主屏幕，但推送权限应从已安装并由主屏幕启动的 Web App 内申请。[WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

## 3. 目标与非目标

### 3.1 目标

- Android Chrome 在管理员授权后，即使 Admin 页面关闭也能收到新反馈通知。
- iPhone/iPad 在将 Admin 添加到主屏幕并从主屏幕启动后，可以授权并收到通知。
- 桌面 Chrome 在浏览器运行且系统允许通知时可以收到。
- 安装入口、Manifest 和 Service Worker 都只属于 Admin。
- 每条新用户消息成功写入数据库后，可靠地产生一次推送事件。
- 通知点击能定位到正确反馈会话，同时不绕过后台认证。
- Push 不可用、被拒绝或投递失败时，Admin 页面仍通过轮询看到新消息。

### 3.2 非目标

- 不把整个 Researvo 站点改造成 PWA。
- P0 不提供完整离线后台；反馈内容和认证接口不进入离线缓存。
- 不向普通用户设备发送管理员回复通知。
- 不在锁屏通知中展示反馈正文或可识别用户的信息。
- 不保证浏览器或操作系统被用户强制结束后仍能投递；最终行为受平台 Push Service、系统省电和通知设置影响。
- 不用 PWA 安装或 Push Subscription 代替管理员认证。

## 4. 目标用户与用户故事

主要用户是需要及时处理跨应用反馈的 Researvo 管理员。

- 作为移动端管理员，我希望安装独立的 Admin 应用，以便从桌面直接进入反馈收件箱。
- 作为管理员，我希望明确点击后才申请通知权限，避免意外打扰或误授权。
- 作为管理员，我希望页面关闭后仍收到新反馈提醒。
- 作为管理员，我希望点击提醒后直接进入对应会话。
- 作为重视隐私的管理员，我希望锁屏只显示存在新反馈，而不暴露正文。
- 作为使用 iPhone 的管理员，我希望产品明确告诉我必须先添加到主屏幕再开启提醒。
- 作为无法使用 Push 的管理员，我仍希望打开页面时自动看到最新消息。

## 5. PWA 配置

Manifest 的核心配置固定为：

```json
{
  "id": "/admin/",
  "name": "Researvo Feedback Admin",
  "short_name": "Researvo Admin",
  "start_url": "/admin/feedback",
  "scope": "/admin/",
  "display": "standalone"
}
```

还需补充 `theme_color`、`background_color`，以及 192×192、512×512 和 maskable 图标。iOS 额外提供 180×180 `apple-touch-icon`。

Manifest 只在 Admin layout 中引用。Service Worker 从 `/admin/sw.js` 注册并限定 `scope: "/admin/"`。Service Worker 不拦截或缓存普通站点页面，也不缓存 Admin API 响应、Token、Cookie 或反馈正文。

安装后的 PWA 仍然渲染现有 `FeedbackInboxClient`，调用现有 `/api/admin/feedback*` 和 `/api/admin/session` 接口。筛选、会话详情、回复、状态变更和登录页面均直接复用，新增代码不复制这些界面或业务逻辑。

## 6. 核心体验

### 6.1 安装

- Android/桌面：浏览器满足可安装条件时，展示非阻塞的“安装 Admin 应用”入口；用户也可使用浏览器菜单安装。
- iOS/iPadOS：检测为 iOS 且不在 standalone 模式时，展示“先添加到主屏幕”的操作说明，不直接请求通知权限。
- 已安装/standalone：不再显示安装引导，显示通知状态入口。
- 不支持安装但支持 Push 的桌面浏览器：允许开启通知，不强制安装。

### 6.2 开启提醒

按钮文案：`开启新消息提醒`

点击后的顺序：

1. 检查 HTTPS、安全上下文、Service Worker、PushManager 和 Notifications API。
2. iOS/iPadOS 若不在主屏幕 Web App 中，停止并展示安装说明。
3. 调用 `Notification.requestPermission()`。
4. 授权成功后，用 VAPID 公钥创建或读取 Push Subscription。
5. 把 Subscription 保存到服务端。
6. 显示 `新消息提醒已开启`，并允许管理员发送一次不含业务数据的测试通知。

状态必须区分：

| 状态 | 界面行为 |
|---|---|
| 未开启 | 显示主按钮 |
| 请求中 | 按钮禁用，显示进度 |
| 已开启 | 显示设备已订阅，可关闭/测试 |
| 权限被拒绝 | 不重复弹权限框，说明如何在系统设置中恢复 |
| iOS 未安装 | 展示“添加到主屏幕”步骤 |
| 浏览器不支持 | 明确告知仍会使用页面自动刷新 |
| 非安全上下文 | 提示必须通过 HTTPS 访问 |
| 服务端未配置 VAPID | 管理员可见配置错误，不显示成功状态 |

### 6.3 收到新消息

- 每一条 `senderType = "user"` 且已成功提交的消息产生一个唯一推送事件。
- 同一反馈线程的多条通知使用同一个 `tag`，允许系统折叠，避免通知中心堆积。
- 默认通知内容始终为通用隐私文案，不包含消息正文。
- Payload 只包含版本号、事件 ID、反馈线程 ID、目标 URL和可选未读数。
- 页面处于前台时也更新收件箱；可以用页面内 toast 告知新消息，但不依赖 toast 代替系统推送。

### 6.4 点击通知

1. Service Worker 关闭当前通知。
2. 如果已有 `/admin/feedback` 窗口，聚焦该窗口并导航到 `?thread=<feedbackId>`。
3. 否则打开新窗口。
4. 页面读取 `thread` 参数并选中对应会话。
5. 若 Cookie 已过期，跳转到 `/admin/login?next=<encoded-admin-url>`。
6. 登录成功后只允许返回校验通过的 `/admin/*` 路径，避免开放重定向。
7. 会话已不存在时返回收件箱并提示“该会话已不存在或不可访问”。

### 6.5 关闭提醒与退出

- “关闭提醒”删除服务端记录并调用浏览器 Subscription 的 `unsubscribe()`。
- 主动退出后台时执行相同的当前设备注销，再清除 Admin Cookie。
- Cookie 自然过期不取消订阅；这是为了继续提醒管理员有新反馈，但通知仍不泄露内容，点击后要求重新登录。
- VAPID 密钥轮换需要重新订阅；管理 Token 轮换使旧认证版本的订阅失效。

### 6.6 页面内轮询兜底

- 页面可见且已认证时每 5 分钟刷新一次列表。
- 页面隐藏时暂停轮询，避免后台耗电。
- `visibilitychange` 回到前台、窗口重新获得焦点或网络恢复时立即刷新。
- 连续失败采用 5/10/20 分钟退避；认证失败立即进入登录页。
- 手动刷新按钮继续保留。

## 7. 平台支持说明

| 平台 | 产品承诺 |
|---|---|
| Android Chrome | 授权后支持页面关闭时的后台推送；需 HTTPS |
| iPhone/iPad Chrome 或 Safari | iOS/iPadOS 16.4+；必须先添加到主屏幕，从图标启动后再由按钮申请权限 |
| 桌面 Chrome | 浏览器仍在运行、系统与站点通知未被禁用时通常可收到 |
| 不支持 Push 的浏览器 | 不提供系统推送，保留页面自动刷新 |

实现必须采用功能检测，不能仅依赖 User-Agent 判断。iOS 的 standalone 引导可结合 `display-mode: standalone` 和平台特征，仅用于解释体验，不用于决定底层 API 能力。

## 8. 安全、隐私与数据保留

- 所有订阅增删查和测试推送 API 都要求有效 Admin Cookie。
- VAPID 私钥只存在服务端环境变量中；公钥可以下发给已认证客户端。
- Subscription endpoint 和密钥属于敏感凭证，不写日志、不返回到管理列表、不进入分析事件属性。
- 服务端保存 endpoint、`p256dh`、`auth`、可选过期时间、设备提示、最后成功/失败时间、状态及 Admin Token 版本指纹。
- 订阅 endpoint 唯一，重复提交幂等更新。
- Push Service 返回 404/410 时立即禁用或删除订阅；连续永久失败的订阅停止投递。
- 推送 payload 使用 Web Push 标准加密；即使如此，也只发送最小通用数据。
- 不缓存 Admin HTML/API 的私密数据，不提供带反馈内容的离线页面。
- 生产部署设置 HTTPS、合理 CSP，并确认服务端网络允许访问各浏览器提供的 Push endpoint；iOS 环境尤其需要允许 `*.push.apple.com`。

## 9. 成功指标与可观测性

P0 上线后记录不含敏感内容的聚合指标：

- `push_permission_prompted / granted / denied`
- `push_subscription_created / removed / invalidated`
- `push_event_enqueued`
- `push_delivery_succeeded / failed / expired`
- 从消息提交到 Push Service 接受的 P50/P95 延迟
- 通知点击数与点击后成功打开目标会话的比例
- 轮询发现的新消息数，用于观察 Push 漏达

建议目标：

- 具备 Push 能力且主动开启的设备，订阅创建成功率 ≥ 95%。
- 正常订阅的推送事件在 60 秒内被 Push Service 接受的比例 ≥ 99%。
- 同一消息不生成重复推送事件。
- 任何推送失败都不影响用户消息写入 API 的成功响应。

“Push Service 接受”不等于操作系统最终展示，服务端不能把最终展示率作为强 SLA。

## 10. 验收标准

### PWA 隔离

- `/admin/*` 页面包含 Admin Manifest；普通页面不包含。
- 安装后从图标打开 `/admin/feedback`，显示为 standalone。
- Service Worker 的实际 scope 为 `/admin/`，不控制 `/workspace`、`/surveys` 或公开问卷。
- Lighthouse/浏览器安装检查能够识别 Manifest、192/512 图标和 Service Worker。

### 权限与订阅

- 页面加载不自动弹出通知权限。
- 只有已认证管理员主动点击按钮才会请求权限和保存订阅。
- 重复点击或刷新页面不会创建重复数据库记录。
- 拒绝、缺少 HTTPS、不支持 API、iOS 未安装和 VAPID 未配置均有明确状态。
- 关闭提醒和主动退出会注销当前设备订阅。

### 推送

- 两个用户消息入口都会在数据库提交成功后产生一个推送事件。
- 消息数据库事务失败时不产生事件。
- 推送服务失败不回滚或阻塞已成功的用户消息。
- 无效订阅收到 404/410 后不再重试。
- 通知由 Service Worker `showNotification()` 创建，锁屏文案不含反馈正文。

### 深链与认证

- 点击通知进入 `/admin/feedback?thread=<正确 ID>`。
- 已登录时选中对应会话。
- 12 小时会话过期后要求重新输入 `FEEDBACK_ADMIN_TOKEN`，成功后回到原会话。
- `next` 参数不能跳转到站外或非 `/admin/*` 路径。

### 兜底与回归

- 页面可见时按 5 分钟周期刷新，隐藏时暂停，恢复可见时立即刷新。
- Push 完全不可用时，手动刷新和定时刷新仍正常工作。
- `/workspace`、`/surveys`、公开问卷、普通认证和反馈提交接口的既有行为不受影响。

## 11. 发布范围

- P0：Admin Manifest、图标、Service Worker、权限按钮、订阅管理、VAPID、可靠推送、隐私通知、会话深链、轮询兜底、日志与基础指标。
- P1：主屏幕 Badge、未读数同步、管理设备列表、单设备测试通知、通知折叠策略优化。
- P2：按来源应用/时段的通知偏好、免打扰、管理员账号级设备管理。

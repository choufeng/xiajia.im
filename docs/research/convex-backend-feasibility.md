# Convex 作为多端同步后端：可行性分析

> 研究日期：2026-08-31  
> 对象：《21 天成人英语训练营》（`docs/english/training/`，VitePress + Vue 3，部署于 GitHub Pages）  
> 问题：数据目前只存 localStorage，无法多端同步；自建后端 API 又太重。Convex 能否作为后端？

---

## 0. 结论摘要（TL;DR）

**可行，且是当前约束下（GitHub Pages 静态托管 + 不想自建后端）投入产出比最高的方案之一。**

1. **与 GitHub Pages 完全兼容** ✅。Convex 的产品模型就是「前端任意静态托管 + 后端全托管 convex.cloud」，浏览器客户端跨域连接是默认工作方式。Convex 官方 Auth FAQ 原话：*"Convex Auth works with and without a Next.js server, you can use it directly from an SPA hosted on a CDN."*（[FAQ](https://labs.convex.dev/auth/faq)）
2. **零服务器运维** ✅。不用写 API 层——Convex functions（TypeScript）就是后端，`npx convex deploy` 一条命令部署到云端。
3. **免费额度对本项目绰绰有余** ✅。Free 档：0.5 GB 存储、1 GB/月数据库 I/O、100 万次函数调用/月（[Limits](https://docs.convex.dev/production/state/limits)）。本项目数据量级 < 1 MB、月调用 < 1 万次。
4. **最大的坑是认证，不是托管** ⚠️。Convex Auth 的客户端库**只有 React 版**（FAQ 原话：*"We currently only have Convex Auth client libraries for React"*），本项目是 Vue。解法：个人工具不需要完整账号体系——用**配对码（sync key）模式**绕过认证，这是本报告推荐方案（§4.2、§5）。
5. **第二坑是离线** ⚠️。Convex 无离线模式（WebSocket 断线即停）。但现有 localStorage 架构恰好可以保留为「离线主存储 + 在线转发同步」，演进路径自然（§4.3）。
6. **一条安全红线** 🚨：`settings.apiKey`（用户的 DeepSeek BYOK Key）**绝不能同步到云端**，同步层必须显式白名单化 settings（§4.5）。
7. 工作量估计：核心同步层 1～2 个工作日（agent 辅助），改动集中在新增 `sync.js` + CI 两步 + 设置页配对 UI。

---

## 1. 现状盘点

| 项 | 现状 |
|---|---|
| 站点 | VitePress 1.x，Vue 3；GitHub Actions 推 master 自动构建 → GitHub Pages（`.github/workflows/deploy.yml`） |
| 应用形态 | `docs/english/training/index.md` 内嵌单页 Vue 应用（TrainingApp / Generator / Practice / Review） |
| 数据层 | `store.js`：一个 `reactive()` 单例，整块 JSON 存 localStorage（key `xji-english-training-v1`），`watch` 深度监听自动持久化 |
| 数据结构 | `settings`（含 BYOK apiKey 🚨）、`scenarios[]`、`sentences[]`（约 15 个字段：遍数/盲听/跟读/D2·D7·D30 复习/标红…）、`practiceLog{日期:遍数}`、`onboarded` |
| 已有备份手段 | 手动导出/导入 JSON（`exportJSON/importJSON`） |
| 无 | 账号、服务端、任何网络写入路径 |

关键观察：**「整块 JSON + 深度 watch」是单机最优解，但不可直接同步**——多端并发写同一块 JSON 会互相覆盖。同步必须下沉到行级（§5.3）。

---

## 2. Convex 的工作模型（为什么它天生适配静态站）

- **后端即函数**：在 `convex/` 目录写 TS 函数（query / mutation / action），`npx convex dev` 本地开发、`npx convex deploy` 推到云端。数据库、实时订阅、WebSocket 推送都是平台内置，无需写 API 路由。
- **客户端是纯浏览器 JS**：`convex/browser`（`ConvexClient`）通过 WebSocket + HTTPS 连接 `*.convex.cloud`，跨域是默认形态（所有托管在 Vercel/Netlify/GH Pages 上的 Convex 应用都这样连）。前端框架无关——React 只是有额外的 `convex/react` hooks 层。
- **实时订阅开箱即用**：`client.watchQuery(query, args).onUpdate(cb)`——A 端 mutation，B 端回调自动触发。多端同步的「推」这一半是免费的。
- **事务性 mutation**：服务端函数串行执行，计数累加（如 practiceLog）天然原子，不会丢更新。

### 与本项目部署管线的对接（已核对官方文档）

1. 前端构建注入：GitHub Actions 里 `CONVEX_DEPLOY_KEY`（repo secret）+ `npx convex deploy --cmd "npm run build" --cmd-url-env-var-name VITE_CONVEX_URL`——deploy 命令会先把 deployment URL 写进 `VITE_CONVEX_URL` 再跑前端构建（[npx convex deploy 文档](https://docs.convex.dev/cli/reference/deploy)）。也可以拆开做：把 prod deployment URL 作为 repo secret 直接注入前端构建的 `env`。
2. 现有 `deploy.yml` 只需在 build 步骤前加一步 convex deploy（或仅注入 `VITE_CONVEX_URL`），Pages 发布流程完全不动。
3. `convex/browser` 的包导出带 Node/browser 条件变体（`dist/…/simple_client-node.js`），VitePress 构建期 SSR 可以安全 import；**但 client 实例化必须放 `onMounted` 里**（构建期 Node 环境没有 `window`，也不应在 build 时连网）。

---

## 3. 免费额度 vs 本项目量级

| 资源 | Free 档上限 | 本项目预估（2～3 端重度使用） | 结论 |
|---|---|---|---|
| 数据库存储 | 0.5 GB | 句子库 500 句 × ~500 B ≈ 250 KB，加场景/日志 < 1 MB | 用了 0.2% |
| 数据库 I/O | 1 GB/月 | 每次订阅全量拉 < 1 MB × 每天几百次 ≈ < 100 MB/月 | < 10% |
| 函数调用 | 100 万/月 | 订阅更新 + mutation 约 1 万/月 | ~1% |

（来源：[Limits 文档](https://docs.convex.dev/production/state/limits)，2026-08 版本。Free 与 Starter 共享 S16 性能档，Free 有硬上限，Starter 超量按用量计费。）

即使这个页面将来对外服务几十个活跃用户，仍在免费额度内。**成本：$0。**

---

## 4. 缺口清单与对策

### 4.1 Vue 支持：官方只有 React hooks ⚠️ → 无所谓

`convex/react` 的 `useQuery/useMutation` 没有 Vue 版；社区有 [convex-vue](https://github.com/chris-visser/convex-vue)（Vue 3 插件，月下载 ~3 万，含 useConvexQuery、SSR/SSG 支持）。

但本项目**不需要引它**：`store.js` 已经是手写 reactive 单例，用 `ConvexClient.watchQuery().onUpdate()` 桥接进 store 约 30 行代码（§5.3），反而少一个依赖。

### 4.2 认证：最大的坑 ⚠️⚠️ → 配对码模式绕过

事实核查（2026-08）：

- Convex Auth（`@convex-dev/auth`，服务端跑在 Convex 部署上，支持 email+密码 / OTP / 匿名）**服务端**确实不需要额外服务器，SPA-on-CDN 是官方支持场景；
- 但它的**客户端库只有 React 版**（`@convex-dev/auth/react`、`/nextjs`，npm 包里没有 vanilla 客户端）；
- 平台级内置匿名认证（老版 `client.auth.signIn("anonymous")`）在当前 convex-js（1.45.0）客户端中已不存在，只剩 Convex Auth 的 React 用法；
- 剩余官方路径是 OIDC（Clerk / Auth0 / 自定义）——又引入第三个账号体系和 SDK。

**对策（推荐）：配对码（sync key）模式，完全不用认证。**

- 用户点「开启多端同步」→ 客户端生成 128-bit 随机 key（UUID v4），以文本码/二维码展示；
- 其他设备输入该码即加入同一 workspace；
- 所有 Convex 函数第一个参数是 `workspaceKey`，数据按 key 分区，函数内校验 key 格式；
- 安全性 = key 不可枚举 + HTTPS 传输。这与「导出/导入 JSON」是同一个信任模型（拿到文件=拿到数据），对练习语句这种低敏感数据完全够用。滥用防护见 §4.6。

**升级路径**：若将来要做真正的多用户账号（读者注册、找回数据），届时要么嵌一个 React 认证孤岛，要么等/贡献 Vue 客户端，要么换 OIDC。配对码模式的数据模型（行级 + workspaceId）可平移，不白做。

### 4.3 离线：Convex 在线优先 ⚠️ → localStorage 仍是主存储

Convex 官方不支持离线模式/本地缓存（断网即停）。设计上**不让 Convex 取代 localStorage**：

- localStorage 保持「第一写入」：现有 `watch` 持久化逻辑不动，离线时应用行为与现在完全一致；
- 在线时同步层把行级变更转发到 Convex（debounce），并接收其他端的推送；
- 若离线期间积累了变更，恢复在线后按 `updatedAt` LWW 合并上行（§5.3）。

> 若「离线优先 + 自动多端同步」是硬需求，Firebase Firestore 是唯一自带该能力的同类产品（§8 对比）；但那会换掉整套数据层。对「每天 20 分钟在线练习」的场景，本方案已够。

### 4.4 VitePress SSR 构建安全 ⚠️ → onMounted 内初始化

VitePress build 会在 Node 里执行组件 setup。规则：`import convex/browser` 可以放顶层（条件导出安全），但 `new ConvexClient(...)` / `watchQuery` 必须在 `onMounted` 之后。现有组件已经是这个习惯（`TrainingApp.vue` 的 onMounted 模式），照做即可。

### 4.5 敏感数据红线 🚨 → settings 白名单同步

`store.settings.apiKey` 是用户的 DeepSeek API Key（BYOK）。**绝不同步**。同步白名单只放：`voiceName`、`rate`、`model`（可选）。`onboarded`、预置场景等设备本地状态也不同步。

### 4.6 滥用防护 ⚠️ → 格式校验 + 限流

无认证的公开 mutation 可能被脚本刷垃圾行。缓解：

1. mutation 内校验 `workspaceKey` 必须是合法 UUID v4（随机碰撞不可行）；
2. 用 [@convex-dev/rate-limiter](https://docs.convex.dev/rate-limiting) 按 key/IP 限写频；
3. cron 定期清理「N 天无活动且无数据」的空 workspace；
4. Dashboard 用量告警（免费额度被刷爆时邮件通知）。

---

## 5. 推荐架构：localStorage 主存储 + Convex 同步层

### 5.1 原则

1. **现有代码几乎不动**：`store.js` 的 reactive 结构、四个组件、localStorage watch 全部保留；
2. **同步是正交的一层**（新增 `sync.js`），关掉同步 = 回到今天的纯本地应用；
3. **行级 LWW + 墓碑删除 + 服务端原子计数**，避免整块覆盖。

### 5.2 数据模型（convex/schema.ts 草案）

```ts
// 所有表都带 workspaceKey 分区 + updatedAt（LWW 依据）+ deletedAt（墓碑）
scenarios:   { workspaceKey, id, name, note, createdAt, updatedAt, deletedAt }
sentences:   { workspaceKey, id, scenarioId, zh, en, addedAt,
               repsTotal, listens, predictUnlocked, shadowReps,
               review: {d2, d7, d30}, red, redCount, lastPracticed, source,
               updatedAt, deletedAt }   // 1 sentence = 1 doc，id 沿用客户端 uid
practiceDays:{ workspaceKey, day: "YYYY-MM-DD", reps: number }  // 服务端原子累加
settings:    { workspaceKey, voiceName, rate, model, updatedAt } // 白名单，无 apiKey
```

### 5.3 同步协议（sync.js 骨架）

```js
// ① 初始化（onMounted 内，仅当用户已开启同步）
const client = new ConvexClient(import.meta.env.VITE_CONVEX_URL)
client.watchQuery(api.getWorkspace, { key }).onUpdate(remote => {
  mergeIntoStore(store, remote)   // 行级 LWW：remote.updatedAt > local 才覆盖
})

// ② 本地变更上行：复用现有深度 watch，debounce 300ms 后 diff 出脏行
watch(store, dirtyRows => {
  for (const row of dirtyRows) client.mutation(api.upsertRow, {
    key, row, updatedAt: row.updatedAt,   // 本地每行写入时刷新 updatedAt
  })
}, { deep: true })

// ③ 练习计数：不走 LWW，走服务端原子累加 + 事件 id 去重（防离线重放多计）
export function logRep() {
  const eventId = uid()
  store.practiceLog[today]++
  client.mutation(api.logRep, { key, day: today, eventId })  // events 表幂等
}
```

合并语义要点：

- **新增/修改**：按 `updatedAt` LWW。两台设备离线改同一句 → 后写的赢（对练习数据可接受，冲突窗口极小）；
- **删除**：不真删，写 `deletedAt` 墓碑；查询过滤；cron 30 天后物理清理；
- **计数**（repsTotal / listens / shadowReps / practiceLog）：可选两档——(a) LWW 快照（简单，极端并发下少计几遍）；(b) 服务端原子累加 + eventId 幂等（精确，多一张 events 表）。建议先 (a) 上线，有需要再升 (b)。

### 5.4 用户流程

1. 设备 A：⚙ 设置 → 「多端同步」→ 生成配对码（UUID + 简短校验位，支持二维码）；
2. 设备 B：同页面输入配对码 → 拉取远端全量 → 与本地合并（首次合并 = LWW + 本地已有数据全部 upsert 上行）；
3. 此后双向实时：A 练完一遍，B 端 stats 几秒内更新。

---

## 6. 实施计划（预估 1～2 个工作日，agent 辅助）

| Phase | 内容 | 产出 |
|---|---|---|
| 0 | 注册 convex.dev，`npm i convex`，`npx convex dev` 初始化 `convex/` 目录 | 仓库多出 convex/ 函数与 schema |
| 1 | schema + 5 个函数：`getWorkspace` / `upsertRow` / `logRep` / `createWorkspace`（校验 key 格式）/ `cleanupCron` | 后端完成（~200 行 TS） |
| 2 | `sync.js`：client 初始化（onMounted）、watchQuery→merge、watch→debounce 上行、行级 LWW、settings 白名单 | 核心同步层（~250 行 JS） |
| 3 | 设置页 UI：配对码生成/输入、同步状态指示（在线/离线/冲突数）、「停止同步」 | UI（~100 行 Vue） |
| 4 | CI：deploy.yml 加 `npx convex deploy` 步骤（CONVEX_DEPLOY_KEY secret）+ `VITE_CONVEX_URL` 注入 | 一条 push 同时发布前后端 |
| 5 | 加固：rate limiter、空 workspace cron、`index.md` 更新「数据存哪」说明 | 收尾 |

验收清单：两台设备 + 手机浏览器同时打开 /english/training/，A 端练 15 遍、标红、加句，B 端 5 秒内一致；断网重连后不丢不重；apiKey 从不出现在任何网络请求。

---

## 7. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| 配对码泄露 = 数据可读写 | 低（数据低敏感） | 码仅本地展示、可随时「重置配对码」迁移 workspace |
| 公开 mutation 被刷垃圾 | 中 | key 格式校验 + rate-limiter + cron 清理 + 用量告警（§4.6） |
| Convex 免费政策变动 | 低 | 数据量小可随时导出迁移；行级模型可平移到 Supabase 等 |
| convex-vue 不成熟 | – | 不依赖它，直接用官方 `convex/browser` |
| VitePress 升级/构建环境变化 | 低 | client 只在 onMounted 创建，SSR 安全已验证（条件导出） |
| LWW 丢并发写 | 低 | 练习数据冲突窗口小；精确需求可升 eventId 幂等计数 |

---

## 8. 横向对比（为什么选 Convex）

| | **Convex** | Supabase | Firebase Firestore | 自建 API + DB |
|---|---|---|---|---|
| 静态站集成 | ✅ 纯客户端 JS | ✅ | ✅ | ✅ |
| 后端代码量 | **最少**（functions 即 API，无路由层） | 中（SQL + RLS + REST 封装） | 中（安全规则） | 多（服务器/运维全来） |
| 实时多端推送 | **内置**（watchQuery） | Realtime 需订阅配置 | 内置 | 自建 WebSocket |
| 离线优先 | ❌ | ❌（离线缓存较弱） | **✅ 唯一内置** | 自建 |
| Vue 友好度 | ✅（browser 客户端框架无关；React hooks 才是 React 专属） | ✅ | ✅ | – |
| 认证 | ⚠️ 客户端 React-only（用配对码绕过） | ✅ JS SDK | ✅ JS SDK | 自建 |
| 免费额度对本项目 | ✅ 绰绰有余 | ✅ | ✅（按读写计费也够） | 服务器费用 |
| 锁定风险 | 中（专有查询模型） | 中（SQL 可迁） | 中高 | 无 |

结论：在「不自建 + Vue + 实时同步 + 免费」四个约束下，Convex 是最短路径；唯一显著优于它的维度是 Firestore 的离线优先——如果哪天离线变成硬需求再评估切换，行级数据模型让这个迁移成本可控。

---

## 10. 上线步骤（一次性，2026-08-31 已按此实现）

代码已全部就位（`convex/` 后端 + `components/sync.js` 同步层 + 设置页 UI + CI 接线）。剩余一次性操作：

1. **初始化 Convex 项目**（本机执行一次）：`npx convex dev`——首次会打开浏览器登录 convex.dev（GitHub 账号即可），自动创建部署并生成 `convex/_generated/` 与 `.env.local`（含 dev 的 `VITE_CONVEX_URL`）。本地 `npm run dev` 即可联调同步。
2. **拿生产 Deploy Key**：Convex Dashboard → Settings → Deploy Keys → 生成 prod key。
3. **配置 GitHub secret**：仓库 Settings → Secrets and variables → Actions → 新增 `CONVEX_DEPLOY_KEY`。此后每次 push master，CI 会先 `npx convex deploy`（用该 key 部署函数）再以生产 URL 构建前端。
4. **验证**：部署完成后打开 /english/training/ → ⚙ 设置 → 生成配对码；在另一台设备粘贴加入，两端加句/练习，数秒内互相同步。

> 未配置 `CONVEX_DEPLOY_KEY` 时，CI 自动退回纯前端构建，页面同步入口显示"未启用后端"，其余功能不受影响。

---

## 11. 参考来源

- Convex Auth FAQ（SPA-on-CDN 支持、React-only 客户端）：<https://labs.convex.dev/auth/faq>
- Convex Limits（免费额度）：<https://docs.convex.dev/production/state/limits>
- npx convex deploy（CI、CONVEX_DEPLOY_KEY、--cmd-url-env-var-name）：<https://docs.convex.dev/cli/reference/deploy>
- Convex 匿名用户 provider（Convex Auth 内，React 用法）：<https://labs.convex.dev/auth/config/anonymous>
- convex-js 浏览器客户端源码（setAuth/watchQuery、Node 条件导出）：unpkg convex@1.45.0
- 社区 Vue 集成：<https://github.com/chris-visser/convex-vue>
- 定价页：<https://www.convex.dev/pricing>

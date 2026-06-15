# Loop Engineering 的网关层：统一入口与三层解耦

> 系列第六篇。前五篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop 协调](./loop-engineering-multi-loop)
>
> 前五篇解决「**loop 内部怎么设计**」。这篇回答一个一直被悬置的问题：**loop 的输入从哪来、怎么统一？**

---

## 零、被悬置的问题

回顾前五篇，loop 的触发方式散落各处：

| 篇 | 触发方式 |
|----|----------|
| L1 落地 | cron 调度 |
| L3 设计 | CI webhook + cron 兜底 |
| Memory | （触发无关） |
| Multi-Loop | cron 表 + skip 规则 |

全是 **cron / webhook**——机器事件。但真实世界里，loop 的一大价值恰恰是**让人能触发它**：

> 「在 Slack 里发一句『#142 看一下』，触发 CI Sweeper loop 去诊断。」
> 「CLI 敲 `pi loop triage` 立刻跑一次 Daily Triage。」
> 「网页上点个按钮，启动一个临时 loop。」

这些场景下，loop 的输入来自**异构渠道**（CLI / Web / Slack / Telegram / 邮件），协议各异、语义各异。如果让每个 loop 自己去对接每个渠道，会得到 N×M 的耦合地狱。

**网关层就是为解这个耦合而生**：在 loop 之上加一层，专门负责「接收 + 协议转换 + 路由」，让 loop 只关心业务。

---

## 一、核心论点

```
                   ┌─────────────────────────────┐
   CLI ──────────► │                             │
   Web ─────────►  │      Gateway 网关层          │
   Slack ──────►   │  (接收 + 协议转换 + 路由)     │
   Telegram ───►   │                             │
   Email ──────►   └──────────────┬──────────────┘
   Webhook ────►                  │ 标准化消息
                                  ▼
                   ┌─────────────────────────────┐
                   │   Loop Engine (调度 + 编排)  │
                   │   CI Sweeper / Triage / ...  │
                   └──────────────┬──────────────┘
                                  │ 调起
                                  ▼
                   ┌─────────────────────────────┐
                   │      pi Agent (执行体)        │
                   └─────────────────────────────┘
```

一句话：**网关接收，Loop 处理，pi 实施。** 三层各司其职。

这个论点里藏着三个设计决策，下面逐一论证：

1. **为什么网关是独立层**（而不是 loop 的一部分）
2. **网关与 pi 的关系：intercom 用在哪儿**
3. **为什么选混合架构（C）而非独立服务（A）或 pi 内 extension（B）**

---

## 二、为什么网关是独立层

### 没有 gateway 的世界：N×M 耦合

```
3 个渠道 × 4 个 loop = 12 条对接线
每加一个渠道 → 改所有 loop
每加一个 loop → 对接所有渠道
loop 代码里塞满 Slack Block Kit / Telegram parse mode / HTTP 路由
```

loop 本该专注业务（诊断 CI、分诊 issue），却被迫关心「Slack 的 thread_ts 怎么传」「Telegram 的 voice 要不要转写」「CLI 的 argv 怎么解析」。**职责泄漏**。

### 有 gateway 的世界：N+M 解耦

```
3 个渠道 → 1 个 gateway → 4 个 loop
每加渠道 → 只改 gateway
每加 loop → 只在 gateway 注册路由
loop 只见到标准化消息，不知渠道为何物
```

这是经典的 **Adapter + Router** 模式。gateway 把异构协议归一成一个内部消息格式，loop 只处理这个格式。渠道的复杂性被吸收在 gateway 里，永远不泄漏到 loop。

### gateway 的三个职责

| 职责 | 做什么 | 不做什么 |
|------|--------|----------|
| **接收 Receive** | 监听各渠道（HTTP server / WebSocket / CLI argv / long-poll） | 不做业务判断 |
| **协议转换 Normalize** | 归一成内部 `Envelope` 格式（见下） | 不调用 LLM |
| **路由 Route** | 按规则决定交给哪个 loop（或丢弃/排队） | 不执行 loop 逻辑 |

**铁律：gateway 是无状态/轻状态的薄层。** 它不做业务、不调 LLM、不写 STATE。一旦它开始「有点 smart」，就是职责泄漏的信号——那部分逻辑应该挪进 loop 或 pi。

### 标准 Envelope 格式

所有渠道的消息，进 gateway 后都被转换成统一信封：

```typescript
interface Envelope {
  id: string;                    // 消息 ID（去重用）
  source: {                      // 来源（loop 据此决定回复方式）
    channel: "cli" | "web" | "slack" | "telegram" | "email" | "webhook";
    channelId?: string;          // Slack channel id / Telegram chat id / ...
    userId?: string;             // 发送者（权限/偏好用）
    threadTs?: string;           // 线程上下文（Slack/邮件）
    raw: unknown;                // 原始 payload（debug 用，不传给 loop）
  };
  content: {
    text: string;                // 归一化文本（voice 已转写、附件已摘要）
    kind: "text" | "command" | "event";
    attachments?: Attachment[];  // 结构化附件
  };
  receivedAt: string;            // ISO 时间
  traceId: string;               // 全链路追踪
}
```

**关键设计**：
- `source.channel` 让 loop 知道**怎么回**（Slack 用 thread、CLI 用 stdout、Telegram 用 reply）
- `content` 已归一（voice 转 text、图片转描述），loop 不碰原始协议
- `traceId` 贯穿 gateway→loop→pi→run-log，调试可追溯

---

## 三、网关与 pi 的关系：intercom 用在哪儿

这是整篇的关键洞察，也是前五篇一直没回答的问题：**pi 的 intercom 到底用来干嘛？**

### 先纠正一个常见误用：让 pi 当 gateway

很多人第一反应：「pi 有 intercom，让 pi 长跑当 gateway 不就行了？」——**这是误用**。

pi 的 Philosophy 写得明明白白：

> **No background bash. Use tmux.** Full observability, direct interaction.
> **No sub-agents.** Spawn pi instances, or build your own.

pi 的定位是**被调用的执行体**，不是长期后台宿主。让 pi 当 daemon 长跑接收消息，与设计意图冲突，还会带来：
- pi 升级/重启 → gateway 挂
- 单点故障，无横向扩展
- pi 进程既跑业务又跑监听，职责混乱

### 正确用法：intercom 是「外部 gateway ↔ pi」的通道

intercom 不是让 pi **当** gateway，而是让**外部 gateway 能与 pi 双向通信**。这是关键区别：

```
❌ 误解：pi + intercom = pi 自己当 gateway（pi 是宿主）
✅ 正解：gateway（独立） + intercom（通道）↔ pi（执行体）
```

intercom 在这里的角色，是**网关与 pi 之间的双向桥梁**：
- gateway 把标准化消息通过 intercom 投递给 pi
- pi 的执行结果/提问通过 intercom 回传给 gateway
- gateway 再把结果转成各渠道的协议格式发回去

这正是 pi `bidirectional-messaging-extension` skill 的设计意图——它讲的不是「让 pi 变 Slack bot」，而是「**让 pi 能与 Slack 这类平台双向通信**」，而谁当宿主是另一回事。

### 三种「gateway 调 pi」的方式

| 方式 | 场景 | 特点 |
|------|------|------|
| **print mode** (`pi -p`) | 简单触发、一次性 | 进程隔离、最简、无状态 |
| **SDK** (`createAgentSession`) | 需要编排、多 session | 类型安全、本进程、灵活 |
| **RPC mode** (`pi --mode rpc`) | 跨语言、长连接 | JSONL over stdio、进程隔离 |
| **intercom** | 需要双向、pi 主动提问 | 唯一支持 pi → 外部的反向通道 |

前三种是 gateway **向** pi 投递（单向）。intercom 是唯一支持 pi **主动回问**的通道——比如 loop 执行中遇到歧义，pi 通过 intercom 反问 gateway「这个 PR 是 CI 问题还是依赖问题？」，gateway 转成 Slack 消息问人，人答了再投回 pi。

**intercom 的真正价值在「双向闭环」**：让 loop 从「单向执行」升级为「能中途问人」。这是 L2/L3 loop 最缺的能力。

---

## 四、三种架构选型：为什么是 C 混合架构

把网关放在哪儿，有三种架构。逐一评估。

### 架构 A：独立三层服务

```
Gateway 进程 ──► Loop Engine 进程 ──► pi 进程
(独立)         (独立)              (被调用)
```

- ✅ 职责最清晰、崩溃完全隔离、可独立扩展
- ❌ **过重**：个人/小团队部署三进程，状态同步三套
- ❌ 脱离系列主线（这系列一直在讲「用 pi 积木搭 loop」）
- 适合：大型团队、需要独立扩缩容、有 SRE 能力

### 架构 B：pi 内 extension（intercom 当 gateway）

```
Gateway = pi extension (intercom)
   Slack ──► pi (extension 接收) ──► pi 内 loop
```

- ✅ 实现成本最低（pi 原生支持）、起步快
- ❌ **致命：pi 不该当 daemon**（见上节）
- ❌ 单点故障、无扩展性、职责混乱
- 适合：**仅作为起步形态**（单人、临时、验证用）

### 架构 C：混合——薄独立网关 + intercom 通道（推荐）

```
                    独立薄进程
   Slack ───────► ┌──────────────┐
   Telegram ───►  │   Gateway    │  协议转换 + 路由
   CLI ────────►  │  (可后台长跑) │
   Webhook ───►  └──────┬───────┘
                          │  intercom (双向通道)
                          ▼
                    ┌──────────────┐
                    │  pi Agent    │  执行体 (被调起)
                    │  (不长跑)    │
                    └──────────────┘
```

- ✅ **网关独立**（可长跑、可扩展、崩了不连累 pi）→ 解决 B 的 daemon 问题
- ✅ **复用 intercom**（不自造协议，用 pi 成熟双向通道）→ 解决 A 的过重问题
- ✅ **pi 仍是执行体**（被 print/SDK/RPC 调起，不长跑）→ 守住 pi 定位
- ✅ 职责单一：gateway 只管接收/转换/路由，符合 Unix 哲学
- 适合：**生产部署、个人/小团队到中型团队**

### 选 C 的深层理由

C 把 intercom **摆正了位置**。前五篇里 intercom 反复出现却没讲清用途——L3 用它做 kill switch、Multi-Loop 用它做跨 loop 信号。C 给出 intercom 的核心定位：**网关与 pi 的双向桥梁**。

而且 C 天然支持渐进演进（见第七节）：从最轻的 B 形态起步，按需抽离成 C。读者不用一开始就上完整架构。

---

## 五、C 架构的完整设计

### 5.1 组件总览

```
┌──────────────────────────────────────────────────────────────────┐
│                        Gateway 进程 (独立)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Slack    │  │ Telegram │  │  CLI     │  │ Webhook  │         │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘         │
│       └──────────────┴────────────┴─────────────┘                │
│                         │ 归一成 Envelope                         │
│                         ▼                                        │
│                  ┌──────────────┐                                 │
│                  │   Router     │  规则: 来源×内容 → loop          │
│                  └──────┬───────┘                                 │
│                         │                                         │
│       ┌─────────────────┼─────────────────┐                      │
│       ▼                 ▼                 ▼                      │
│  ┌─────────┐      ┌──────────┐      ┌──────────┐                 │
│  │ Queue   │      │ Direct   │      │ Reject   │                 │
│  │ (异步)  │      │ (同步触发)│      │ (丢弃)   │                 │
│  └────┬────┘      └────┬─────┘      └──────────┘                 │
│       │                │                                         │
└───────┼────────────────┼─────────────────────────────────────────┘
        │                │
        │ intercom       │ SDK / print mode
        ▼                ▼
┌──────────────┐   ┌──────────────┐
│  pi Agent    │   │  pi Agent    │   (执行体，按需调起，不长跑)
│ (双向场景)    │   │ (单向场景)    │
└──────────────┘   └──────────────┘
        │
        ▼
   Loop Engine (各 loop，见前五篇)
   ci-sweeper / daily-triage / ...
```

### 5.2 四种 Adapters（协议转换）

每个渠道一个 adapter，职责单一：把渠道协议转成 Envelope。

| Adapter | 输入 | 转换要点 |
|---------|------|----------|
| **Slack** | Socket Mode 事件 | thread_ts 保留、mention 解析、voice/文件下载 |
| **Telegram** | Bot getUpdates / webhook | chat_id 映射、voice 转写（whisper）、inline query |
| **CLI** | argv / stdin | 子命令解析（`pi loop triage`）、stdin pipe |
| **Webhook** | HTTP body | 签名验证、CI 事件归一（check_run failure → Envelope） |

每个 adapter 实现统一接口：

```typescript
interface Adapter {
  name: string;
  start(router: Router): Promise<void>;   // 启动监听
  stop(): Promise<void>;
  // adapter 内部: 收到原始事件 → normalize() → router.route(envelope)
  // adapter 也负责把 outbound 发回渠道 (reply)
  reply(envelopeId: string, response: Outbound): Promise<void>;
}
```

**关键：adapter 双向**。它既收（normalize 成 Envelope），也发（把 loop 的回复转回渠道协议）。loop 只产出标准 `Outbound`，adapter 负责格式化。

### 5.3 Router（路由规则）

```typescript
// 路由表（配置驱动，不改代码即可调）
const routes: Route[] = [
  // 按命令路由
  { match: { text: /^\/triage/ }, target: "loop:daily-triage", mode: "async" },
  { match: { text: /^\/fix #(\d+)/ }, target: "loop:ci-sweeper", mode: "async", extract: { prId: 1 } },
  { match: { text: /^\/approve (\w+)/ }, target: "gate:human-approval", mode: "sync" },

  // 按来源路由
  { match: { source: "webhook", event: "ci-failed" }, target: "loop:ci-sweeper", mode: "async" },
  { match: { source: "slack", channel: "#loop-escalations" }, target: "inbox:human", mode: "sync" },

  // 按权限路由 (admin 才能触发某些 loop)
  { match: { user: "admin", text: /^\/kill/ }, target: "control:kill-switch", mode: "sync" },

  // 兜底
  { match: {}, target: "loop:daily-triage", mode: "async" },  // 默认当 triage
];
```

路由规则三要素：
- **match**：来源（channel/user/event）+ 内容（正则/关键词）
- **target**：交给哪个 loop（或 control/inbox）
- **mode**：`async`（排队，loop 慢）还是 `sync`（立即响应，适合短查询）

**铁律：路由表是配置，不是代码。** 改路由不改代码、不重启（热重载），这是 gateway 灵活性的来源。

### 5.4 两种投递模式

| 模式 | 场景 | 机制 | 回复 |
|------|thinking|------|------|
| **Direct (同步)** | 短查询、人在线等 | gateway 直接 `pi -p` 调起，等结果返回 | 立即发回渠道 |
| **Queue (异步)** | 长 loop、触发即忘 | 入消息队列，loop runner 消费 | loop 完成后通过 intercom/webhook 推送 |

人发「/triage」期望秒回 → Direct。CI webhook 触发 → Queue。**别让用户等一个 15 分钟的 loop**——立即回「已触发，结果稍后推送」。

---

## 六、pi 落地：gateway 与 pi 怎么通信

这是 C 架构的落地核心。

### 6.1 通信矩阵

| 场景 | gateway 怎么调 pi | 回复路径 |
|------|-------------------|----------|
| **简单触发**（fire-and-forget） | `pi -p "..."` (print mode) | stdout → gateway → 渠道 |
| **编排式 loop**（多 session） | SDK `createAgentSession` | event stream → gateway → 渠道 |
| **跨语言/长连接** | `pi --mode rpc` | JSONL → gateway → 渠道 |
| **pi 主动反问**（双向） | **intercom**（唯一） | pi → intercom → gateway → 渠道 → 人 → 渠道 → gateway → intercom → pi |

前三种是单向投递，第四种是双向闭环。**intercom 是唯一支持 pi 反向主动通信的通道。**

### 6.2 intercom 双向闭环示例

场景：人在 Slack 触发 loop，loop 执行中遇到歧义，反问人。

```
[人] Slack: /fix #142
   │
   ▼
[gateway] Slack adapter 收到 → Envelope → Router → ci-sweeper loop
   │
   ▼  (gateway 启动 pi session, 通过 intercom 保持连接)
[pi/loop] 执行 CI Sweeper: 诊断 → 发现两种可能根因
   │
   ▼  (歧义! loop 决定反问, 通过 intercom 回传)
[pi] intercom message: "PR #142 可能是 (a) token 过期 或 (b) 回调路径错, 选哪个?"
   │
   ▼
[gateway] intercom → Slack adapter → reply 到原 thread
   │
   ▼
[人] Slack: (a)
   │
   ▼
[gateway] Slack adapter 收到 → Envelope (threadTs 匹配) → Router 匹配到 pending 反问 → intercom 投回 pi
   │
   ▼
[pi/loop] 收到答案 → 继续执行 → FIX → VERIFY → MERGE
   │
   ▼
[gateway] 结果 → Slack adapter → reply "已修复并合并 #142 (sha: a1b2c3d)"
```

**intercom 让 loop 从「单向执行」变成「能对话」**。这是 L2/L3 loop 解锁「human-in-the-loop 中途介入」的关键能力。

### 6.3 pi 内的接入点

pi 提供原生接入点（`bidirectional-messaging-extension` skill 的范式）：

```typescript
// pi extension 内 (作为 intercom 的 pi 端)
pi.on("user_message", (event) => {
  // event.source === "extension" 表示来自 gateway (非交互式输入)
  if (event.source === "extension") {
    // 来自 gateway 的标准化消息, 已是 Envelope 处理后的内容
    // 不再二次解析协议, 直接进 loop 逻辑
  }
});

// loop 需要反问时, 通过 sendUserMessage 触发 turn (或自定义 tool 回投 gateway)
pi.registerTool({
  name: "ask_human",
  description: "通过 gateway 向人提问",
  parameters: Type.Object({ question: Type.String(), traceId: Type.String() }),
  execute: async (_, params) => {
    // 通过 intercom 把问题发回 gateway, gateway 转渠道
    const answer = await pi.intercom.ask(params.traceId, params.question);
    return { content: [{ type: "text", text: `人答: ${answer}` }] };
  },
});
```

**关键：pi 端不感知渠道**。它只见 `ask_human` tool 的 question/answer，不知道问题最终发到了 Slack 还是 Telegram。渠道复杂性全在 gateway 里。

---

## 七、从 B 到 C 的渐进演进

C 虽好，但不必一开始就上。推荐的渐进路径：

### 阶段 1：B 形态（最轻起步，验证闭环）

```
单 pi + bidirectional extension (Slack/Discord/...)
   人 → Slack → pi extension 接收 → pi 内处理 → pi 回 Slack
```

用 pi `bidirectional-messaging-extension` skill 直接搭，**一个 pi 进程搞定**。验证「人能通过 Slack 触发 loop」这个核心闭环是否成立。**适合：单人、临时、验证用。**

> **边界信号**（何时该离开 B）：当 pi 开始卡顿、升级要停服、想接第二个渠道、想加第二个 loop 时——B 撑不住了，该抽 gateway。

### 阶段 2：抽离 gateway（B → C）

```
Slack → 薄 gateway 进程 (adapter + router) ──intercom──► pi
```

把 Slack 接收逻辑从 pi extension 抽出，变成独立 gateway 进程。pi 只通过 intercom 与 gateway 通信。**gateway 可独立重启/升级，pi 不受影响。**

### 阶段 3：多渠道 + 多 loop（完整 C）

```
Slack ┐
Tele  ├── gateway ──┬── intercom ──► pi (双向 loop)
CLI   │             ├── SDK ────────► pi (单向 loop)
Webhook┘            └── pi -p ──────► pi (简单触发)
                    + Router 路由到多个 loop
```

加更多 adapter、加 router 规则、加多个 loop。gateway 成为中心枢纽。

### 阶段 4（可选）：gateway 集群 + loop 网协调

```
gateway (多实例, 负载均衡) → 消息队列 (Kafka/SQS) → loop runner 集群
                                                    ↓
                                              Multi-Loop 协调 (见第五篇)
```

到这一步已超出个人/小团队范畴，进入企业级。**大多数场景停在阶段 2-3 即可。**

---

## 八、网关层特有的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **协议泄漏** | S2 | loop 代码里出现 `thread_ts`/`chat_id` 等渠道细节 | 严格 Envelope 归一，adapter 兜底转换 |
| **gateway 当 daemon 过重** | S2 | gateway 啥都干，越来越慢、越来越脆 | 守住三职责铁律（接收/转换/路由），业务挪走 |
| **路由规则膨胀** | S1→S2 | 路由表变成面条，改一个崩三个 | 路由分优先级 + 测试覆盖 + 配置版本化 |
| **pi 当 daemon** | S2 | 让 pi 长跑当 gateway（B 误用） | 坚守 C：gateway 独立，pi 被调起 |
| **反问风暴** | S2 | loop 动不动就反问人，人被烦死 | 限制 ask_human 频率 + 倾向 escalate 而非问 |
| **消息丢失** | S2 | webhook 漏接、Slack 重连丢消息 | 持久化队列 + ack 机制 + 去重（Envelope.id） |
| **权限绕过** | S3 | 任意渠道都能触发 kill switch | 路由按 user/channel 鉴权，敏感操作二次确认 |
| **双向死锁** | S2 | pi 反问后人没答，pi 永远卡住 | intercom 反问带超时，超时 → escalate |
| **渠道回声** | S1 | bot 回复自己，无限循环 | adapter skip bot/self message（skill 铁律） |

---

## 九、与前五篇的关系：补完 loop 工程的「输入侧」

| 系列篇 | 解决什么 | 本篇补充 |
|--------|----------|----------|
| 概念 | loop 是什么 | — |
| L1 落地 | loop 怎么搭 | 触发仍限 cron |
| L3 设计 | 无人值守怎么安全 | 触发仍限 webhook |
| Memory | loop 怎么记得 | — |
| Multi-Loop | 多 loop 怎么不打架 | loop 间协调，不管输入 |
| **网关（本篇）** | **输入从哪来、怎么统一** | **补完「输入侧」** |

**网关层让 loop 工程从「机器驱动」升级为「人机共同驱动」**。cron/webhook 是机器的嘴，gateway 给 loop 装上了**听人说话的耳朵**和**回话的嘴**（各渠道）。这是 loop 从「自动化的批处理」变成「可交互的协作伙伴」的关键一跳。

而 intercom 在这个图景里终于有了明确定位：**不是让 pi 当 gateway，而是让外部 gateway 能与 pi 双向对话**。这是前五篇一直悬而未决、本篇给出答案的问题。

---

## 十、回顾

1. **核心论点：网关接收，Loop 处理，pi 实施。** 三层解耦。
2. **网关是独立层**，因为 N×M 耦合必须靠 Adapter+Router 解。
3. **网关三职责铁律**：接收、协议转换、路由。**无状态/轻状态，不调 LLM、不做业务。** 一旦变 smart 就是职责泄漏。
4. **Envelope 是归一信封**：source（怎么回）+ content（已归一）+ traceId（可追溯）。
5. **intercom 的正确定位**：不是让 pi 当 gateway，而是网关与 pi 的**双向桥梁**。唯一支持 pi 主动反问的通道。
6. **选 C 混合架构**：薄独立网关 + intercom 通道。网关独立解 daemon 问题，复用 intercom 解过重问题，pi 仍是执行体。
7. **四种调 pi 方式**：print mode（简单）/ SDK（编排）/ RPC（跨语言）/ intercom（双向）。前三单向，intercom 双向。
8. **渐进演进 B→C**：从 pi extension 起步验证闭环，按需抽离 gateway，最后多渠道多 loop。
9. **gateway 让 loop 从「机器驱动」变「人机共驱」**——这是 loop 升级为可交互协作伙伴的关键。

一句话收尾：**好的网关层，让 loop 既听得见 cron 的钟声，也听得见人在 Slack 的一句话——而 loop 自己，永远不需要知道声音是从哪来的。**

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列二：pi L1 落地](./loop-engineering-on-pi) · [系列三：L3 设计](./loop-engineering-l3-design) · [系列四：Memory 系统](./loop-engineering-memory) · [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)
- [pi — bidirectional-messaging-extension skill](https://github.com/earendil-works/pi) （Slack/Discord/Teams 双向接入范式）
- [pi — intercom 与 `pi.sendUserMessage` / `pi.sendMessage` API](https://github.com/earendil-works/pi)
- [pi Philosophy：为什么 pi 不当 daemon](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- 相关概念：[OpenClaw / RayClaw（AI agent gateway，LLM provider 路由层）](https://docs.openclaw.ai/)——注意它们做 provider 路由，本篇做 loop 输入层，层次不同

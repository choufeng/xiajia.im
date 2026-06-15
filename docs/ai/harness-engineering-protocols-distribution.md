# 协议层与分发：Harness 怎么走出去

> Harness Engineering 系列第十篇（共 10 篇·系列终篇）。前一篇：[9. 可观测性与可调试性](./harness-engineering-observability)。
>
> 前九篇把 harness 在单机内怎么转讲透了——工具、上下文、运行时、子代理、扩展、记忆、安全、可观测。但一个只会在自己进程里自转的 harness 终究是孤岛：它能调外部工具吗？能和别的 agent 协作吗？能被嵌进你的 Web 服务吗？能力能打包给别人用吗？**这些都能答「能」，harness 才算成熟。** 本篇讲它怎么走出去。

---

## 目录

1. [引言：harness 走出单机才算成熟](#引言harness-走出单机才算成熟)
2. [10.1 三种互操作需求](#101-三种互操作需求)
3. [10.2 MCP：工具市场标准](#102-mcp工具市场标准)
4. [10.3 A2A：agent 间对等协作](#103-a2aagent-间对等协作)
5. [10.4 进程间总线：intercom 模式](#104-进程间总线intercom-模式)
6. [10.5 SDK：把 harness 嵌进宿主](#105-sdk把-harness-嵌进宿主)
7. [10.6 npm 分发：能力变包](#106-npm-分发能力变包)
8. [10.7 协议选择矩阵](#107-协议选择矩阵)
9. [10.8 反模式](#108-反模式)
10. [迁移清单](#迁移清单)
11. [下一步：系列总结](#下一步)

---

## 引言：harness 走出单机才算成熟

前九篇解决的都是「内功」：harness 怎么在单进程里把一个 loop 跑稳。可生产里的 agent 从不孤立——它要查公司内网工单、要和另一个专做 code review 的 agent 交接、要被 CI 流水线当一步调用、你写的好用技能要能装到同事机器上。

把这些「向外伸手」的需求归成两类通道：

- **互操作（interoperate）**：agent ↔ 工具 / agent ↔ agent / 进程 ↔ 进程。
- **分发（distribute）**：把 harness 本体或它的能力（扩展、技能）送到别的宿主、别的机器。

判断 harness 成熟度，不看它内置了多少功能，看它**接得住多少标准、送得出多少能力**。pi 在这件事上态度一致：**不把协议焊进内核，只提供组合点**——扩展、SDK、子进程、RPC。标准协议（MCP、A2A）经扩展接入，harness 本体经 SDK 嵌入宿主，能力经 npm 分发。成熟 ≠ 啥都内置，而等于能接住任何标准。

## 10.1 三种互操作需求

先分清互操作的三张面孔，别混着设计。

| 需求 | 谁连谁 | 典型问题 | 对应机制 |
|------|--------|----------|----------|
| ① 调外部工具 | agent → 工具服务 | 想用 GitHub/数据库/Slack，不想自己写 | MCP |
| ② agent 间协作 | agent ↔ agent | 把 review 派给另一个 agent，对等对话 | A2A |
| ③ 进程间协调 | 进程 ↔ 进程 | 多个常驻服务/扩展进程握手 | intercom 式总线 |

三种不是互斥，是叠加层。一个复杂集成可能三者都用：harness 经 MCP 调外部工具，经 A2A 和另一个 agent 对话，两者背后又跑在同一组进程总线上。

关键区分：**前两种是「语义层」互操作（agent 在对话里发起），第三种是「传输层」互操作（进程在底层握手）**。混在一起设计必乱——语义层谈「调什么工具」，传输层谈「字节怎么走」。

## 10.2 MCP：工具市场标准

**定义**：MCP（Model Context Protocol）把工具从「harness 内置」变成「外挂服务」。client（harness 侧）经统一协议调用 server（任意工具提供方）。一个 GitHub MCP server，谁家的 harness 都能接，工具生态归社区。

**为何**：内置工具是 harness 私货，换 harness 就重写。MCP 让工具变可复用市场——client/server 解耦，server 可用任何语言写、跨厂商共享。这和[第 2 篇](./harness-engineering-tools)讲的是同一件事的协议化版本：从「name+schema+handler」升级到「跨进程的标准契约」。

**怎么做（pi）**：**pi 故意不内置 MCP**。这是它的组合哲学：与其把 MCP client 焊进内核，不如让你用扩展自己接。需要 MCP 时两条路——

1. 写扩展桥接：MCP client 跑在扩展里，把 server 的工具经 `registerTool` 暴露给模型。
2. 装现成 package：社区把常用 MCP server 封成 pi 包，`pi install` 即用。

```
传统内置:  pi ─ [read/edit/bash/git]   ← 锁死一家
MCP 桥接:  pi ─ extension ─ MCP client ─┬─ github-server
                                       ├─ postgres-server
                                       └─ … 任何 MCP server
```

桥接思路（伪代码，展示接法，非可运行 API）：

```typescript
// 伪代码：在扩展里把 MCP server 的工具转发给 pi
import { Client } from "@modelcontextprotocol/sdk"; // MCP 官方 SDK

const mcp = new Client({ name: "pi-mcp-bridge", version: "1.0.0" });
await mcp.connect(/* transport: stdio | sse | http */);

for (const tool of await mcp.listTools()) {
  pi.registerTool({
    name: `mcp_${tool.name}`,
    description: tool.description,
    parameters: toTypebox(tool.inputSchema), // JSON Schema → Typebox
    async execute(_id, params, signal) {
      const res = await mcp.callTool(tool.name, params, signal);
      return { content: [{ type: "text", text: JSON.stringify(res.content) }], details: {} };
    },
  });
}
```

这个选择本身是个 harness 设计样本：**MCP 是标准，接不接、怎么接是 harness 的工程决策**。pi 选扩展，Claude Code/Cursor 选内置 client，殊途同归——抽象上任何 harness 都该支持「外挂工具市场」。

**反模式**：把 MCP server 当可信代码。它跑在你权限下，能读写盘、发网络请求。装前看源码、限权限（见[第 8 篇](./harness-engineering-security)）。

## 10.3 A2A：agent 间对等协作

**定义**：A2A（Agent2Agent）是 agent 之间**对等**协作的开放协议——一个 agent 把另一个 agent 当成一个可对话的端点，发任务、收产出，双方地位平等。

**为何**：不是所有协作都该用父子子代理。子代理是**层级**关系（父派活、定验收、控生命周期，见[第 5 篇](./harness-engineering-subagents)）。但对方若是别人团队跑的 review agent、云上的 Devin、另一家厂商的产品，你没有「父」的权限——只能以对等身份发请求。A2A 填的就是这个位。

**怎么做（pi）**：诚实说——**A2A 是行业新兴标准，pi 不内置 A2A 端点**。pi 原生的多-agent 答案是子代理（层级）。要做对等 A2A，靠 SDK/扩展自己实现一个端点。两者对比如下：

| 维度 | 子代理（subagent） | A2A 对等协作 |
|------|---------------------|--------------|
| 关系 | 父子，层级 | 平等，无父子 |
| 控制 | 父控生命周期/工具/上下文 | 各自自治，只交换消息 |
| 进程 | 同 harness 派生的子进程 | 可能跨机器、跨厂商 |
| 信任 | 同信任域 | 跨信任域，需鉴权 |
| pi 支持 | 原生 | 需自建（SDK/扩展） |

把 pi agent 暴露成 A2A 端点（伪代码）：

```typescript
// 伪代码：用 SDK 把一个 pi session 包成 A2A 可调用端点
import { createAgentSession } from "@earendil-works/pi-coding-agent";

async function handleTask(task: string) {
  const { session } = await createAgentSession({ tools: ["read", "bash", "edit"] });
  const outputs: string[] = [];
  const off = session.subscribe((e) => {
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta")
      outputs.push(e.assistantMessageEvent.delta);
  });
  await session.prompt(task);
  off();
  session.dispose();
  return outputs.join(""); // 再按 A2A 的 task/send、task/get 语义封装
}
```

**反模式**：拿子代理硬扮 A2A。父子模型里父能改子的系统提示、收编子的工具；对等协作里这些都不成立。把层级原语套到对等场景，要么越权要么失控——各归各位。

## 10.4 进程间总线：intercom 模式

**定义**：当集成变重——多个常驻服务进程（MCP server、向量库、长跑 review agent、IDE 插件）要协调，就需要一条**进程间消息总线**（intercom 式）：进程们经统一总线收发消息、广播事件、路由请求，而不是两两焊死 stdio。

**为何**：两三个进程可以点对点 stdio；进程一多，N×N 连接爆炸，谁连谁、谁死谁活、消息怎么路由全成乱麻。总线把这些收成一个**中间件**：进程只认总线，不认彼此，连接复杂度从 O(N²) 降到 O(N)。

**怎么做（pi）**：**pi 不内置命名总线**。它给的是三类积木，重型集成时在其上拼装 intercom 式总线——

| 积木 | 形态 | 用途 |
|------|------|------|
| RPC 模式 | JSONL over stdio | 把 pi 暴露成可被宿主驱动的无头进程 |
| 子代理 | 独立子进程 | 派生并发 agent，父子经结果通信 |
| 扩展钩子 | 同进程事件 | `pi.on(...)` 拦截 loop 各阶段 |

```
重型集成（intercom 式总线，伪架构）:

   IDE 插件 ─┐                         ┌─ pi (RPC mode)
   CI runner ─┼── [ 消息总线 / broker ] ─┼─ review-agent 子进程
   MCP server ┘                         └─ 向量库 / 长跑服务
                 ↑ 进程只认总线，互不直连
```

在扩展里把 pi 事件桥到外部总线（伪代码）：

```typescript
// 伪代码：把 pi 的 turn 事件转发到进程间总线
pi.on("turn_end", async (event, _ctx) => {
  await bus.publish("agent.turn.end", {
    sessionId: event.sessionId,
    toolResults: event.toolResults,
  });
});
// 外部进程订阅总线即可观测/介入，不必侵入 pi 主进程
```

**适用边界**：日常单机用不到总线，两三个 stdio 连接就够。**只有当进程数涨到协调成本超过收益，才上总线**——否则是过度设计。别为「好看」上中间件。

**反模式**：单机两进程也铺一套消息中间件。总线解决的是「多」，不是「连」。

## 10.5 SDK：把 harness 嵌进宿主

**定义**：SDK 把 harness 从「一个 CLI 程序」变成「一个可编程库」。宿主（Web 服务、CLI 工具、IDE 插件、CI 脚本）直接 `import` 创建 agent session，agent 成为一个组件，而不是一个要 spawn 的外部进程。

**为何**：CLI 模式下宿主和 agent 是两个进程，靠 stdio 文本协议通信，开销大、类型弱。SDK 模式下两者同进程，直接拿 TypeScript 对象、订阅事件流、调方法。延迟低、类型强、控制细。

**怎么做（pi）**：`@earendil-works/pi-coding-agent` 主包即含 SDK，无需另装。核心是 `createAgentSession`：

```typescript
import {
  createAgentSession,
  SessionManager,
  AuthStorage,
  ModelRegistry,
} from "@earendil-works/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const { session } = await createAgentSession({
  cwd: process.cwd(),
  tools: ["read", "bash"],          // 只给需要的手脚
  sessionManager: SessionManager.inMemory(),
  authStorage,
  modelRegistry,
});

session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta); // 流式输出
  }
});

await session.prompt("跑一下测试并总结失败原因");
session.dispose();
```

典型嵌入场景：

| 宿主 | 怎么嵌 |
|------|--------|
| Web 服务 | 路由 handler 里 `createAgentSession`，把流式 delta 经 SSE 推前端 |
| 自建 CLI | 替代交互式 TUI，做无头批处理 |
| IDE 插件 | 替代 spawn 子进程，同进程直接控工具集/模型 |
| CI 流水线 | 一步 agent，失败抛非零退出码 |

层级关系：**CLI 是 SDK 之上的一层壳**。pi 的交互式、print、RPC 三种模式都建在 `AgentSession` / `AgentSessionRuntime` 之上。SDK 是最底层、控制最全的入口；非 JS 宿主够不到 SDK 时，退一档用 RPC 模式（JSONL over stdio，语言无关）。

**反模式**：SDK 紧耦合——把 session 当全局单例到处直接调，不释放（`dispose`）、不处理 runtime 替换后的重新订阅。多请求并发会互相踩。正解：每个请求一个 session、用完即弃，事件订阅跟着 session 走。

## 10.6 npm 分发：能力变包

**定义**：你写的好用扩展、技能、提示模板、主题，打包成 npm 包（或 git 包），别人 `pi install` 即用。能力从「你机器上的私货」变成「生态里的可复用件」。

**为何**：分发是 harness 走出去的最后一公里。没有分发，每个团队都重造 GitHub 工具、重造 review 技能。有了分发，能力沉淀成包，生态复利——一个人的产出，全社区可用。

**怎么做（pi）**：`pi install` 支持三类源，**版本化是关键**——

```bash
pi install npm:@foo/bar@1.0.0          # 版本化 → 锁定，pi update 不动它
pi install git:github.com/user/repo@v1 # git ref 锁定
pi install ./local/path                # 本地路径，开发期
```

打包：`package.json` 的 `pi` 键声明资源，加 `pi-package` 关键字进 gallery 可被发现。

```json
{
  "name": "@foo/pi-review-kit",
  "version": "1.2.0",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  }
}
```

版本化与升级的红线：

| 行为 | 安全 | 危险 |
|------|------|------|
| 包遵守 semver，breaking 升 major | ✓ | ✗ |
| 版本化安装 `@1.0.0` 被 `pi update` 跳过 | ✓ | — |
| 无版本 git ref 静默漂移 | — | ✗ |
| 改了工具 schema 不升版本 | — | ✗ 老会话崩 |

依赖纪律：核心包（`@earendil-works/pi-ai`、`pi-coding-agent`、`typebox`）放 `peerDependencies` 不打包；其他 pi 包进 `bundledDependencies`。pi 给每个包独立模块根，互不撞车。

**反模式**：扩展无版本，破坏性升级。今天装的技能明天作者改了工具签名，你的老 session resume 直接崩。**版本化不是装饰，是 harness 可恢复性的前置条件**（见[第 4 篇](./harness-engineering-runtime)）。

## 10.7 协议选择矩阵

需求对号入座：

| 你的需求 | 选 | 理由 |
|----------|-----|------|
| agent 要调外部工具/数据源 | MCP | 工具市场标准，解耦复用 |
| agent 要和另一个对等 agent 协作 | A2A | 对等语义，跨厂商 |
| 想给 agent 派子任务、控验收 | 子代理 | 层级、同信任域，原生 |
| 多个常驻进程要协调 | intercom 式总线 | 解决「多」，不是「连」 |
| 把 agent 嵌进自己的程序 | SDK | 同进程、类型强、控制细 |
| 非 JS 宿主要驱动 pi | RPC 模式 | JSONL over stdio，语言无关 |
| 把能力分享给同事/社区 | npm 分发 | 版本化、可发现、可复用 |

一句话决策树：

```
要调外部工具? ──Y──► MCP（经扩展桥接）
   │N
agent 间协作? ──Y──► 对等? A2A / 层级? 子代理
   │N
多进程协调?  ──Y──► intercom 式总线
   │N
嵌进自己程序? ──Y──► JS? SDK / 非 JS? RPC
   │N
分享能力?    ──Y──► npm 分发
```

## 10.8 反模式

汇总「别这么干」：

| 反模式 | 症状 | 对策 |
|--------|------|------|
| **自造协议不兼容生态** | 自定义工具/agent 通信格式，和谁都不通 | 调工具走 MCP，agent 协作走 A2A，别重发明 |
| **SDK 紧耦合** | session 当全局单例，不释放、不重订阅 | 每请求一 session，用完 `dispose` |
| **扩展无版本破坏升级** | 作者改签名，用户老会话崩 | semver + 版本化安装，breaking 升 major |
| **层级当对等** | 用子代理硬扮 A2A，越权或失控 | 对等用 A2A，层级用子代理，各归各位 |
| **总线滥用** | 两进程也铺中间件 | 进程数涨上来才上总线 |
| **MCP 当可信代码** | server 越权读写盘/网络 | 看源码、限权限 |

一条总纲：**协议选对、版本管好、组合优于内置**。harness 走出去，靠的是接住标准、送出能力，而不是把全世界焊进内核。

## 迁移清单

互操作与分发的迁移，核心是「pi 的组合哲学」映射到「别家的内置策略」。

| pi 做法 | Claude Code | Cursor | Aider | 通用 harness |
|---------|-------------|--------|-------|--------------|
| 无内置 MCP（扩展桥接） | 内置 MCP client | 内置 MCP client | 无 | 按 MCP 标准接或自建 |
| 无内置 A2A（SDK/扩展自建） | 无 | 无 | 无 | 按 A2A 标准接 |
| 进程协调：RPC + 子进程 + 扩展钩子 | hooks + 子进程 | — | — | 自选传输层 |
| SDK（`createAgentSession`） | SDK/CLI | — | Python lib | 各自 embedding API |
| `pi install` npm/git 包 + 版本锁定 | 插件 / marketplace | 扩展市场 | 无 | 各自包管理 |
| 版本化升级（semver + 跳过锁定） | 插件版本 | 扩展版本 | — | 版本治理 |

**可迁移**：MCP/A2A 标准（全行业）、SDK 嵌入心智、semver 版本治理、RPC 无头模式思路。**要重写**：具体 SDK API、包管理命令、MCP 接入方式（内置 vs 桥接）。设计时越贴近「标准协议 + 可嵌入 + 可分发」，迁移越轻松。

## 下一步：系列总结

十篇走完，回顾脉络：

| 册 | 篇 | 主线 |
|----|----|------|
| 定义 | 1 是什么 | 立「壳」的心智模型 |
| 三大支柱 | 2 工具 / 3 上下文 / 4 运行时 | harness 的承重墙 |
| 扩展面 | 5 子代理 / 6 扩展技能 / 7 记忆 | 让 harness 会派活、会加载、会记 |
| 守护面 | 8 安全 / 9 可观测 | 让 harness 不闯祸、可查证 |
| 互操作 | 10 协议与分发 | 让 harness 走出单机（本篇） |

一句话串起来：**先定义壳（1），再立三根承重墙（2-4），然后让它会派活/加载/记忆（5-7），接着给安全与可观测两道护栏（8-9），最后让它能接住标准、送出能力（10）。** 内功练完，外功打开。

三条后续路径，任选其一或并行：

1. **回 Loop 系列**：本系列只讲「壳」，循环那一侧（衰减、韧性、多 loop 协调、Meta-Loop）在 [Loop Engineering](./loop-engineering-series) 系列等齐。壳配循环才是完整 agent。
2. **读 pi 源码验证**：本文每个机制都能在 pi 的 `docs/` 与 `examples/sdk/` 找到对应——`createAgentSession`、`pi install`、扩展钩子、RPC 模式。带着本系列的地图读源码，比裸读快十倍。
3. **贡献扩展回馈生态**：把你反复在用的工具/技能打成 `pi-package` 发 npm。[第 6 篇](./harness-engineering-extensions)（扩展加载）+ 本篇 10.6 给了全部打包知识。生态复利从你这一包开始。

一句话收束整条线——

> **Loop 决定 agent 怎么想，Harness 决定 agent 被什么托着跑。**

Loop 是发动机的燃烧循环，Harness 是底盘、悬挂、油路、仪表盘。发动机再好，没有壳上不了路；壳再精，没有发动机只是摆设。两者配套，agent 才从「能聊天的模型」变成「能交付活的工程师」。

Harness Engineering 系列（第 10 篇 / 共 10 篇·系列终篇）到此完结。前一篇：[9. 可观测性与可调试性](./harness-engineering-observability)。回到 [系列总纲](./harness-engineering-series)。

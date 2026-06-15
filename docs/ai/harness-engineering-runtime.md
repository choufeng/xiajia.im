# 会话与运行时生命周期：Agent 怎么活下去

> Agent 不是一次 API 调用，而是一个**有生命周期的运行体**。harness 的运行时层，就是负责让这个运行体出生、分叉、中断、续命、终老的那套机制。

---

## 目录

- [引言：从「请求」到「运行体」](#引言从请求到运行体)
- [4.1 运行时三层模型](#41-运行时三层模型)
- [4.2 为什么必须持久化](#42-为什么必须持久化)
- [4.3 fork：历史点分叉](#43-fork历史点分叉)
- [4.4 resume：断点续跑](#44-resume断点续跑)
- [4.5 并发会话与隔离](#45-并发会话与隔离)
- [4.6 turn 的原子性](#46-turn-的原子性)
- [4.7 pi 的运行时实现](#47-pi-的运行时实现)
- [4.8 反模式](#48-反模式)
- [迁移清单](#迁移清单)
- [下一步](#下一步)

---

## 引言：从「请求」到「运行体」

把 LLM 当聊天框用时，交互单元是**一次请求**：发 prompt → 收回复 → 结束。状态全靠人记，关掉窗口就归零。

agent 不是这样。一个真实的 agent 任务往往横跨几十轮模型调用、十几次工具执行、若干次人为干预，中途可能崩溃、可能下班、可能想换条路重试。要支撑这种工作模式，harness 必须把 agent 当成一个**运行体**来管理——它有身份（哪个会话）、有历史（走到哪了）、有分支（试过哪几条路）、有断点（崩了从哪接）。

这一层在 pi 里由「会话运行时」（session runtime）承载。本文拆解它的三层模型与四大能力（持久化、fork、resume、隔离），并落到 pi 的实际实现。

## 4.1 运行时三层模型

认清 agent 生命周期，先分清三个粒度。三者是**嵌套**关系：

```
session（会话）────────────────────────────────────────────┐
│  长期上下文载体，一棵消息树                              │
│  run（一次任务执行）────────────────────────────┐        │
│  │  你给一个目标，agent 做到自然停下            │        │
│  │  turn（一轮）──────┐  turn ────┐  turn ────┐│        │
│  │  │ 1次模型调用      │ │ 1次调用  │ │ 1次调用  ││        │
│  │  │ + 1批工具执行    │ │ +工具批  │ │ +工具批  ││        │
│  │  └─────────────────┘ └─────────┘ └─────────┘│        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

| 层 | 定义 | 时间尺度 | pi 对应 |
|----|------|----------|---------|
| **session** | 一个工作上下文的长期载体，一棵可分叉的消息树 | 数小时~数周 | `AgentSession` + 一个 JSONL 文件（`SessionManager`） |
| **run** | 一次任务执行：用户给出目标 → agent 推进到自然停止 | 数分钟~数小时 | 一次 `session.prompt()` 从发起到 resolve |
| **turn** | 一轮：**一次模型调用 + 它触发的一批工具执行** | 数秒 | `turn_start` / `turn_end` 事件 |

**为何要分三层**：不同工程问题落在不同层。持久化粒度在 session；任务进度在 run；计费、回滚、trace 的最小单位在 turn。把三者混为一谈，就会出现「想回滚却不知道退到哪」「想算成本却算不清」的乱账。

**怎么做（pi）**：SDK 里 session 是一等公民（`createAgentSession` 返回的 `AgentSession` 管理 messages、model、compaction、事件流）；run 对应一次 `prompt()`；turn 对应事件循环里的 `turn_start`/`turn_end` 对，文档明确定义为「one LLM response + tool calls」。

**反模式**：只认「请求/响应」两层，没有 turn 概念 → 无法在工具批中途干预、无法按 turn 计费。

## 4.2 为什么必须持久化

运行体最怕的是**失忆**。持久化（把 session 落盘）不是为了「下次还能聊」，而是四个硬需求：

| 需求 | 没持久化会怎样 | 持久化带来什么 |
|------|----------------|----------------|
| **崩溃恢复** | 进程一挂，几小时的工作上下文蒸发 | 重启即接回断点 |
| **审计回溯** | 黑盒，无法回答「它当时为什么这么改」 | 可逐 turn replay，可追责 |
| **分支探索** | 想试方案 B 必须从头重跑，方案 A 的进度作废 | 从任意历史点 fork，主线不动 |
| **跨设备续跑** | 困在公司电脑，回家没法接 | session 文件可拷贝/同步续跑 |

**怎么做（pi）**：session 默认落盘，存于 `~/.pi/agent/sessions/`，按工作目录分组：

```
~/.pi/agent/sessions/
└── --Users-jia--development--myproject--/
    ├── 2024-12-03T14-00-00_a1b2c3d4.jsonl   ← 一个 session = 一个文件
    └── 2024-12-04T09-30-00_e5f6g7h8.jsonl
```

每个文件是 **JSONL（每行一个 JSON 对象）**，首行是 header，后续行是消息/工具结果/压缩/分支摘要等 entry，用 `id` / `parentId` 串成一棵树（当前为 version 3）。一条 entry 示意：

```json
{"type":"message","id":"b2c3d4e5","parentId":"a1b2c3d4",
 "timestamp":"2024-12-03T14:00:02.000Z",
 "message":{"role":"assistant","content":[{"type":"text","text":"Hi!"}],
            "provider":"anthropic","model":"claude-sonnet-4-5",
            "usage":{"totalTokens":120,"cost":{"total":0.001}},
            "stopReason":"stop"}}
```

注意 `usage` 直接挂在 assistant 消息上——这是 turn 成为计费单位的物理依据（见 4.6）。

**反模式**：默认内存模式跑长任务（pi 的 `SessionManager.inMemory()` 或 `pi --no-session`），进程崩 = 一切归零。临时会话只适合一次性脚本，不适合需要审计的真实工程。

## 4.3 fork：历史点分叉

**定义**：fork 是从历史的某个点**复制出一条新的执行线**，原线不受影响。两条线共享共同祖先，之后各自生长。

**为何**：agent 干活常需要「试这条线，不行再换」。如果只能线性重跑，每换一次方案就丢掉前面所有上下文——既贵又容易遗忘已经探明的信息。fork 让探索变成树形而非线性。

```
user: 重构 auth 模块
└─ assistant: 我会先读现状…
   └─ [fork 点] ─┬─ 分支A：用中间件方案 ─→ 成功 ✓（active leaf）
                 └─ 分支B：用装饰器方案 ─→ 卡住，可弃
```

**怎么做（pi）**：pi 的 fork 分两档——**树内分叉**（同文件、同 session）与**新文件分叉**（生成独立 session）：

| 操作 | 输出 | API / 命令 | 适用 |
|------|------|-----------|------|
| 树内分叉 | 同一 JSONL 文件 | `/tree` 跳转、`sm.branch(entryId)` | 在原地试多条路，保持一体 |
| 带摘要分叉 | 同文件 | `sm.branchWithSummary(id, summary)` | 弃用分支的要点压缩回主线 |
| 新 session fork | 新 JSONL 文件 | `/fork`、`runtime.fork("entry-id")` | 想把某条线独立出去 |
| clone 当前路径 | 新文件 | `runtime.fork("entry-id", { position: "at" })` | 复制当前进展再继续 |
| 跨项目 fork | 新文件（另一 cwd） | `SessionManager.forkFrom(src, targetCwd)` | 把别处 session 拉到本项目 |

```typescript
// SDK：从某个历史 user entry 分叉出新 session
await runtime.fork("a1b2c3d4");          // 从该 entry 起新线
await runtime.fork("a1b2c3d4", { position: "at" }); // clone 该 entry 这条路径
```

`branchWithSummary` 特别关键：切走一条分支时，让 LLM 把弃用分支的要点总结成一段 `BranchSummary` 挂到新位置——既不丢探索结论，又不必整条回放，省 token 又保上下文。

**反模式**：只有「重置」没有「分叉」。每次方向不对就清空重来，等于把 agent 当无状态函数用，前几轮的投入全部沉没。

## 4.4 resume：断点续跑

**定义**：resume 是**在 run 被中断后，从断点接续**，恢复完整上下文（不只是聊天记录，还包括模型选择、thinking 级别、当前所在树位置）。

**为何**：长任务的现实是——下班、断网、换电脑、进程被 OOM 杀。没有 resume，agent 的「记忆」脆弱得不堪一击；有了 resume，一个 session 可以断续跑上好几周。

**怎么做（pi）**：

```bash
pi -c                    # 直接续最近一个 session
pi -r                    # 弹出选择器，挑一个历史 session
pi --session <path|id>   # 指定文件或部分 ID 续
```

交互内用 `/resume` 浏览；SDK 层：

```typescript
SessionManager.continueRecent(cwd);      // 续最近，没有就新建
SessionManager.open("/path/to/x.jsonl"); // 打开指定文件
await runtime.switchSession(path);       // 运行中切到另一个 session
```

**resume 的上下文重建**靠 `buildSessionContext()`：从当前 leaf 沿 `parentId` 走到 root，收集这条路径上的全部 entry，再把压缩摘要、分支摘要按规则展开。也就是说——你 resume 回来的不是一个「聊天记录」，而是**你当时停在树上的那个精确位置**，连同它经过的所有压缩与分支记忆。

**反模式**：把 resume 当成「把历史对话再贴一遍」。真正的 resume 要恢复**树位置**与**派生状态**（当前 model、thinking level、active leaf），否则 agent 会以为自己还在某个早被你弃掉的分支上。

## 4.5 并发会话与隔离

**定义**：多个 session 可以同时活着，各自拥有独立上下文，互不串味。

**为何**：你常同时干几件不相关的事——改 bug A、做重构 B、跑个调研 C。塞进一个 session，三件事的上下文互相稀释、互相干扰（A 的报错栈混进 B 的设计讨论）。隔离让每件事有干净的上下文边界。

**怎么做（pi）**：

- **目录即边界**：session 按 cwd 归档到 `sessions/--<cwd 路径>--/`。不同项目天然隔离。
- **上下文不越界**：`buildSessionContext()` 只走本 session 的树路径，物理上不可能读到别的 session 的消息。
- **配合 worktree 做物理隔离**：用 git worktree 给每个并发任务一个独立工作目录 + 独立 session，连文件系统状态都隔开（详见[第 5 篇](./harness-engineering-subagents)）。

```
项目A (cwd=/proj-a) ─→ sessions/--proj-a--/ ─→ sessionA.jsonl（只含A上下文）
项目B (cwd=/proj-b) ─→ sessions/--proj-b--/ ─→ sessionB.jsonl（只含B上下文）
```

**反模式**：单 session「万能工」，一个会话从早聊到晚、从 bug 聊到架构。上下文越堆越杂，最后 agent 连「现在到底在干嘛」都分不清。该开新 session 就 `/new`。

## 4.6 turn 的原子性

**定义**：一个 turn = **一次模型调用 + 它触发的一批工具执行**。它是 agent 运行时里**最小有意义的原子单位**。

```
turn_start
 ├─ 1 次 LLM 调用 → 产出一个 assistant message（含若干 toolCall）
 ├─ 批量执行这些 toolCall → 产出一组 toolResult message
 └─ stopReason 决定：toolUse → 进下一个 turn；stop → run 结束
turn_end
```

**为何 turn 是关键粒度**——三件事都以它为单位：

| 维度 | turn 作为单位的意义 |
|------|---------------------|
| **回滚** | 退一个 turn = 撤销最近一次模型决策 + 它的工具副作用起点 |
| **计费** | 每个 assistant message 自带 `usage`（input/output/cache/cost），按 turn 累加即得 run 成本 |
| **trace** | 一个 turn 是一条完整「思考→行动」记录，trace/replay 的天然切片 |

**怎么做（pi）**：SDK 事件流里 turn 有明确边界：

```typescript
session.subscribe((event) => {
  if (event.type === "turn_end") {
    // event.message: 本 turn 的 assistant 响应
    // event.toolResults: 本 turn 的工具结果
    logCost(event.message.usage);   // 按 turn 计费
  }
});
```

中断也落在 turn 边界：`steer()` 在当前 turn 的工具批间隙注入新指令，`abort()` 让当前 turn 干净停下——而不是在 token 流中间硬切，造成半截消息。

turn 还是 harness 与 loop 的**咬合点**：assistant 消息的 `stopReason` 决定 loop 是否再转一圈（`toolUse` → 进下一 turn，`stop` → 本 run 收尾）；自动重试（auto-retry）以 turn 为单位重放失败的这一轮；压缩（compaction）则跨多个 turn 把旧上下文折成摘要。换句话说，[Loop Engineering](./loop-engineering) 讲的「发动机怎么转」在 turn 边界上与 harness 的「壳」对接——turn 既是循环的一拍，也是运行时的一颗原子。

**反模式**：turn 边界模糊（工具执行和模型调用混算一笔、或把多次模型调用揉成一个「步」）。后果：成本算不清、回滚退不准、trace 切片错位，且 auto-retry 与 compaction 无从附着。

## 4.7 pi 的运行时实现

把上面几节拼成一张全景。pi 的运行时由 `AgentSession`（单会话生命周期）+ `AgentSessionRuntime`（可替换活动 session 的更高层）+ `SessionManager`（JSONL 持久化与树操作）构成。

**落盘**：见 4.2，JSONL v3 树，按 cwd 分目录。

**fresh / fork / clone 三态**：

| 起会话方式 | 命令 | SDK | 上下文来源 |
|-----------|------|-----|-----------|
| fresh（全新） | `/new`、`pi`（默认新建） | `runtime.newSession()` | 空 |
| fork（从历史 entry 起） | `/fork` | `runtime.fork("id")` | 从该 entry 的路径 |
| clone（复制当前路径） | `/clone` | `runtime.fork("id", { position: "at" })` | 当前 active 路径 |

**async / 后台 run（诚实说明）**：pi **没有内置的「后台异步 run」调度原语**——这是刻意设计。文档的 Philosophy 写得明白：调度、子进程编排留给用户用 tmux / 外部调度器 / SDK 自行组合。要跑一个不阻塞终端的后台 agent，标准做法是：

```bash
# 用 tmux 起一个常驻 pi，断开终端也不死
tmux new -d -s triage "pi --session ~/.pi/agent/sessions/.../x.jsonl \
  -p '扫一遍 TODO，回写 STATE.md'"
# 之后 tmux attach -t triage 查看；session 持续落盘，随时可 resume
```

或用 SDK 起子进程、用 RPC 模式（`pi --mode rpc`）做进程隔离集成。后台能力 = **持久化 session + 外部进程 + resume** 的组合，而非某个 `pi.asyncRun()`。把这点想清楚，才不会去找一个并不存在的 API——这恰恰是 harness 的职责划分：运行时负责让单个 run 活得久、可分叉、可续命；至于「何时起、起几个、谁等谁」，那是调度容器（下一篇）的事。

**resume**：见 4.4，`continueRecent` / `switchSession` 重建 `buildSessionContext`。

一条 entry 流水示意（fork + 后续 resume）：

```
[new] session.jsonl 创建 ──→ turn×N 写入 ──→ [/fork entryId] ──→ 新 .jsonl
                                                            │
                                  原 .jsonl 继续写（主线不动）│
                                                            └─ 新 session 跑 turn×M
                                  [崩] → [pi -c] resume 原 leaf → 接续写
```

## 4.8 反模式

| 反模式 | 症状 | 根因 | 对策 |
|--------|------|------|------|
| **黑盒不持久化** | 崩了归零、无法审计当时决策 | 默认 in-memory / `--no-session` 跑真活 | 真实任务强制落盘 JSONL |
| **只线性不 fork** | 换方案就重跑、上下文丢失 | harness 不提供树/分叉 | 用 `/tree`、`branch`、`fork` |
| **turn 边界模糊** | 成本算不清、回滚退不准 | 把多调用揉成一「步」 | 以 `turn_end` 切片计费/trace |
| **单 session 万能** | 多任务上下文互相污染 | 不舍得开新会话 | 按任务 `/new`，配 worktree |
| **伪造 async API** | 找 `asyncRun()` 找不到、集成卡住 | 误以为后台 run 是内置原语 | tmux/RPC/SDK 子进程 + resume |

---

## 迁移清单

| 能力 | pi | Claude Code | Cursor | Aider | 通用 harness 实现 |
|------|----|-------------|--------|-------|-------------------|
| **session 持久化** | JSONL 树（v3），按 cwd 分目录 | `--resume`/`--continue`，本地 session | 对话历史存档 | `.aider.chat.history.md` | 一个 append-only 文件 + 索引 |
| **三层模型** | session/run/turn（`turn_end` 事件） | 隐含 turn，无显式 run 对象 | 粗粒度 chat turn | tag/commit 即断点 | 至少把 turn 切出来 |
| **fork 分叉** | `/tree`、`/fork`、`runtime.fork` | checkpoint 回滚（线性为主） | 无原生 fork | `/undo`（回退非分叉） | 消息树 + `parentId` |
| **resume 续跑** | `pi -c`、`continueRecent`、`switchSession` | `claude --resume <id>` | 重开历史对话 | 重启加载 history 文件 | 存 leaf 指针，重建上下文 |
| **并发隔离** | 按 cwd 分 session 目录 | 多项目多 session | 多窗口 | 多 repo | 一任务一会话 + worktree |
| **async 后台** | 无内置原语，tmux/RPC/SDK 组合 | headless 模式 + 外部调度 | 无 | 后台进程 + 外部 | 进程隔离 + 持久化 + resume |
| **turn 计费** | assistant `usage` 挂消息上 | 内部统计 | 粗略 | `/tokens` | 每次调用记 input/output/cost |

**一句话**：pi 在「树形 fork + 精确 turn 边界」上最完整；Claude Code 胜在开箱即用的 resume；Aider 把「git commit 当断点」是最朴素的持久化范式——自建 harness 至少要有**持久化 + turn 切片 + 一种分叉能力**这三件。

---

## 下一步

运行时让 agent「活得下去」，但单个 agent 干不了多复杂的活——真要并发探索、并行验证，得有**子代理调度容器**把多个 run 编排起来。那是下一篇的事。

> 本文是 Harness Engineering 系列第 4 篇 / 共 10 篇。
> 上一篇：[3. 上下文工程与 Token 预算](./harness-engineering-context)
> 下一篇：[5. 子代理调度容器](./harness-engineering-subagents) —— chain/parallel/fanout、acceptance 契约、worktree 隔离、控制平面。

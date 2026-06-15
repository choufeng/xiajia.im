# 跨工具对比：能力是工具无关的

> 系列第二十四篇。本篇属组织与生态分册。前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行](./loop-engineering-worktree) · [Scheduling](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup) · [Documentation Loop](./loop-engineering-documentation) · [Intent Debt](./loop-engineering-intent-debt) · [Comprehension Debt](./loop-engineering-comprehension-debt) · [Cognitive Surrender](./loop-engineering-cognitive-surrender) · [可观测性](./loop-engineering-observability) · [成本工程](./loop-engineering-cost)
>
> 前 23 篇以 pi 为落地载体。这篇**跳出 pi**——看 Loop Engineering 六原语在主流工具上的不同实现，以及一个核心信念：**能力是工具无关的，工具只是能力的一个实例。**

---

## 零、为什么需要跨工具视角

前 23 篇全以 pi 为载体。这容易造成一个误解：**Loop Engineering = pi 的某种用法。**

不是。Cobus Greyling 的 primitives-matrix 开篇第一句话就说清了：

> 「Tool-agnostic loop design: the **capability** is what matters, not the product name.」
>
> （工具无关的 loop 设计：**能力**才是关键，不是产品名。）

Loop Engineering 是方法论，不是某个工具的功能。六原语（调度 / worktree / skill / connector / sub-agent / memory）是**抽象能力**，每个工具只是这些能力的一个具体实例。

为什么这篇值得写？三个实际理由：

| 理由 | 场景 |
|------|------|
| **选型** | 你的团队该用 pi 还是 Claude Code？不是「哪个最好」，是「哪个适合你」 |
| **迁移** | 从 Cursor 迁到 pi，或从 Grok 迁到 Claude Code——哪些能迁，哪些要重写 |
| **可移植性** | 你写的 skill / state schema / 验证链设计，换工具还剩多少？ |

本文用 Cobus 的 primitives-matrix 为骨架，加上各工具的哲学差异，给出一套选型 + 迁移的决策框架。

---

## 一、核心信念：能力是工具无关的

先建立正确的心智模型。设计一个 loop 时，你真正在设计的是：

```
① 一个目的（purpose）          ← 工具无关
② 一套状态 schema（state）     ← 工具无关（markdown/JSON）
③ 一个验证分离（maker/checker）← 工具无关（谁检查谁）
④ 一个调度节奏（cadence）       ← 工具相关（怎么触发）
⑤ 一个执行载体（harness）       ← 工具相关（跑在什么上）
```

前三个**工具无关**，后两个**工具相关**。Cobus 的迁移配方就是基于这个划分：

> 「A well-designed loop transfers:
> 1. Write the **skill** (tool-agnostic `SKILL.md`)
> 2. Define the **state schema** (markdown or JSON)
> 3. Document the **verification split** (who checks whom)
> 4. Map scheduling to your current TUI or Action」

意思是：**skill、state、验证链跟着你走，调度和 harness 换工具时重写。** 这就是 loop 设计的可移植性边界。

理解了这一点，工具选型就不再是宗教战争，而是一个工程匹配问题。

---

## 二、五大工具的哲学差异

Loop Engineering 的六个原语，每个工具都「实现了」，但**实现方式反映了完全不同的哲学**。先看哲学，再看矩阵。

### pi：最小化 + 组合

pi 的哲学在系列第二篇已详述，核心一句：

> **No sub-agents. No MCP. No background bash. No plan mode.**
> 「There's many ways to do this. Build your own with extensions.」

pi 刻意把 loop、sub-agent、调度、MCP **全部留白**，让你用 SDK + 扩展 + 外部调度器自己组合。杠杆点在于**最大可组合性**——你拥有 loop 的每一行代码，但你要自己搭。

**适合**：喜欢掌控感、愿意写代码、追求最小依赖的开发者。

### Claude Code：内置 + 生态

Anthropic 的 Claude Code 把 loop 能力**内置**——`/loop` 命令、`/goal`、subagent（`.claude/agents/`）、hooks、cron 调度全有。配合 MCP 生态，开箱即用。

哲学是**降低门槛**：不用自己搭调度器、不用写 runner 脚本，直接 `/loop 15m` 就跑起来。代价是可组合性弱——你用 Claude Code 的方式，就是 Anthropic 设计的方式。

**适合**：想快速上手 loop、不想写基础设施、深度使用 Claude 生态的团队。

### Codex (OpenAI)：云端自动化 + Triage Inbox

OpenAI Codex 的 loop 跑在**服务端**（Automations tab），不是本地。cadence、prompt、environment 在网页配，结果进 Triage Inbox。`/goal` 支持可验证停机条件。

哲学是**托管优先**——自动化跑在云端，不依赖你的机器常开。代价是控制力弱（不能像 pi SDK 那样精确定制每个 step）。

**适合**：不想维护常驻进程、偏好网页操作、用 OpenAI 模型的团队。

### Cursor：编辑器内 + Rules

Cursor 把 loop 能力融进**编辑器交互**——`/loop` 风格的 prompt、background agents、`.cursor/rules` 充当 skill、MCP 支持。但 Cursor 的 loop 更偏向「编辑器内的自动化」，而非「独立运行的后台系统」。

**适合**：重度 IDE 用户、loop 场景与编辑/重构强绑定的开发者。

### Grok (Build TUI)：原生 /loop + scheduler

Grok Build TUI 有**最完整的内置 loop 能力**——`/loop [interval]`、`scheduler_create/list/delete`（recurring、durable、fireImmediately）、`monitor` 流式事件、subagent with `isolation: "worktree"`。

哲学是**loop-first**——loop 不是附加功能，是核心交互。Cobus 的整个 loop-engineering 仓库最初就是以 Grok 为主载体设计的。

**适合**：想要最完整内置 loop 体验、愿意用 Grok 生态的开发者。

---

## 三、Primitives Matrix：六原语 × 五工具

Cobus 的原始矩阵覆盖 Grok / Claude Code / Codex 三家。这里扩展到五家（加入 pi 和 Cursor），让对比更完整。

| 原语 | pi | Claude Code | Codex | Cursor | Grok |
|------|-----|-------------|-------|--------|------|
| **Scheduling** | 无内置（外部 cron / SDK / `pi -p`） | `/loop`、cron、hooks、GitHub Actions | Automations（服务端，cadence + prompt） | Rules + background agents | `/loop [interval]`、`scheduler_create`（durable） |
| **Run-until-done** | SDK + 自写判断 | `/goal`（独立模型检查完成） | `/goal`（可验证停机条件） | 手动 prompt | Goal mode / 显式停止条件 |
| **Worktrees** | subagent `worktree: true` / 手动 `git worktree` | `git worktree`、`--worktree`、subagent isolation | 每线程内置 worktree | Git worktree per Composer task | subagent `isolation: "worktree"` |
| **Skills** | `SKILL.md`（`.pi/skills/`，符合 Agent Skills 标准） | `SKILL.md`（`.claude/skills/`） | Agent Skills（`$name` 或隐式匹配） | `.cursor/rules`、`AGENTS.md` | `SKILL.md`（`.grok/skills/`） |
| **Connectors** | 无内置 MCP（用扩展 / 自写） | MCP servers + plugins | Connectors (MCP) + plugins | MCP in settings | MCP via `CallMcpTool` |
| **Sub-agents** | pi-subagents（外部包）/ SDK 多 session | Task subagents（`.claude/agents/`） | TOML subagents（`.codex/agents/`） | Multi-agent / review mode | `Task` tool + `subagent_type` |
| **State / Memory** | `STATE.md` / memory 工具 / `AGENTS.md` | `AGENTS.md`、progress files、Linear via MCP | Markdown 或 Linear via connector | `STATE.md`、`LOOP.md` | `STATE.md`、durable scheduler state |

### 矩阵怎么读

每一行是一个**能力**，每一列是一个**实例**。读法：

- **横向看**：同一个能力，不同工具怎么实现。比如 Scheduling——Grok 内置 `/loop`，pi 需要外部 cron。
- **纵向看**：同一个工具，六原语全不全。比如 pi——skill 全有，scheduling 和 connectors 全无内置。
- **交叉看**：哪个工具的能力最完整？Grok 最齐，pi 最少但最灵活。

> **关键洞察**：矩阵里**没有空格是真正的「做不到」**，只有「内置」和「需要自己搭」的区别。pi 没有 `/loop`，但用 cron + SDK 能实现完全相同的效果，甚至更灵活。差别在于**你愿意写多少基础设施代码**。

---

## 四、Scheduling：原生 vs 自建的分水岭

调度是六原语里**工具差异最大**的一个，也最能体现工具哲学。

### 四种调度模型

| 模型 | 代表工具 | 特点 | 代价 |
|------|----------|------|------|
| **内置 TUI 命令** | Grok `/loop`、Claude Code `/loop` | 一行命令即跑，`durable` 可重启存活 | 锁定工具生态 |
| **服务端自动化** | Codex Automations | 不依赖本地常开，网页配 | 控制力弱，黑盒 |
| **外部调度 + SDK** | pi（cron + `pi -p` / SDK） | 最大灵活性，完全掌控 | 要自己写 runner |
| **编辑器内触发** | Cursor background agents | 与编辑流融合 | 非「后台系统」 |

### 选调度的关键问题

问自己三个问题，就知道该用哪种：

1. **你的机器能常开吗？** 不能 → Codex 服务端 Automations。
2. **你要精确控制每一步吗？** 要 → pi 外部 SDK（每步可编程）。
3. **你只想最快跑起来？** 是 → Grok / Claude Code 内置 `/loop`。

### pi 的「无调度」为什么不是缺点

系列第二篇讲过，pi 刻意不内置调度，是 Philosophy 的体现。从跨工具视角看，这反而有一个独特优势：**调度逻辑归你所有，不绑定任何工具。**

```
Grok 的 /loop → loop 跑在 Grok 里 → 换工具 = 重写调度
pi + cron     → loop 跑在你的进程里 → 换 pi 只换执行体，调度不变
```

如果你的 loop 系统需要长期存在、跨工具演进，pi 的「调度归你」反而是最保值的。

---

## 五、Sub-agents：四种实现模型

Sub-agent（maker/checker 分离）是 Loop Engineering 的可靠性底线。各工具实现差异显著。

| 工具 | 定义方式 | 隔离 | 适用模式 |
|------|----------|------|----------|
| **pi-subagents** | agent 定义在 `~/.pi/agents/`，package 管理 | `worktree: true` + `context: "fresh"` | chain / parallel / fan-out / review-loop |
| **Claude Code** | `.claude/agents/*.md`（markdown 定义） | subagent isolation | Task subagent + agent teams |
| **Codex** | `.codex/agents/*.toml`（TOML 定义） | 内置 worktree per thread | TOML agent + `reasoning_effort` |
| **Grok** | `Task` tool + `subagent_type` 参数 | `isolation: "worktree"` | explore / implement / verify |
| **Cursor** | Multi-agent mode / review mode | 编辑器级 | 双角色 review |

### 定义格式对比

```
pi:          ~/.pi/agents/<package>.<name>.md     (markdown, systemPrompt)
Claude Code: .claude/agents/<name>.md             (markdown, frontmatter)
Codex:       .codex/agents/<name>.toml            (TOML, 结构化)
Grok:        Task tool 参数                        (无独立文件, 运行时指定)
```

pi 和 Claude Code 用 markdown（人可读、易版本控制），Codex 用 TOML（结构化、可验证），Grok 无独立文件（最轻但不可版本控制 agent 定义）。

### 迁移影响

agent 定义格式不可直接迁移——pi 的 agent 定义迁到 Codex 要从 markdown 转成 TOML。但 **agent 的「角色设计」**（什么角色、什么 prompt、什么验证标准）是工具无关的，只需重写格式。

---

## 六、Skills：Agent Skills 标准让 skill 跨工具可移植

六原语里，**skill 是跨工具可移植性最高的一个**。原因是 Agent Skills 标准的出现。

### Agent Skills 标准

[agentskills.io](https://agentskills.io/specification) 定义了一套 skill 规范：

```
my-skill/
├── SKILL.md          # frontmatter (name + description) + 指令
├── scripts/          # 辅助脚本
├── references/       # 按需加载的参考文档
└── assets/           # 模板等资源
```

`SKILL.md` 的 frontmatter：

```yaml
---
name: my-skill
description: 做什么、何时用。要具体。
---
```

正文是自由格式的指令。这个标准被 **pi、Claude Code、Codex** 共同支持（三家都用 `SKILL.md`）。

### 跨工具 skill 可移植性

| 概念 | pi | Claude Code | Codex | Cursor | Grok |
|------|-----|-------------|-------|--------|------|
| 格式 | `SKILL.md` | `SKILL.md`（相同） | `SKILL.md`（相同） | `.cursor/rules`（不同） | `SKILL.md`（相同） |
| 发现 | `.pi/skills/` | `.claude/skills/` | Agent Skills 匹配 | `.cursor/rules` | `.grok/skills/` |
| 调用 | `/skill:name` 或 auto-match | `$skill-name` 或隐式 | `$skill-name` 或隐式 | rules 自动匹配 | prompt 中引用 |

**pi / Claude Code / Codex / Grok 四家的 skill 格式完全一致**（都是 `SKILL.md`），只是发现路径不同。迁移时**复制目录 + 改路径**即可。

pi 甚至直接支持加载其他工具的 skill：

```json
// pi settings.json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

Cursor 是唯一格式不同的（`.cursor/rules`），但内容可手动转换。

> **这是 Loop Engineering 可移植性的最大胜利**：你花心血写的 triage skill、minimal-fix skill、ci-triage skill，换工具不用重写。skill 是你 loop 系统里最保值的资产。

---

## 七、State / Memory：状态存储的工具无关性

状态存储（STATE.md / memory）天然跨工具可移植，因为它就是文件。

### 状态格式

| 存储 | 用途 | 跨工具 |
|------|------|--------|
| `STATE.md` | loop 工作记忆（active/today/waiting） | ✅ 纯 markdown，全工具通用 |
| `AGENTS.md` | 项目约定 / context file | ✅ pi 和 Claude Code 都支持 |
| `loop-run-log.md` / JSONL | append-only 运行日志 | ✅ 纯文件 |
| Linear / GitHub Projects | 外部看板 | ✅ via connector/MCP |
| 向量库（Mem0 等） | 语义记忆 | ✅ 独立服务，工具无关 |

**状态存储是六原语里迁移成本最低的**——它不依赖任何工具特性，就是一个文件或一个外部服务。你换工具，STATE.md 一个字都不用改。

### pi 的独特优势：memory 工具

pi 有一个其他工具大多没有的能力——**内置 memory 工具**（跨会话持久化用户偏好、失败教训）。这让 pi 的 loop 天然有「长期记忆」能力，而不需要外接 Mem0。

但即便用其他工具，外接 Mem0 或自建向量库也能达到同等效果——**能力一样，实现路径不同**。

---

## 八、选型决策：什么场景选什么工具

终于到实战部分。不是「哪个最好」，是**「哪个适合你的场景」**。

### 决策表

| 你的情况 | 推荐工具 | 理由 |
|----------|----------|------|
| **想最快跑起来，不想写基础设施** | Grok / Claude Code | 内置 `/loop`，一行命令即跑 |
| **机器不能常开，偏好网页操作** | Codex | 服务端 Automations，不依赖本地 |
| **要精确控制每一步，loop 是核心资产** | pi | SDK 全可编程，调度归你 |
| **重度 IDE 用户，loop 与编辑流绑定** | Cursor | 编辑器内融合，background agents |
| **团队已有 Claude 生态** | Claude Code | MCP 生态 + hooks，开箱即用 |
| **skill 需要跨工具复用** | pi / Claude Code / Codex | 都支持 Agent Skills 标准 |
| **追求最小依赖、最大掌控** | pi | 无内置 = 无锁定 = 全归你 |

### 三个决策维度

把选型拆成三个维度，打分更清晰：

| 维度 | 低 → 高 |
|------|---------|
| **上手速度** | pi（要搭）< Cursor < Claude Code < Grok < Codex（网页即用） |
| **可控性** | Codex（黑盒）< Cursor < Grok < Claude Code < pi（全掌控） |
| **可移植性** | Codex ≈ Grok < Cursor < Claude Code ≈ pi（skill 可迁） |

**没有全满分的工具**。上手快和可控性天然矛盾——内置越多越快上手，但锁定越深。选型就是在这三角里找你的最优点。

### pi 的定位

从这张表看，pi 的特点很鲜明：**上手最慢、可控性最高、可移植性最好**。它不是给「想快速试 loop」的人用的，而是给「把 loop 当长期资产」的人用的。

> 系列第二篇说过：pi 的无内置 loop 是**特性不是缺陷**。从跨工具视角看，这意味着你投资的每一行 loop 代码（runner、scheduler、state schema、skill）都不绑定 pi——换工具时，只有「执行载体」要换，其余全带走。

---

## 九、迁移：怎么把 loop 从一个工具迁到另一个

Cobus 说「You do not need to pick one forever」。实际迁移时，什么能带走、什么要重写？

### 迁移清单

| 组件 | 可迁移？ | 迁移方式 |
|------|----------|----------|
| **Skill（SKILL.md）** | ✅ 直接复制 | pi/Claude/Codex/Grok 格式一致，改发现路径即可 |
| **State schema（STATE.md）** | ✅ 直接复制 | 纯文件，零改动 |
| **验证链设计（maker/checker）** | ✅ 概念迁移 | 角色设计不变，agent 定义格式可能要转（如 md→toml） |
| **Denylist / 安全规则** | ✅ 直接复制 | 写在 skill 或 LOOP.md 里，跟着走 |
| **调度逻辑** | ❌ 重写 | `/loop` → cron + SDK，或反过来 |
| **Harness 配置** | ❌ 重写 | tools 白名单、权限模型、扩展加载方式不同 |
| **Connector 实现** | ❌ 重写 | MCP 调用 / 扩展写法不同 |

**三带走、四重写**。好消息是：带走的三个（skill / state / 验证设计）正好是 loop 最有价值的部分——它们编码了你的领域知识和安全设计。重写的四个（调度 / harness / connector / agent 格式）是基础设施，换了就换。

### 迁移实例：从 Grok 迁到 pi

```
Grok loop:
  /loop 15m /ci-sweep + SKILL.md + STATE.md + Task subagent
        ↓ 迁移
pi loop:
  cron */15 + pi SDK runner + SKILL.md(直接复制) + STATE.md(直接复制)
  + 验证链(第二个 SDK session) + 手写 Slack webhook(替代 MCP)
```

skill 和 state 零改动搬过来。重写的是调度（`/loop` → cron）、subagent（Task → SDK 第二 session）、connector（MCP → webhook）。

### 迁移实例：从 Claude Code 迁到 pi

```
Claude Code loop:
  /loop 15m + .claude/agents/reviewer.md + AGENTS.md + STATE.md + MCP
        ↓ 迁移
pi loop:
  cron */15 + pi SDK + .pi/agents/reviewer.md(改格式)
  + AGENTS.md(直接复制, pi 支持) + STATE.md(直接复制)
  + 自写 connector(替代 MCP)
```

skill / AGENTS.md / state 全部零改动。重写 agent 定义格式（`.claude/agents` → `~/.pi/agents`）和 connector。

> **迁移的核心洞察**：你设计的 loop 越遵循「工具无关」原则（skill 用标准格式、state 用纯文件、验证链用角色设计而非工具特性），迁移成本越低。反之，你越依赖某工具的专有特性（Grok 的 `scheduler_create`、Claude 的特定 hook），迁移越痛。

---

## 十、不锁定：Loop Engineering 的可移植性哲学

把全篇收束到一个信念：

**Loop Engineering 的设计目标是让 loop 成为你的资产，而非工具的附属品。**

Cobus 的迁移配方、Agent Skills 标准、state 用纯文件——这些设计都在推动同一个方向：**让 loop 的核心（skill + state + 验证设计）工具无关，让工具只负责执行。**

```
你的 loop 资产（保值）           工具提供的基础设施（可替换）
├── SKILL.md                    ├── 调度器（/loop / cron / Automations）
├── STATE.md                    ├── harness（tools / 权限 / 扩展）
├── 验证链设计                   ├── connector（MCP / webhook / SDK）
├── denylist / 安全规则          └── agent 定义格式（md / toml）
└── loop 模式设计
```

左边是你的，换工具带走。右边是工具的，换了就换。

**这就是为什么本系列以 pi 为载体，但不绑定 pi**——pi 的「最小化 + 组合」哲学天然逼你把 loop 资产和工具基础设施分开。你在 pi 上写的 loop，迁移到任何工具都最轻松。

但反过来说，**你在 Grok / Claude Code 上写的 loop 也能做到可移植**——只要你遵循三条原则：
1. skill 用 Agent Skills 标准格式（`SKILL.md`）
2. state 用纯文件（markdown/JSON），不用工具专有存储
3. 验证链用角色设计，不依赖特定 subagent API

做到了这三条，你的 loop 就是你的资产。做不到，你就是某工具的租户。

---

## 十一、回顾

1. **能力是工具无关的**：Loop Engineering 是方法论，不是工具功能。六原语是抽象能力，工具只是实例。
2. **五大哲学**：pi（最小化+组合）/ Claude Code（内置+生态）/ Codex（云端托管）/ Cursor（编辑器融合）/ Grok（loop-first）。
3. **Primitives Matrix**：同一能力，不同实现。没有「做不到」，只有「内置」和「需要自建」。
4. **Scheduling 差异最大**：内置命令（Grok/Claude）vs 服务端（Codex）vs 外部 SDK（pi）vs 编辑器内（Cursor）。
5. **Sub-agent 格式各异**：md（pi/Claude）/ toml（Codex）/ 运行时参数（Grok）。角色设计可迁，格式要转。
6. **Skill 可移植性最高**：Agent Skills 标准让 pi/Claude/Codex/Grok 四家 skill 格式一致，复制即用。
7. **State 天然可迁**：纯文件，零改动跨工具。
8. **选型不是选最好**：上手速度 × 可控性 × 可移植性三角，找你的最优点。
9. **迁移：三带走四重写**：skill/state/验证设计带走，调度/harness/connector/agent 格式重写。
10. **不锁定是设计目标**：遵循三条原则（标准 skill + 纯文件 state + 角色验证），loop 就是你的资产，不是工具的租户。

一句话收尾：**工具会变，能力不变。你设计的 loop 越工具无关，它就越经得起时间——和工具更迭——的考验。**

---

## 参考资料

- [Cobus Greyling — Primitives Matrix](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives-matrix.md)（核心素材，Grok/Claude/Codex 三家 + Cursor/Windsurf/Aider 附录）
- [Cobus Greyling — Choosing a Tool](https://github.com/cobusgreyling/loop-engineering/blob/main/README.md)
- [Agent Skills 标准](https://agentskills.io/specification)（pi / Claude Code / Codex 共同支持）
- [pi — skills.md（Agent Skills 标准实现）](https://github.com/earendil-works/pi)
- [pi Philosophy（为什么无内置）](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- 系列前序 23 篇（见文首导航）

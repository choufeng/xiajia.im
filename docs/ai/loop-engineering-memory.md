# Loop Engineering 的 Memory 系统：loop 的「脊柱」怎么造

> 系列第四篇。前三篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design)
>
> 前三篇反复说一句话——「memory 是 loop 的脊柱」「跨 run 的唯一记忆」「把 attempt 数从 3 降到 1 的隐形杠杆」。但**这根脊柱到底怎么造**，一直没展开。这篇补上。

---

## 零、为什么 Memory 单独成篇

Loop Engineering 的全部难题，归根到底一句话：

> **模型跨会话没有记忆。每次会话，Agent 都是冷启动。**

这条限制逼出了 loop 工程里最核心的设计决策。Cobus Greyling 把 memory 列为「五大原语**之外**的第零项」；Mem0 的工程视角更直接：

> 「**没有显式 memory，loop 工程会退化成在一个上下文窗口里做子串管理。**」

退化形态很具体：
- 同一个 CI 错，loop 第二次遇到还从零诊断（intent debt + 无跨 run 记忆）
- STATE.md 越写越长，挤爆上下文窗口（state rot + token 失控）
- 改了用户偏好，loop 下次还是按旧的来（concept drift）
- 多个 loop 各写各的 state，互相不知道对方干了什么（multi-loop 冲突）

本文给出一套可操作的 memory 设计框架：**四层架构、四类策略、四大失败模式**，并落到 pi 的实际能力上。

---

## 一、Memory 不是「存东西」，是「让 loop 不退化」

先纠正一个常见误解：memory ≠ 数据库，memory ≠ 向量检索。

memory 的真正职责是**让 loop 在「每会话冷启动」的约束下，仍然表现出连续性**。它要回答四个问题：

| 问题 | 没有 memory 时 | 有 memory 时 |
|------|----------------|--------------|
| 我现在在干什么？ | 看当前 prompt（一片空白） | 读 STATE.md |
| 上次试了什么、结果如何？ | 不知道，重新试 | 查 run-log / 失败记忆 |
| 用户/项目有什么偏好？ | 每次重新教 | 读 skills / user memory |
| 这个问题以前怎么解决的？ | 从零推理 | 检索相似案例 |

**memory 的价值不在「记得多」，而在「让 loop 不退化成无状态的单次 prompt」。** 这正是 Loop Engineering 与 Prompt Engineering 的分水岭——后者优化单次调用，前者优化「调用之间状态如何管理」（Mem0 原文）。

---

## 二、四层 Memory 架构

一个生产级 loop 的 memory 不是单一存储，而是**四层**，各司其职。

```
┌─────────────────────────────────────────────────────────────┐
│  ④ 语义记忆 Semantic Memory  （跨 run、跨 loop、跨用户）       │
│     领域知识、案例库、失败教训、最佳实践                        │
│     载体: 向量库 / 结构化 DB / memory 工具                     │
│     检索: 相似度召回，按需注入                                  │
├─────────────────────────────────────────────────────────────┤
│  ③ 长期记忆 Long-term Memory  （跨会话、本 loop）              │
│     用户偏好、项目约定、持续进行的工作                          │
│     载体: skills / AGENTS.md / user memory                     │
│     检索: 启动加载 + 按需 read                                 │
├─────────────────────────────────────────────────────────────┤
│  ② 工作记忆 Working Memory  （本 run、多 step）                │
│     当前任务、已尝试的方案、中间结论                            │
│     载体: STATE.md / worktree / session 消息                  │
│     检索: 每 run 起手读 + 每 step 写                           │
├─────────────────────────────────────────────────────────────┤
│  ① 短期记忆 Short-term Memory  （单步、单 LLM 调用）           │
│     当前 prompt 的上下文窗口                                    │
│     载体: 模型 context window                                  │
│     检索: 无（已在窗口内）                                      │
└─────────────────────────────────────────────────────────────┘
```

### 各层职责对照

| 层 | 生命周期 | 写什么 | 谁读 | pi 载体 |
|----|----------|--------|------|---------|
| **①短期** | 单次 LLM 调用 | 当前 prompt + 工具结果 | 模型（本轮） | context window |
| **②工作** | 单个 run | STATE.md 的 Today 段、attempt、诊断 | 同一 run 的后续 step | STATE.md、worktree、session |
| **③长期** | 跨 run（周/月） | 偏好、约定、进行中项目 | 每次启动加载 | skills、AGENTS.md、user memory |
| **④语义** | 跨 run 跨 loop（永久） | 失败教训、相似案例、领域知识 | 按需检索注入 | memory 工具、向量库、外部 DB |

**关键洞察**：低层（①②）解决「token 太多怎么办」，高层（③④）解决「重复劳动怎么办」。一个成熟的 loop 四层都得有，否则要么破产、要么低效。

---

## 三、四类策略：让 memory 不变垃圾堆

memory 系统失败，90% 死在「**该存什么、什么时候忘、怎么检索**」的策略上。Mem0 把这叫做「memory policies can be wrong」——存错了比不存更糟。

### 策略 1：写入（Write Policy）—— 什么值得记

| 值得记 | 不值得记 |
|--------|----------|
| 失败 + 根因（「改 X 导致测试挂，因为 Y」） | 成功的细节（成功是默认，不用记） |
| 用户纠正（「别再这样做」） | 单次工具调用的原始输出 |
| 跨 run 有用的状态（attempt、已试方案） | 临时中间态（读完即弃） |
| 偏好、约定、铁律 | 可从代码/文档重新推导的东西 |
| 异常与边界情况 | 重复出现的高频常态 |

> 铁律：**记「偏离预期的」，不记「符合预期的」。** 失败比成功值钱 10 倍——同一个坑踩第二次才是真正的损失。

### 策略 2：检索（Retrieve Policy）—— 记了怎么用

| 检索方式 | 适用层 | 成本 | 精度 |
|----------|--------|------|------|
| **全量加载**（启动读整个文件） | ②工作③长期 | 低（一次性） | 高（无遗漏） |
| **按需 read**（模型主动读 SKILL.md） | ③长期（skills） | 极低（不用不花） | 高 |
| **相似度检索**（向量召回 top-K） | ④语义 | 中（embedding） | 中（依赖召回质量） |
| **结构化查询**（DB where 条件） | ④语义 | 低 | 高（精确匹配） |

混合策略最常见：**②③全量加载（STATE + skills 启动读），④按需检索（失败记忆遇到新问题时查）**。

### 策略 3：遗忘（Forget Policy）—— 不忘的 memory 是债

这是最被忽视的策略。Mem0 把它列为四大挑战之一：「**concept drift and stale memories**——用户变偏好、系统变行为、任务演进，loop 必须有更新或丢弃过时 memory 的策略。」

| 遗忘触发 | 机制 | pi 实现 |
|----------|------|---------|
| **时间过期** | TTL：N 天未被命中 → 归档 | STATE.md 每 run prune 已合并项 |
| **状态失效** | 引用的 PR/issue 已关闭 → 删 | State Rot 防护（L3 篇 CLEANUP） |
| **矛盾覆盖** | 新 memory 与旧的冲突 → 新的赢 | memory 工具的 replace 动作 |
| **低价值淘汰** | 长期未检索命中 → 降权/删除 | 定期 consolidate（合并去重） |

> **State Rot 是 S1→S2 的失败模式**：STATE.md 引用已合并 PR、已关闭 ticket、已删分支。loop 会去操作「幽灵」—— Mitigation：每 run prune + 时间戳 + 校验 ID 存活。

### 策略 4：压缩（Compress Policy）—— 让 prompt 不爆炸

这是 token-rich → token-poor 迁移的核心。

| 原始 | 压缩后 |
|------|--------|
| 完整 CI 日志（10k tokens） | 「OAuth 回调 500，根因 token 过期」（50 tokens） |
| 全部历史 attempt | 「试过 X、Y 失败，根因是 Z」（100 tokens） |
| 整个会话消息树 | compaction 后的摘要（pi 内置） |
| 原始代码上下文 | 相关片段 + 文件路径 |

pi 内置 compaction 机制（`session.compact()`），会话上下文快满时自动压缩。loop 设计时要**主动**压缩，而不是等上下文溢出被动触发。

---

## 四、STATE.md 设计哲学

工作记忆（②）最核心的载体是 STATE.md。前几篇给了格式，这篇讲设计原则。

### 一个好的 STATE.md 必须满足

```markdown
# Loop State — <LoopName>

## Active              ← loop 自己维护的进行中项（带 attempt 计数）
- [ ] #142 OAuth 回调 500 | attempt: 1 | last: 2026-06-14 | 根因: token 过期

## Today (2026-06-14)  ← 每次 run 覆盖（快照，可丢）
<!-- loop 写入 -->

## Waiting on Human    ← loop 不碰，人工收件箱
- #150 需产品确认方向

## History (压缩区)    ← 长尾，定期归档到 ④语义层
- 2026-06-13 #138 已合并 (sha: a1b2c3d)
---
Run: 2026-06-14 09:15 | 1 finding | 1 merged | 0 escalate | ~187k tokens
```

五条设计原则：

1. **分区明确**：Active（进行中）、Today（当日快照）、Waiting（人收件箱）、History（归档）。混在一起 = State Rot 温床。
2. **带元数据**：每项有 `attempt`、`last`（时间戳）、根因。没有元数据 = 无法做重试上限、无法防 Infinite Fix Loop。
3. **Today 可丢**：它是当日快照，丢了重跑即可。真正长期价值在 Active 和 History。
4. **History 要归档**：长尾别堆在主文件里，定期迁到 ④语义层（失败记忆库）。否则 STATE.md 膨胀挤爆上下文。
5. **绝不存敏感信息**：STATE.md 常被 commit 进仓库，API key/secret 一律不写（Cobus 的安全铁律）。

### 多 loop 时的状态布局

```
STATE.md                    # Daily Triage（优先级、人工收件箱）
ci-sweeper-state.md         # CI 失败 + attempt 计数
pr-babysitter-state.md      # PR 监听
dependency-sweeper-state.md # 依赖升级进行中
loop-run-log.md             # 所有 loop 共用的 append-only 日志
```

**一个 loop 一个 state 文件，外加一个共享 run-log。** 这是 multi-loop 协调的基础（下一篇详谈）。

---

## 五、token-rich → token-poor：迁移路径

Mem0 给的二分法（系列一已引），这里展开**怎么从富迁到贫**。

### 起点：token-rich（图省事）

```
每轮 prompt = 系统提示 + 完整历史 + 全部工具结果 + 完整 CI 日志
```

问题：模型仍因上下文头部截断「忘记」、账单爆炸、扩展性差。

### 迁移四步

```
Step 1: 压缩②工作记忆
  完整 CI 日志 → 摘要（50 tokens）
  ↓
Step 2: 提炼③长期记忆
  重复出现的约定 → 写进 skill（启动加载，不在 prompt 里重复）
  ↓
Step 3: 建④语义记忆
  失败案例 → 向量库（遇到新问题时检索 top-3 相似案例注入）
  ↓
Step 4: 混合检索
  prompt = 系统提示 + skills(已加载) + STATE(精简) + 检索到的相似案例(top-3)
```

### 终点：token-poor（混合，不是纯贫）

```
每轮 prompt = 系统提示 + 精简 STATE + 检索记忆(top-K)
        ↑              ↑              ↑
     启动加载        每 run 重写      按需注入
```

> **重要警告（Mem0 原文）**：「token-poor 不是万能。某些任务**真的需要** rich local context——比如编辑长文档、多文件代码改动。这时 loop 工程是『混合本地上下文与检索记忆』，不是『不惜一切代价最小化 token』。」
>
> 判断标准：**改单文件 bug → token-poor 合适；跨文件重构 → 必须保留 rich 本地上下文。** 别教条。

---

## 六、Memory 的四大失败模式

Mem0 明确列出的 memory 工程四大挑战，每一条都对应真实事故。

| 失败模式 | 症状 | 根因 | 对策 |
|----------|------|------|------|
| **① Prompt 质量仍是基础** | memory 再强，prompt/工具规格差 → 照样错 | memory 不替代基础 prompt 与 API 设计 | memory 是放大器，不是银弹；prompt 工程不能丢 |
| **② Memory policy 错误** | 存了一堆噪声，检索更模糊 | 「存什么/检索什么」决策难 | 策略 1-4（写偏离预期、按需检索、主动遗忘、压缩） |
| **③ Concept drift / stale** | 用户偏好变了，loop 还按旧的 | 没有更新/丢弃过时 memory 的机制 | 遗忘策略 + replace 覆盖 + 定期 consolidate |
| **④ Debugging 复杂度** | 多步、memory-aware 的 loop 出错难查 | 状态分散、难以 replay | 结构化 run-log + replay 工具 + 评估集 |

### 第五个隐藏失败：State Rot（Cobus 视角）

```
STATE.md 引用 → 已合并的 PR / 已关闭的 ticket / 已删的分支
        ↓
loop 去操作「幽灵」→ 浪费 token、误判、甚至错误合并
```

**S1→S2 有害**。Mitigation：每 run prune + 校验 ID 存活 + 时间戳。

---

## 七、pi 的 Memory 能力地图

pi 没有单一的「memory 系统」，而是**四种机制对应四层**——这正是 pi「核心最小化、能力靠组合」哲学的体现。

| 记忆层 | pi 机制 | 怎么用 |
|--------|---------|--------|
| **②工作** | `STATE.md` + worktree + session | loop runner 读写 STATE；worktree 隔离改动；session 内存本 run 上下文 |
| **③长期（被动）** | Context Files（`AGENTS.md`） | 启动加载，项目约定/命令写这里，全量进系统提示 |
| **③长期（主动）** | Skills（`SKILL.md`） | progressive disclosure：描述总在，正文按需 read |
| **③长期（用户偏好）** | memory 工具（`~/.pi/agent/` 持久化） | 跨会话记用户偏好、纠正、项目约定 |
| **④语义** | memory 工具 + 外部向量库/DB | 失败案例、相似问题检索 |
| **压缩** | `session.compact()` | 内置，上下文将满时自动/手动压缩 |

### 实战：一个四层齐全的 pi loop memory 配置

```typescript
// runner 启动时
const { session } = await createAgentSession({
  cwd: REPO,
  tools: ["read","grep","find","bash","edit","write","memory"],  // ← memory 工具
  // ③长期被动: AGENTS.md 自动加载（DefaultResourceLoader 发现）
  // ③长期主动: skills 自动发现（.pi/skills/）
  sessionManager: SessionManager.inMemory(REPO),                  // ← ②工作（不落盘）
});
```

**关键设计**：
- **②工作用 `SessionManager.inMemory()`**：loop 每次干净会话，不污染交互式 pi 的 session 树。工作记忆靠 STATE.md 跨 step，不靠 session 跨 run。
- **③长期靠 skills + AGENTS.md**：约定写一次，每次启动加载。这是「还意图债」的落地。
- **④语义靠 memory 工具**：loop 遇到新问题，主动 `memory_search` 找相似失败案例——这是把 attempt 从 3 降到 1 的关键。
- **压缩靠内置 compaction**：长 run 自动触发，不用自己写。

### memory 工具的写入策略（对应策略 1）

```
值得写入 memory 工具的（④语义）：
- 失败根因（「改 src/auth/token.ts 导致测试挂，因为 mock 没更新」）
- 用户纠正（「这个项目别用 default export」）
- 项目约定（「测试用 bun test，不是 jest」）

不值得写的：
- 单次成功的细节
- 可从代码重新推导的
- 临时中间态（写 STATE.md，不写 memory）
```

---

## 八、设计检查清单

搭一个 loop 的 memory 系统，逐项过：

| 维度 | 检查项 |
|------|--------|
| **分层** | ②工作记忆有载体（STATE.md）？③长期有 skills/AGENTS.md？④语义有检索机制？ |
| **写入** | 只记「偏离预期」的？失败带根因？带元数据（attempt/时间）？ |
| **检索** | ②③启动加载？④按需检索？混合策略？ |
| **遗忘** | 每 run prune 已合并项？有 TTL？矛盾时新覆盖旧？ |
| **压缩** | 长 run 有 compaction？CI 日志/历史有摘要？ |
| **安全** | STATE.md 不存 secret？memory 不含敏感信息？ |
| **多 loop** | 一 loop 一 state 文件？共享 run-log？ |
| **可观测** | run-log 能 replay？memory 可审计？ |
| **token 平衡** | 没有教条 token-poor？长上下文任务保留 rich？ |

---

## 九、回顾

1. **memory 的职责是「让 loop 不退化成无状态单次 prompt」**，不是「存东西」。
2. **四层架构**：短期（窗口）→ 工作（STATE）→ 长期（skills/偏好）→ 语义（案例库）。低层管 token，高层管重复劳动。
3. **四类策略**：写入（记偏离预期）、检索（混合）、遗忘（主动 prune）、压缩（token-rich→poor）。
4. **STATE.md 五原则**：分区、元数据、Today 可丢、History 归档、不存敏感。
5. **token-poor 不是万能**：单文件改用贫，跨文件重构必须保留 rich 本地上下文。
6. **pi 的四种机制对应四层**：STATE/skills/AGENTS.md/memory 工具/compaction——靠组合，不靠单一系统。
7. **memory 是放大器不是银弹**：prompt 质量仍是基础，policy 错误比不存更糟，stale memory 是债。

一句话收尾：**好的 memory 系统，让 loop 每多跑一次就更聪明一点，而不是每多跑一次就更慢一点。** 这就是「脊柱」的真正含义——它撑起整个 loop 的连续性。

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列二：pi L1 落地](./loop-engineering-on-pi) · [系列三：L3 设计](./loop-engineering-l3-design)
- [Mem0 — Loop Engineering for AI Agents: Memory-First Design](https://mem0.ai/blog/loop-engineering-for-ai-agents-memory-first-design)
- [Cobus Greyling — Concepts（Intent Debt / Comprehension Debt）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [Cobus Greyling — Failure Modes（State Rot）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md)
- pi 能力：`STATE.md` · skills（progressive disclosure）· Context Files（`AGENTS.md`）· memory 工具 · `session.compact()`

# Loop Engineering：设计那个替你 Prompt Agent 的系统

> 「你不再应该手动 prompt 编码 Agent 了。你应该设计 loop，让 loop 去 prompt Agent。」—— Peter Steinberger

2025 年下半年，AI 工程的杠杆点发生了一次明确的迁移：从**打磨单条 prompt**，转向**设计控制 Agent 随时间运行的系统**。这套方法论被 Cobus Greyling、Addy Osmani、Anthropic 的 Boris Cherny 等人归纳为 **Loop Engineering（循环工程）**。

一句话定义：

> **Loop Engineering 是「替换掉你自己作为 prompter」的工程实践——你设计一个系统去发现工作、分配任务、验证结果、持久化状态，而不是亲手敲下下一条 prompt。**

本文面向开发者，讲清楚 loop 由什么构成、如何设计、有哪些工程实践与失败模式。

---

## 一、从 Prompt 到 Loop：范式的迁移

先把三种容易被混淆的工程放在一起对比，建立正确的心智模型。

| 工程 | 关注点 | 时间尺度 | 你做什么 |
|------|--------|----------|----------|
| **Prompt Engineering** | 单次请求的措辞、结构、示例 | 一次 request-response | 写一条好 prompt |
| **Context Engineering** | 每一步塞进上下文什么内容 | 单次会话内 | 管理窗口、检索、压缩 |
| **Harness Engineering** | 一个 Agent 运行的环境：工具、权限、规则 | 单次会话 | 搭好沙箱 |
| **Loop Engineering** | 如何随时间调度、编排、验证多个 harness 运行 | 跨会话、跨天 | 设计控制循环本身 |

关键区分（Addy Osmani 的提法）：

```
Harness = 单次会话的设置（沙箱）
Loop    = Harness + 调度 + 状态 + 验证链
```

> —— Boris Cherny（Anthropic Claude Code 负责人）：
> 「我不再 prompt Claude 了。我有一堆 loop 在跑，它们负责 prompt Claude 并搞清楚该做什么。我的工作是写 loop。」

Loop 的本质是一个**递归目标（recursive goal）**：你定义一个目的，Agent（通常配合子 Agent、验证器、外部状态）不断迭代，直到目标完成，或 loop 决定把控制权交还给人。

---

## 二、Loop 的解剖：一次完整迭代长什么样

一个生产级 loop 的单次循环，通常经过这些阶段：

```
        ┌──────────────────────────────────────────────────────┐
        │                     调度触发                          │
        │   (cron / /loop / GitHub Actions / /goal / webhook)  │
        └────────────────────────┬─────────────────────────────┘
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │  ① 分诊 Triage：读 STATE/Memory，判断「现在该干什么」  │
        └────────────────────────┬─────────────────────────────┘
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │  ② 隔离工作区：独立 git worktree，避免并行冲突        │
        └────────────────────────┬─────────────────────────────┘
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │  ③ 实现 Implementer：执行子 Agent 产出改动            │
        └────────────────────────┬─────────────────────────────┘
                                 ▼
        ┌──────────────────────────────────────────────────────┐
        │  ④ 验证 Verifier：另一个子 Agent 跑测试/门禁/安全检查  │
        │     （实现者绝不给自己的作业打分）                      │
        └────────────────────────┬─────────────────────────────┘
                                 ▼
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
          ┌───────────────┐             ┌────────────────┐
          │ 安全/已白名单  │             │ 高风险/有歧义   │
          │ → 提交/PR/动作 │             │ → 附完整上下文  │
          └───────┬───────┘             │    升级给人     │
                  │                     └───────┬────────┘
                  ▼                             ▼
          ┌──────────────────────────────────────────────┐
          │  ⑤ 回写 STATE / Memory：记录尝试与结果          │
          └──────────────────────┬───────────────────────┘
                                 ▼
                          （回到调度，开始下一轮）
```

这套结构里，**最容易被新手忽略、却是 loop 可靠性命门的两块，是「验证器」和「状态」。** 下文展开。

---

## 三、六大构建块（Five Primitives + Memory）

Cobus Greyling 把 loop 的组成抽象成五个原语，外加一个贯穿全部的「记忆/状态」。任何一个最小可用 loop，至少需要 **调度 + 一个分诊 skill + 一个状态文件**；其余构建块按需递进加入。

| 原语 | 在 loop 里的职责 | 典型实现 |
|------|------------------|----------|
| **Automations / Scheduling** | loop 的心跳；没有调度只是一次性 Agent 运行 | Grok `/loop`、Claude Code cron、GitHub Actions、`/goal`（跑到可验证条件为真） |
| **Worktrees** | 安全的并行执行；多 Agent 改同文件 = 合并地狱，worktree 给每个 Agent 独立工作树但共享历史 | `git worktree`、`isolation: "worktree"`、`--worktree` |
| **Skills** | **意图（intent）的持久记忆**：约定、构建命令、「我们不这样做因为某次事故」、review 标准 | `SKILL.md` + 脚本，可打包成 plugin 跨仓库复用 |
| **Plugins & Connectors (MCP)** | 让 loop 伸出文件系统、触碰真实工具：读写 Linear/Jira、发 Slack、查 DB、建 PR、触发部署 | Model Context Protocol 已成通用底座 |
| **Sub-agents** | **制造者/检查者分离**（maker/checker）：写代码的 Agent 不是评判自己工作的合适人选 | Explorer→Implementer→Verifier、`/goal` 用新模型判定停机 |
| **+ Memory / State** | 模型跨会话无长期记忆，loop 必须读写**持久的东西** | `STATE.md` / `LOOP-STATE.json`、Linear 看板、DB 行 |

### 为什么 Memory 单独拎出来

> 「**状态文件往往是 loop 产出的唯一最重要的制品。**」

好的状态文件必须能回答三个问题：
1. 我们当前在做什么？
2. 上次试了什么、结果如何？
3. 什么在等人介入？

这一点上，[Mem0 的 Memory-First 视角](https://mem0.ai/blog/loop-engineering-for-ai-agents-memory-first-design)给了一个很实用的二分法（见第五节）——memory 既是 loop 的设计原语，也是它的瓶颈：**没有显式记忆，loop 工程会退化成在一个上下文窗口里做子串管理。**

---

## 四、必须掌握的六个概念

理解 loop 工程，绕不开这套词汇。它们解释了 loop 为什么会跑偏、以及怎么防。

### 1. Intent Debt（意图债）
每次会话，Agent 都是**冷启动**。缺失的意图会被它用「自信的猜测」填上。**Skills 是还意图债的工具**——把约定、构建步骤、「我们绝不这样做」写一次，每次运行都读。没有 skill，loop 每次都从零重新推导一切。

### 2. Comprehension Debt（理解债）
**仓库里实际存在的东西**与**你真正理解的东西**之间的差距。loop 越快，就越快产出你没写过的代码——除非你**主动去读 loop 产出的东西**，否则理解债只增不减。

### 3. Cognitive Surrender（认知投降）
让 loop 跑着、你自己不再有判断力的陷阱。**带着判断力去设计 loop 是解药，用 loop 来逃避思考是催化剂。** 同样的动作，相反的结果。

### 4. Orchestration Tax（编排税）
协调并行 Agent 的人力成本：review 带宽、合并冲突、上下文切换。Worktree 解决机械碰撞，但**你能吸收多少并行 loop，你自己就是天花板。**

### 5. Harness vs Loop（环境 vs 循环）
一个 agent 跑的环境（工具、上下文、权限、规则）是 harness；loop 是**随时间调度和编排 harness 运行**的东西。混淆两者会让人误以为「配好了一个 Agent 就等于有了 loop」。

### 6. Adversarial Code Review / Code Agent Orchestra
结构性模式：不同 Agent 扮演不同角色（探索、实现、验证）。**实现者绝不给自己的作业打分。** 这条对无人值守 loop 是生死线。

---

## 五、Token-Rich vs Token-Poor：memory 决定 loop 的形状

来自 Mem0 的工程视角，提供了一个能直接指导设计的二分法。Loop 工程往往始于一个设计选择：**每一步给模型看多少上下文？**

| 维度 | Token-Rich Loop（上下文富） | Token-Poor Loop（上下文贫） |
|------|------------------------------|------------------------------|
| 每轮塞什么 | 大量上下文塞进 prompt | 摘要 + 少量检索到的记忆 |
| 优点 | 高分辨率历史，少因缺上下文犯错 | 易守在上下文上限，可扩展 |
| 缺点 | 易溢出、贵、难扩展到多用户/长会话 | 易幻觉、重复劳动、忘关键约束 |
| 依赖 | 几乎无 | **需要更强的记忆与摘要基础设施** |

Loop 工程是「在富与贫之间找平衡」的艺术，由延迟、成本、质量、安全共同驱动。实践里，多数团队一开始图省事用 token-rich（什么都塞进窗口），然后慢慢撞墙：

- 模型仍会因上下文头部被截断而「忘记」
- 账单随规模爆炸
- 没有清晰结构界定「Agent 该记住什么」

到这一步，**memory 系统从可选变成必选**——这也是为什么把 memory 视为 loop 的「脊柱（durable spine）」而非附属功能。

一个生产级 Agent loop 的阶段，大致是：

```
用户消息/环境事件
  → 元数据（user id、时间、渠道）
  → 可选的工具调用检测
  → 上下文装配（窗口策略 / 记忆检索）
  → 规划 + 行动
  → 观察结果 → 回写状态/记忆
  → （循环或交还控制）
```

---

## 六、七种生产级 Loop 模式

Cobus Greyling 仓库给出了可直接套用的 7 种模式，按「自治程度」和「成本」分级。

| 模式 | 调度频率 | 第一周自治级别 | Token 成本 | 适用场景 |
|------|----------|----------------|------------|----------|
| **Daily Triage**（每日分诊） | 1 天 / 2 小时 | L1 仅出报告 | 低 | 每日扫一遍 issue/PR，产出待办 |
| **Issue Triage**（议题分诊） | 2 小时 / 1 天 | L1 仅提议 | 低 | 给新 issue 打标签、分优先级 |
| **Changelog Drafter**（变更日志起草） | 1 天 或打 tag | L1 草稿 | 低 | 自动汇总合并的 commit 生成 changelog |
| **Post-Merge Cleanup**（合并后清理） | 1 天 / 6 小时 | L1 离峰时段 | 低 | 删分支、收尾、更新文档 |
| **Dependency Sweeper**（依赖清扫） | 6 小时 / 1 天 | L2 仅补丁 | 中 | 升级依赖、修安全公告 |
| **PR Babysitter**（PR 看护） | 5–15 分钟 | L1 盯着 | 高 | PR 有新提交时自动 review、跑检查 |
| **CI Sweeper**（CI 清扫） | 5–15 分钟 | L2 谨慎 | 极高 | CI 挂了自动尝试修复 |

> **不确定先跑哪个？** 经验法则：**从 L1 报告类、低成本、低风险的模式起步**（Daily Triage / Issue Triage / Changelog Drafter）。它们即便出错也只是产出一份给你看的报告，不会动你的代码。

---

## 七、分阶段落地：L1 → L2 → L3

不要一上来就让 loop 无人值守改代码。推荐的三段式：

| 级别 | 行为 | 适合的模式 | 何时升级 |
|------|------|-----------|----------|
| **L1 报告** | loop 只产出报告/提议，不动代码 | Daily Triage、Changelog、Issue Triage | 连续一周报告质量稳定 |
| **L2 辅助修复** | loop 可提交补丁，但需人确认才合并 | Dependency Sweeper、CI Sweeper | 验证器误判率够低 |
| **L3 无人值守** | loop 自主完成并合并 | 谨慎，仅高度白名单场景 | 安全护栏 + 验证链成熟 |

升级的判定标准不是「它能不能跑」，而是**「验证器是否能在无人介入时拦住错误」**。

---

## 八、失败模式与护栏

Loop 工程会放大判断力——无论好坏。Cobus Greyling 的仓库里专门维护了一份事故级失败目录，核心几类：

| 失败模式 | 现象 | 对策 |
|----------|------|------|
| **Token 失控** | 子 Agent + 长跑 loop 让成本爆炸 | 设预算上限、用 `loop-cost` 类工具预估、对子 Agent 收紧 |
| **无人值守的错误** | loop 自信地犯着无人发现的错 | Verifier 必须独立、关键操作走人工门禁 |
| **理解债累积** | loop 越快产出越多你没读过的代码 | 强制「读 loop 产出」的节奏，纳入 review 流程 |
| **反向判断** | 两个人跑同一个 loop 得到相反结果——loop 不知道，你知道 | 编码判断力到 skills/verifiers，别把判断外包给 loop |
| **自动合并事故** | loop 自我批准并合并坏改动 | auto-merge 默认关闭，denylist，MCP 作用域收窄 |
| **多 loop 冲突** | 多个 loop 同时改同一处 | worktree 隔离 + 多 loop 协调策略 |

---

## 九、给工程师的箴言

> 「造 loop。但要像一个打算继续当工程师的人那样去造，而不只是那个按下开始键的人。」—— Addy Osmani

Loop Engineering 的核心信念：

- **杠杆点已经移动**：从写 prompt，移到了设计编排 Agent 的控制系统。
- **loop = harness + 调度 + 状态 + 验证链**，缺一不可。
- **Memory/State 是脊柱**，不是附属——它决定 loop 的形状（token-rich vs token-poor）。
- **实现者不给自己打分**：maker/checker 分离是可靠性的底线。
- **它放大判断力**：带着判断设计是解药，用它逃避思考是毒药。

从今天起，每次你发现自己在重复地 prompt 同一件事情，问自己一句：**这件事，能不能变成一个 loop？**

---

## 参考资料

- [Cobus Greyling — Loop Engineering（GitHub 仓库，含 patterns/starters/CLI 工具）](https://github.com/cobusgreyling/loop-engineering)
- [Cobus Greyling — Loop Engineering essay（Substack）](https://cobusgreyling.substack.com/p/loop-engineering)
- [Addy Osmani — Loop Engineering（canonical essay）](https://addyosmani.com/blog/loop-engineering/)
- [Mem0 — Loop Engineering for AI Agents: Memory-First Design](https://mem0.ai/blog/loop-engineering-for-ai-agents-memory-first-design)
- 工具链：`npx @cobusgreyling/loop-init`（脚手架）、`@cobusgreyling/loop-audit`（就绪度评分）、`@cobusgreyling/loop-cost`（token 成本预估）

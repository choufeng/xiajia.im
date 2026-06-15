# Intent Debt：冷启动、自信的猜测与意图的复利

> 系列第十九篇。前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup) · [Documentation Loop](./loop-engineering-documentation)
>
> 方法论分册第一篇。Loop Engineering 有三个核心「债」概念——Intent Debt、Comprehension Debt、Cognitive Surrender。前面十八篇反复提到「还意图债」「skill = 意图持久化」「冷启动问题」，但**意图债到底是什么、为什么它是 LLM agent 的结构性宿命、怎么累积成系统性偏差**，始终没正面展开。这三篇补上，本文先讲第一个：Intent Debt。

---

## 零、一个被低估的根本问题

先做一个思想实验。

你的 CI Sweeper loop 跑了三个月，一切正常。今天它遇到一个 CI 失败——`src/billing/stripe-webhook.ts` 里的签名验证挂了。loop 的 agent（一个全新的 session，冷启动）看到错误，自信地改了代码：把 webhook 的签名校验从「先验签名再处理」改成「先处理再验签名」，因为它觉得这样能更快返回 200。

测试过了。verifier 过了。合并了。

**然后生产环境收到了一堆伪造的 webhook。**

为什么？因为这个 agent 不知道一件你的团队都知道的事：**Stripe webhook 必须先验签名**——三个月前出过一次事故，团队定了铁律「任何 webhook 处理器，签名校验必须在业务逻辑之前」。但这条知识没有写进任何 skill，没有写进 AGENTS.md，没有写进 memory。

agent 不知道。它也不会说「我不知道」。它用「自信的猜测」填了这个缺口。

这就是 **Intent Debt（意图债）**。

Cobus Greyling 的定义精准到一句话：

> 「**Every session, the agent starts cold. Missing intent gets filled with confident guesses.** Skills are how you pay down intent debt — conventions, build steps, and 'we don't do it this way because of X incident' written once, read every run.」

这不是偶发 bug，不是 skill 写得差，不是模型不够强。**这是 LLM agent 的结构性宿命**——只要 agent 每次会话冷启动，意图债就必然产生。不还，只增不减。还，才能停。

---

## 一、冷启动：LLM agent 的结构性约束

理解意图债，先理解它的根源——**冷启动**。

### 什么是冷启动

每次会话开始，LLM agent 的状态是：

```
知道的:
  - 训练数据里的通用知识（到训练截止日期）
  - system prompt 里注入的内容（AGENTS.md + skill 描述）
  - 当前 prompt 里给的信息

不知道的:
  - 你的项目用什么测试框架（除非写了）
  - 哪条路径绝对不能碰（除非写了）
  - 上个月踩了什么坑（除非写了）
  - 为什么某段代码是这样写的（除非写了）
  - 团队的隐性约定（除非写了）
```

**模型不知道的项目特定信息，就是「意图缺口」。** 每次冷启动，缺口都在那里。模型会怎么处理？下节讲。

### 为什么普通软件没有这个问题

普通服务跑的是固定代码——你写进去的逻辑，第一天和第三百天一致。agent 不一样：

| 维度 | 普通服务 | LLM agent |
|------|----------|-----------|
| 行为来源 | 编译好的代码（持久） | 模型推理（每次重新生成） |
| 项目知识 | 硬编码在代码里 | prompt 里有没有给 |
| 缺失信息时 | 报错/异常（显式） | **用猜测填充（隐式）** |
| 跨会话状态 | 磁盘/DB（持久） | 无（每次冷启动） |

最后一条是关键差异。普通代码遇到「不知道」，抛异常或走 default 分支——**你知道它不知道**。LLM agent 遇到「不知道」，**它会猜，而且很自信**。你不知道它不知道。

> 意图债不是「agent 能力不足」，而是「agent 和项目之间的信息不对称」。能力再强的模型，在全新的冷启动会话里，也不知道你三个月前的那次事故。

---

## 二、意图债的定义与累积

### 定义

**Intent Debt = Σ（每次冷启动产生的未填补意图缺口）**

它是一条累积量。每次 loop 运行（每次冷启动），都产生新的意图缺口。缺口未被 skill/memory/context-file 填补 = 债。债不还，只增不减。

### 累积机制

```
第 1 次 run: agent 冷启动
  → 不知道 "用 bun test"
  → 猜: 用 npm test
  → 报错 → 人在 prompt 里纠正 → 这次的债还了
  → 但纠正没写进 skill → 下次还不知道

第 2 次 run: agent 又冷启动
  → 仍然不知道 "用 bun test"
  → 又猜 npm test
  → 债又产生了（一模一样的债）
  → 人又纠正 → 又没写进 skill

第 3 次 run: ...
  → 无限循环，每次冷启动都在制造同一个债
```

**关键洞察**：意图债不像技术债那样「你欠了就得还」。它的危险在于——**你还了一百次，第一百零一次它还在**，因为每次冷启动都是全新的 agent，你口头纠正的内容不会跨会话传递。

只有把纠正**持久化**（写进 skill / memory / AGENTS.md），这条债才真正被还清。否则你只是在「付利息」（每次重新纠正），本金一分没少。

### 累积的速度

意图债的累积速度取决于：

| 因素 | 快 → | 慢 |
|------|------|-----|
| 会话频率 | loop 每 15 分钟跑一次 | 每天一次 |
| 项目复杂度 | 大型多模块项目 | 单文件工具 |
| 约定数量 | 100+ 条隐性约定 | 5 条显性约定 |
| 持久化覆盖 | 无 skill / 无 memory | skill 覆盖 90% 约定 |

**loop 工程放大了累积速度**——loop 比人快得多，一天跑 96 次（15m cadence），每次都在制造债。人一天最多交互几次。这就是为什么「skill = 还意图债」是 Loop Engineering 的核心原语，不只是锦上添花。

---

## 三、「自信的猜测」陷阱

这是意图债最危险的表现形式。

### 模型不会说「不知道」

这是 LLM 的行为特征：面对信息缺口，模型的默认行为**不是承认无知**，而是**用训练数据里的通用模式填充**，然后表现得好像它很确定。

| 缺口类型 | 模型的「自信猜测」 | 真实约定 | 后果 |
|----------|-------------------|----------|------|
| 测试框架 | 用 jest | 项目用 bun test | 测试跑不了 |
| 导出风格 | 用 default export | 项目用 named export | 代码风格不一致 |
| 错误处理 | try-catch 吞掉 | 项目要求 rethrow | 错误被静默吞 |
| 签名验证顺序 | 先处理再验签 | 先验签再处理 | 安全漏洞 |
| 数据库迁移 | 直接改 schema | 必须走 migration 文件 | 数据不一致 |

**为什么这是陷阱**：猜测在「通用场景」下往往看起来合理（jest 确实是常见的测试框架），所以它**不容易被 verifier 发现**——verifier 也是 LLM，也倾向于认为「jest 是对的」。只有知道项目特定约定的人（或写了约定的 skill）才能发现。

### 幻觉 vs 自信的猜测

| 类型 | 特征 | 与意图债的关系 |
|------|------|----------------|
| **幻觉** | 编造不存在的事实/API | 不完全是意图债（模型能力问题） |
| **自信的猜测** | 用通用合理但项目特定的错误答案填充缺口 | **就是意图债的具象化** |

区分两者很重要：幻觉是模型「编」，自信的猜测是模型「合理但错」。后者更危险，因为它看起来太合理了，连 verifier 都觉得没问题。

> **意图债的危险不在于 agent 犯错，而在于 agent 犯的是「看起来合理但项目特定地错误」的错——这种错最难发现。**

---

## 四、意图债的三个表现

意图债不是抽象概念，它有三种具体的、可观测的表现形态。每种对应一类缺失的知识。

### 表现 1：项目约定缺失

```
约定: "这个项目的 API handler 必须用 zod 校验输入"
缺失: 没写进 skill / AGENTS.md
后果: agent 写了不校验输入的 handler
      → 安全风险
      → code review 被拒（但 L3 loop 没 code review...）
```

**这是最常见的意图债**。每个项目都有一堆「我们都知道但没写下来」的约定。人记得住，agent 记不住。

### 表现 2：事故教训缺失

```
教训: "2026-03 那次, 有人把 Stripe webhook 改成先处理后验签, 被刷了伪造请求"
缺失: 没写进 skill 的铁律
后果: 三个月后, 冷启动的 agent 不知道这件事, 又改了一遍
      → 同一个坑踩第二次
```

**这是代价最高的意图债**。事故教训是最值钱的知识——它用真实损失换来的。不写进 skill，等于这笔学费白交了。Cobus 把它列为 skill 应编码的核心内容之一：「**'we don't do it this way because of X incident'**」。

### 表现 3：构建/测试流程缺失

```
流程: "测试用 bun test, lint 用 biome 不是 eslint, 构建用 vite 不是 webpack"
缺失: 没写进 skill / AGENTS.md
后果: agent 每次都猜错工具
      → 测试跑不了 → 以为代码没问题 → 合并坏代码
```

**这是最容易被忽视的意图债**。因为「跑不了测试」看起来是工具问题，实际是意图缺失——agent 不知道该用什么工具，就不会去用。

### 三种表现对照

| 表现 | 缺失的 | 频率 | 代价 |
|------|--------|------|------|
| 约定缺失 | 「怎么干才对」 | 每次代码改动 | 代码质量问题 |
| 事故教训缺失 | 「什么绝对不能干」 | 偶发但致命 | 安全事故、重复踩坑 |
| 流程缺失 | 「用什么工具」 | 每次构建/测试 | 测试失效、误判通过 |

---

## 五、三种还债机制：精准分工

意图债不能靠「多说几遍」来还（说一百次，第一百零一次还是新 agent）。必须**持久化**。但持久化有三条路径，各管一类，不能混用。

### 路径 1：Skills —— 还「怎么干」的债

```
Skill = 稳定的、可执行的「怎么干」
内容: 步骤、决策表、铁律、构建命令
变化频率: 低（周/月级修改）
加载: progressive disclosure（描述常驻，正文按需 read）
```

**适合放的**：
- CI 修复的分类决策表（compile→修，flake→quarantine）
- 测试/构建/lint 命令（bun test / biome / vite）
- 代码约定（named export / zod 校验）
- 事故铁律（webhook 先验签 / 绝不碰 migrations）

**Skills 篇（系列十一）已详述设计原则**，这里强调它在意图债里的角色：skill 是**一次性教化 → 每次自动加载**的工具。你写一次，每个冷启动的 agent 都读到。这就是「**还本金**」——写一次，永久生效。

### 路径 2：Memory —— 还「干了什么」的债

```
Memory = 变化的、运行时积累的「干了什么」
内容: 失败根因、尝试记录、用户纠正、状态
变化频率: 高（每次 run 可能写）
加载: 按需检索（memory_search）
```

**适合放的**：
- 「上次 #142 失败是因为 mock 没更新」（一次性事件）
- 「用户说这个项目别用 default export」（偏好纠正）
- 「这个 loop 本周合并了 3 个 PR」（状态）

**Memory 篇（系列四）已详述四层架构**。在意图债里，memory 的角色是**还「skill 来不及写」的债**——刚发生的新约定、新教训，先写进 memory（即时生效），积累到稳定了再被 Meta-Loop 提炼成 skill。

### 路径 3：Context Files（AGENTS.md）—— 还「背景」的债

```
AGENTS.md = 全局的、全量加载的「背景」
内容: 项目概述、全局铁律、常用命令、架构约定
变化频率: 极低（月/季级修改）
加载: 启动全量注入 system prompt
```

**适合放的**：
- 「这是一个 VitePress 静态站点」
- 「所有文档用中文，技术术语原文」
- 「commit message 用 conventional commits」
- 「禁止在 main 分支直接提交」

**与 skill 的区别**：AGENTS.md 全量进上下文（每个 token 都花钱），所以只放最全局、最高频的背景。skill 是按需加载，放专项流程。Memory 篇把这归为「③长期（被动）」。

### 三者分工对照

| 维度 | Skill | Memory | AGENTS.md |
|------|-------|--------|-----------|
| **还什么债** | 怎么干（稳定的流程） | 干了啥（变化的状态） | 是什么（全局背景） |
| **变化频率** | 低 | 高 | 极低 |
| **加载方式** | 按需 read | 检索注入 | 全量加载 |
| **token 成本** | 低（progressive disclosure） | 中（检索时） | 高（每次全量） |
| **谁写** | 人 / Meta-Loop 提议 → 人审 | loop 运行时自动 | 人 |

**一句话记住分工**：

> **AGENTS.md 告诉 agent「你在哪」；Skill 告诉 agent「这事怎么干」；Memory 告诉 agent「上次干得怎么样」。三者覆盖意图债的全部形态。**

### 放错了的后果

| 放错 | 后果 |
|------|------|
| 约定写进 memory 不写 skill | 每次都要检索，不稳定；且 memory 可能被遗忘策略清理 |
| 事故教训只写 memory | 下次 agent 可能没检索到那条 memory → 同一个坑 |
| 全局背景写进 skill | skill 太多描述 → system prompt 膨胀 → 每次都花钱 |
| 一次性事件写进 skill | skill 里堆满噪音 → 正文膨胀 → progressive disclosure 失效 |

---

## 六、意图债的量化

管理的前提是度量。意图债可以被间接量化——虽然「不知道 agent 不知道什么」很难直接测，但**意图债的后果**是可观测的。

### 四个代理指标

| 指标 | 含义 | 怎么测 | 高 = 债多 |
|------|------|--------|-----------|
| **平均 attempt 数** | 同一 issue 修几次才成功 | run-log 的 attempt 字段 | 越高 → 意图缺失越多 |
| **误用工具率** | 用错测试框架/构建工具的次数 | run-log 分析 | 越高 → 流程债多 |
| **偏离约定频率** | 改动违反项目约定的比例 | 人工抽检 + lint | 越高 → 约定债多 |
| **重复失败率** | 同类错误反复出现 | run-log 分类分析 | 越高 → 教训债多 |

### 量化示例

```markdown
## Intent Debt Report — Week of 2026-06-10

| 指标 | 本周 | 上周 | 趋势 | 判定 |
|------|------|------|------|------|
| avg attempt | 2.1 | 1.6 | ↑ | ⚠️ 意图缺失加剧 |
| 误用工具率 | 18% | 12% | ↑ | ⚠️ bun test 被猜成 jest 6 次 |
| 偏离约定率 | 8% | 5% | ↑ | ⚠️ named export 被写成 default 3 次 |
| 重复失败率 | 12% | 4% | ↑ | 🔴 webhook 签名顺序错 2 次（同类） |

归因:
- bun test 约定没写进 skill → 每次都猜 jest
- named export 约定只在 memory 里，不稳定
- webhook 签名教训完全没持久化

建议（Meta-Loop 产出）:
1. skill 补: "测试用 bun test 不是 jest"
2. skill 补: "export 用 named 不用 default"
3. skill 补铁律: "webhook 签名验证必须在业务逻辑之前"
```

**量化的价值**：它让「agent 不知道什么」从不可见变成可见。你不用猜意图债有多少——看 attempt 数和重复失败率就知道。

---

## 七、Skill 作为还债工具：复利哲学

这是意图债治理的核心洞察：**skill 是复利工具**。

### 什么是「复利」

```
普通还债（人在 prompt 里纠正）:
  第 1 次: 纠正 → 还了
  第 2 次: 新 agent 冷启动 → 债又来了 → 又纠正
  第 3 次: ...
  → 每次都从零开始，没有复利

Skill 还债（写进 SKILL.md）:
  第 1 次: 写 skill → 还了
  第 2 次: 新 agent 冷启动 → 加载 skill → 知道了 → 不欠了
  第 3 次: 同上
  → 写一次，永久生效，这就是复利
```

**写一次、读每次**。skill 的边际成本趋近于零（progressive disclosure 让描述常驻只花 ~50 tokens），但收益是永久的。

### 复利的数学

```
N = loop 跑的总次数
C = 每次纠正的成本（token + 时间 + 风险）
S = 写 skill 的成本（一次性）

不写 skill 的总成本: N × C
写 skill 的总成本:   S + N × 50（描述常驻的 token）

当 N × C > S + N × 50 时, 写 skill 更划算
→ 即 N > S / (C - 50)
→ 通常 N > 3-5 就已经划算了
```

**loop 跑三天就回本**。这就是为什么 skill 是「首选还债工具」——在 loop 工程的尺度下，它的 ROI 极高。

### progressive disclosure 让复利「几乎免费」

如果不是 progressive disclosure，skill 复利的前提（「每次加载」）会很贵——全量加载 20 个 skill = 20000+ tokens/次。progressive disclosure 把这个成本压到 ~1000 tokens（只有描述常驻），让「写一次读每次」真正可持续。

| 还债方式 | 写入成本 | 每次加载成本 | 总成本（N 次） | 复利? |
|----------|----------|-------------|----------------|-------|
| prompt 纠正 | 0 | C（每次手动） | N × C | ❌ |
| 全量 skill | 高 | 高（20000 tokens） | S + N × 20000 | ✅ 但贵 |
| progressive skill | 中 | 低（~50 tokens 描述） | S + N × 50 | ✅ 便宜 |
| memory | 低 | 中（检索时） | M + N × retrieval | ⚠️ 半复利（可能检索不到）|

---

## 八、不还 vs 还不准：哪个更危险

这是一个反直觉的判断：**不还的债比还不准的债更危险。**

### 不还（完全不写 skill / memory / AGENTS.md）

```
后果: 每次冷启动都用猜测填充
      → 每次都可能犯错
      → 犯的错不可预测（每次猜的不一样）
      → 无法改进（没有锚点）
```

### 还不准（写了 skill，但内容有错）

```
后果: 每次冷启动都按错误的 skill 干
      → 每次犯同一个错
      → 但错误是确定的、可预测的
      → 发现后改一次 skill → 全部修好
```

### 对比

| 维度 | 不还 | 还不准 |
|------|------|--------|
| 错误可预测性 | ❌ 不可预测（每次不同） | ✅ 可预测（每次相同） |
| 发现难度 | 高（每次表现不同） | 低（重复模式易发现） |
| 修复成本 | 高（每次都要纠正） | 低（改 skill 一次） |
| 系统性风险 | 高（不可预测 = 无法防） | 中（可预测 = 可防） |

**为什么不可预测更危险**：不可预测的错误无法建立防线。你不知道下次会犯什么错，所以无法针对性防护。而「还不准」的错误是确定性的——虽然每次都错，但错的方式一样，你可以观测到、可以追踪、可以一次修好。

> **结论：宁可写一条不准的 skill（至少错误是确定性的），也不要什么都不写（让 agent 自由猜测 = 不可预测的雷）。**

这也是为什么 Cobus 的 anti-patterns 里没有「skill 写错了」——但有「no skill / no state」。**没有比错误更危险**。

### 还不准的典型场景

| 场景 | skill 写了什么 | 实际约定 | 后果 | 修复 |
|------|----------------|----------|------|------|
| 命令过时 | "用 jest" | 已迁移到 bun test | 每次用错 | 改 skill 一行 |
| 约定演进 | "用 default export" | 已改为 named | 每次风格错 | 改 skill 一行 |
| 事故遗漏 | 没提 webhook 签名 | 必须先验签 | 安全风险 | 补一条铁律 |

每种都是**改一次 skill 就全部修好**。这就是确定性错误的优势——修复成本极低。

---

## 九、反例：过度依赖 skill 造成的新问题

skill 是还债工具，但它自己也会制造新问题。反衰减篇（系列七）讲过「过时 skill = intent debt 回潮」，这里补充两个更微妙的反模式。

### 反模式 1：Skill 通胀（Skill Inflation）

```
症状: skill 越写越多, 50 个 skill 常驻 system prompt
原因: 每遇到一个新约定/教训就写一个 skill, 从不合并/清理
后果:
  - system prompt 膨胀 (50 × 50 tokens = 2500 tokens 纯描述)
  - 描述重叠 → 模型不确定该加载哪个
  - 维护成本爆炸 → 人放弃维护 → skill 过时 → 回潮
```

**对策**：
- skill 数量控制在 15-20 个以内
- 定期合并相似 skill（ci-triage + ci-fix → ci-sweeper）
- 描述写清边界，避免重叠（Skills 篇原则 1）

### 反模式 2：Skill 过时（Stale Skill）

```
症状: skill 说 "用 jest", 项目已迁移到 bun test
原因: 项目演进, skill 没跟
后果: 每次都按过时 skill 干 → 确定性错误
      → 但如果没发现, 会持续犯错
```

**对策**：
- 反衰减篇的 Behavior Drift 检测（基线回归 + 分布对比）
- Meta-Loop 的 skill evolution（定期审查 skill 是否与项目一致）
- 人定期 audit（每季过一遍所有 skill）

### 反模式 3：Skill 替代了思考

```
症状: 依赖 skill 到极端 → 人不再理解为什么有这条约定
原因: skill 写了 "webhook 先验签", 但人不知道为什么
后果: 人变成 skill 的执行者而非判断者
      → 这正是 Cognitive Surrender 的早期形态
```

**这是最微妙的反模式**。skill 的初衷是「持久化人的判断力」，但如果人只知道「skill 这么说」而不知道「为什么这么说」，skill 就从「肌肉记忆」变成了「盲信教条」。

**对策**：
- skill 铁律**附注理由**（「webhook 先验签 — 2026-03 伪造请求事故」）
- 人定期 audit 时**问为什么**（这条铁律还在成立吗？条件变了吗？）
- 这是方法论第三篇（Cognitive Surrender）的核心议题

### 三个反模式对照

| 反模式 | 症状 | 根因 | 关联 |
|--------|------|------|------|
| Skill 通胀 | skill 太多 | 只增不减 | State Rot 的 skill 版本 |
| Skill 过时 | skill 与现实不符 | 项目演进 skill 没跟 | Behavior Drift |
| Skill 替代思考 | 人不知为何 | 盲信 skill | Cognitive Surrender |

> 三个反模式的共同教训：**skill 是工具不是目的。** 目的是「让冷启动的 agent 按项目特定意图行事」。skill 太多/过时/被盲信，都偏离了这个目的。

---

## 十、与 Comprehension Debt 的关系

意图债是系列方法论三篇里的第一篇。它与第二篇的主题——Comprehension Debt（理解债）——是一枚硬币的两面。

| 维度 | Intent Debt（本文） | Comprehension Debt（下一篇） |
|------|---------------------|------------------------------|
| **谁的债** | agent 欠的（不知道项目约定） | 人欠的（不理解 loop 产出） |
| **方向** | 信息缺口：项目 → agent | 信息缺口：loop 产出 → 人 |
| **根因** | 冷启动 × 没持久化 | loop 太快 × 人读太慢 |
| **还债工具** | Skills / Memory / AGENTS.md | 强制阅读节奏 / Review Gate |
| **谁还** | 人写 skill（代码侧） | 人读 loop 产出（认知侧） |
| **不还后果** | agent 犯「看起来合理的错」 | 人失去对 loop 的判断力 |

**两者的交叉点**：如果 Comprehension Debt 太高（人不理解 loop 产出），人就无法判断 skill 写得对不对 → skill 质量下降 → Intent Debt 加剧。反之，Intent Debt 太高（agent 总犯错），loop 产出质量差 → 人更不想读 → Comprehension Debt 加剧。

它们是**正反馈循环**。打破循环的唯一方式：**两端同时治理**——用 skill 还意图债（本篇），用强制阅读还理解债（下一篇）。

---

## 十一、pi 上的意图债治理

把概念落到 pi 的能力上。

| 治理动作 | pi 机制 | 效果 |
|----------|---------|------|
| 还「怎么干」的债 | Skills（`.pi/skills/` + progressive disclosure） | 写一次，每次冷启动自动加载 |
| 还「背景」的债 | AGENTS.md（全量注入 system prompt） | 全局约定常驻 |
| 还「干了什么」的债 | memory 工具（`~/.pi/agent/` 持久化） | 运行时积累，按需检索 |
| 量化意图债 | run-log（JSONL）+ Meta-Loop 分析 | attempt/误用率/偏离率可测 |
| 自动还债 | Meta-Loop skill evolution | 失败归因 → 提炼 skill → 人审 |
| 防 skill 过时 | 反衰减的基线回归 + Meta-Loop 审查 | 漂移检测 |

**关键设计**：pi 的三种持久化机制（skill / memory / AGENTS.md）天然对应意图债的三种形态。这不是巧合——pi 的设计哲学就是「用组合覆盖需求」，意图债的治理恰好是三者组合的经典案例。

### 实战：从意图债发现到还债的闭环

```
① 量化: Meta-Loop 分析 run-log → 发现 ci-sweeper avg attempt = 2.1（偏高）
     ↓
② 归因: Analyzer 发现 → "src/auth/ 下失败率 60%, 根因是不知道自定义 token 刷新逻辑"
     ↓
③ 提议: Proposer 建议 → skill 补 "src/auth/ 改动前必读 token-refresh.ts"
     ↓
④ 人审: 人 review → 确认这条知识对 → merge 进 SKILL.md
     ↓
⑤ 验证: 下次 ci-sweeper 遇 src/auth/ → skill 加载 → 读 token-refresh.ts → 首次修对
     ↓
⑥ 效果: avg attempt 2.1 → 1.3 → 意图债减少
```

这是 Meta-Loop 篇（系列八）讲的 Skill Evolution 五步闭环，从意图债视角看——**它就是一个自动化的还债工厂**。

---

## 十二、回顾

1. **意图债 = 冷启动 × 会话次数**。每次冷启动产生意图缺口，未持久化的缺口 = 债。不还只增不减。
2. **冷启动是 LLM agent 的结构性宿命**。不是能力问题，是信息不对称——agent 和项目之间的知识断层。
3. **「自信的猜测」是意图债的具象化**。模型不会说「不知道」，会用通用合理但项目特定地错误的答案填充。这种错最难发现。
4. **三种表现**：约定缺失（怎么干才对）、事故教训缺失（什么绝对不能干）、流程缺失（用什么工具）。
5. **三种还债机制精准分工**：Skill（稳定的怎么干）+ Memory（变化的干了啥）+ AGENTS.md（全局背景）。放错位置 = 债没还对。
6. **可量化**：avg attempt / 误用工具率 / 偏离约定率 / 重复失败率。让不可见的债变可见。
7. **Skill 是复利工具**：写一次读每次，progressive disclosure 让它几乎免费。loop 跑三天就回本。
8. **不还比不准更危险**：不还 = 不可预测的雷；不准 = 确定性错误，改一次全修好。宁可写一条不准的 skill，也不让 agent 自由猜测。
9. **三个反模式**：skill 通胀（只增不减）、skill 过时（项目演进没跟）、skill 替代思考（盲信教条 = Cognitive Surrender 早期形态）。
10. **与 Comprehension Debt 互为正反馈**：意图债高 → loop 犯错多 → 人不想读 → 理解债高 → skill 质量降 → 意图债更高。打破循环需两端同治。

一句话收尾：**意图债是 LLM agent 时代的结构性债务——它不是 bug，是冷启动这个约束的必然产物。你能做的不是消灭它，而是用 skill 把它持久化、用 memory 把它即时化、用 Meta-Loop 把它自动化。还债不是一次性动作，而是一种工程纪律：每发现一个意图缺口，就问一句「这条该写进哪」。**

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering)（Intent Debt 原始定义）
- [系列四：Memory 系统](./loop-engineering-memory)（四层记忆架构，skill 作为长期记忆）
- [系列七：反衰减](./loop-engineering-antidegradation)（过时 skill = intent debt 回潮）
- [系列八：Meta-Loop](./loop-engineering-meta-loop)（Skill Evolution 闭环 = 自动还债）
- [系列十一：Skills 工程化](./loop-engineering-skills)（skill 设计原则与 progressive disclosure）
- [Cobus Greyling — Concepts（Intent Debt 定义）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [Cobus Greyling — Primitives（Skills 段）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md)
- [Cobus Greyling — Anti-Patterns](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md)
- [Addy Osmani — Loop Engineering essay](https://addyosmani.com/blog/loop-engineering/)
- pi 能力：Skills（progressive disclosure）· AGENTS.md（Context Files）· memory 工具 · Meta-Loop skill evolution

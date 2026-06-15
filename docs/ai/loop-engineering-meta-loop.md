# Meta-Loop：让 loop 自己改进 loop

> 系列第八篇。前七篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation)
>
> 第七篇结尾留了个钩子：反衰减机制里，量化认知债、强制 review、跑基线回归，都需要一个「**监管 loop 的 loop**」来执行。这就是 Meta-Loop。这篇讲它怎么让 loop 从「会跑」升级到「会改进」。

---

## 零、为什么需要 Meta-Loop

先看一个困境。

前七篇设计的 loop 越来越完善：会跑、会记、会协调、会对抗衰减。但所有 loop 都有一个共同特征——**它们不会改自己**：

- CI Sweeper 修代码，但不会修**自己的** skill
- Daily Triage 排优先级，但不会优化**自己的** triage 规则
- Memory 系统存记忆，但不会决定**该记什么不该记什么**

这些「元层次」的工作，前七篇都默认**人来做**。但人是瓶颈：

| 人做元层次工作的问题 | 后果 |
|----------------------|------|
| 人太忙没空优化 skill | skill 过时，intent debt 回潮 |
| 人看不出 loop 输出的系统性偏差 | 同类错误反复 |
| 人不会每周审计所有 run-log | 异常堆积无人发现 |
| 人凭感觉调 cadence/预算 | 调优滞后于实际负载 |

**Meta-Loop 的价值**：把「监管和改进 loop」这件事本身，也变成一个 loop。它是 loop 工程的递归——loop 管 loop。

> Multi-Loop 篇提过 meta-loop 一句：「当 loop 多到人管不过来，出现管理 loop 的 loop。」这篇展开。

---

## 一、Meta-Loop 的定义

```
普通 loop:    事件源 → loop → 改代码/做事 → 回写 state
Meta-Loop:    其他 loop 的 run-log → meta → 改 loop 自身（skill/规则/预算/级别）→ 回写 loop 配置
```

一句话：**普通 loop 改世界，Meta-Loop 改 loop。**

它处理的不是「仓库的 issue / CI 失败」，而是「**其他 loop 的行为本身**」。输入是 run-log、STATE、metrics；输出是 loop 的配置变更。

### Meta-Loop 与普通 loop 的本质区别

| 维度 | 普通 loop | Meta-Loop |
|------|-----------|-----------|
| 输入 | 业务事件（CI 失败、PR、issue） | 其他 loop 的 run-log/metrics |
| 输出 | 代码改动、通知 | loop 配置（skill/规则/cadence/级别） |
| 改的对象 | 代码库 | loop 系统 |
| 作用域 | 单个 loop 内 | 跨所有 loop |
| 自治级别 | L1-L3 | **最高 L1，通常只报告** |

**最后一条是铁律**：Meta-Loop 的自治级别**默认 L1**（只报告建议），绝不自动改 loop 的关键配置。原因见第四节——改 loop 比改代码风险更高。

---

## 二、Meta-Loop 的四类职责

Meta-Loop 不只一件事，是四类工作的集合。

### 职责 1：观测（Observability）—— 让 loop 系统可审计

把分散在各 loop 的 run-log 汇总成全局视图，发现系统性问题。

```markdown
## Meta-Loop 周报 — 2026-W24

### 各 loop 运行状况
| Loop | Runs | 成功率 | Avg tokens | Escalate率 | 异常 |
|------|------|--------|------------|-----------|------|
| ci-sweeper | 96 | 78% | 187k | 22% | ⚠️ 连续3次同PR失败 |
| pr-babysitter | 288 | 91% | 23k | 9% | escalate率偏低 |
| daily-triage | 7 | 100% | 51k | 0% | 正常 |
| dep-sweeper | 4 | 50% | 312k | 50% | ⚠️ 半数escalate |

### 系统性发现
- ci-sweeper 在 src/auth/ 上的首次修复成功率只有 40%（其他模块 75%）→ skill 可能需补 auth 相关约定
- pr-babysitter escalate 率从 25% 降到 9% → 怀疑护栏失效（反衰减篇的 Drift 信号）
- 全 loop 周预算用了 78%，接近 80% 降级阈值
```

**关键**：Meta-Loop 不只罗列数字，而是**发现异常 + 归因**。哪个 loop、哪个模块、哪种类型的异常。

### 职责 2：调优（Tuning）—— 建议 loop 参数调整

根据历史数据建议 cadence、预算、attempt 上限的调整。

| 发现 | Meta-Loop 建议 | 谁执行 |
|------|----------------|--------|
| ci-sweeper 凌晨 2-6 点零触发 | cadence 从 15m 改 30m（夜间） | 人改 LOOP.md |
| pr-babysitter 撞 ci-sweeper 占 30% 运行 | 错峰：pr-babysitter 改 20m | 人改 LOOP.md |
| dep-sweeper 单次均 312k tokens | 拆成两次（scan + fix 分离） | 人重构 loop |
| ci-sweeper MAX_ATTEMPTS=3 从未用满 | 可考虑降到 2（省 token） | 人改护栏配置 |

**Meta-Loop 产出「建议」，不直接改**。原因：调优决策涉及取舍（降 attempt 上限省 token 但可能漏修），需要人判断。

### 职责 3：知识沉淀（Skill Evolution）—— 把经验变成 skill

这是 Meta-Loop 最有价值、也最危险的职责：**从 loop 的失败中提炼知识，更新 skill**。

```
ci-sweeper 第 3 次在 src/auth/oauth.ts 上失败
        ↓ 归因
根因: 它不知道本项目用自定义 token 刷新逻辑（非标准库）
        ↓ Meta-Loop 提炼
建议在 ci-sweeper skill 补一条:
  "src/auth/ 下改动前, 必须先读 src/auth/token-refresh.ts 理解自定义刷新逻辑"
        ↓ 人审 → merge 进 SKILL.md
下次 ci-sweeper 遇同类问题, 首次就修对 (attempt 3→1)
```

**这是「自我演进」的核心机制**：loop 失败 → 归因 → 沉淀成 skill → 下次不失败。Loop 越跑越聪明。

### 职责 4：护栏执行（Guardrail Enforcement）—— 执行反衰减机制

第七篇的四种反衰减机制，Meta-Loop 是执行体：

| 反衰减机制 | Meta-Loop 怎么执行 |
|------------|-------------------|
| Comprehension Debt 量化 | 每周算未读占比，超 15% 设 DEGRADE flag |
| Review Gate | 检测未 review 的合并，阻塞 loop 继续 |
| Behavior Drift 检测 | 跑基线回归，对比输出分布 |
| State Rot 巡检 | 抽查各 STATE.md 的引用存活率 |

> 反衰减篇说「机制天然指向 Meta-Loop」——这就是答案。没有 Meta-Loop，反衰减只是写在文档里的规则；有了它，规则才被执行。

---

## 三、Meta-Loop 的架构

```
┌──────────────────────────────────────────────────────────────┐
│                    Meta-Loop (独立 loop)                       │
│                                                              │
│  调度: 每日(观测+护栏) / 每周(调优+知识沉淀)                    │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │ Collector  │  │  Analyzer  │  │  Proposer  │             │
│  │ 收集所有    │→ │ 分析异常   │→ │ 提议改进   │             │
│  │ run-log    │  │ 归因问题   │  │ 产出建议   │             │
│  └────────────┘  └────────────┘  └─────┬──────┘             │
│                                        │                     │
│                          ┌─────────────┼─────────────┐      │
│                          ▼             ▼             ▼      │
│                   ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│                   │ Reporter │  │ Applier  │  │ Auditor  │  │
│                   │ 出报告    │  │ 建议改配  │  │ 跑基线   │  │
│                   │ (L1)     │  │ (人审)    │  │ 检测漂移  │  │
│                   └──────────┘  └──────────┘  └──────────┘  │
└──────────────────────────────────┬───────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ci-sweeper│   │triage    │   │其他 loop │
              │的 run-log│   │的 run-log│   │的 run-log│
              └──────────┘   └──────────┘   └──────────┘
```

### 三个子角色

| 角色 | 做什么 | 自治 |
|------|--------|------|
| **Collector** | 读所有 loop 的 run-log、STATE、metrics，归一成 Meta-State | 全自动 |
| **Analyzer** | 用 LLM 分析「为什么这个 loop 这里失败了/慢了/漂移了」 | 全自动 |
| **Proposer** | 产出结构化建议（改 skill / 改配置 / 降级） | **只提议，不执行** |

**Proposer 永远是 L1**——这是 Meta-Loop 的安全铁律（见下节）。

---

## 四、为什么 Meta-Loop 必须 L1

这是整篇最关键的安全设计。

**Meta-Loop 改的是 loop 本身，比改代码风险高一个数量级。**

| 普通 loop 出错 | Meta-Loop 出错 |
|----------------|----------------|
| 改坏一个文件 | 改坏所有 loop 的 skill/配置 |
| 影响一次运行 | 影响后续所有运行 |
| 回滚一个 commit | 回滚「学习成果」很难（已渗入多个 skill） |
| 单点故障 | 全局污染 |

具体场景：如果 Meta-Loop 自动把 ci-sweeper 的 skill 改错了，ci-sweeper 会**持续**地按错误 skill 行动，而它的 verifier 可能验证不出（因为 skill 是 verifier 的「正确」依据）。错误会**自我强化**。

### 三道安全防线

```
防线1: Meta-Loop 永远只提议, 不执行
        ↓
防线2: 所有提议进 Human Review Queue
        ↓  人审通过
防线3: 改动进 loop-config Git 分支, 走 PR review
        ↓  merge 后
生效（下次 loop 启动加载新 skill/配置）
```

**绝不让 Meta-Loop 直接改 SKILL.md / config.js / LOOP.md。** 它的输出是「建议」，建议必须经人审 + Git 流程才生效。

### 唯一例外：自动降级

只有一个动作 Meta-Loop 可自动执行——**降级**（L3→L2、暂停 loop）。原因：降级是「更安全」的方向，出错也只是 loop 变保守，不会造成损害。

```typescript
// Meta-Loop 可自动执行的（降级方向，安全）
if (comprehensionDebtRatio > 0.15) setFlag("ci-sweeper", "DEGRADE_L3_TO_L2");
if (reviewCompliance < 0.8) setFlag("ci-sweeper", "PAUSE");
if (budgetUsed > 0.8) setFlag("GLOBAL", "ALL_DEGRADE_TO_L1");

// Meta-Loop 绝不能自动执行的（升级方向或改认知，危险）
// ❌ setFlag("ci-sweeper", "UPGRADE_L2_TO_L3")   // 升级要人批
// ❌ editSkill("ci-sweeper", "...")               // 改 skill 要人审
// ❌ changeModel("ci-sweeper", "opus")            // 换模型要人批
```

**方向不对称**：降级可自动，升级必人审。这是 Meta-Loop 的核心安全原则。

---

## 五、Skill Evolution 的完整闭环

职责 3（知识沉淀）是 Meta-Loop 最闪亮的能力，单独展开。

### 闭环五步

```
① 检测失败
   ci-sweeper 在 src/auth/ 第3次失败 (attempt=3, escalate)
        ↓
② 归因分析 (Meta-Loop 的 Analyzer)
   读: run-log + diff + verifier 反馈 + STATE 历史
   问: "为什么这次修不对? 缺什么知识?"
   答: "loop 不知道本项目用自定义 token 刷新逻辑"
        ↓
③ 提炼建议 (Proposer)
   建议补 skill:
   "## Auth 模块特殊约定
    src/auth/ 下改动前必读 src/auth/token-refresh.ts
    本项目用自定义刷新（非标准库），mock 要对应"
        ↓
④ 人审 + merge (Human Review Queue)
   人判断: 这条知识对吗? 通用吗? 会不会误导?
   通过 → 提 PR 改 SKILL.md → review → merge
        ↓
⑤ 验证生效
   下次 ci-sweeper 遇 src/auth/ 问题:
   skill 加载 → 读 token-refresh.ts → 首次修对
   attempt 从 3 降到 1, token 省 60%
```

**这是 loop 的「学习」**：失败 → 提炼 → 沉淀 → 下次不失败。整个 loop 系统随时间变聪明。

### Skill Evolution 的护栏

知识沉淀是 Meta-Loop 最危险的职责（在改 loop 的认知），需最强护栏：

| 护栏 | 规则 |
|------|------|
| **人审必须** | 所有 skill 改动经人 review，不自动 merge |
| **可追溯** | 每条 skill 改动记「来自哪次失败、归因什么」（audit trail） |
| **可回滚** | skill 改动进 Git，发现误导可 revert |
| **防过拟合** | 单次失败不沉淀，需「同类失败 ≥2 次」才提议（避免噪音） |
| **防污染** | Meta-Loop 不能删 skill 条目（只增不删，删要人手动） |

> **只增不删**很重要：Meta-Loop 可能误判某条 skill「过时」而提议删，但删知识比加知识危险（删了就忘了）。所以只允许提议新增/修改，删除纯人手动。

---

## 六、Meta-Loop 自己怎么反衰减

第七篇讲 loop 会衰减，Meta-Loop 也是 loop，也会衰减。怎么办？

**递归问题**：谁监督监督者？

答案是**不递归到底**——Meta-Loop 的反衰减靠人，不靠 Meta-Meta-Loop。理由：

```
Meta-Meta-Loop 监督 Meta-Loop?
  → Meta-Meta-Meta-Loop 监督 Meta-Meta-Loop?
    → 无限递归
```

递归无解。在某一层必须由人兜底。**那一层就是 Meta-Loop**——它是自动化的最后一层，之上是人。

### Meta-Loop 特有的衰减与对策

| 衰减 | 症状 | 对策（人执行） |
|------|------|----------------|
| **归因退化** | Analyzer 归因越来越虚（「可能是配置问题」） | 人每月抽检 Meta-Loop 的归因质量 |
| **建议通胀** | Proposer 建议越来越多、越来越水 | 设「建议采纳率」指标，低于 30% 说明提议质量差 |
| **认知同化** | Meta-Loop 和被监督的 loop 用同模型，盲点一致 | Meta-Loop 故意用**不同模型**（差异化） |
| **flag 失控** | 自动降级 flag 越设越多，loop 全停 | flag 有 TTL，超期自动清除，需人续设 |

**最重要的对策：Meta-Loop 用与被监督 loop 不同的模型**。否则它的盲点和被监督 loop 一样，发现不了系统性问题。这是「Adversarial」思想在元层次的延伸——验证链要独立，Meta-Loop 也要独立。

---

## 七、pi 上的 Meta-Loop 实现

Meta-Loop 本质是一个特殊 loop，前七篇的所有设计都适用，加几个 Meta 特性。

### 7.1 独立进程 + 只读访问其他 loop

```typescript
// meta-loop/runner.ts
const { session } = await createAgentSession({
  cwd: REPO,
  tools: ["read", "grep", "find", "bash", "memory"],  // 无 edit/write（L1）
  sessionManager: SessionManager.inMemory(REPO),
});

// Collector: 读所有 loop 的 run-log（只读）
const allLogs = ["ci-sweeper","pr-babysitter","daily-triage","dep-sweeper"]
  .flatMap(name => readRunLog(`${name}-run-log.jsonl`));

await session.prompt(`你是 Meta-Loop Analyzer。读下面所有 loop 的 run-log,
  发现系统性问题（反复失败、漂移、预算异常）。归因到根因。
  对每个问题产出结构化建议（改哪个 loop 的什么）。
  绝不直接改文件，只输出建议 JSON。
  --- run-logs ---
  ${JSON.stringify(allLogs)}`);
```

### 7.2 建议进 Human Review Queue

```typescript
// Proposer 产出 → 写入 review queue（不直接改 loop 配置）
const suggestions = parseSuggestions(output);
for (const s of suggestions) {
  appendReviewQueue({
    id: uuid(),
    type: s.type,           // "skill_add" | "config_change" | "cadence_tune"
    target: s.targetLoop,
    suggestion: s.content,
    evidence: s.evidence,    // 来自哪次失败
    createdAt: now(),
    status: "pending",       // 人审前永远 pending
  });
  // 人审通过 → 才生成 PR 改 SKILL.md/config
}
```

### 7.3 用 memory 工具积累「loop 经验库」

Meta-Loop 的归因结果，沉淀进 memory（第四层语义记忆，见 Memory 篇）：

```
值得记的（写 memory）:
- "ci-sweeper 在 src/auth/ 反复失败, 根因是自定义 token 刷新逻辑" (已沉淀成 skill)
- "dep-sweeper 周末 escalate 率飙升, 根因是 npm registry 间歇性慢" (环境因素)
- "pr-babysitter 换 opus 后 false-positive 翻倍, opum 对 diff 过度敏感" (模型特性)

下次同类异常出现, Meta-Loop 先 memory_search 找历史归因
→ 不用从零分析, 直接复用经验
```

**这是 Meta-Loop 自己的「越跑越聪明」**——它的归因经验也沉淀成记忆。

### 7.4 intercom 汇报 + 反向控制

Meta-Loop 通过网关层（第六篇）向人汇报，人也通过网关反向批准建议：

```
Meta-Loop 发现异常 → intercom → Slack #loop-meta
  "ci-sweeper 在 auth 反复失败, 建议补 skill 条目, 见 review queue #42"
人 Slack 回 "approve #42"
  → 网关 → intercom → Meta-Loop 触发 PR 生成 → 人最终 review PR
```

网关篇的「双向闭环」在 Meta-Loop 这里最有价值——loop 的改进建议需要人批准，intercom 让这个批准流可以跨渠道（Slack/CLI/Web）。

---

## 八、Meta-Loop 的成熟度演进

Meta-Loop 不是第一天就上，按成熟度分阶。

| 阶段 | Meta-Loop 形态 | 时机 |
|------|----------------|------|
| **0. 无** | 人手动看 run-log | loop 数 ≤2，人管得过来 |
| **1. 观测** | Meta-Loop 只出周报（Collector + Reporter） | loop 数 3+，人看不过来 |
| **2. 调优建议** | 加 Tuning 建议（cadence/预算） | loop 跑了 1 月+，有数据 |
| **3. 知识沉淀** | 加 Skill Evolution 闭环 | loop 稳定，开始有重复失败模式 |
| **4. 护栏执行** | 加自动降级（反衰减执行体） | loop 多到反衰减需自动化 |

**不要跳级**。没观测就上知识沉淀 = 提议质量差（无数据基础）；没知识沉淀就上护栏执行 = 降级判断不准。

> 这呼应反衰减篇的「制度优先于代码」——Meta-Loop 的每个阶段，都是先有人工制度（人看周报、人调优），才把它自动化成 Meta-Loop 职责。

---

## 九、Meta-Loop 的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **自我强化错误** | S3 | Meta-Loop 把错误知识沉淀进 skill，所有 loop 跟着错 | 人审必须 + 只增不删 + 可回滚 |
| **归因退化** | S2 | Analyzer 归因越来越虚 | 人抽检 + 用不同模型 |
| **建议通胀** | S1→S2 | 建议多而水，人审疲劳 | 采纳率指标 + 阈值过滤 |
| **认知同化** | S2 | Meta-Loop 与 loop 同模型，盲点一致 | 强制差异化模型 |
| **越权执行** | S3 | Meta-Loop 绕过人审直接改配置 | 代码层禁止（tools 无 edit/write） |
| **flag 失控** | S2 | 降级 flag 堆积，loop 全停 | flag TTL + 超期清除 |
| **递归衰减** | S2 | Meta-Loop 自己衰减无人发现 | 人在 Meta 层兜底，不递归 |

> **越权执行是 S3**——Meta-Loop 若能直接改 skill，等于绕过所有安全设计。代码层硬保证：Meta-Loop 的 tools 白名单**不含 edit/write**，只有 read + memory。它物理上改不了配置文件，只能写建议到 review queue。

---

## 十、回顾

1. **Meta-Loop 改 loop，不改代码**。普通 loop 改世界，Meta-Loop 改 loop 系统。
2. **四类职责**：观测（汇总）、调优（建议参数）、知识沉淀（提炼 skill）、护栏执行（反衰减）。
3. **默认 L1，只提议不执行**。Meta-Loop 改的是 loop 认知，比改代码危险一个数量级。
4. **唯一例外：自动降级**。降级是安全方向，可自动；升级必人审。方向不对称。
5. **Skill Evolution 五步闭环**：检测失败 → 归因 → 提炼 → 人审 → 验证。这是 loop「越跑越聪明」的核心。
6. **知识沉淀护栏**：人审必须、可追溯、可回滚、防过拟合（≥2 次同类失败）、只增不删。
7. **不递归到底**：Meta-Loop 是自动化最后一层，之上是人。谁监督监督者？人。
8. **Meta-Loop 用不同模型**：避免与被监督 loop 盲点一致（Adversarial 思想的元层次延伸）。
9. **成熟度分阶**：观测 → 调优 → 知识沉淀 → 护栏执行，不跳级。
10. **pi 实现**：独立进程 + 只读 tools（无 edit/write）+ memory 积累经验 + intercom 汇报/批准。

一句话收尾：**Meta-Loop 是 loop 工程的递归性的体现——loop 不仅会跑、会记、会协调，最终还会改进自己。但这条递归链必须在人这里终止：Meta-Loop 之上有且只有人。这是「自我演进」与「失控」的分水岭。**

---

## 参考资料

- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（首次提到 meta-loop）
- [系列四：Memory 系统](./loop-engineering-memory)（Meta-Loop 用 memory 积累经验）
- [系列七：反衰减](./loop-engineering-antidegradation)（Meta-Loop 是反衰减执行体）
- [系列六：网关层](./loop-engineering-gateway)（intercom 用于 Meta-Loop 汇报/批准）
- [Cobus Greyling — Operating Loops（metrics/run-log）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [Cobus Greyling — Concepts（Adversarial Review）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- pi 能力：只读 tools + memory 工具 + intercom + 独立进程

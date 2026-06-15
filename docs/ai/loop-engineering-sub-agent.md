# Sub-agent 编排模式：从 maker/checker 到多 agent 拓扑

> 系列第十篇。前九篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval)
>
> 六原语逐个深挖的第一篇。前面九篇里，sub-agent 只以最简形态出现——单次 implementer→verifier。这篇系统讲**多种编排拓扑**：什么时候用 chain、什么时候用 parallel、什么时候该 dynamic fan-out、review-loop 怎么保证收敛。

---

## 零、为什么编排是门学问

Cobus Greyling 把 sub-agents 列为六原语里「**唯一最重要的结构性模式**」：

> 「**写代码的 Agent 是评判自己工作的最差人选。** 第二个 agent（有时用更强模型，永远用不同指令）负责验证。在无人值守 loop 里，verifier 是你能走开一会儿的唯一依仗。」

但「再开一个 agent」只解决了**两人分工**。真实 loop 的需求远比这复杂：

| 真实需求 | 单 agent 够吗 |
|----------|----------------|
| 先侦察再规划再实现 | ❌ 需要串行流水线（chain） |
| 从三个角度审一个 diff | ❌ 需要并行扇出（parallel） |
| 扫到 N 个 issue，每个派一个修复 | ❌ 需要动态展开（fan-out） |
| 修完再审，审完再修，直到干净 | ❌ 需要收敛循环（review-loop） |

**这四种拓扑各有适用场景、各有失败模式、各有 pi 上的具体写法。** 选错拓扑 = 要么过度串行（慢）、要么过度并行（贵且乱）、要么循环不收敛（infinite fix loop）。

pi 的 subagent 工具原生支持全部四种，但它的能力是「积木」不是「黑盒」——你得知道每种拓扑什么时候用、怎么用、什么时候会崩。这篇讲透。

---

## 一、四种编排拓扑总览

```
 ① Chain（串行）        ② Parallel（并行扇出）
   A → B → C              A ┐
   流水线                   B ├→ 汇总
                           C ┘

 ③ Fan-out（动态展开）   ④ Review-Loop（收敛循环）
   产出结构化列表          Worker → Reviewer
   → 按项数展开            ↑           ↓
   → N 个并行任务          └─ Fixer ←──┘
   → 收集                  （直到干净或达上限）
```

| 拓扑 | 核心结构 | 什么时候用 | 代价 |
|------|----------|------------|------|
| **Chain** | 串行，每步喂 `{previous}` | 后一步依赖前一步结果（recon→plan→implement） | 总延迟 = 各步之和 |
| **Parallel** | 并行，同时跑各自汇总 | 角度独立、互不依赖（多角度 review） | 并行上限受 budget/concurrency |
| **Fan-out** | 动态展开 N 个子任务 | 任务数运行时才知道（扫到 N 个 issue） | N 不可控时有爆炸风险 |
| **Review-Loop** | 循环直到满足条件 | 质量收敛（修→审→修直到干净） | 不收敛 = infinite fix loop |

**选型原则**：
- 有**依赖**→ chain
- **独立角度**→ parallel
- **运行时才知道有几个**→ fan-out
- 要**质量收敛**→ review-loop（但必须有上限）

---

## 二、Chain：串行流水线

### 模型

```
 Scout（侦察）      Planner（规划）       Worker（实现）
  读代码库     →     产实现计划      →     按计划写代码
 context.md        plan.md              改动 diff
```

每一步的输出通过 `{previous}` 模板变量喂给下一步。前一步的失败会**阻断**后续。

### pi 写法

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Map the auth flow and summarize key files" },
    { agent: "planner", task: "Create an implementation plan from {previous}" },
    { agent: "worker", task: "Implement the approved plan based on {previous}" },
  ]
})
```

**关键变量**：
- `{previous}`：上一步的完整输出（简单线性 handoff）
- `{outputs.name}`：用 `as: "name"` 命名后，后续步骤按名引用（更精准）
- `{chain_dir}`：chain 的临时目录（相对输出路径安全）
- `{task}`：当前步骤的 task

### 命名输出 vs `{previous}`

```typescript
// 命名输出：后续步骤引用特定结果（非紧邻的也行）
subagent({
  chain: [
    { agent: "scout", as: "recon", task: "Map auth flow", output: "recon.md" },
    { agent: "planner", as: "plan", task: "Plan from {outputs.recon}", output: "plan.md" },
    { agent: "worker", task: "Implement {outputs.plan}. Recon context: {outputs.recon}" },
  ]
})
```

**何时用 `as` 而非 `{previous}`**：第三步需要第一步的输出（不只是紧邻的第二步）时，命名引用比 `{previous}`（只拿到上一步）更精准。

### 何时用 chain

| 场景 | 为什么是 chain 而非 parallel |
|------|------------------------------|
| recon → plan → implement | plan 依赖 recon 结果，implement 依赖 plan |
| research → context-build → handoff-plan | 每步喂上一步 |
| triage → investigate → fix | diagnose 是 fix 的前提 |

**反例**：三个角度审同一个 diff——它们互相独立，该用 parallel 不是 chain。

### chain 的 file-only 模式

大输出（完整代码扫描、长 research）别塞进 `{previous}`（上下文爆炸）。用 `outputMode: "file-only"`：

```typescript
subagent({
  chain: [
    { agent: "scout", task: "Full codebase scan", output: "scan.md", outputMode: "file-only" },
    // {previous} 此时是 "Output saved to: /abs/scan.md (48.2 KB)" 紧凑引用
    { agent: "planner", task: "Read {previous}, plan implementation", output: "plan.md" },
  ]
})
```

> file-only 让 `{previous}` 只拿到**文件路径引用**而非全文，避免每步上下文膨胀。大输出标配。

---

## 三、Parallel：并行扇出

### 模型

```
          ┌─ Reviewer A（正确性/回归）
 diff ────┼─ Reviewer B（测试/验证）     ──→ 汇总
          └─ Reviewer C（简洁/可维护）
```

多个 agent **同时**跑，角度独立，产出汇总后由 parent 决策。

### pi 写法

```typescript
subagent({
  tasks: [
    { agent: "reviewer", task: "Review the current diff for correctness and regressions. Inspect changed files directly; do not rely on the worker's reasoning.", output: false },
    { agent: "reviewer", task: "Review the current diff for tests and validation quality.", output: false },
    { agent: "reviewer", task: "Review the current diff for simplicity and maintainability.", output: false }
  ],
  concurrency: 3,
  context: "fresh",
  async: true
})
```

**四个关键设计**：

1. **`context: "fresh"`**：每个 reviewer 独立干净上下文，不看 implementer 的推理过程。这是**对抗式（adversarial）**的物理基础。
2. **`concurrency: 3`**：并行上限。防预算爆炸。
3. **`output: false`**：review-only 任务不写文件，结果直接回 parent。
4. **`async: true`**：parent 不阻塞，可继续本地 inspection，async 完成后收结果。

### 每个任务可独立 override

```typescript
subagent({
  tasks: [
    { agent: "scout", task: "Map auth", output: "auth-context.md", progress: true },
    { agent: "researcher", task: "Research OAuth best practices", output: "oauth-research.md" },
    { agent: "reviewer", task: "Review auth tests", model: "anthropic/claude-sonnet-4" }  // ← 单任务换模型
  ],
  concurrency: 3
})
```

**模型路由**：parallel 是实现「verifier 用更强模型、implementer 用标准模型」的天然位置——L3 篇讲的对抗式验证链，这里落地。

### 并行路径不冲突规则

```
✅ 并行安全的（读/审查/研究，互不改同文件）
   - 多个 reviewer 审同一 diff
   - scout + researcher（一读本地一查外部）
   - 多个 context-builder 写不同输出路径

❌ 并行危险的（多个 writer 改同一 worktree）
   - 两个 worker 同时改 src/auth/
   → 要么串行化（chain），要么用 worktree 隔离
```

> **铁律：parallel 默认单写线程。** 一个 parent + 多个 advisory/research/review agent。要并行写，必须 `worktree: true` 隔离。

---

## 四、Fan-out：动态展开

### 与 parallel 的区别

| 维度 | Parallel（静态） | Fan-out（动态） |
|------|-------------------|-----------------|
| 任务数 | 编写时已知（手写 3 个） | 运行时才知道（扫到 N 个） |
| 模板 | 每个任务手写 | 一个模板 + 动态展开 |
| 触发 | 直接列 | 前一步产出结构化列表 → 按列表展开 |

### 场景

```
  ① 扫描 diff → 产出结构化 issue 列表
     [
       { path: "src/auth.ts", issue: "null check missing" },
       { path: "src/api.ts",  issue: "race condition" },
       { path: "src/db.ts",   issue: "SQL injection" }
     ]
                          ↓ expand
  ② 按列表展开 → 3 个并行 planner（每个一个 issue）
                          ↓ collect
  ③ 收集所有 planner 输出
```

### pi 写法（expand + collect）

fan-out 在 chain 内实现：前一步用 `outputSchema` 产出结构化数据，后一步用 `expand` 展开。

```typescript
subagent({
  async: true,
  context: "fresh",
  chain: [
    // ① 生产者：产出结构化目标列表
    {
      agent: "reviewer",
      as: "scanner",
      task: "Scan the diff for all issues. Return a structured list.",
      outputSchema: { /* 每个 item: { path, issue } */ }
    },
    // ② 动态展开：按列表展开为 N 个并行子任务
    {
      expand: {
        from: { output: true, path: "issues" },   // 从上一步的 issues 数组
        maxItems: 8,                                 // 硬上限，防爆炸
        parallel: {
          agent: "planner",
          task: "Plan a fix for {item.issue} at {item.path}. Inspect the diff directly."
        }
      },
      collect: { as: "plans" }
    }
  ]
})
```

**三个关键约束**：
- `maxItems`：**必须有**。否则扫到 50 个 issue = 50 个并行任务 = 预算爆炸。
- `{item}` / `{item.path}`：模板变量引用当前展开项。
- `collect.as`：收集所有展开结果到一个命名变量。

### fan-out 的限制

> `.chain.md` 格式**不支持**：嵌套 fanout、动态 agent 选择、reducer、`when` 条件、任意表达式。需要这些时用 `.chain.json` 或直接 JSON 编排。

fan-out 是**结构化数据驱动**的——只适合「列表→展开」这种规整场景。复杂控制流（条件分支、动态选 agent）不是它的设计目标。

---

## 五、Review-Loop：收敛循环

### 模型

```
     ┌────────── Worker（实现/修复）──────────┐
     │                                        │
     ▼                                        │
  Reviewer（审 diff，fresh context）           │
     │                                        │
     ├─ 发现需修的问题 → Fix Worker（应用修复）┘
     │                                        （回到 review）
     │
     └─ 无需修 / 达上限 / 需人决 → 终止
```

这是 L3 篇 FIX↔VERIFY 循环的**结构化版本**——不只是「跑测试过没过」，而是**多角度审查→综合→修复→再审**。

### pi 写法

review-loop 不是单个 API 调用，而是**parent 编排的模式**：worker → parallel reviewers → fix worker 循环。

```typescript
// 第 1 轮：worker 实现
await subagent({
  agent: "worker",
  async: true,
  task: "Implement the approved feature...",
  acceptance: {
    criteria: ["Implement without widening scope"],
    evidence: ["changed-files", "commands-run", "validation-output"],
    maxFinalizationTurns: 3        // ← worker 自己的内部修复上限
  }
});

// 第 1 轮：parallel reviewers 审 diff
const review1 = await subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness/regressions...", output: false },
    { agent: "reviewer", task: "Tests/validation...", output: false },
    { agent: "reviewer", task: "Simplicity/maintainability...", output: false }
  ],
  concurrency: 3,
  context: "fresh",
  async: true
});

// parent 综合 reviewer 发现 → fix worker 应用值得修的
if (hasFixesWorthDoing(review1)) {
  await subagent({
    agent: "worker",
    async: true,
    task: "Apply synthesized reviewer feedback: ..."
  });
  // → 第 2 轮 review（如果 fix 改动大）
}
// 循环直到: 无需修 / 达上限 / 需人决
```

### 终止条件（四条，缺一不可）

review-loop **必须**有明确终止条件，否则就是 Infinite Fix Loop（L3 篇的 S2 事故）：

| 终止条件 | 含义 |
|----------|------|
| **reviewer 无发现** | 没有需修的问题 → 干净，停 |
| **达 review 轮上限** | 默认 3 轮，到上限强制停 |
| **需人决** | 出现未批准的产品/架构选择 → 停，escalate |
| **全是可选改进** | 剩余反馈都是 optional/defer → 停，不为 polish 死循环 |

> **铁律：不为 optional polish 死循环。** review-loop 的目标是「消除 blocker」，不是「追求完美」。第 3 轮还有问题就交给人，不死磕。

### acceptance 契约：goal 式请求的代码化

review-loop 的极端形态是「**跑到条件满足为止**」（类似 `/goal`）。pi 用 `acceptance` 契约编码这个：

```typescript
subagent({
  agent: "worker",
  task: "Fix CI failure #142",
  acceptance: {
    criteria: [
      "改动仅限 src/auth/",
      "npm test 全绿",
      "无新增 TODO"
    ],
    evidence: ["changed-files", "commands-run", "validation-output"],
    verify: [
      { id: "tests", command: "npm test" },
      { id: "lint",  command: "npm run lint" }
    ],
    review: { /* 可选：独立 reviewer 门禁 */ },
    stopRules: ["测试连续两轮失败则停下交还给人"],
    maxFinalizationTurns: 3        // ← 内部修复循环上限
  }
})
```

**acceptance 六字段**：

| 字段 | 作用 |
|------|------|
| `criteria` | 目标条件（必须全部满足） |
| `evidence` | worker 必须返回的证据类型 |
| `verify` | 运行时验证命令（跑测试/构建） |
| `review` | 独立 reviewer 门禁 |
| `stopRules` | 何时停下交还给人 |
| `maxFinalizationTurns` | 内部修复循环上限（防无限） |

`maxFinalizationTurns` 是 acceptance 内部的**安全阀**——worker 在同一 session 里自修，到上限强制停。它和 review-loop 的「3 轮上限」是**两层不同的收敛保护**：一个管 worker 单次内部，一个管 parent 外部循环。

---

## 六、Maker/Checker 的物理隔离原则

四种拓扑里，只要涉及验证（review-loop、parallel reviewers），就必须遵守**物理隔离三原则**。Cobus 称之为「**Adversarial Code Review**」：

> 「**结构性模式：不同 agent 扮演不同角色（探索、实现、验证）。实现者绝不给自己的作业打分。** 这对无人值守 loop 是生死线。」

### 三原则

| 原则 | 为什么 | pi 怎么做 |
|------|--------|-----------|
| **① 不同上下文** | 同上下文 = 同盲点，verifier 看不到 implementer 的推理错误 | `context: "fresh"`（reviewer 不继承 implementer 历史） |
| **② 不同模型（推荐）** | 同模型 = 同偏置，同类型错误互相放过 | `model` override（verifier 用更强或不同厂商模型） |
| **③ 目标相反** | implementer 想「让它过」，verifier 想「证明它不行」 | prompt 写死：verifier「找拒绝的理由」 |

### context: fork vs fresh

pi 的两种 context 模式，选错 = 隔离失效：

| 模式 | 行为 | 适合 |
|------|------|------|
| **`context: "fork"`** | 从父 session **分叉**，继承全部历史 | oracle（审继承的决策和 drift）、worker（继承已批准的计划上下文） |
| **`context: "fresh"`** | **干净**，不看父历史 | reviewer（对抗式审查）、researcher（外部研究） |

> **常见错误**：用 fork 跑 reviewer。fork 继承了 implementer 的全部推理过程，reviewer 等于「看了答案再批改」——**同流合污**。对抗式 review 必须用 fresh。

> **另一常见错误**：worker 用 fresh 却丢了计划上下文。packaged `worker` 默认 fork（继承 parent 已批准的方向），**不要无脑改 fresh**——只有「不依赖父上下文」的独立任务才该 fresh。

### Verifier Theater（验证器戏剧）

物理隔离失败的症状（L3 篇已警示，这里展开）：

```
verifier "批准" 了 → CI 挂 / review 一眼出 bug
        ↓ 根因
① verifier prompt 太虚（"looks good"）→ 改成 "找拒绝理由"
② verifier 没真跑测试 → 加 acceptance.verify
③ verifier 跟 implementer 同模型同上下文 → fresh + 不同模型
```

> **child-reported 命令成功 ≠ runtime 验证。** worker 说「测试过了」是**证据**，不是**验证**。验证 = reviewer gate 返回了结果。acceptance 契约里 `verify` 字段才是真正的运行时验证。

---

## 七、内置 Agent 角色

pi subagent 预装 8 个角色，优先级最低（project/user 自定义同名覆盖）：

| Agent | 职责 | 默认 context | 典型产出 |
|-------|------|-------------|----------|
| `scout` | 快速代码侦察 | 继承 | `context.md` handoff |
| `planner` | 产实现计划 | fork | `plan.md` |
| `worker` | 实现 + 已批准的 oracle handoff | fork | 单写线程实现 |
| `reviewer` | review + 修复专家 | 继承 | 可编辑/修复被审代码 |
| `context-builder` | 需求/代码库 handoff 构建者 | 继承 | 结构化 context 文件 |
| `researcher` | Web 研究简报生成 | 继承 | `research.md` |
| `delegate` | 轻量通用委托 | 继承 | 无固定输出 |
| `oracle` | 决策一致性咨询审查 | fork | 咨询性 review，intercom 协调 |

### 模型 override

内置 agent 默认继承 pi 默认模型。**单次运行 override**：

```text
/run reviewer[model=anthropic/claude-sonnet-4] "Review this diff"
```

**持久 override**（settings.json）：

```json
{
  "subagents": {
    "agentOverrides": {
      "reviewer": {
        "model": "anthropic/claude-sonnet-4",
        "thinking": "high",
        "fallbackModels": ["openai/gpt-5-mini"]
      }
    }
  }
}
```

> **reviewer 用更强模型是 L3 的推荐配置**——对抗式验证链里，verifier 是最后防线，值得配更强模型。这就是「verifier 用 opus、implementer 用 sonnet」的落地方式。

### oracle 不是 fresh reviewer

> `oracle` 是 **forked advisory thread**——继承父历史，用它作为基线契约。它不是 Cognition 文章意义上的 fresh-context reviewer。

别把 oracle 当 fresh reviewer 用：
- **oracle**：审「方向/架构/drift」，需要继承上下文
- **reviewer**：审「diff/正确性」，必须 fresh

### 执行前确认可用

> 铁律：自定义 agent 不存在时回退 delegate。**执行前先 `subagent({ action: "list" })` 确认可用 agent。**

---

## 八、四种拓扑的实战代码汇总

### Chain：recon → plan → implement

```typescript
subagent({
  chain: [
    { agent: "scout", as: "recon", task: "Map auth flow", output: "recon.md" },
    { agent: "planner", as: "plan", task: "Plan from {outputs.recon}", output: "plan.md" },
    { agent: "worker", task: "Implement {outputs.plan}", async: true,
      acceptance: { criteria: ["..."], maxFinalizationTurns: 3 } }
  ]
})
```

### Parallel：多角度 review

```typescript
subagent({
  tasks: [
    { agent: "reviewer", task: "Correctness/regressions...", output: false },
    { agent: "reviewer", task: "Tests/validation...", output: false },
    { agent: "reviewer", task: "Security...", output: false, model: "anthropic/claude-sonnet-4" }
  ],
  concurrency: 3,
  context: "fresh",
  async: true
})
```

### Fan-out：动态展开修复计划

```typescript
subagent({
  async: true,
  chain: [
    { agent: "reviewer", as: "scan", task: "Scan diff, return structured issue list", outputSchema: { /* ... */ } },
    { expand: {
        from: { output: true, path: "issues" },
        maxItems: 8,
        parallel: { agent: "planner", task: "Plan fix for {item.issue} at {item.path}" }
      },
      collect: { as: "plans" } }
  ]
})
```

### Review-loop：收敛循环

```typescript
// parent 编排: worker → reviewers → fix → reviewers → ... (≤3 轮)
// worker 阶段
await subagent({ agent: "worker", async: true, task: "Implement...",
  acceptance: { criteria: [...], verify: [{id:"tests",command:"npm test"}], maxFinalizationTurns: 3 } });
// review 阶段 (fresh, parallel)
const findings = await subagent({ tasks: [...reviewers], context: "fresh", concurrency: 3, async: true });
// fix 阶段 (如有需修)
if (hasBlockers(findings)) await subagent({ agent: "worker", async: true, task: "Fix: ..." });
// → 第 2 轮 review（如 fix 改动大），≤3 轮上限
```

---

## 九、编排特有的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **Verifier 同流合污** | S2 | reviewer 用 fork 继承 implementer 上下文，放水 | `context: "fresh"` + 不同模型 |
| **并行爆炸** | S1→S2(钱) | fan-out 无 maxItems，50 个任务同时跑 | `maxItems` 硬上限 + `concurrency` 限制 |
| **Review-loop 不收敛** | S2 | 修了再审、审了再修，无限循环 | 轮数上限（默认 3）+ 不为 polish 死循环 |
| **并行写冲突** | S2 | 两个 worker 改同一 worktree | 单写线程默认；并行写必须 `worktree: true` |
| **Fan-out 失控** | S2 | 扫到几十项全展开，token 爆炸 | `maxItems` + 筛选优先级（只展开高优） |
| **上下文膨胀** | S1 | chain 每步 `{previous}` 全文传递，上下文滚雪球 | `outputMode: "file-only"` + 命名引用 |
| **模型同质化** | S2 | 所有 agent 同模型，盲点一致 | reviewer/oracle 用不同模型 |
| **async 孤儿** | S1 | async 子任务跑完无人收结果 | `subagent({action:"status"})` 追踪 + 完成通知 |
| **嵌套过深** | S2 | 子 agent 再派子 agent，递归失控 | 默认 `maxSubagentDepth: 2`，不随意调高 |
| **输出路径冲突** | S1 | parallel 任务写同一文件 | 每个任务独立 output 路径 |

### async 的正确姿势

> 铁律：**async 不意味着并行写。** async 的本意是「parent 不阻塞，继续做独立的事」。async worker 改 worktree 时，parent 应在读/验证/综合，不是改同一 worktree。

```
✅ async 正确用法
   parent: 本地 inspection / 验证准备 / 综合
   async worker: 在隔离 worktree 实现
   
❌ async 错误用法
   parent: 同时改同一 worktree
   async worker: 也在改同一 worktree
   → 冲突
```

---

## 十、选型决策树

```
任务需要多 agent 吗?
│
├─ 否 → 单 agent (subagent({ agent, task }))
│
└─ 是 → 步骤间有依赖吗?
   │
   ├─ 是 → 后一步要等前一步吗?
   │  │
   │  ├─ 是 → CHAIN (scout→planner→worker)
   │  │
   │  └─ 否（但逻辑上有序）→ CHAIN with async
   │
   └─ 否 → 任务数编写时知道吗?
      │
      ├─ 知道 → PARALLEL (多角度 review)
      │
      └─ 运行时才知道 → FAN-OUT (expand + collect)

质量需要收敛吗（修到干净）?
│
├─ 是 → REVIEW-LOOP (≤3 轮 + acceptance)
│
└─ 否 → 单次 review 即可
```

---

## 十一、回顾

1. **四种拓扑各有定位**：chain（串行依赖）、parallel（独立角度）、fan-out（动态展开）、review-loop（质量收敛）。
2. **chain 用 `{previous}` / `{outputs.name}`** 传递；大输出用 `outputMode: "file-only"`。
3. **parallel 默认单写线程**：一个 parent + 多个 advisory agent。并行写必须 `worktree: true`。
4. **fan-out 必须 `maxItems`**：否则运行时展开爆炸。只适合「结构化列表→展开」。
5. **review-loop 必须有终止条件**：四条（无发现/达上限/需人决/全可选）。不为 polish 死循环。
6. **acceptance 契约是 goal 式请求的代码化**：criteria + evidence + verify + stopRules + maxFinalizationTurns。
7. **Maker/Checker 三原则**：不同上下文（fresh）、不同模型（推荐）、目标相反（找拒绝理由）。
8. **`context: "fork"` vs `"fresh"`**：fork 继承（oracle/worker），fresh 干净（reviewer）。选错 = 隔离失效。
9. **verifier 用更强模型**：reviewer 配 opus、worker 配 sonnet，通过 `agentOverrides` 持久化。
10. **async ≠ 并行写**：async 让 parent 不阻塞，但写仍要单线程（除非 worktree 隔离）。

一句话收尾：**编排不是「派更多 agent」，而是「用正确的拓扑，让 agent 之间形成对抗与协作的张力」。** 单 agent 是线，chain 是流水线，parallel 是合唱，fan-out 是分身，review-loop 是打磨——选对拓扑，loop 的可靠性和效率才能同时最大化。

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列二：pi L1 落地](./loop-engineering-on-pi) · [系列三：L3 设计](./loop-engineering-l3-design)
- [系列四：Memory 系统](./loop-engineering-memory) · [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)
- [Cobus Greyling — Sub-agents (Maker/Checker Split)](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md)
- [Cobus Greyling — Code Agent Orchestra / Adversarial Code Review](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- pi subagents skill（`pi-subagents`）：SINGLE/CHAIN/PARALLEL 模式、expand+collect 动态 fan-out、acceptance 契约、worktree、context fork/fresh、async
- pi 内置 agent：scout / planner / worker / reviewer / context-builder / researcher / delegate / oracle

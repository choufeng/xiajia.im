# 子代理调度容器：让 Harness 会派活

> 单 agent 装不下所有上下文，复杂任务必须能派活——但「派活」不是复制 prompt，而是让 harness 拥有一个真正的**调度容器**：开进程、传上下文、定验收、隔离文件、外部控制。本篇拆解它。

---

## 目录

- [引言：单 agent 的天花板](#引言单-agent-的天花板)
- [5.1 子代理 = 进程](#51-子代理--进程)
- [5.2 调度模式四象限](#52-调度模式四象限)
- [5.3 acceptance 契约](#53-acceptance-契约)
- [5.4 worktree 隔离](#54-worktree-隔离)
- [5.5 控制平面](#55-控制平面)
- [5.6 上下文边界](#56-上下文边界)
- [5.7 反模式](#57-反模式)
- [5.8 与 Loop 系列第 10 篇的关系](#58-与-loop-系列第-10-篇的关系)
- [迁移清单](#迁移清单)
- [下一步](#下一步)

---

## 引言：单 agent 的天花板

把一个 agent 当成无所不能的「全栈工程师」塞进所有任务，会撞两堵墙。

第一堵是**上下文容量**。一个 session 的 token 窗口有限，把侦察、计划、评审、外部研究全压进同一个上下文，要么撑爆，要么裁剪丢关键细节。窗口是稀缺预算，不是免费仓库（见 [上下文工程篇](./harness-engineering-context)）。

第二堵更阴险——**上下文污染**。同一 session 里实现阶段的推理会污染评审阶段：评审 agent「看过自己的答卷」，盲点被继承，bug 被放过。这不是容量问题，是**角色必须物理隔离**。

解法唯一：让 harness 会**派活**——把任务拆给多个子代理，各有独立上下文、目标、生命周期。这就是**子代理调度容器**。本篇从「容器」视角讲：怎么调度、怎么定义完成、怎么隔离、怎么外部控制。

## 5.1 子代理 = 进程

理解子代理最准的心智模型是**进程**，不是「同一次对话的延续」。

### 定义

子代理是 harness 派生的**独立执行单元**，四要素：

| 要素 | 含义 |
|------|------|
| **独立上下文** | 自己的 token 窗口，不与父共享历史 |
| **独立目标** | 一份明确的 task，不是父上下文的延续 |
| **可并发** | 多个子代理可同时运行 |
| **父子通信** | 父传 task、收 result；子不直接动父的状态 |

在 pi 里子代理是**独立子进程**（`pi` subprocess），带独立系统提示、工具集、模型配置——把「进程」从隐喻变成物理事实。

```
              ┌───────────────────────────┐
              │       Parent session       │
              │   (主 loop / orchestrator) │
              └──────────┬─────┬─────┬─────┘
              spawn A    │     │     │   spawn C
                  ┌──────▼─┐ ┌─▼───┐ │
                  │ child A│ │childB│ │  ...
                  │ ctx #1 │ │ctx#2 │ │
                  │ goal A │ │goalB │ │
                  └────────┘ └──────┘ │
                     result ─────────┘
```

### 为何：与「同一 agent 多轮」的本质区别

同一个 agent 多轮对话本质是**单进程内的状态累积**——上下文越滚越大，角色越混越糊。子代理是**进程级隔离**：

| 维度 | 同一 agent 多轮 | 子代理（进程） |
|------|----------------|----------------|
| 上下文 | 累积共享 | 各自独立 |
| 失败影响 | 一个崩全盘崩 | 一个崩可被父捕获、调度 |
| 角色隔离 | 无法隔离（看得见彼此推理） | 天然隔离 |
| 并发 | 串行 | 可并行 |
| 回滚/清理 | 难（污染已渗入） | 易（杀进程即清） |

**多轮是「一个人换顶帽子」，子代理是「派另一个人」。** 评审要 unbiased，就得派另一个人，且不让他看答卷。

### 怎么做（pi）

```typescript
// 最小委派：派一个 worker 子进程
const r = await subagent({
  agent: "worker",                 // 角色（独立系统提示 + 工具 + 模型）
  task: "为 src/auth/ 加上输入校验，仅改该目录",
});
// r 是 child 的最终输出，回到 parent 的上下文
```

`agent` 决定子进程「是谁」（prompt + tools + model），`task` 决定「干什么」，两者划定进程边界。

### 反模式

- **把子代理当函数调用**：期望它修改父的变量、写父的文件、改父的状态——子代理是黑盒进程，只通过 `task` 进、`result` 出。
- **不设 `task` 边界**：「把这个功能做好」式开放 task = 进程不知道何时停，空转烧钱。

## 5.2 调度模式四象限

容器要会派活，更要会**用对姿势**派活。四种调度模式对应四种任务结构。

### 定义

```
 ① Single（单一委派）    ② Chain（顺序流水线）
   parent ──> child          A ──> B ──> C
   一对一，最简               每步喂 {previous}

 ③ Parallel（并发扇出）   ④ Expand-Collect（动态展开收集）
   parent ─┬─ A             scan → 产出列表
           ├─ B ─> 汇总            → expand N 个并行
           └─ C                    → collect 收集
```

### 对比表

| 模式 | 适用场景 | 上下文传递 | 失败语义 |
|------|----------|-----------|----------|
| **Single** | 单一独立任务（侦察、研究、一次实现） | 父→子 task；子→父 result | 子失败→父决定重试或 escalate |
| **Chain** | 步骤有依赖（recon→plan→implement） | `{previous}` / `{outputs.name}` 线性或命名 handoff | 一步失败**阻断**后续，报「哪步挂了」 |
| **Parallel** | 独立角度（多角度 review、多目标研究） | 各自独立，汇总回父 | 单任务失败不拖垮其他；并行写需隔离 |
| **Expand-Collect** | 任务数运行时才知（扫到 N 个 issue） | 前步产结构化列表→`expand` 展开→`collect` 汇总 | `maxItems` 硬上限防爆炸 |

### 怎么做（pi）

```typescript
// ② Chain：命名输出，让第 3 步引用第 1 步（不只紧邻的第 2 步）
subagent({
  chain: [
    { agent: "scout",    as: "recon", task: "摸清鉴权流程", output: "recon.md" },
    { agent: "planner",  as: "plan",  task: "基于 {outputs.recon} 出实现计划", output: "plan.md" },
    { agent: "worker",   task: "按 {outputs.plan} 实现" },
  ],
});

// ③ Parallel：多个独立角度，每个 fresh context
subagent({
  tasks: [
    { agent: "reviewer", task: "审正确性/回归", output: false },
    { agent: "reviewer", task: "审测试/验证质量", output: false },
    { agent: "reviewer", task: "审简洁/可维护", output: false },
  ],
  concurrency: 3, context: "fresh", async: true,
});

// ④ Expand-Collect：动态展开
subagent({
  async: true, context: "fresh",
  chain: [
    { agent: "reviewer", as: "scan", task: "扫 diff，返回结构化 issue 列表",
      outputSchema: { /* { path, issue }[] */ } },
    { expand: {
        from: { output: true, path: "issues" },
        maxItems: 8,                          // ← 必须有，防爆炸
        parallel: { agent: "planner", task: "为 {item.issue} 在 {item.path} 出修复计划" },
      }, collect: { as: "plans" } },
  ],
});
```

> 大输出别塞 `{previous}`（上下文滚雪球）。chain 用 `outputMode: "file-only"`，让 handoff 只拿到文件路径引用而非全文。

### 反模式

- **把独立角度塞进 chain**：三个 reviewer 本可并行，串成 chain = 三倍延迟，且后者看得见前者推理。
- **fan-out 不设 `maxItems`**：扫到 50 个 issue 全展开 = 50 个并行进程 = 预算爆炸。

> 四象限的**选型决策**（何时 chain、何时 parallel、何时收敛）属 Loop 工程范畴，见 [Loop 系列第 10 篇](./loop-engineering-sub-agent)。本篇只讲承载这些模式的**容器机制**。

## 5.3 acceptance 契约

调度容器最该回答的问题不是「怎么派」，而是「怎么算**完**」。子代理是黑盒进程，父不能窥视它的内心，只能靠**契约**判断它是否达成目标。

### 定义

acceptance 契约是一份**可机器判定的完成边界**，由六字段构成：

| 字段 | 作用 |
|------|------|
| `criteria` | 验收标准（必须全部满足才算完） |
| `evidence` | 子代理必须返回的证据类型（改动文件、跑过的命令、验证输出） |
| `verify` | 运行时校验命令（真跑测试/构建，而非听子代理声称） |
| `review` | 独立 reviewer 门禁（可选的第二道关） |
| `stopRules` | 何时停下、把控制权交还给人 |
| `maxFinalizationTurns` | 子代理内部自修循环的回合上限（安全阀） |

### 为何必须

没有 acceptance 的子代理 = **没有退出条件的进程**，会自我感觉良好地空转、过度发挥、在「再改一点点」里永不收敛：

```
task: "把测试修绿"
  无 acceptance → 子代理「觉得」改完了就停
  → 实际没跑测试 / 跑了但没全绿 / 顺手重构了无关代码
```

`maxFinalizationTurns` 尤其关键：子代理**单次内部修复循环的硬上限**。没它，「改→测→再改」可无限循环；有它，到上限强制停，交回父。

### 怎么做（pi）

```typescript
subagent({
  agent: "worker",
  task: "修复 CI 失败 #142，仅限 src/auth/",
  acceptance: {
    criteria: [
      "改动仅限 src/auth/",
      "npm test 全绿",
      "无新增 TODO",
    ],
    evidence: ["changed-files", "commands-run", "validation-output"],
    verify: [
      { id: "tests", command: "npm test" },
      { id: "lint",  command: "npm run lint" },
    ],
    review: { /* 可选：独立 reviewer 门禁 */ },
    stopRules: ["测试连续两轮失败则停下交还给人"],
    maxFinalizationTurns: 3,        // ← 内部自修上限
  },
});
```

> **铁律：child-reported 成功 ≠ runtime 验证。** 子代理说「测试过了」是**证据**，不是**验证**。`verify` 字段才是真正的运行时校验。

### 反模式

- **`criteria` 太虚**（「把功能做好」）→ 不可判定，子代理自行其是。写成可观测条件。
- **缺 `maxFinalizationTurns`** → 子代理在「再修一点点」里烧光预算。
- **信 child 的口供而不要 `verify`** → 验证器戏剧（verifier theater），CI 照样挂。

## 5.4 worktree 隔离

并行调度里最危险的失败不是「算错」，而是**多个子进程静默覆盖同一份文件**。

### 定义 + 为何

git worktree 让同一仓库拥有多个工作目录，各自独立 working tree、共享 `.git` 历史。两个子代理同时改同一 checkout，B 基于过期版本写回，A 的改动无声消失——比 merge 冲突危险十倍：没人会注意到。

```
worktree:true 时
  child A → /repo-wt-A/  （独立文件副本）
  child B → /repo-wt-B/  （独立文件副本）
  → 物理隔离，互不可见，最后各自 merge 回主干
```

### 怎么做（pi）

```typescript
subagent({
  tasks: [
    { agent: "worker", task: "实现功能 A（仅 src/feature-a/）" },
    { agent: "worker", task: "实现功能 B（仅 src/feature-b/）" },
  ],
  worktree: true,   // ← 每个 task 自动从 HEAD 创建独立 worktree
});
```

### 何时用

| 场景 | 用 worktree? |
|------|-------------|
| 多 writer 并行改代码 | ✅ 必须 |
| 单 writer + 多 advisor（advisor 只读） | ❌ 不需要 |
| 只读 loop（triage、侦察） | ❌ 不需要 |

> **铁律：worktree 是「并行写」的需求驱动的，不是默认选项。** worktree 的完整生命周期管理（创建/cleanup/泄漏治理/preflight）见 [Loop Worktree 篇](./loop-engineering-worktree)。容器层只记一条：要求 git working tree 干净，非 git 仓库直接拒绝（降级到目录复制不是真隔离）。

### 反模式

- 单 writer 场景无脑开 worktree = 浪费磁盘 + 增加合并负担。
- 以为开了 worktree 就万事大吉，却没把子进程的 `cwd` 指向 worktree 路径 → 最阴险：子进程在主仓库改了代码，你却以为隔离了。

## 5.5 控制平面

派出去的活，父要能**看得到、收得住、续得上**——这是控制平面，父与子的协调协议。没有它，async 子代理跑飞了就是**孤儿进程**，无人收尸。

### 定义

控制平面提供四类原语，让父在子进程生命周期外施加影响：

| 原语 | 作用 |
|------|------|
| **status** | 查子代理运行状态（running/done/failed、进度、usage） |
| **interrupt** | 软中断，停下跑偏的子代理（不是杀进程，是可控停止） |
| **resume** | 续跑被中断或挂起的子代理 |
| **notify** | 控制注意力——把父的信号注入子代理，提醒它关注某处 |

### 为何必须

async 子代理的典型灾难是「跑完无人收」：父 fire-and-forget，子进程产出堆在那儿无人取，或父自己崩了留下孤儿。控制平面让派活变成**可观测、可干预**的过程，而非「射出去随它去」。

```
父的生命周期内必须能回答：
  - 派出去的子现在到哪了？          → status
  - 它跑偏了/超预算了，能停吗？     → interrupt
  - 停下后还能接着跑吗？            → resume
  - 要插话提醒它注意某事吗？        → notify
```

### 怎么做（pi）

```typescript
// 启动 async 子代理，父不阻塞
const handle = await subagent({
  tasks: [ /* ... */ ],
  async: true,
  context: "fresh",
});

// 查状态（追踪 async 子代理，防孤儿）
const st = await subagent({ action: "status", id: handle.id });
// → { phase: "running", turns: 4, tokens: {...}, cost, tasks: [...] }

// 软中断跑偏的子代理（伪代码：API 形态以本地 pi-subagents 为准）
await subagent({ action: "interrupt", id: handle.id });

// 续跑
await subagent({ action: "resume", id: handle.id });

// 控制注意力：父提醒子代理聚焦
await subagent({ action: "notify", id: handle.id,
  message: "注意：src/auth/oauth.ts 有并发问题，重点查这里" });
```

> 上面 `interrupt`/`resume`/`notify` 的确切调用形态，以你本地的 pi-subagents 实现为准（不同版本暴露面不同），此处为说明语义的伪代码。核心是：**派活≠放手，容器必须保留对子的干预能力。** 控制平面是**单向通道**——父始终调度者，子始终被调度者；子不反过来控父，拓扑才不失控。

### 反模式

- **fire-and-forget**：async 派出去就不追踪 → 孤儿进程、结果丢失。
- **interrupt 后不 resume 也不清理** → 留下半死的悬挂进程。

## 5.6 上下文边界

进程的「内存」是上下文，容器要管它从哪来——全新还是继承。

### 定义

两种模式决定子进程「脑子里装什么」：

| 模式 | 行为 | 适合 |
|------|------|------|
| **`context: "fork"`** | 从父 session 分叉，继承全部历史 | oracle（审继承的决策/drift）、worker（继承已批准的计划） |
| **`context: "fresh"`** | 全新干净，不看父历史 | reviewer（对抗式审查）、researcher（外部研究） |

### 为何：防上下文污染

对抗式评审的物理基础。reviewer 若用 `fork`，继承 implementer 全部推理——**等于看了答案再批改**。必须 `fresh`，从零审 diff。

反过来 worker 常需 `fork`：继承父已批准的方向、已侦察的上下文，不能从零瞎写。把该 fork 的改 fresh = 丢计划上下文，worker 凭空发挥。

### 怎么做（pi）

```typescript
// reviewer 必须 fresh：对抗式审查
subagent({
  tasks: [{ agent: "reviewer", task: "审 diff 找拒绝理由", output: false }],
  context: "fresh",
});

// worker 默认 fork：继承已批准的计划上下文
subagent({ agent: "worker", task: "实现已批准的计划..." });
```

### 反模式

- **reviewer 用 fork** → 隔离失效。
- **worker 无脑 fresh** → 丢计划上下文，跑偏。

## 5.7 反模式

调度容器的典型翻车，逐条给对策：

| 反模式 | 症状 | 对策 |
|--------|------|------|
| **级联失败** | chain 一步挂，后续全崩且不知哪步挂 | chain 报「哪步失败」；父捕获后决定重试/escalate |
| **无限派活** | 子又派子，递归失控 | 限制子代理嵌套深度，不随意让子再 spawn 子 |
| **acceptance 缺失** | 子代理空转、过度发挥、永不收敛 | 强制 acceptance（criteria + verify + maxFinalizationTurns） |
| **共享文件冲突** | 多子代理改同一 checkout，静默覆盖 | 并行写必须 `worktree: true`；否则单 writer |
| **async 孤儿** | async 子进程跑完无人收 | 控制平面 `status` 追踪 + 完成通知 |
| **上下文污染** | reviewer 用 fork 看了答案 | reviewer 必须 `context: "fresh"` |
| **fan-out 失控** | 扫到几十项全展开，token 爆 | `expand` 必带 `maxItems` 硬上限 |

最该警惕的是**无限派活 + acceptance 缺失**：子代理 spawn 子代理、内部循环无上限、外部又没契约——三重失守，预算烧穿且无产出。

## 5.8 与 Loop 系列第 10 篇的关系

Loop Engineering [第 10 篇](./loop-engineering-sub-agent)讲**编排模式**：何时用 chain/parallel/fan-out/review-loop、maker/checker 物理隔离、收敛循环终止条件——核心是「**循环动力学里多个 agent 怎么连成拓扑**」。

本篇讲**承载这些模式的容器工程**——核心是「**底盘里这套调度机制怎么造、靠什么不翻车**」。

两者互补：Loop 篇答「用哪种拓扑」，Harness 篇答「这种拓扑在容器里靠什么机制落地」。两篇合读，同一套 subagent 能力被讲透。

---

## 迁移清单

把 pi 的子代理调度机制映射到其他 harness：

| 机制 | pi | Claude Code | Cursor | Aider | 通用 harness |
|------|-----|-------------|--------|-------|--------------|
| **子代理 = 进程** | `subagent({ agent, task })` 子进程 | subagent / Task tool（独立上下文） | 无一等价物（单 session 为主） | 单进程，靠 `/architect` 等角色 prompt 模拟 | 抽象出 child 进程 + IPC |
| **单一委派** | `subagent({ agent, task })` | Task 工具单次调用 | 不适用 | 角色切换 | task + result |
| **顺序流水线** | `chain` + `{previous}` | 手动串 Task | 不适用 | 手动分步 | 显式 handoff 队列 |
| **并发扇出** | `tasks` + `concurrency` | 多 Task 并行 | 不适用 | 不适用 | 任务池 + 并发上限 |
| **动态展开** | `expand`/`collect` + `maxItems` | 手动展开 | 不适用 | 不适用 | scan→fan-out→reduce |
| **验收契约** | `acceptance` 六字段 | 靠 prompt + 外部检查 | 不适用 | `/test` 后人审 | criteria + verify 命令 |
| **文件隔离** | `worktree: true` | git worktree / 分支 | 不适用 | 分支 | 物理隔离写路径 |
| **控制平面** | `status`/`interrupt`/`resume`/`notify` | 有限（中断/继续） | 单会话无 | 无 | 可观测 + 可干预 |
| **上下文边界** | `context: "fresh"`/`"fork"` | Task 天然 fresh | 不适用 | 不适用 | 显式 inherit/sandbox |

> 迁移要点：能力越弱的 harness，越要把 **acceptance**（可机器判定的完成边界）和 **worktree**（并行写隔离）外置——前者靠 CI/测试命令，后者靠分支，否则子代理失控。

---

## 下一步

本文是 Harness Engineering 第 5 篇 / 共 10 篇。前一篇：[会话与运行时生命周期](./harness-engineering-runtime)（session/run/turn 模型、fork/resume、持久化恢复）——子代理本身就是运行时派生的进程，读完那篇更能理解子代理的生命周期从哪来。

子代理能派活了，下一步问的是：**这些角色（scout/planner/worker/reviewer）从哪加载、冲突了谁说了算、能不能热重载。** 这就是第 6 篇「扩展与技能加载机制」。

下一篇：[6. 扩展与技能加载机制](./harness-engineering-extensions) —— extension vs skill、加载时序、热重载、冲突治理。

---

## 参考资料

- [Harness Engineering 总纲](./harness-engineering-series) · [第 4 篇：会话与运行时生命周期](./harness-engineering-runtime)
- [Loop Engineering 第 10 篇：Sub-agent 编排模式](./loop-engineering-sub-agent)（编排拓扑、maker/checker、收敛循环）
- [Loop Engineering Worktree 篇](./loop-engineering-worktree)（worktree 生命周期与治理）
- pi subagents：single/chain/parallel/expand-collect、acceptance 契约、`worktree: true`、`context: "fresh"`/`"fork"`、async、控制平面 status/interrupt/resume

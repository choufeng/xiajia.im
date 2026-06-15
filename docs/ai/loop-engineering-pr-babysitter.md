# PR Babysitter 实战：让 loop 看护你的 Pull Request

> 系列第十四篇。前三篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行工程](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling)
>
> 前十三篇建立了通用框架。从这篇开始，我们进入**垂直模式实战**——把框架落到一个个具体 loop 上。第一个：PR Babysitter，最高频、最痛、也最容易出价值的 loop。

---

## 一、PR Babysitter 解决什么问题

每个团队都见过这个场景：

```
PR #142  开了 3 天
  ├── CI 红（有人 push 后没等 CI）
  ├── review 有 2 条 comment，没人回
  ├── 主干前移了 8 个 commit，需要 rebase
  ├── merge conflict 在 2 个文件
  └── 人在 Slack 问了 3 次「这个能合吗」
```

PR 不是写完就完了。它卡在 **review → CI → rebase → merge** 的流水线里，每个环节都可能停滞。人肉「herding」（放牧）PR——盯 CI、催 review、rebase、解冲突——是团队最碎片化、最浪费时间的活。

Cobus Greyling 对 PR Babysitter 的定义一针见血：

> **Goal**: Reduce the human time spent herding pull requests through review, CI, rebase, and merge — **while keeping the human in the judgment seat**.

注意最后半句。PR Babysitter 不是替人合并 PR，是替人**看护** PR——盯状态、提醒、做小 fix、在「ready」时叫人。判断权永远在人。

### 痛点量化（真实案例）

来自 Cobus 仓库的一个生产故事：

| 指标 | 引入 PR Babysitter 前 | 引入后 |
|------|----------------------|--------|
| Slack「CI 红了」/「rebase 一下」ping 数 | ~12 次/天 | ~4 次/天 |
| 首次 fix 提议的平均时间 | 数小时 | ~25 分钟 |
| loop 导致的错误合并 | — | 0 |

**一天省 8 次 ping，首次响应从小时级到分钟级。** 这是 PR Babysitter 典型的投资回报。

---

## 二、PR 生命周期与 Babysitter 介入点

一个 PR 从 open 到 merge/closed，经过多个阶段。Babysitter 在**每个阶段**都有不同角色：

```
  PR Open ──► Review ──► CI ──► Rebase ──► Merge
     │           │         │        │          │
     ▼           ▼         ▼        ▼          ▼
  分诊标签    提醒reviewer  盯CI红  解冲突    确认ready
  去重检查    propose fix  propose  rebase   ping人合并
  建议reviewer minimal-fix  fix     提醒      (不自动合)
```

### 各阶段介入详情

| 阶段 | 人的痛 | Babysitter 做什么 | 级别 |
|------|--------|-------------------|------|
| **Open** | 新 PR 没人看、没标签、重复 | 分诊：打标签、找 duplicate、建议 reviewer | L1 |
| **Review** | review comment 没人回、actionable 的没人修 | 提醒 reviewer；actionable comment → propose minimal patch | L1→L2 |
| **CI** | CI 红了没人注意 | 盯 CI 状态，红了通知；**简单 fix（lint/import）→ propose** | L1→L2 |
| **Rebase** | 主干前移，PR 落后 | 检测落后，rebase；解简单冲突 | L1→L2 |
| **Merge** | 满足条件但没人合 | 全绿 + 有 approval → 标「ready to merge」label / ping 人 | L1 |

**核心原则：Babysitter 永远在 PR 侧，不碰主干。** 主干的事归 CI Sweeper（见第六节分工）。Babysitter 的作用域是「这个 PR 到 merge-ready 的距离」。

---

## 三、L1 版：只读看护 + 提醒

起步必须 L1。Babysitter 在 L1 **只看、只提醒，不改代码**。

### 看哪些信号

```typescript
// 每个 PR，Babysitter 收集这些信号
interface PRSnapshot {
  number: number;
  title: string;
  author: string;
  state: "open" | "closed" | "merged";

  // review 信号
  reviewStatus: "approved" | "changes_requested" | "pending" | "commented";
  reviewers: string[];
  actionableComments: ActionableComment[];   // 可执行的 comment（如 "加个 null check"）

  // CI 信号
  checks: { name: string; status: "pass" | "fail" | "pending" }[];
  ciRed: boolean;

  // rebase 信号
  commitsBehind: number;                     // 落后主干几个 commit
  mergeable: boolean | null;                 // GitHub mergeable 状态
  conflictFiles: string[];

  // 时间信号
  openedAt: string;
  lastActivityAt: string;
  idleDays: number;
}
```

### 提醒规则（L1 不改代码，只出报告/提醒）

| 信号 | 触发 | 动作 |
|------|------|------|
| CI 红 | `ciRed === true` | PR comment: 「⚠️ CI 红: [job名]，[失败摘要]」+ Slack ping 作者 |
| 落后主干 | `commitsBehind > 10` | PR comment: 「⏰ 落后主干 N commit，建议 rebase」 |
| 冲突 | `mergeable === false` | PR comment: 「🔀 冲突文件: [列表]，需人解」 |
| idle | `idleDays > 3` | PR comment: 「💤 N 天无活动，close 还是继续？」 |
| ready | 全绿 + approved + no conflict | 加 `ready-to-merge` label + Slack: 「✅ PR #N ready，谁来合？」 |
| actionable comment | 有可执行的 review comment | PR comment: 「建议最小 fix: [描述]」→ L2 才 propose patch |

### L1 的铁律

1. **绝不改代码**：tools 白名单不含 `edit`/`write`。
2. **只评论「需要人 action 的」**：不变的状态不评论（防通知风暴）。
3. **评论带签名**：`🤖 Loop Engineering — PR Babysitter`，让 reviewer 知道这是 loop 说的。
4. **幂等**：同一个状态不重复评论（对比 STATE.md 的 last action）。

> Cobus 故事里 Day 5 的教训：bot 每次运行都评论（即使状态没变），团队把 bot 静音了。**Fix：只在 verdict 是 APPROVE 或 ESCALATE_HUMAN 时才评论。** 这就是幂等原则的来源。

---

## 四、L2 版：小 fix + rebase

L1 连续跑稳后（建议 3 天以上），可以升级 L2。L2 让 Babysitter **动手做安全的小改动**。

### L2 允许的动作（allowlist）

| 动作 | 条件 | 怎么做 |
|------|------|--------|
| **lint auto-fix** | 仅 `.eslintrc` 规则自动修复（如 import 排序、分号） | worktree 里 `eslint --fix`，propose diff |
| **rebase** | `commitsBehind > 0` 且 `mergeable !== false` | worktree 里 `git rebase main`，成功则 force-push |
| **补 missing test** | review comment 明确要求「加个 test case」 | subagent 生成 test，verifier 验证跑过 |
| **minimal-fix** | review comment 是 actionable 的（如「这里要 null check」） | subagent 最小改动，verifier 确认 |

### L2 绝不碰的（→ escalate）

- 行为变更（不只 lint/test 的小改）
- denylist 路径（auth/secrets/migrations/payments）
- lockfile / 依赖
- 冲突解（`mergeable === false` 时只提醒，不自动解）
- 同一 PR 第 3 次 fix 尝试

### L2 的验证链

```
review comment「加 null check」
     ↓
① Implementer subagent (worktree:true)
   生成最小改动: if (x === null) return
     ↓
② Verifier subagent (fresh, 更强模型)
   检查: 改动只加 null check? 没碰别的? test 跑过?
     ↓ PASS
③ PR comment: 「🤖 针对 @reviewer 的 comment, propose fix:
   [diff] + [test 结果]。 approve 后我 push。」
     ↓ 人 approve
push 到 PR branch
```

> **Cobus 的验证策略**：「Never let the implementer sub-agent mark its own work 'done'. Use a separate verifier sub-agent (maker/checker) that must explicitly confirm: the change addresses the comment, no unrelated files touched, tests/lint still pass.」

---

## 五、必备 Skills 与 STATE 设计

### 三个核心 skills

```
.pi/skills/
├── pr-review-triage/
│   └── SKILL.md      # 理解项目 review 规范、required checks、什么叫 "ready to merge"
├── minimal-fix/
│   └── SKILL.md      # 针对一条 comment / CI 失败, 产最小改动
└── rebase-and-clean/
    └── SKILL.md      # 安全 rebase + 简单冲突解 + 清理 stale 分支
```

#### pr-review-triage SKILL.md（核心片段）

````markdown
---
name: pr-review-triage
description: PR review 分诊。读 PR 状态，判断每个 PR 需要什么 action，产出结构化报告。
---

# PR Review Triage

## 分诊决策树
每个 PR，按顺序判断：

1. **CI 红?** → 标记 CI_RED, 提取失败 job + 错误摘要
   - 失败类型: compile / test / lint / flaky / env
   - flaky 判定: 同类失败在近期出现率 <30% → flaky（不自动改代码，escalate）
2. **有 actionable review comment?** → 标记 NEEDS_FIX, 提取 comment 列表
3. **落后主干?** (commitsBehind > 0) → 标记 NEEDS_REBASE
4. **冲突?** (mergeable === false) → 标记 CONFLICT, 列冲突文件
5. **idle 太久?** (idleDays > 3) → 标记 STALE
6. **ready?** (全绿 + approved + no conflict) → 标记 READY_TO_MERGE
7. **以上都没有?** → 标记 WAITING（正常等待中，不提醒）

## 铁律
- 只在 verdict 是 NEEDS_FIX / CI_RED / READY_TO_MERGE / STALE 时才产出 action
- WAITING 的 PR 不出 action（防通知风暴）
- flaky test 一律标 FLAKY → escalate，绝不改应用代码
````

### STATE 设计

```markdown
# PR Babysitter State

## Watched PRs
- #1234 (feat/auth-refresh)
  verdict: NEEDS_FIX
  status: Changes requested by @reviewer
  last_action: 2026-06-14 propose minimal-fix for "null check" comment
  attempt: 1
  idle_since: 2026-06-12

- #1238 (fix/typo)
  verdict: READY_TO_MERGE
  status: All green, approved by @lead
  last_action: 2026-06-14 added ready-to-merge label
  attempt: 0

## Merged/Closed (本 run prune 掉)
<!-- 每次 run 清理已 merge/close 的 PR（防 State Rot） -->

---
Run: 2026-06-14 10:15 | 12 watched | 2 actionable | 1 fix proposed | 0 escalate
```

**关键字段**：
- `attempt`：同一 PR 的 fix 尝试次数，超 3 → escalate（防 Infinite Fix Loop）
- `last_action`：防重复评论（幂等）
- `idle_since`：跟踪停滞时长
- `verdict`：结构化分类，驱动后续动作

---

## 六、与 CI Sweeper 的分工

这是 Multi-Loop 协调（第五篇）优先级表的落地。PR Babysitter 和 CI Sweeper 都可能碰到「CI 红」，必须明确分工。

| 维度 | CI Sweeper | PR Babysitter |
|------|-----------|---------------|
| 作用域 | **主干** main 分支的 CI | **PR 分支**的 CI |
| 频率 | 15m | 5-10m |
| 优先级 | **1（最高）**——主干红阻塞一切 | 2——PR 有时效但不阻塞 |
| CI 红了怎么办 | 诊断 + 修主干 | 通知 PR 作者 + propose fix（L2） |
| 同一 PR 撞车 | — | **skip**——如果 CI Sweeper 正在 act on 同一目标 |

### 防撞车规则

```typescript
// Babysitter spawn fix 前检查
async function canActOnPR(prNumber: number): Promise<boolean> {
  // 读 CI Sweeper 的 state
  const csState = readState("ci-sweeper-state.md");
  if (csState.actingOn?.prId === prNumber) {
    // CI Sweeper 正在处理这个 PR → skip
    appendRunLog({ loop: "pr-babysitter", event: "collision_skip", blockedBy: "ci-sweeper", target: prNumber });
    return false;
  }
  return true;
}
```

> **优先级铁律（Multi-Loop 篇）**：主干红阻塞一切。如果 CI Sweeper 正在修主干，PR Babysitter 的 fix 应该 skip——因为 rebase 还会发生，现在 fix 可能白做。

---

## 七、pi 实现

pi 无内置 GitHub 集成，靠 extension + `gh` CLI + GitHub API 组合。

### 架构

```
┌──────────────────────────────────────────────────────────────┐
│  触发: GitHub webhook (pull_request event) + cron 兜底 10m    │
│      webhook: PR open/synchronize/review 等事件即时触发        │
│      cron: 兜底, 确保 webhook 漏接时不漏                      │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  runner.ts (Node 进程)                                        │
│                                                              │
│  ① Collect: gh pr list --json + gh api 取 checks/reviews     │
│     (bash tool 调 gh CLI, 或 fetch GitHub API)               │
│                        ▼                                      │
│  ② Triage session (pi SDK, 只读 tools + pr-review-triage)     │
│     读 PR 快照 → 分诊 verdict → 写 STATE                      │
│                        ▼                                      │
│  ③ Act 按 verdict:                                            │
│     WAITING → 不动                                            │
│     CI_RED/STALE/READY → PR comment + 通知 (L1)               │
│     NEEDS_FIX → spawn subagent worktree (L2, 见下)            │
│                        ▼                                      │
│  ④ Verifier session (fresh, 确认 fix 安全)                     │
│                        ▼                                      │
│  ⑤ PR comment + 更新 STATE + run-log                          │
└──────────────────────────────────────────────────────────────┘
```

### GitHub 数据采集（gh CLI）

pi 的 `bash` tool 调 `gh`，或 SDK runner 里直接 `exec`：

```typescript
// runner.ts — 收集所有 open PR 的快照
async function collectPRs(): Promise<PRSnapshot[]> {
  // 基本 PR 信息
  const prs = JSON.parse(await exec(`gh pr list --json number,title,author,headRefName,updatedAt --state open`));

  return Promise.all(prs.map(async (pr) => {
    const [checks, reviews, mergeable] = await Promise.all([
      // CI checks 状态
      exec(`gh api repos/:owner/:repo/commits/${pr.headRefName}/check-runs --jq '.check_runs[] | {name, conclusion}'`),
      // review 状态
      exec(`gh pr view ${pr.number} --json reviews,comments`),
      // mergeable + behind
      exec(`gh pr view ${pr.number} --json mergeable,mergeStateStatus`),
    ]);
    return parsePRSnapshot(pr, checks, reviews, mergeable);
  }));
}
```

### Triage（pi SDK session）

```typescript
const { session } = await createAgentSession({
  cwd: REPO,
  tools: ["read", "bash", "grep"],   // 只读，L1 无 edit/write
  sessionManager: SessionManager.inMemory(REPO),
});

await session.prompt(`执行 /skill:pr-review-triage。
  读下面 PR 快照 + pr-babysitter-state.md, 对每个 PR 产出 verdict + action。
  WAITING 的不出 action。带签名 🤖 Loop Engineering — PR Babysitter。
  --- PR 快照 ---\n${JSON.stringify(prSnapshots)}`);
```

### L2 fix（subagent worktree 隔离）

```typescript
// NEEDS_FIX verdict → spawn worker subagent
await subagent({
  agent: "worker",
  task: `PR #${pr.number} 有 review comment: "${comment.body}"。
         用 /skill:minimal-fix 产最小改动。只改 ${pr.files} 相关。
         不碰 auth/secrets/migrations。改完跑测试。`,
  worktree: true,               // ← 隔离，不影响主分支
  acceptance: {                  // ← pi 原生验证契约
    criteria: [
      "改动只针对这条 comment",
      "无无关文件变更",
      "npm test 全绿",
    ],
    verify: [{ id: "tests", command: "npm test" }],
    stopRules: ["连续 2 轮测试失败则停"],
  },
});
```

### Webhook 接收（express + extension）

```typescript
// server.ts — 接收 GitHub webhook, 触发 runner
import express from "express";
const app = express();

app.post("/github-webhook", express.json(), async (req, res) => {
  const event = req.headers["x-github-event"];
  // 只关心 PR 相关事件
  if (event === "pull_request" || event === "pull_request_review" || event === "check_run") {
    runBabysitter(req.body).catch(console.error);   // 异步触发，不等
  }
  res.sendStatus(200);   // 快速 ack, 不让 GitHub 超时重试
});

app.listen(3010);
```

加 cron 兜底（webhook 漏接时不漏）：

```cron
*/10 9-20 * * * cd /pr-babysitter && bun run runner.ts >> logs/babysitter.log 2>&1
```

---

## 八、模式特有的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **通知风暴** | S1→S2 | bot 每次运行都评论，团队静音 bot | 只在 verdict 非 WAITING 时评论；幂等（对比 last_action） |
| **Infinite Fix Loop** | S2 | 同一 PR 的 flaky test 被反复「修」4+ 次 | attempt 计数 ≤3；flaky 分类不自动改代码 |
| **rebase 死循环** | S2 | rebase 冲突反复解不干净 | rebase 尝试 ≤2 次；冲突 escalate 给人 |
| **over-eager merge** | S3 | loop 自动合并了不该合的 PR | **永不自动合并**——只标 label/ping 人；L2 只 push fix，不 merge |
| **与 CI Sweeper 撞车** | S2 | 两 loop 同时 fix 同一 PR | acting_on 字段 + spawn 前检查 + skip |
| **State Rot** | S1→S2 | STATE 引用已 merge/close 的 PR | 每 run prune（Multi-Loop 篇铁律 2） |
| **verifier 共谋** | S2 | verifier 和 implementer 同 session/上下文 | fresh session + 不同模型（Sub-agent 篇原则） |
| **stale PR 堆积** | S1 | idle PR 越来越多, 看板混乱 | idle > 3 天 → 建议 close/assign；> 7 天 → 自动标 stale |

### 反模式速查（来自 Cobus）

> 「**L2 before L1 quality**」：Day 1 就开 L2 自动 fix。loop 在没学会分诊（什么是 flaky、什么是真 regression）时就动手 → 无限 fix loop + 通知风暴。
>
> **正确做法**：先跑 3 天 L1（纯看护 + 提醒），确认 verdict 分类准确，再开 L2。Cobus 故事原话：「Start L2 only after 3 days of state-only watching. The loop doesn't know a flake from a regression — you teach it in skills.」

---

## 九、成本控制

PR Babysitter 是高频 loop（5-10m），成本爆炸风险高。Cobus 的成本画像：

| 场景 | tokens/run | 说明 |
|------|-----------|------|
| **空监听**（无 actionable PR） | ~3k | **大多数 run 应该是这个** → early exit |
| **Triage pass**（扫 PR + CI 状态） | ~80k | 有 PR 需要分诊 |
| **Fix 尝试**（L2, worktree + verifier） | ~250k | 最贵 |

**核心策略：early exit。** 空 watchlist 或全 WAITING → 立即退出（<5k tokens）。子 agent 只在 verdict 是 NEEDS_FIX 时才 spawn。

```typescript
// early exit
const actionable = prSnapshots.filter(p => p.verdict !== "WAITING");
if (actionable.length === 0) {
  appendRunLog({ run: now(), outcome: "noop", tokens: 3000 });
  return;   // 不 spawn 任何 agent，直接退出
}
```

> **Cobus 警告**：「High cadence without early-exit burns tokens fast.」5 分钟跑一次 × 每次 80k = 一天 2.3M tokens（如果每次都 full triage）。early exit 让大多数 run 只花 3k。

---

## 十、成功指标

| 指标 | 怎么测 | 目标 |
|------|--------|------|
| **review → merge 平均时长** | PR openedAt 到 mergedAt | 下降 |
| **纯 LGTM 评论数** | 「LGTM, loop handled the rest」 | 上升 |
| **Slack CI/rebase ping 数** | 日志统计 | 下降（12→4/天 级别） |
| **首次 fix 提议时间** | comment 到 loop propose | 分钟级（小时→25min） |
| **no-op run 占比** | early exit / total runs | >80%（证明 early exit 有效） |
| **通知打开率** | 团队没静音 bot | 100% |

**第一个指标最重要**：review → merge 时长是 PR Babysitter 存在意义的直接度量。如果它没降，loop 没在帮人。

---

## 十一、回顾

1. **PR Babysitter 解决「herding」**：PR 卡在 review/CI/rebase/merge 流水线里，loop 替你看护，你只管判断。
2. **PR 生命周期 5 阶段介入**：Open（分诊）→ Review（提醒/propose）→ CI（盯红）→ Rebase（提醒/解）→ Merge（标 ready）。
3. **L1 先跑 3 天**：纯看护 + 提醒，不改代码。确认 verdict 分类准确（尤其 flaky vs regression），再开 L2。
4. **L2 严格 allowlist**：lint fix / rebase / 补 test / minimal-fix，其余全 escalate。永不自动合并。
5. **三个核心 skill**：pr-review-triage（分诊）、minimal-fix（最小改动）、rebase-and-clean（安全 rebase）。
6. **与 CI Sweeper 分工**：CI Sweeper 管主干，Babysitter 管 PR。撞车时 Babysitter skip（主干优先）。
7. **early exit 是成本命脉**：空 watchlist / 全 WAITING → 立即退出（3k tokens）。子 agent 只在有 actionable 时 spawn。
8. **防通知风暴**：只在 verdict 非 WAITING 时评论；幂等；评论带签名。
9. **pi 实现**：gh CLI 采集 + SDK triage session + subagent worktree（L2）+ webhook + cron 兜底。

一句话收尾：**PR Babysitter 的价值不是「合更多 PR」，而是「让每个 PR 不再卡在没人管的角落」。loop 盯着流水线，人盯着判断——这才是 herding 自动化的正确姿势。**

---

## 参考资料

- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（优先级表、collision detection）
- [系列十：Sub-agent 编排](./loop-engineering-sub-agent)（maker/checker、worktree、acceptance）
- [系列十二：Worktree 并行工程](./loop-engineering-worktree)（L2 fix 隔离）
- [系列十三：Scheduling 模式](./loop-engineering-scheduling)（webhook + cron 混合）
- [Cobus Greyling — PR Babysitter Pattern](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/pr-babysitter.md)
- [Cobus Greyling — PR Babysitter Week One Story](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/pr-babysitter-week-one.md)
- pi 能力：`bash`（gh CLI）· SDK session · subagent worktree · skills 自动发现 · STATE.md

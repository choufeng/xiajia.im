# Multi-Loop 协调：从单 loop 到 loop 网

> 系列第五篇。前四篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory)
>
> 前四篇讲的都是**单个 loop**。但生产环境从来不是一个 loop——CI Sweeper、PR Babysitter、Dependency Sweeper、Daily Triage 常常同时跑。**单 loop 稳了，下一步必然是多 loop 共存。而多 loop 不设边界，就是 loop 互相打架。**

---

## 零、为什么多 loop 是新问题

Cobus Greyling 说得很直白：

> 「跑多个 loop 是常态。**没有边界地跑多个 loop，就是让 loop 互相打架。**」

单 loop 的所有难题（护栏、验证、memory），多 loop 时都还在，**再加一层全新的难题**：loop 之间的协调。具体表现为三类冲突：

| 冲突类型 | 场景 | 后果 |
|----------|------|------|
| **写冲突** | CI Sweeper 和 PR Babysitter 同时改同一文件 | merge 地狱、worktree 撞车 |
| **资源冲突** | 5 个 loop 同时 spawn 子 agent | token 爆炸、API 限流、预算失控 |
| **语义冲突** | CI Sweeper 改代码、Dependency Sweeper 升依赖 | 互相破坏、测试结果归因混乱 |

这三类冲突，单 loop 设计里根本不存在。本文给出 Cobus 的五原则 + 一套可落地的协调机制，并用 pi 实战。

---

## 一、五条铁律

### 铁律 1：One owner per branch

**一条分支，一小时窗口内至多一个 loop 改它。**

```
❌ CI Sweeper 改 src/auth/ + PR Babysitter 改 src/auth/（同一小时）
   → merge 冲突、worktree 撞车、归因混乱
✅ CI Sweeper 拿到 src/auth/ 的锁，PR Babysitter skip 并 log
```

这是多 loop 协调的第一性原则。两个 loop 改同一处，无论怎么设计 worktree 都会出问题——**锁是唯一可靠的解法**。

### 铁律 2：分离 state 文件

```
STATE.md                    # Daily Triage（优先级、人工收件箱）
ci-sweeper-state.md         # CI 失败 + attempt 计数
pr-babysitter-state.md      # PR 监听
dependency-sweeper-state.md # 依赖升级进行中
post-merge-state.md         # 合并后清理 backlog
loop-run-log.md             # 所有 loop 共用的 append-only 日志
```

**一个 loop 一个 state 文件，外加一个共享 run-log。** 混在一个 STATE.md 里 = 互相覆盖、State Rot、调试地狱。共享的只有 run-log（append-only，不冲突）。

### 铁律 3：Triage 报告，Action loop 执行

职责分层，不重叠：

| 角色 | 做什么 | 自治级别 |
|------|--------|----------|
| **Daily Triage** | 扫描、分类、产出优先级报告 | L1（只读） |
| **CI Sweeper** | 修 CI 失败 | L2/L3 |
| **PR Babysitter** | 监听 PR 新提交、review | L1/L2 |
| **Dependency Sweeper** | 升依赖 | L2 |

**Daily Triage 永远是 L1，永远不执行改动。** 它负责调度信息，不负责动手。这避免了「报告 loop」和「执行 loop」抢同一份工作。

### 铁律 4：共享 denylist

把同一份路径 denylist 复制进**每一个** loop 的 LOOP.md。

```
.env / .env.*
**/secrets/** / **/credentials/**
**/migrations/**  / auth/** / payments/**
**/lock.json / **/lock.yaml
```

> **为什么必须共享**：denylist 只在一个 loop 里 = 漏洞。Dependency Sweeper 不碰 lockfile 但 CI Sweeper 碰了，等于没防护。所有 loop 一视同仁。

### 铁律 5：聚合 token 预算

多 loop 的 token 不是相加，是**乘法风险**——每个 loop 都 spawn 子 agent，叠加起来极易爆。

```markdown
## Loop Budget（聚合）
- 全 loop 合计 max_tokens/day: 4_000_000
- 单 loop max_tokens/run: 见各自 loop-budget.md
- 全局 kill: 任一 loop 超 day 预算的 80% → 所有 loop 降级到 L1
- CI Sweeper（高频）单独占 50% 配额，其余平分
```

**预算必须全局看，不能每个 loop 各管各的。** 否则单个 loop 都「合理」，加起来破产。

---

## 二、冲突优先级

当多个 loop 同时想动，必须有明确优先级。Cobus 给的表：

| 优先级 | Loop | 理由 |
|--------|------|------|
| **1** | CI Sweeper | 主干红了，一切阻塞 |
| **2** | PR Babysitter | 活跃 PR 有时效 |
| **3** | Dependency Sweeper | 主干红时暂停 |
| **4** | Post-Merge Cleanup | 离峰、最低优先级 |
| **5** | Daily Triage | 只报告，调度其他 |

**核心逻辑：红色的主干阻塞一切。** CI Sweeper 永远优先，因为它在修「全员都被卡住」的问题。Dependency Sweeper 在主干红时主动让位——升依赖时主干还红，等于火上浇油。

---

## 三、Collision Detection 机制

光有优先级不够，要能**检测到冲突并主动避让**。机制：

### `acting_on` 字段

每个 action loop 在自己的 state 文件里写当前正在处理的目标：

```markdown
# ci-sweeper-state.md
## Acting On
- acting_on: src/auth/oauth.ts (PR #142)
- since: 2026-06-14T09:15:00Z
- attempt: 1
```

### Spawn 前的检查协议

任一 loop 在 spawn 子 agent 改代码前，执行：

```typescript
async function canActOn(target: string): Promise<boolean> {
  // 读所有其他 loop 的 state 文件
  const otherStates = [
    "ci-sweeper-state.md",
    "pr-babysitter-state.md",
    "dependency-sweeper-state.md",
  ].filter(f => f !== myStateFile);

  for (const f of otherStates) {
    const acting = readActingOn(f);
    // 有其他 loop 正在动同一目标 → skip
    if (acting && overlaps(acting.target, target)) {
      logCollision(myName, f, target);
      return false;   // skip + log，不阻塞
    }
  }
  return true;
}

// FIX 状态入口
if (!(await canActOn(diagnosis.targetFiles))) {
  state = "ESCALATE";   // 或 RETRY_LATER
  break;
}
```

**关键：撞了就 skip 并 log，不阻塞、不等待。** 等待会引入死锁和超时地狱。让低优先级 loop 下一轮 tick 再试。

### 撞车记录

所有碰撞写进共享 `loop-run-log.md`：

```json
{
  "run_id": "2026-06-14T09:20:00Z",
  "loop": "pr-babysitter",
  "event": "collision_skip",
  "target": "src/auth/oauth.ts",
  "blocked_by": "ci-sweeper",
  "action": "skip, retry next tick"
}
```

撞车多了，说明调度有问题（cadence 太密、优先级没生效），可观测后调整。

---

## 四、Scheduler Coordination（LOOP.md）

所有 loop 的调度计划，写在仓库根的一个 `LOOP.md` 里，作为「多 loop 宪法」：

```markdown
# LOOP.md — Multi-loop Schedule

## Loops in this repo
| Loop | Level | Cadence | Active hours |
|------|-------|---------|--------------|
| CI Sweeper | L3 | 15m | 09:00-20:00 |
| PR Babysitter | L2 | 10m | 09:00-20:00 |
| Daily Triage | L1 | 1d @ 08:00 | — |
| Dependency Sweeper | L2 | 6h | skip if main CI red |
| Post-Merge Cleanup | L1→L2 | 1d @ 22:00 | off-peak |

## Skip rules
- PR Babysitter: skip if CI Sweeper acting on same PR
- Dependency Sweeper: skip if main CI red
- All: skip during maintenance window (Sun 02:00-04:00)

## Shared resources
- Denylist: ./loop-denylist.txt
- Budget: ./loop-budget.md
- Run log: ./loop-run-log.md
```

`LOOP.md` 是多 loop 的**单一事实源**。新加 loop、调 cadence、改优先级，都改这一个文件。

---

## 五、人工收件箱（Human Inbox）

多 loop 时，会涌现一类「跨 loop 争议」——两个 loop 都标记了同一项，但归属不清。这类不能让 loop 自己决，必须有人收口。

在共享的 `STATE.md` 开一个区：

```markdown
## Human Inbox（跨 loop / 有歧义）
- [ ] PR #42: CI Sweeper 和 PR Babysitter 都 flag 了 — 人决定谁处理
- [ ] #150: 是 CI 问题还是依赖问题？需人判断归属
```

**规则**：任一 loop 遇到归属不明的，写进 Human Inbox 然后 ESCALATE，不自行决断。这是防止 loop 互相推诿或重复处理的关键。

---

## 六、pi 上的多 loop 实现

pi 没有内置多 loop 协调器（符合其哲学——"No sub-agents. Build your own"），但它的能力组合起来够用。

### 架构

```
┌────────────────────────────────────────────────────────────┐
│  Scheduler（cron / croner / GitHub Actions）               │
│  按 LOOP.md 的 cadence 调起各 loop runner                    │
└──────────────┬─────────────────────────────────────────────┘
               ▼
   ┌───────────────────────────────────┐
   │  每个 loop = 独立 Node 进程         │
   │  （CI Sweeper、PR Babysitter...）   │
   │  各自: SDK runner + state 文件      │
   │  共享: denylist + budget + run-log  │
   └───────────────────────────────────┘
               ▼
   ┌───────────────────────────────────┐
   │  Collision Detector（共享模块）     │
   │  读所有 state 的 acting_on          │
   │  spawn 前检查 → skip 或放行         │
   └───────────────────────────────────┘
               ▼
   ┌───────────────────────────────────┐
   │  pi Agent（被 runner 调起）         │
   │  worktree 隔离 + memory 共享        │
   └───────────────────────────────────┘
```

### 关键实现点

**① 每个 loop 独立进程**，不共享内存，只共享文件（state + run-log）。这是 pi「spawn pi instances」哲学的延伸——进程隔离，崩了不连累。

```bash
# crontab 示例：多 loop 调度
*/15 9-20 * * * cd /loops && bun run ci-sweeper/index.ts >> logs/cs.log 2>&1
*/10 9-20 * * * cd /loops && bun run pr-babysitter/index.ts >> logs/pb.log 2>&1
0    8    * * * cd /loops && bun run daily-triage/index.ts >> logs/dt.log 2>&1
0    */6  * * * cd /loops && bun run dep-sweeper/index.ts >> logs/ds.log 2>&1
0    22   * * * cd /loops && bun run post-merge/index.ts >> logs/pm.log 2>&1
```

**② Collision Detector 是共享模块**，每个 loop runner 引入：

```typescript
// shared/collision.ts — 所有 loop 共用
import { readState, overlaps } from "./state-utils";

export async function canActOn(myLoop: string, target: string[]): Promise<boolean> {
  const allLoops = ["ci-sweeper","pr-babysitter","dep-sweeper","post-merge"];
  for (const loop of allLoops) {
    if (loop === myLoop) continue;
    const acting = readState(`${loop}-state.md`)?.actingOn;
    if (acting && overlaps(acting.files, target)) {
      appendRunLog({ loop: myLoop, event: "collision_skip", blockedBy: loop, target });
      return false;
    }
  }
  return true;
}
```

**③ 聚合预算靠共享计数器**（文件锁 + 计数）：

```typescript
// shared/budget.ts
import { lockFileSync, unlockFileSync } from "proper-lockfile";

export async function spendTokens(loop: string, n: number): Promise<void> {
  lockFileSync("loop-budget.lock");
  try {
    const budget = readJSON("loop-budget.json");
    budget.spentToday += n;
    budget.byLoop[loop] = (budget.byLoop[loop] || 0) + n;
    if (budget.spentToday > budget.dailyCap * 0.8) {
      // 触发全局降级信号
      writeFileSync("loop-control/GLOBAL_DEGRADE.flag", "1");
    }
    writeJSON("loop-budget.json", budget);
  } finally {
    unlockFileSync("loop-budget.lock");
  }
}
```

**④ worktree 隔离**：每个 action loop 用独立 worktree（pi subagent 的 `worktree: true` 或 SDK 手动 `git worktree add`）。即使 collision detector 漏了，worktree 也保证物理隔离。

**⑤ intercom 作为跨 loop 信号通道**：高级用法——CI Sweeper 修好主干后通过 intercom 广播「main green」，订阅了的 Dependency Sweeper 收到后立即恢复运行（替代轮询 state 文件）。

---

## 七、渐进引入：从安全三 loop 到完整 loop 网

不要一上来铺五个 loop。Cobus 推荐的渐进路径：

### 阶段 1：安全三 loop（2 周观察）

| Loop | Level | Cadence |
|------|-------|---------|
| Daily Triage | L1 | 1d |
| PR Babysitter | L2 | 10m |
| Post-Merge Cleanup | L1→L2 | 1d off-peak |

这三个互不冲突：Triage 只报告、PR Babysitter 监听不与 Cleanup 抢分支、Cleanup 离峰跑。**最安全的起步组合。**

### 阶段 2：加 Dependency Sweeper（再 2 周）

主干稳定后加依赖升级。关键约束：**主干 CI 红时自动暂停**。

### 阶段 3：加 CI Sweeper（最后，最危险）

> Cobus 的原话：「**只有在 PR Babysitter 的 attempt 上限和 verifier 都证明稳定两周后，才加 CI Sweeper。**」

为什么 CI Sweeper 最后加？因为它自治级别最高（L3）、频率最高（15m）、改动最激进（直接改代码并合并）。其他 loop 的护栏没练熟就上它，等于裸奔。

### 阶段 4：Meta-loop（可选，进阶）

当 loop 多到人管不过来，出现「**管理 loop 的 loop**」：
- 巡检所有 loop 的 run-log，发现异常 escalate
- 根据 metrics 自动调 cadence（撞车多 → 降频）
- 预算到阈值自动降级各 loop

Meta-loop 本身也得守五铁律——它有自己的 state、自己的护栏。这是 loop 工程的递归性体现。

---

## 八、多 loop 特有的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **写冲突** | S2 | 两 loop 改同文件，merge 地狱 | 铁律 1（one owner per branch）+ collision detection |
| **资源争抢** | S1→S2(钱) | 5 loop 同时 spawn，token 爆炸 | 聚合预算 + 子 agent spawn 上限 |
| **优先级失效** | S2 | 低优 loop 卡住高优 | 明确优先级表 + 高优 acting 时低优 skip |
| **State 互相污染** | S1→S2 | 共用 STATE.md 导致覆盖 | 铁律 2（分离 state 文件） |
| **Denylist 漏洞** | S3 | 某个 loop 没复制 denylist | 铁律 4（共享 denylist） |
| **归属不明** | S1 | 两 loop 都 flag 同一项，无人处理 | Human Inbox + ESCALATE |
| **死锁等待** | S2 | loop 互相等对方释放锁 | 撞了就 skip 不等待（下一 tick 再试） |
| **级联降级失效** | S2 | 一个 loop 崩了，其他不知情 | 共享 kill flag + intercom 广播 |

---

## 九、Orchestration Tax：人的承受力是天花板

最后回到一个容易被技术掩盖的事实（系列一讲过的概念）：

> **Orchestration Tax**：协调并行 Agent 的人力成本——review 带宽、merge 冲突、上下文切换。**Worktree 解决机械碰撞，但你能吸收多少并行 loop，你自己就是天花板。**

多 loop 不是越多越好。每个 loop 都带来：
- 一份 state 要读
- 一份 run-log 要看
- 一批 escalation 要处理
- 一套护栏要维护

**经验法则**：一个人能有效监管的并行 loop，**3-5 个是上限**。超过就要么加人，要么用 meta-loop 自动化监管。盲目铺 loop，Orchestration Tax 会吃掉所有收益。

---

## 十、回顾

1. **多 loop 是新问题**：写冲突、资源冲突、语义冲突，单 loop 设计里不存在。
2. **五条铁律**：一 owner per branch、分离 state、triage 报告/action 执行、共享 denylist、聚合预算。
3. **冲突优先级**：主干红阻塞一切，CI Sweeper 永远优先，Dependency Sweeper 让位。
4. **Collision detection**：`acting_on` 字段 + spawn 前检查 + 撞了就 skip 不等待。
5. **LOOP.md 是宪法**：所有调度计划、skip 规则、共享资源的单一事实源。
6. **Human Inbox**：跨 loop 争议写进去 ESCALATE，不让 loop 自行决断。
7. **pi 实现**：独立进程 + 共享文件 + collision 模块 + 文件锁预算 + worktree 隔离。
8. **渐进引入**：安全三 loop → 加依赖 → 最后才加 CI Sweeper（最危险）。
9. **Orchestration Tax 是天花板**：一人有效监管 3-5 个并行 loop，超过必须自动化或加人。

一句话收尾：**多 loop 工程的目标不是「跑更多 loop」，而是「让 loop 之间像交响乐而不是大乱斗」。** 指挥（你）的精力是稀缺资源——用边界、优先级、协调机制，把这份精力用在最该用的地方。

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列二：pi L1 落地](./loop-engineering-on-pi) · [系列三：L3 设计](./loop-engineering-l3-design) · [系列四：Memory 系统](./loop-engineering-memory)
- [Cobus Greyling — Multi-Loop Coordination](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/multi-loop.md)
- [Cobus Greyling — Loop Design Checklist](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- [Cobus Greyling — Operating Loops（聚合预算）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- pi 能力：独立进程（SDK runner）· worktree 隔离 · intercom 跨 loop 信号 · 共享文件协调

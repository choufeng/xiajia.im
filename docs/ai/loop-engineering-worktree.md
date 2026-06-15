# Worktree 并行工程：loop 安全并行的基石

> 系列第十二篇。前十一篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop 协调](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval)
>
> 系列 [第五篇 Multi-Loop](./loop-engineering-multi-loop) 和 [第三篇 L3 设计](./loop-engineering-l3-design) 都反复提到 worktree——「撞了用 worktree 隔离」「FIX 状态在 worktree 里改」。但 worktree 到底怎么用、怎么管、管不好会怎样，一直没展开。这篇补完。

---

## 零、为什么 worktree 是并行 loop 的命脉

Cobus Greyling 给 worktree 的定义极简极准：

> **Parallelism without chaos.**（无混乱的并行）

反过来理解：**没有 worktree 的并行就是混乱。**

### 共享 working tree 的 merge 地狱

当两个 agent（或两个 loop）同时改同一份 working tree——同一个仓库 checkout——会发生什么？

```
时刻 T1: Agent A 读 src/auth/oauth.ts (版本 v1)
时刻 T2: Agent B 读 src/auth/oauth.ts (版本 v1)
时刻 T3: Agent A 改 src/auth/oauth.ts → 写回 (版本 v2)
时刻 T4: Agent B 改 src/auth/oauth.ts → 基于过期 v1 覆盖写入 (版本 v3)
         → Agent A 的改动被静默丢弃
```

这不是「merge 冲突」——那至少有个冲突标记提醒你。这是**静默覆盖**：Agent B 从不知道 A 改过，直接拿旧版本覆盖，A 的改动消失得无声无息。比 merge 冲突危险十倍，因为**没人会注意到**。

就算运气好只撞到一个文件，更常见的场景是：

| 场景 | 后果 |
|------|------|
| 两 agent 同时 `npm install` | node_modules 互相覆盖，依赖树损坏 |
| 一 agent 改代码，另一 agent 跑 `npm test` | 测试结果基于半个旧半个新的代码，归因混乱 |
| 两 agent 同时 `git add` + `git commit` | 暂存区互相污染，commit 混入别人的改动 |

**结论：多 agent 写同一个 working tree = 灾难。不是可能，是必然。**

### worktree 的解法

git worktree 让同一个仓库拥有**多个工作目录**，每个有自己的 working tree，但共享 `.git` 历史。

```
主仓库 /repo/          ← working tree A（你日常工作的地方）
  ├── .git/            ← 共享的 git 数据库
  ├── src/
  │   └── auth/
  └── ...

/repo-wt-ci-sweeper/   ← working tree B（CI Sweeper loop 的隔离区）
  ├── src/             ← 独立的文件副本，改这里不影响 A
  │   └── auth/
  └── ...

/repo-wt-pr-baby/      ← working tree C（PR Babysitter loop 的隔离区）
  ├── src/             ← 独立的文件副本
  └── ...
```

三个 working tree，三份独立文件副本，共享同一个 `.git`。Agent A 改 `/repo/src/`，Agent B 改 `/repo-wt-ci-sweeper/src/`——**物理隔离，互不可见**。

> Cobus 的原话：「Git worktrees give each agent its own working directory that shares history but not the working tree.」共享历史，不共享工作树。这是并行 loop 的安全基石。

---

## 一、git worktree 基础（loop 视角）

先过一遍 git worktree 的核心命令，然后映射到 loop 生命周期。

### 四个核心命令

| 命令 | 作用 | loop 什么时候用 |
|------|------|----------------|
| `git worktree add <path> [<branch>]` | 创建新 worktree（可基于新分支或已有分支） | loop 进入 FIX/动作状态时 |
| `git worktree list` | 列出所有 worktree | 巡检、collision detection、cleanup |
| `git worktree remove [-f] <path>` | 删除 worktree（清理） | loop 的 CLEANUP 状态 |
| `git worktree prune` | 清理已删除但未注销的 worktree 残留 | 定期维护、启动时 |

### 一个 worktree 的完整生命周期

```
创建:
  $ git worktree add ../repo-wt-ci-sweeper -b loop/ci-sweeper/fix-142
  → 在 ../repo-wt-ci-sweeper 创建 worktree，新分支 loop/ci-sweeper/fix-142

使用:
  $ cd ../repo-wt-ci-sweeper
  → Agent 在这个目录里工作（改代码、跑测试）
  → 不影响主仓库 /repo 的 working tree

查看:
  $ git worktree list
  /repo              3a7f2c1 [main]
  /repo-wt-ci-sweeper 8b4d9e2 [loop/ci-sweeper/fix-142]

清理:
  $ cd /repo && git worktree remove ../repo-wt-ci-sweeper
  → 删 worktree 目录 + 注销（分支保留）
  → 如果有未提交改动, -f 强制删（loop cleanup 慎用 -f）
```

### loop 里的生命周期映射

把 worktree 生命周期映射到 L3 篇的状态机：

| 状态机阶段 | worktree 操作 | 要点 |
|------------|---------------|------|
| **IDLE/TRIAGE** | 不创建 worktree | 只读分析，在主仓库或只读 session 跑 |
| **INVESTIGATE** | 可选创建（如果要实验） | 多数情况不需要，诊断在只读模式跑 |
| **FIX** | **创建 worktree** | worker 在隔离 worktree 里改代码 |
| **VERIFY** | 在同一 worktree 里跑测试 | 验证改动的 worktree 就是改动产出的地方 |
| **REVIEW** | 读 worktree 的 diff | `git diff main` 查看隔离改动 |
| **MERGE** | 合并 worktree 分支到主干 | merge 后 worktree 失去作用 |
| **CLEANUP** | **删除 worktree + 分支** | `git worktree remove` + `git branch -d` |

**关键**：worktree 的创建和删除必须配对。创建了不删 = 泄漏（第六节详谈）。

---

## 二、并行隔离模型

「一个 worktree 隔离一个 agent」是基本思路，但实际有三种隔离粒度，适用于不同场景。

### 模型 1：一 loop 一 worktree

最简单的模型：每个 action loop 有一个专属 worktree。

```
主仓库 /repo/                    ← Daily Triage（只读，不需要 worktree）
/repo-wt-ci-sweeper/             ← CI Sweeper 专属
/repo-wt-pr-babysitter/          ← PR Babysitter 专属
/repo-wt-dep-sweeper/            ← Dependency Sweeper 专属
```

| 优点 | 缺点 |
|------|------|
| 简单、好管理 | 同一 loop 不能真正并行（串行处理多个任务） |
| worktree 数量 = loop 数量（可控） | 一次只处理一个任务 |
| 状态清晰：一个 loop 一个家 | 任务排队等 worktree 空闲 |

**适合**：loop 数量少（3-5 个）、每个 loop 一次处理一个任务。

### 模型 2：一 task 一 worktree

更细粒度：每个独立任务（如每个 CI 失败、每个 PR review）一个临时 worktree。

```
主仓库 /repo/
/repo-wt-task-001/               ← 修 CI 失败 #142
/repo-wt-task-002/               ← 修 CI 失败 #145
/repo-wt-task-003/               ← review PR #138
```

| 优点 | 缺点 |
|------|------|
| 真并行：同 loop 多任务同时跑 | worktree 数量 = 并行任务数（可能很多） |
| 任务互不干扰 | 管理复杂（创建/跟踪/清理每个 worktree） |
| 完成即删，干净 | 磁盘和句柄压力大 |

**适合**：高频 loop（CI Sweeper 15m 一跑、可能多个 CI 同时红）、需要真并行的场景。

### 模型 3：Worktree 池（Pool）

预创建固定数量的 worktree，循环复用。

```
worktree-pool/
  wt-0/    ← 空闲（下一个任务领取）
  wt-1/    ← 正在用（CI Sweeper 修 #142）
  wt-2/    ← 空闲
  wt-3/    ← 正在用（PR Babysitter review #138）
  （上限 4 个，超出排队）
```

| 优点 | 缺点 |
|------|------|
| 资源可控（上限固定） | 实现最复杂（池管理、分配/回收/reset） |
| 避免频繁创建/删除开销 | worktree reset 需设计（`git checkout .` + `git clean -fd`） |
| 并行度可调 | 需处理「任务等 worktree」的队列 |

**适合**：高频高并行场景、需要严格控制资源（CI/CD 环境、共享服务器）。

### 选型决策

| 场景 | 推荐模型 |
|------|----------|
| ≤3 个 loop，低频 | **模型 1**（一 loop 一 worktree） |
| CI Sweeper 需同时修多个 | **模型 2**（一 task 一 worktree） |
| 高频、多 loop、资源敏感 | **模型 3**（Pool） |
| 只读 loop（Triage） | **不需要 worktree** |

> **铁律：只读 loop 不需要 worktree。** Daily Triage 只读不写，在主仓库跑就行。worktree 是给「要改代码」的 action loop 准备的。无谓创建 worktree = 浪费磁盘 + 增加管理负担。

---

## 三、与 Multi-Loop 协调的配合

Worktree 解决了「物理隔离」，但没解决「语义冲突」——两个 loop 各自在自己的 worktree 里改了同一文件，merge 回主干时还是会冲突。

这就是 [Multi-Loop 协调篇](./loop-engineering-multi-loop)的 `acting_on` 字段登场的地方。

### 两层防护

```
层1: Worktree（物理隔离）  ← 防止写时互相覆盖
层2: acting_on（语义协调） ← 防止 merge 时冲突
```

缺任何一层：
- 只有 worktree、无 acting_on → 两个 loop 各自改同一文件，merge 时冲突（物理安全但语义撞车）
- 只有 acting_on、无 worktree → 检测到不冲突才动，但万一检测漏了，直接互相覆盖

**两层叠加才完整**：acting_on 先做语义检查（撞了就 skip），不撞的才在各自 worktree 里动手（物理隔离兜底）。

### 完整的 spawn 前检查协议

```typescript
async function spawnInWorktree(loopName: string, task: Task) {
  // ① 语义检查：acting_on collision detection（Multi-Loop 篇）
  const targetFiles = task.diagnosis.targetFiles;
  if (!(await canActOn(loopName, targetFiles))) {
    log("collision_skip", { blockedBy: conflictingLoop });
    return { ok: false, reason: "collision" };
  }

  // ② 物理隔离：创建专属 worktree
  const wtPath = `../repo-wt-${loopName}-${task.id}`;
  const branch = `loop/${loopName}/${task.id}`;
  await exec(`git worktree add ${wtPath} -b ${branch}`);

  // ③ 写入 acting_on（让其他 loop 知道我在动这些文件）
  writeActingOn(`${loopName}-state.md`, {
    files: targetFiles,
    worktree: wtPath,
    branch: branch,
    since: new Date().toISOString(),
  });

  // ④ 在 worktree 里执行 pi agent
  const { session } = await createAgentSession({
    cwd: wtPath,              // ← 关键：cwd 切到 worktree
    tools: ["read","edit","write","bash","grep"],
    sessionManager: SessionManager.inMemory(wtPath),
  });
  await session.prompt(task.prompt);
  session.dispose();

  // ⑤ 清除 acting_on
  clearActingOn(`${loopName}-state.md`);

  return { ok: true, worktree: wtPath, branch };
}
```

**acting_on 字段加上 worktree 信息**（`worktree: wtPath, branch: branch`），让其他 loop 和 Meta-Loop 都能看到「谁在哪个 worktree 里做什么」——这是可观测性和 collision detection 的基础。

---

## 四、Worktree 生命周期管理

worktree 的创建和删除必须严格配对。生命周期管理的核心问题是**泄漏**——创建了不删，worktree 越堆越多。

### 生命周期状态机

```
        ┌──────────┐
        │  READY   │  尚未创建
        └────┬─────┘
             │ git worktree add
             ▼
        ┌──────────┐
        │  ACTIVE  │  loop 正在用（FIX/VERIFY）
        └────┬─────┘
             │ 任务完成 / merge / escalate
             ▼
        ┌──────────┐
        │  DIRTY   │  有未提交改动？ → 检查
        └────┬─────┘
             │
     ┌───────┴───────┐
     ▼               ▼
┌─────────┐   ┌──────────┐
│ CLEAN   │   │ HAS_CHG  │
│ 无改动  │   │ 有改动    │
└────┬────┘   └────┬─────┘
     │ git worktree remove
     │ -f 强制删   │ 记录残留 → escalate
     ▼               ▼
┌──────────┐   ┌──────────┐
│ REMOVED  │   │ QUARANTINE│  隔离留档，等人查
└──────────┘   └──────────┘
```

### CLEANUP 状态的标准流程

```typescript
async function cleanupWorktree(wtPath: string, branch: string, loopName: string) {
  // ① 检查有无未提交改动
  const status = await execInDir(wtPath, "git status --porcelain");

  if (status.trim().length > 0) {
    // ② 有改动 → 不暴力删，隔离留档
    const quarantinePath = `../quarantine/${loopName}-${Date.now()}`;
    await exec(`mv ${wtPath} ${quarantinePath}`);
    await appendRunLog({
      event: "worktree_quarantined",
      path: quarantinePath,
      branch,
      reason: "uncommitted changes on cleanup",
    });
    await escalate(`worktree ${wtPath} 有未提交改动，已隔离到 ${quarantinePath}`);
    return;
  }

  // ③ 无改动 → 安全删除
  await exec(`git worktree remove ${wtPath}`);

  // ④ 删除临时分支（如果已 merge）
  const merged = await exec(`git branch --merged main | grep ${branch}`);
  if (merged.includes(branch)) {
    await exec(`git branch -d ${branch}`);
  } else {
    // 未 merge 的分支不删（保留给人查）
    await appendRunLog({ event: "branch_kept", branch, reason: "not merged" });
  }

  await appendRunLog({ event: "worktree_removed", path: wtPath });
}
```

**设计要点**：
- **不暴力删**：`git worktree remove -f` 会丢弃未提交改动。loop cleanup 默认不用 `-f`，有改动就隔离。
- **分支区分对待**：已 merge 的删，未 merge 的留（可能改动有价值）。
- **全程记 run-log**：每个 worktree 的创建/删除/隔离都记，可追溯。

---

## 五、资源治理

worktree 不是免费的。每个 worktree 是一份完整的 working tree——磁盘、文件句柄、内存都有成本。不加治理 = 资源耗尽。

### 磁盘

一个大仓库的 worktree 可能几百 MB 到几 GB。

```
仓库 500MB × 8 个并行 worktree = 4GB
仓库 2GB × 8 个并行 worktree = 16GB
```

加上 `node_modules`（npm/pnpm 项目）、构建产物、缓存——一个 worktree 的实际占用可能翻几倍。

| 治理手段 | 做法 |
|----------|------|
| **数量上限** | 全局 worktree 上限（如 8 个），超出的任务排队 |
| **TTL 强制清理** | 超 N 小时未活动的 worktree → 自动隔离 + 删 |
| **定期 prune** | 启动时 + 每天跑 `git worktree prune` 清残留 |
| **磁盘检查** | CLEANUP 后检查磁盘用量，超阈值告警 |

### 文件句柄

每个 worktree 里的进程（pi agent、测试进程、linter）都会打开文件句柄。worktree 多了 = 句柄多。在 macOS 默认 `ulimit -n` 256 的环境下尤其需要注意。

```bash
# 检查当前句柄限制
ulimit -n

# loop runner 启动时提高（如需要）
ulimit -n 4096
```

### 数量上限的经验值

| 场景 | worktree 上限 | 依据 |
|------|----------------|------|
| 单人开发机 | 4-6 | Orchestration Tax 天花板（Multi-Loop 篇：一人管 3-5 个 loop） |
| CI/CD 环境 | 2-4 | 资源受限 |
| 共享服务器 | 8-12 | 多人共用，按团队规模 |

> **Orchestration Tax 再次提醒**：worktree 解决了机械碰撞，但你能吸收多少并行 loop，你自己就是天花板。盲目铺 worktree = 更多 state 要读、更多 diff 要 review、更多 merge 要处理——人的精力是真正的瓶颈。

---

## 六、pi 实现

pi 对 worktree 的支持有三个层次：subagent 内置、SDK 手动、extension hook。

### 6.1 subagent worktree:true（最简）

pi-subagents 提供 `worktree: true`，自动给每个并行 task 创建独立 worktree：

```typescript
// 多任务并行写，每个隔离在独立 worktree
await subagent({
  tasks: [
    { agent: "worker", task: "实现功能 A（仅 src/feature-a/）" },
    { agent: "worker", task: "实现功能 B（仅 src/feature-b/）" },
  ],
  worktree: true,   // ← 每个任务自动从 HEAD 创建 git worktree
});
```

`worktree: true` 的行为：
- 从当前 HEAD 创建新 worktree（每个 task 一个）
- **要求 git working tree 干净**（`git status` 无未提交改动）
- task 完成后 worktree 需手动清理或由父 agent 合并

> **注意**：`worktree: true` 主要用于**有意并行写**的场景。如果你只是一个 writer + 多个 advisor，用单 writer 模式更合适——不需要 worktree，因为 advisor 只读不写。

### 6.2 SDK 手动 git worktree（最灵活）

在 SDK runner 里（如 CI Sweeper 的 FIX 状态），手动管理 worktree 生命周期：

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

async function fixInWorktree(diagnosis: Diagnosis) {
  const branch = `loop/ci-sweeper/${diagnosis.issueId}`;
  const wtPath = `../repo-wt-ci-sweeper-${diagnosis.issueId}`;

  // ① 创建 worktree
  await exec(`git worktree add ${wtPath} -b ${branch}`);

  // ② 在 worktree cwd 下创建 pi session
  const { session } = await createAgentSession({
    cwd: wtPath,                              // ← 切到 worktree
    tools: ["read", "edit", "write", "bash", "grep"],
    sessionManager: SessionManager.inMemory(wtPath),
  });

  // ③ pi 在隔离环境里修代码
  await session.prompt(
    `修复 CI 失败。诊断: ${diagnosis.rootCause}。
     只改 ${diagnosis.targetFiles.join(", ")}。
     改完跑 npm test 确认。`
  );
  session.dispose();

  // ④ 读 worktree 的 diff（供 verifier 审）
  const diff = await execInDir(wtPath, "git diff HEAD");

  // ⑤ cleanup（见第四节标准流程）
  await cleanupWorktree(wtPath, branch, "ci-sweeper");

  return { diff, branch };
}
```

**关键**：`createAgentSession` 的 `cwd` 指向 worktree 路径——pi 的所有文件操作（read/edit/write/bash）都在 worktree 内，物理隔离主仓库。

### 6.3 SDK 自定义 cwd 的 tools

pi SDK 支持给 `createAgentSession` 传 `cwd`，内置 tools 会基于该 cwd 构建：

```typescript
const { session } = await createAgentSession({
  cwd: wtPath,                        // worktree 路径
  tools: ["read", "bash", "edit", "write"],   // 基于 wtPath 构建
  sessionManager: SessionManager.inMemory(wtPath),
});
```

> 系列 [L1 落地篇](./loop-engineering-on-pi) 已展示过 `SessionManager.inMemory(cwd)`——那里是为了不落盘。这里额外加了 worktree 路径作为 cwd，让 pi 的操作范围限定在 worktree 内。

### 6.4 Extension cleanup hook

pi extension 可以在 session 生命周期事件上挂 cleanup hook，确保 worktree 被清理：

```typescript
// pi extension 内
pi.on("session_shutdown", async () => {
  // session 结束时清理本 session 用的 worktree
  const activeWorktrees = await exec("git worktree list --porcelain");
  const orphaned = findOrphanedWorktrees(activeWorktrees, myLoopName);
  for (const wt of orphaned) {
    await exec(`git worktree remove ${wt.path}`);
    pi.events.emit("worktree:cleanup", { path: wt.path });
  }
});
```

### 6.5 非并行场景：单 writer 模式

pi-subagents 的 SKILL.md 反复强调一个原则：

> **Async does not mean parallel writes.** Do not edit the same active worktree while an async worker is changing it.

如果一个 loop 只有一个 writer（常见），不需要 worktree——直接在主仓库跑。worktree 是**并行写**的需求驱动的，不是默认选项。

| 场景 | 用 worktree? | 原因 |
|------|-------------|------|
| 单 writer + 多 advisor | ❌ | advisor 只读，writer 在主仓库 |
| 多 writer 并行 | ✅ | 物理隔离必须 |
| L3 CI Sweeper（一次修一个） | 看情况 | 可用 worktree 也可不用（但用更安全） |
| 多 loop 同时 action | ✅ | 不同 loop 的改动隔离 |

---

## 七、非 git 仓库的退化方案

worktree 是 git 的功能。如果仓库不是 git 仓库（或 working tree 不干净），`worktree: true` 会直接失败。

> 系列 [L1 落地篇](./loop-engineering-on-pi) 和 pi 工具记忆里都有一条：「**非 git 仓库 worktree 跳过隔离**」——pi 在非 git 环境下 `worktree: true` 会报错或降级。

### 退化方案

| 场景 | 退化策略 | 安全性 |
|------|----------|--------|
| **非 git 仓库** | 目录复制隔离（`cp -r repo repo-isolated/`） | ⚠️ 中（无版本控制，merge 靠手动） |
| **git 但 working tree 脏** | 拒绝创建 worktree → escalate | ✅ 安全（不冒险） |
| **容器环境** | 每个任务一个容器（Docker） | ✅ 强（完全隔离） |
| **CI 环境** | 每个 job 一个 checkout | ✅ 强（CI 天然隔离） |

### preflight 检查

loop 在创建 worktree 前应做 preflight：

```typescript
async function preflightWorktree(): Promise<{ ok: boolean; reason?: string }> {
  // ① 是否 git 仓库
  try {
    await exec("git rev-parse --git-dir");
  } catch {
    return { ok: false, reason: "非 git 仓库，无法创建 worktree" };
  }

  // ② working tree 是否干净
  const status = await exec("git status --porcelain");
  if (status.trim().length > 0) {
    return { ok: false, reason: `working tree 不干净: ${status.trim()}` };
  }

  // ③ 磁盘空间是否够（粗略检查）
  const free = await getDiskFree(".");
  if (free < 2 * 1024 * 1024 * 1024) {  // < 2GB
    return { ok: false, reason: `磁盘空间不足: ${free}` };
  }

  // ④ worktree 数量是否超上限
  const list = await exec("git worktree list");
  if (list.split("\n").filter(Boolean).length > MAX_WORKTREES) {
    return { ok: false, reason: `worktree 数量超上限 ${MAX_WORKTREES}` };
  }

  return { ok: true };
}

// FIX 状态入口
const preflight = await preflightWorktree();
if (!preflight.ok) {
  await escalate(`worktree preflight 失败: ${preflight.reason}`);
  state = "ESCALATE";
  break;
}
```

**非 git 仓库 → 直接 escalate**。不要降级到「目录复制」除非你很清楚自己在做什么——没有版本控制的「隔离」不是真正的隔离，merge 靠手动 diff 粘贴，极易出错。

---

## 八、Worktree 特有失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **Worktree 泄漏** | S1→S2 | 创建不删，越堆越多，磁盘爆 | TTL 强制清理 + 启动时 prune + 数量上限 |
| **未提交改动被丢** | S2 | `git worktree remove -f` 丢弃了有价值的改动 | 默认不用 `-f`；有改动隔离留档 |
| **残留分支** | S1 | worktree 删了但分支没删，分支列表膨胀 | cleanup 时 `git branch -d`（已 merge 删、未 merge 留） |
| **prune 失败** | S1 | 目录被手动删但 worktree 没注销，`git worktree list` 显示幽灵 | 定期 `git worktree prune` + 启动时清理 |
| **磁盘爆** | S1→S2 | worktree + node_modules + 构建产物撑满磁盘 | 磁盘监控 + TTL + 数量上限 |
| **非 git 报错** | S1 | `worktree: true` 在非 git 仓库直接失败 | preflight 检查 → escalate |
| **working tree 脏** | S1 | 人正在改代码，loop 创建 worktree 失败 | preflight 检查 → escalate（不抢人的 working tree） |
| **merge 冲突回传** | S2 | 两 worktree 各改同文件，merge 回主干冲突 | acting_on 语义协调（Multi-Loop 篇） |
| **cwd 指向错误** | S2 | session 的 cwd 没切到 worktree，改了主仓库 | SDK 里显式传 `cwd: wtPath` |

### 最危险的：cwd 指向错误

这个失败模式最阴险——没有报错、没有崩溃，pi 安安静静地在主仓库里改了代码，而你以为它在隔离 worktree 里。

```typescript
// ❌ 危险：cwd 没传 worktree 路径
const { session } = await createAgentSession({
  // cwd: 缺失！默认 process.cwd() = 主仓库！
  tools: ["read", "edit", "write"],
});
// → pi 在主仓库改代码，你以为隔离了，实际没有

// ✅ 正确：显式传 worktree 路径
const { session } = await createAgentSession({
  cwd: wtPath,   // ← 必须！
  tools: ["read", "edit", "write"],
  sessionManager: SessionManager.inMemory(wtPath),
});
```

**防御**：创建 session 后做一次 sanity check——确认 pi 读到的文件确实是 worktree 里的：

```typescript
// sanity check: 确认 cwd 是 worktree
const pwd = await runAgentReadTool("pwd");
if (!pwd.includes(wtPath)) {
  throw new Error(`cwd mismatch: expected ${wtPath}, got ${pwd}`);
}
```

---

## 九、Worktree 管理检查清单

搭一个 worktree 管理体系，逐项过：

| 维度 | 检查项 |
|------|--------|
| **创建** | preflight 检查（git 仓库 + 干净 + 磁盘 + 数量）？ |
| **隔离** | `cwd` 显式传 worktree 路径？session 创建后 sanity check？ |
| **协调** | `acting_on` 字段包含 worktree + branch + files？spawn 前做 collision detection？ |
| **清理** | 每个创建都有配对删除？默认不用 `-f`？有改动隔离留档？ |
| **分支** | 已 merge 删、未 merge 留？分支列表定期清理？ |
| **泄漏检测** | TTL 强制清理？启动时 prune？定期巡检？ |
| **资源** | 数量上限（全局）？磁盘监控？句柄限制？ |
| **非 git** | preflight 检测 → escalate？不降级到目录复制？ |
| **可观测** | 每个 worktree 创建/删除/隔离记 run-log？worktree 列表可查？ |
| **退化** | 只读 loop 不创建 worktree？单 writer 不创建 worktree？ |

---

## 十、回顾

1. **共享 working tree 的并行 = 灾难**。静默覆盖比 merge 冲突危险十倍——没人会注意到。
2. **worktree = 共享历史、不共享工作树**。物理隔离是并行 loop 的安全基石。
3. **三种隔离粒度**：一 loop 一 worktree（简单）、一 task 一 worktree（真并行）、Pool（资源可控）。只读 loop 不需要 worktree。
4. **两层防护叠加**：worktree（物理隔离）+ acting_on（语义协调）。缺任何一层都不完整。
5. **生命周期必须配对**：创建→使用→cleanup。泄漏 = 创建不删。
6. **cleanup 不暴力**：默认不用 `-f`，有改动隔离留档。已 merge 删分支、未 merge 留。
7. **资源治理**：磁盘（TTL + prune + 监控）、句柄（ulimit）、数量上限（一人管 3-5 loop）。
8. **pi 三层支持**：`worktree:true`（subagent 自动）、SDK 手动（`cwd: wtPath`）、extension hook（session_shutdown 清理）。
9. **非 git → escalate**。不降级到目录复制（无版本控制的隔离不是真隔离）。
10. **最阴险失败 = cwd 指向错误**：pi 在主仓库改了代码你却以为隔离了。显式传 `cwd` + sanity check。

一句话收尾：**worktree 是 loop 工程里「低成本、高回报」的安全网——创建它只需一行 `git worktree add`，但它防止的是多 agent 静默覆盖这种最难发现、最难恢复的灾难。用好它，让每个 loop 都有自己的沙箱可改、有自己的安全边界可守。**

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列三：L3 设计](./loop-engineering-l3-design)（FIX 状态的 worktree 用法） · [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（acting_on + collision detection） · [系列二：pi L1 落地](./loop-engineering-on-pi)（SessionManager.inMemory + cwd）
- [Cobus Greyling — Primitives: Worktrees](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md)
- [Cobus Greyling — Concepts: Orchestration Tax](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [git-worktree 官方文档](https://git-scm.com/docs/git-worktree)
- pi 能力：`subagent({ worktree: true })` · SDK `createAgentSession({ cwd: wtPath })` · extension `session_shutdown` hook · `SessionManager.inMemory(cwd)`

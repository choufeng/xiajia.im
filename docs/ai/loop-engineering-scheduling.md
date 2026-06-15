# Scheduling 模式：loop 的心跳与外部调度工程

> 系列扩展篇。前九篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop 协调](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval)
>
> 前面的篇章里，「调度」反复出现却从未被正面拆开：L1 落地篇一笔带过 cron、L3 设计篇提了 webhook 兜底、Multi-Loop 篇用 LOOP.md 写了张调度表。这篇把六原语之一的 **Automations / Scheduling** 彻底讲透——因为它是 loop 的心跳，是「一次性 agent run」与「持续运行的 loop」之间唯一的区别。

---

## 一、调度是 loop 的心跳

Cobus Greyling 给这个原语下了一句精准定义：

> **「The heartbeat. Without scheduling, you just have a one-off agent run.」**
> （心跳。没有调度，你只是做了一次性 agent 运行。）

这句话点明了调度在 loop 工程里的根本地位。把 loop 拆到最简：

```
agent run（一次性）= prompt → LLM → 输出 → 结束
loop（持续）       = agent run + 调度 + 状态 + 迭代
```

调度是让 agent run **变成** loop 的那个东西。它回答三个问题：

| 问题 | 调度器的回答 |
|------|-------------|
| **什么时候跑？** | 时间（cron）、事件（webhook）、条件（/goal） |
| **跑多久一次？** | cadence（频率），由 loop 的时效性决定 |
| **什么时候停？** | watchlist 空（self-cleanup）、预算耗尽、kill switch |

没有调度器，你手里只有一个 `pi -p "prompt"` 脚本——跑完就没了，不记得上次结果，不会自动再跑。**加上调度器，它才活过来。**

### 调度的五个关键属性

Cobus 把调度的能力拆成五个属性，每个 loop 都要为这五个属性做决策：

| 属性 | 含义 | 典型选择 |
|------|------|----------|
| **Interval（间隔）** | 多久跑一次 | 5m / 15m / 1h / 6h / 1d |
| **Fire-immediately（立即触发）** | 启动时先跑一次，还是等第一个 interval | CI Sweeper 要立即；Daily Trait 等到早上 |
| **Recurring vs one-shot（循环 vs 一次性）** | 持续跑还是跑一次就删 | Triage 循环；临时 fix 一次性 |
| **Durable（持久化）** | 跨重启存活吗 | 机器重启后调度还在不在 |
| **Self-cleanup（自清理）** | 没活干时删掉自己 | watchlist 空 → 停调度省 token |

后面几节逐一展开这五个属性怎么落地。先看有哪些调度模式可选。

---

## 二、四种调度模式

调度不是只有「定时跑」一种。有四种根本不同的模式，每种适合不同场景。

### 模式总览

```
┌─────────────────────────────────────────────────────────────┐
│                    调度模式四象限                              │
│                                                             │
│         时间驱动                    事件驱动                   │
│    ┌──────────────────┐      ┌──────────────────┐          │
│    │  ① Cron 定时      │      │  ② Event-Driven  │          │
│    │  每 N 时间跑      │      │  事件发生时跑     │          │
│    │  简单、可预测      │      │  低延迟、按需     │          │
│    │  可能空跑          │      │  需监听基础设施   │          │
│    └──────────────────┘      └──────────────────┘          │
│    ┌──────────────────┐      ┌──────────────────┐          │
│    │  ③ Webhook       │      │  ④ 混合 Hybrid   │          │
│    │  外部推送触发     │      │  cron 兜底 +      │          │
│    │  最低延迟         │      │  webhook 即时     │          │
│    │  需公网入口       │      │  生产推荐         │          │
│    └──────────────────┘      └──────────────────┘          │
│         定期轮询                    即时响应                   │
└─────────────────────────────────────────────────────────────┘
```

### 四模式对比

| 维度 | ① Cron 定时 | ② Event-Driven | ③ Webhook | ④ 混合 |
|------|-------------|-----------------|-----------|--------|
| **触发** | 时间到 | 事件发生 | 外部 POST | 时间 + 事件 |
| **延迟** | ≤一个 interval | 毫秒级 | 毫秒级 | 毫秒级（事件）/ 兜底（cron） |
| **空跑风险** | 高（没活也跑） | 低（有事件才跑） | 低 | 中（cron 兜底会空跑） |
| **基础设施** | crontab 即可 | 需消息队列/event bus | 需公网 HTTP 端点 | 两者都要 |
| **适合场景** | Daily Triage | CI Sweeper（理想） | PR Babysitter | 生产 CI Sweeper |
| **复杂度** | 低 | 中 | 中 | 高 |

### 各模式的典型 loop 匹配

| Loop | 推荐模式 | 理由 |
|------|----------|------|
| **Daily Triage** | ① Cron（1d） | 每天扫一次，不需要实时 |
| **Issue Triage** | ① Cron（2h）+ ② event | 定时扫 + 新 issue 即时响应 |
| **CI Sweeper** | ④ 混合 | webhook 即时修 + cron 兜底防漏 |
| **PR Babysitter** | ③ Webhook（PR 事件） | PR 有变动才需要看 |
| **Dependency Sweeper** | ① Cron（6h） | 定期扫，不急 |
| **Changelog Drafter** | ② Event（tag/release） | 发版时触发 |
| **Post-Merge Cleanup** | ③ Webhook（merge） | 合并后触发 |

**选型原则**：时效性要求高 → event/webhook；时效性低 → cron（简单可靠）。生产环境的高频 loop 用混合（事件即时 + cron 兜底），兼顾延迟和鲁棒。

---

## 三、事件驱动 vs 轮询：核心取舍

这是调度设计里最根本的决策。先把两种范式讲清楚，再讲怎么选。

### 轮询（Polling）

```
每隔 interval:
  检查 → 有活? → 干 / 没活? → 退出
  等 interval → 再检查
```

- 优点：实现极简（一条 cron），无基础设施依赖
- 缺点：**空跑浪费**（90% 的 tick 可能没活）；延迟 = interval（最坏等一个周期）

### 事件驱动（Event-Driven）

```
事件发生（CI fail / PR open / issue create）:
  → 立即触发 loop → 干
```

- 优点：**零延迟**；不空跑（没事件不跑）
- 缺点：需监听基础设施（webhook server / message queue / GitHub App）；**漏接 = 漏处理**

### 取舍矩阵

| 场景 | 轮询 | 事件驱动 | 推荐 |
|------|------|----------|------|
| **低频 + 不急**（Daily Triage） | ✅ 简单 | ❌ 杀鸡牛刀 | 轮询 |
| **高频 + 急**（CI Sweeper） | ⚠️ 空跑多 | ✅ 即时 | 事件（+ 轮询兜底） |
| **外部触发**（PR Babysitter） | ⚠️ 盲扫 | ✅ 精准 | 事件 |
| **安全网**（防漏接） | ✅ 兜底 | — | **混合的 cron 部分** |

### 成本影响（关键）

Cobus 的成本数据揭示了一个残酷事实：

| Loop | Cadence | Runs/day | 日 token（如果每次都全量跑） |
|------|---------|----------|----------------------------|
| Daily Triage | 1d | 1 | ~50k |
| CI Sweeper | 15m | 96 | **~5M** |
| PR Babysitter | 5m | 288 | **极高** |

CI Sweeper 每 15 分钟跑一次 = 一天 96 次。如果每次都全量跑（implementer + verifier），一天 5M token——**破产**。

解法不是「少跑」，而是 **early exit**：

```
TRIAGE（廉价的预检）:
  读 STATE → 有可操作项? 
    YES → spawn 子 agent（贵）
    NO  → 立即退出（<5k tokens）
```

> Cobus 的 best practice：**「Triage pass is cheap; spawn sub-agents only when state says actionable. Empty watchlist → exit in <5k tokens.」**
>
> 翻译：triage 预检是廉价的（~5k）；只有确认有活可干时，才 spawn 子 agent（~200k）。空 watchlist → 5k token 退出。

这意味着轮询的成本可以接受——**只要 triage 做到廉价 early exit**。事件驱动省的是「空跑的 triage 成本」，不是「有活时的成本」。高频 loop 用事件驱动 + cron 兜底是最优解。

---

## 四、pi 的「无内置调度」哲学

回顾系列反复强调的 pi Philosophy：

> **No sub-agents.** There's many ways to do this. Spawn pi instances via tmux, or build your own with extensions, or install a package that does it your way.

pi 刻意没有 `/loop` 命令、没有内置 scheduler、没有 cron 引擎。这不是缺陷——是设计意图。

### 为什么「无调度」是特性

| 有内置调度的工具 | pi 的做法 |
|------------------|-----------|
| `/loop 15m <prompt>` 一行搞定 | 外部 cron 调起 `pi -p` |
| 调度器藏在工具内部，黑盒 | 调度器是你选的、你管的、你可控的 |
| 工具升级可能改调度行为 | 你的 crontab 永远不变 |
| 调度与 agent 绑死 | 调度与 agent 解耦，可独立换 |

pi 的信念：**调度是系统级关注点，不该由 coding agent 管。** cron/croner/Actions 这些调度器经过几十年打磨，比任何 agent 内置的都可靠。pi 做好「被调起的执行体」，调度交给系统。

### pi 的三种被调起方式

调度器到 pi 之间，有三条路径：

| 方式 | 命令 | 特点 | 调度器看到什么 |
|------|------|------|----------------|
| **print mode** | `pi -p "prompt"` | 进程隔离、一次性、最简 | 一个 shell 命令，跑完退出 |
| **SDK** | `createAgentSession()` | 类型安全、可编排多 session | 一个 Node 进程 |
| **RPC mode** | `pi --mode rpc` | JSONL over stdio、长连接 | 一个 stdin/stdout 管道 |

**调度器永远看到的不是「pi 的 loop 功能」，而是一个普通的 shell 命令或进程。** 这是解耦的体现——crontab 不知道也不关心它调起的是 pi 还是别的什么。

### 关键：pi 进程不长跑

每次调度触发，都**启动一个新的 pi 进程**，跑完就退出：

```
cron 09:00 → 启动 pi -p "triage" → pi 执行 → pi 退出 → 等 09:00+1d
cron 09:15 → 启动 pi -p "ci-sweep" → pi 执行 → pi 退出 → 等 09:15+15m
```

这与 pi Philosophy 的「No background bash. Use tmux.」完全一致——pi 不当 daemon，不长期占用资源。**调度器负责「什么时候叫 pi」，pi 负责「被叫了就干活」，各司其职。**

---

## 五、三种实现：crontab / croner / GitHub Actions

### 5.1 系统 crontab（最经典）

最简、最可靠的调度。适合单机长期跑的 loop。

```cron
# Daily Triage — 每天 09:00
0 9 * * * REPO_CWD=/path/to/repo SLACK_WEBHOOK=https://hooks... \
  cd /path/to/runner && /usr/local/bin/bun run triage.ts \
  >> /path/to/runner/logs/$(date +\%F).log 2>&1

# CI Sweeper — 工作时间每 15 分钟
*/15 9-20 * * * cd /loops && bun run ci-sweeper/index.ts >> logs/cs.log 2>&1

# PR Babysitter — 工作时间每 10 分钟
*/10 9-20 * * * cd /loops && bun run pr-babysitter/index.ts >> logs/pb.log 2>&1

# Post-Merge Cleanup — 每天 22:00 离峰
0 22 * * * cd /loops && bun run post-merge/index.ts >> logs/pm.log 2>&1
```

**优点**：零依赖、系统级可靠、重启自动恢复（cron 服务自启动）。
**缺点**：改 schedule 要改 crontab 文件；跨平台不一致（macOS/Linux/Windows 差异）；无热重载。

### 5.2 croner（TS 内嵌，推荐）

croner 是零依赖的 TS cron 库。推荐原因：配置驱动 + fs.watch 热重载——改 schedule 不改代码、不重启进程。

```typescript
// scheduler.ts — 用 croner 实现 pi loop 调度
import { Cron } from "croner";
import { readFileSync, watch } from "fs";

// jobs.json 配置驱动（改它不重启，fs.watch 热重载）
interface JobConfig {
  name: string;
  cron: string;           // cron 表达式
  command: string;        // 调起的 shell 命令
  activeHours?: string;   // "9-20" 可选，非 active 时间 skip
}

const jobsFile = "./jobs.json";
let jobs: Cron[] = [];

function loadJobs() {
  // 停掉旧的
  jobs.forEach(j => j.stop());
  jobs = [];

  const config: JobConfig[] = JSON.parse(readFileSync(jobsFile, "utf8"));
  for (const job of config) {
    const cron = new Cron(job.cron, () => {
      // activeHours 检查
      if (job.activeHours) {
        const hour = new Date().getHours();
        const [start, end] = job.activeHours.split("-").map(Number);
        if (hour < start || hour >= end) return;  // 非活跃时间 skip
      }
      console.log(`[${new Date().toISOString()] ${job.name} triggered`);
      // 调起 pi（每次新进程）
      Bun.spawn(["bash", "-c", job.command], {
        cwd: process.env.REPO_CWD,
        stdout: { path: `./logs/${job.name}.log` },
      });
    });
    jobs.push(cron);
    console.log(`Loaded: ${job.name} (${job.cron})`);
  }
}

loadJobs();
// fs.watch 热重载：改 jobs.json 自动重载 schedule
watch(jobsFile, () => { console.log("jobs.json changed, reloading..."); loadJobs(); });
```

jobs.json（配置文件，改它即生效）：

```json
[
  { "name": "daily-triage",   "cron": "0 9 * * *",    "command": "bun run triage.ts" },
  { "name": "ci-sweeper",     "cron": "*/15 * * * *", "command": "bun run ci-sweeper/index.ts", "activeHours": "9-20" },
  { "name": "pr-babysitter",  "cron": "*/10 * * * *", "command": "bun run pr-babysitter/index.ts", "activeHours": "9-20" },
  { "name": "post-merge",     "cron": "0 22 * * *",   "command": "bun run post-merge/index.ts" }
]
```

**优点**：配置驱动（改 JSON 不改代码）、热重载（fs.watch）、跨平台（纯 TS）、可与 pi SDK 同进程。
**缺点**：需要一直跑一个 scheduler 进程（但它极轻，不做 LLM 调用）。

> croner 的热重载是关键优势：Multi-Loop 篇的 LOOP.md 调度表如果手动改 crontab，要 SSH 改文件再等 cron 重载；用 croner + fs.watch，改 jobs.json 秒级生效。

### 5.3 GitHub Actions（仓库即 loop）

把调度和 loop 逻辑都放仓库里，GitHub 帮你跑。适合开源/团队项目。

```yaml
# .github/workflows/ci-sweeper.yml
name: CI Sweeper Loop

on:
  # ① 事件驱动：CI 失败时立即触发
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  # ② cron 兜底：每 15 分钟巡检（防 webhook 漏接）
  schedule:
    - cron: "*/15 * * * *"   # 注意：GitHub Actions cron 最少 5 分钟，且不保证准时

jobs:
  sweep:
    if: ${{ github.event.workflow_run.conclusion == 'failure' || github.event_name == 'schedule' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 50 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install @earendil-works/pi-coding-agent
      - name: Run CI Sweeper
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node ci-sweeper/index.ts
```

```yaml
# .github/workflows/daily-triage.yml
name: Daily Triage Loop
on:
  schedule:
    - cron: "0 9 * * *"      # 每天 UTC 09:00
  workflow_dispatch: {}       # 手动触发
jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pi -p "执行 /skill:daily-triage，产出今日报告并回写 STATE.md。" -t read,grep,find,ls,bash
```

**优点**：免维护机器、仓库即配置、天然支持事件 + cron 混合、secret 管理（GitHub Secrets）。
**缺点**：GitHub Actions cron **不保证准时**（文档明确说可能延迟十几分钟）；单次运行有 6 小时上限；免费额度有限。

### 三种实现的选型

| 维度 | crontab | croner | GitHub Actions |
|------|---------|--------|----------------|
| **依赖** | 系统自带 | 一个 npm 包 | GitHub 账号 |
| **热重载** | ❌ | ✅ fs.watch | ✅ push 即生效 |
| **事件驱动** | ❌ | 需自己加 | ✅ workflow_run / push / webhook |
| **准时保证** | ✅ 秒级 | ✅ 秒级 | ❌ 可能延迟 10m+ |
| **维护成本** | 低（机器在就行） | 低（一个进程） | 零（GitHub 管） |
| **适合** | 单机长期 | 多 loop + 热重载 | 开源/团队/无服务器 |

**经验法则**：个人项目用 crontab 起步 → loop 多了换 croner（热重载太香）→ 团队/开源项目用 Actions（仓库即配置）。

---

## 六、Self-Cleanup：没活干时停调度

Cobus 的 Checklist 里有一条容易被忽略但极重要的项：

> **Self-cleanup** — `scheduler_delete` when watchlist empty?
> （watchlist 空时，删掉调度器自己。）

什么意思？loop 的存在是为了处理工作。当**没有工作可处理时**（watchlist 空、所有 issue 关闭、CI 全绿、PR 全 merged），loop 应该**停止自己**，而不是继续空跑。

### 为什么空跑是问题

```
CI 全绿，无失败:
  cron 15m → 启动 pi → pi 读 STATE → 没有可操作项 → pi 退出（~5k tokens）
  cron 15m → 启动 pi → pi 读 STATE → 没有可操作项 → pi 退出（~5k tokens）
  ...（一天 96 次 × 5k = ~480k tokens，全是浪费）
```

即使做了 early exit（5k token 退出），**96 次空跑 = 480k token/天**。钱白花。

### Self-Cleanup 实现

```typescript
// ci-sweeper/index.ts — TRIAGE 状态末尾检查
async function triagePhase(): Promise<State> {
  const failures = await checkCIFailures();   // 查 CI 状态
  if (failures.length === 0) {
    // ① 无可操作项
    const emptyStreak = readState("ci-sweeper-state.md").emptyStreak + 1;
    writeState({ emptyStreak });
    
    // ② 连续 N 次空 → 删自己的调度
    if (emptyStreak >= 10) {
      console.log("连续 10 次无 CI 失败，启用 self-cleanup");
      disableSchedule("ci-sweeper");   // 从 jobs.json 删掉 / crontab 注释掉
      notify("CI Sweeper 已自暂停（连续 10 次无失败）。CI 再次失败时会通过 webhook 重新激活。");
      return { state: "EXIT", reason: "self_cleanup" };
    }
    return { state: "EXIT", reason: "empty_watchlist" };
  }
  // 有可操作项，重置 streak
  writeState({ emptyStreak: 0 });
  return { state: "INVESTIGATE" };
}
```

### 唤醒机制

Self-cleanup 删掉调度后，怎么在「有活了」时恢复？两条路：

| 唤醒方式 | 实现 | 适合 |
|----------|------|------|
| **webhook 唤醒** | CI 失败 webhook → 重新启用调度 | 有 webhook 基础设施的 |
| **外部心跳** | 另一个低频 loop（Daily Triage）巡检 CI 状态，发现失败 → 重启 CI Sweeper | 无 webhook 的（Triage 当「看门人」） |

**关键设计**：Self-cleanup **不删 loop 代码和 skill**，只停**调度**。代码还在，下次唤醒直接用。删的是 cron 行 / jobs.json 条目，不是 runner 脚本。

---

## 七、Off-Hours 与 Active Hours

并非所有 loop 都要 24/7 跑。Cobus 的 Checklist：

> **Off-hours behavior** — slower cadence or paused overnight?

### 三种时段策略

| 策略 | 适用 loop | 实现 |
|------|-----------|------|
| **恒定** | Daily Triage（1d） | 不分时段 |
| **Active hours 降频** | CI Sweeper、PR Babysitter | 白天 15m，夜间 30-60m |
| **完全暂停** | Dependency Sweeper、Post-Merge | 夜间/周末不跑 |

```cron
# CI Sweeper: 白天 15m，夜间 60m
*/15  9-20 * * * cd /loops && bun run ci-sweeper/index.ts >> logs/cs.log 2>&1
0     0-8,21-23 * * * cd /loops && bun run ci-sweeper/index.ts >> logs/cs.log 2>&1

# Dependency Sweeper: 仅工作日
0 */6 * * 1-5 cd /loops && bun run dep-sweeper/index.ts >> logs/ds.log 2>&1

# Post-Merge: 仅夜间
0 22 * * * cd /loops && bun run post-merge/index.ts >> logs/pm.log 2>&1
```

### Active Hours 的决策因素

| 因素 | 倾向 24/7 | 倾向 active hours |
|------|-----------|-------------------|
| **团队时区** | 分布式团队 | 集中时区 |
| **紧急程度** | 主干红必须立即修 | 可等次日 |
| **成本压力** | 预算充足 | 预算紧张（夜间省 50%+） |
| **通知打扰** | 有夜间值班 | 不想半夜被 ping |

**经验法则**：L1 loop（只报告）可以 24/7；L3 loop（改代码并合并）**强烈建议限制 active hours**——半夜自动合并坏代码而人在睡觉，没人能快速回滚。

---

## 八、Durable Scheduling：跨重启存活

Cobus 的 Checklist：

> **Durable** — survives session/tool restart if needed?

「Durable」的意思是：**调度器本身重启后，调度计划还在。**

### 三种实现的 Durability

| 调度器 | 重启后调度在吗 | 为什么 |
|--------|----------------|--------|
| **crontab** | ✅ 是 | cron 是系统服务，开机自启，crontab 文件持久 |
| **croner** | ⚠️ 看部署 | croner 进程崩了调度就没了；需 supervisor 拉起 |
| **GitHub Actions** | ✅ 是 | schedule 存在 GitHub 服务端，不依赖你的机器 |

### croner 的 Durability 方案

croner 本身不保证 durable——它是个进程内库，进程死了调度就没了。要 durable，需配合进程拉起（系列第九篇「韧性与评估」讲了三层拉起）：

```bash
# systemd service: pi-loop-scheduler.service
[Unit]
Description=Pi Loop Scheduler (croner)
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/bun run /loops/scheduler.ts
Restart=always                    # ← 崩了自动拉起
RestartSec=5                      # 5 秒后重启
Environment=REPO_CWD=/path/to/repo

[Install]
WantedBy=multi-user.target        # 开机自启
```

```bash
# 启用
sudo systemctl enable pi-loop-scheduler
sudo systemctl start pi-loop-scheduler
```

这样 croner 进程崩了 systemd 会拉起，机器重启 systemd 会自启——实现 durable。

### Durability 的层次

```
层1: 调度配置 durable（jobs.json / crontab 在磁盘）  ← 所有方案都有
层2: 调度进程 durable（supervisor / systemd 拉起）    ← croner 需要
层3: loop 状态 durable（STATE.md 跨重启存活）         ← Memory 篇讲的
```

三层都 durable，loop 系统才真正「跨重启存活」。缺一层，重启后就少一块。

---

## 九、调度与 loop 状态机的配合

调度器触发 loop 后，loop 进入状态机（L3 篇讲过完整状态机）。调度与状态机之间有一个关键约束：**不重入**。

### 不重入（Non-Reentrant）

```
问题场景:
  09:00 cron 触发 CI Sweeper → FIX 中（耗时 8 分钟）
  09:15 cron 再次触发 CI Sweeper → 两个实例同时跑!
    → 两个实例改同一 worktree → 冲突
    → 两个实例写同一 STATE.md → 覆盖
```

15 分钟 cadence 的 loop 如果单次运行 >15 分钟，下一次 cron 触发时上一次还没跑完——**重入**。

### 锁机制防重入

```typescript
// ci-sweeper/index.ts — 入口加锁
import { lockFileSync, unlockFileSync } from "proper-lockfile";

const LOCK_FILE = "/tmp/ci-sweeper.lock";

async function main() {
  // 尝试加锁
  try {
    lockFileSync(LOCK_FILE);
  } catch {
    console.log("上一个实例还在跑，skip 本次调度");
    process.exit(0);   // 静默退出，不报错
  }

  try {
    await runLoop();   // 正常状态机流程
  } finally {
    unlockFileSync(LOCK_FILE);
  }
}
```

**设计要点**：
- 锁是**文件锁**（跨进程可见），不是内存锁
- 加锁失败 = 上一个还在跑 → **静默退出**（不报错，run-log 记一条 skip）
- `finally` 保证异常时也释放锁（防死锁）
- 可加锁超时（如 30 分钟自动释放，防进程崩了锁不释放）

### 调度→状态机的完整时序

```
cron 触发
  │
  ▼
[加锁] ──失败──► skip（上个实例在跑）──► 退出
  │
  │ 成功
  ▼
[IDLE] → TRIAGE → ... → MERGE/CLEANUP/ESCALATE → [IDLE]
  │                                                    │
  ▼                                                    ▼
[写 run-log]                                     [写 STATE]
  │
  ▼
[释放锁]
  │
  ▼
退出进程（等下次 cron）
```

**每个 cron tick = 一次完整的「锁 → 状态机 → 解锁」周期。** tick 之间 loop 不存在（进程已退出）。这正是 pi「不长跑」哲学的落地——调度器到点叫 pi，pi 跑完一轮就退出，下个 tick 再叫。

### 长时间运行的特例

有些 loop 单次运行确实很长（如大规模重构），可能超过 cadence。两种处理：

| 策略 | 做法 | 适合 |
|------|------|------|
| **调长 cadence** | 把 15m 改成 1h，让单次有足够时间 | 运行时长可预测 |
| **异步化** | FIX 阶段 spawn async 子 agent，主 loop 退出；下个 tick 检查 async 结果 | 运行时长不可预测（见 Meta-Loop 篇 async subagent） |

---

## 十、调度失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **重入冲突** | S2 | 两个实例同时跑，STATE/worktree 冲突 | 文件锁 + 静默 skip |
| **空跑浪费** | S1(钱) | watchlist 空仍每 15m 跑 | early exit + self-cleanup |
| **cron 不准时** | S1 | GitHub Actions 延迟 10m+ | 不依赖准时；用 webhook 即时 + cron 兜底 |
| **调度丢失** | S2 | 机器重启后 croner 进程没起 | systemd/supervisor 拉起（Durable） |
| **锁不释放** | S2 | 进程崩了锁还在，后续全 skip | 锁超时自动释放（30min） |
| **时区错乱** | S1 | cron 用 UTC，实际要本地时间 | 明确标注时区；GitHub Actions 用 UTC |
| **维护窗口冲突** | S1 | loop 在备份/部署期间跑 | LOOP.md 定义 maintenance window，期间 skip |
| **webhook 漏接** | S2 | webhook server 重启期间事件丢失 | cron 兜底巡检（混合模式的核心价值） |

---

## 十一、回顾

1. **调度是 loop 的心跳**。没有调度 = 一次性 agent run，有调度 = 持续运行的 loop。
2. **五个属性**：interval、fire-immediately、recurring/one-shot、durable、self-cleanup。每个 loop 都要为这五个做决策。
3. **四种模式**：cron 定时（简单可靠）、event-driven（零延迟）、webhook（外部推送）、混合（生产推荐）。
4. **事件驱动 vs 轮询**：高频急用事件、低频不急用 cron。但轮询配 early exit 也可接受（空 watchlist <5k token 退出）。
5. **pi 无内置调度是特性**。调度是系统级关注点，pi 当好被调起的执行体，调度交给 crontab/croner/Actions。
6. **三种实现**：crontab（最简）、croner（配置驱动 + 热重载，推荐）、Actions（仓库即 loop，团队/开源）。
7. **Self-cleanup**：watchlist 连续空 N 次 → 停调度（省 token），有活了 webhook/外部心跳唤醒。
8. **Off-hours**：L1 可 24/7，L3 强烈建议限 active hours（半夜自动合并坏代码没人回滚）。
9. **Durable**：调度配置（磁盘）+ 调度进程（systemd 拉起）+ loop 状态（STATE.md），三层 durable 才跨重启存活。
10. **不重入**：文件锁防同 loop 多实例；锁失败静默 skip，不报错不等待。
11. **混合模式是生产标配**：webhook 即时 + cron 兜底，兼顾延迟与鲁棒。

一句话收尾：**调度的艺术不在于「跑得多频繁」，而在于「该跑的时候一定跑、不该跑的时候一定不跑」。** 一个好的调度配置，让 loop 在需要时秒级响应、在空闲时静默不花一分钱——这才是 loop 心跳的正确节奏。

---

## 参考资料

- [系列二：pi L1 落地](./loop-engineering-on-pi)（cron 用法的原始出处）
- [系列三：L3 设计](./loop-engineering-l3-design)（webhook + cron 兜底的混合模式）
- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（LOOP.md 调度表、skip 规则）
- [系列九：韧性与评估](./loop-engineering-resilience-eval)（进程拉起、看门狗）
- [Cobus Greyling — Primitives: Automations / Scheduling](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md)
- [Cobus Greyling — Loop Design Checklist: Scheduling](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- [Cobus Greyling — Operating Loops（cadence × cost）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [pi Philosophy：无内置调度](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- 工具：[croner](https://github.com/hexagon/croner)（零依赖 TS cron）· [GitHub Actions schedule](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)

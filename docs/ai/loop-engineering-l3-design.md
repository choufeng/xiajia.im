# L3 Loop 设计方案：无人值守自治的工程化

> 系列第三篇。前两篇：[Loop Engineering 概念](./loop-engineering) · [pi 上的 L1 落地](./loop-engineering-on-pi)
>
> L1 让 loop **产出报告**，L2 让 loop **提议补丁**——但人始终在回路里拍板。L3 是质变：**人从回路里拿掉，loop 自主完成并合并。** 这一级别的安全设计是命脉，写错就是生产事故。

---

## 零、L3 的本质与代价

L3 的定义只有一句话：

> **loop 自主完成「发现→修复→验证→合并」全链路，无需人工逐项确认。**

这句话藏着三个致命前提，任何一个不成立，你的 L3 就是一颗定时炸弹：

| 前提 | 不成立的后果 |
|------|--------------|
| **验证器能在无人介入时拦住错误** | loop 自信地合并坏代码（Verifier Theater） |
| **失败有界** | 同一个 CI 错被反复「修」5 次以上（Infinite Fix Loop） |
| **每个合并可一键回滚** | 一旦合坏，无快速止血手段 |

> 「**默认：不自动合并。** 如果允许，仅限 trivial allowlist（注释里的错别字、测试文件的 lint 自动修复、import 排序）——绝不含行为变更、依赖升级、lockfile、denylist 路径。」—— Cobus Greyling《Safety & Guardrails》

L3 不是「L2 跑得更勤」，而是**一套全新的安全工程**。本文给出一套可复用的 L3 框架，并用 **CI Sweeper**（CI 失败时自动修复并合并）这个最经典的高风险场景完整走一遍。

---

## 一、六层架构总览

一个生产级 L3 loop 由六层构成，缺一不可。

```
┌─────────────────────────────────────────────────────────────┐
│  ⑥ 可观测层  Observability                                   │
│     run-log(JSONL) · 指标 · 每日汇总 · 通知(分级)              │
├─────────────────────────────────────────────────────────────┤
│  ⑤ 回滚层  Rollback                                          │
│     每个 merge 记录 SHA + 自动 revert 命令 · revert 灰度        │
├─────────────────────────────────────────────────────────────┤
│  ④ 验证链层  Adversarial Verification                        │
│     Implementer → Verifier(跑测试) → Reviewer(审diff) → Gate  │
├─────────────────────────────────────────────────────────────┤
│  ③ 状态机层  State Machine                                   │
│     IDLE→TRIAGE→INVESTIGATE→FIX→VERIFY→GATE→MERGE/ESCALATE   │
│     每状态: 输入/输出/超时/重试上限/失败转移                    │
├─────────────────────────────────────────────────────────────┤
│  ② 护栏层  Guardrails  ← L3 的命脉                            │
│     kill switch · 预算 · 重试上限 · 路径denylist · 合并策略      │
├─────────────────────────────────────────────────────────────┤
│  ① 执行层  pi Agent + Worktree + Memory                      │
└─────────────────────────────────────────────────────────────┘
```

**自底向上**：pi 提供 ①手脚；②③ 是你设计的控制系统；④⑤⑥ 是 L3 区别于 L2 的全部增量。L1/L2 只有 ①③④ 的子集，**L3 必须六层齐全**。

---

## 二、状态机（第③层）

loop 最怕的不是单次失败，而是**失去终止性**。状态机是「保证 loop 一定会停」的机制。

### 状态转移

```
                    ┌──────────┐
        ┌──────────►│   IDLE   │◄─────────────────────────┐
        │           └────┬─────┘                          │
        │  (next tick /   │ (trigger)                      │
        │   webhook)      ▼                                │
        │           ┌──────────┐  无可操作项 ──────► EXIT(empty)
        │           │  TRIAGE  │                          │
        │           └────┬─────┘                          │
        │   有可操作项    │                                │
        │                ▼                                │
        │           ┌──────────┐  超时/超预算 ───► ESCALATE
        │           │INVESTIG. │                          │
        │           └────┬─────┘                          │
        │   诊断完成      │                                │
        │                ▼                                │
        │           ┌──────────┐  试次>MAX ─────► ESCALATE
        │  ┌───────►│   FIX    │◄──────┐                   │
        │  │        └────┬─────┘       │                   │
        │  │  改动产出     │             │ verify 失败        │
        │  │              ▼             │ (< MAX 试次)       │
        │  │        ┌──────────┐        │                   │
        │  │        │  VERIFY  │────────┘                   │
        │  │        │ (跑测试)  │                            │
        │  │        └────┬─────┘                            │
        │  │  测试全绿     │                                  │
        │  │              ▼                                  │
        │  │        ┌──────────┐  denylist/半径超标 ► ESCALATE
        │  │        │  REVIEW  │                            │
        │  │        │ (审diff) │                            │
        │  │        └────┬─────┘                            │
        │  │  审核通过      │                                │
        │  │              ▼                                │
        │  │        ┌──────────┐  human-gate 触发 ► ESCALATE
        │  │        │   GATE   │                            │
        │  │        └────┬─────┘                            │
        │  │  最终放行       │                                │
        │  │              ▼                                │
        │  │        ┌──────────┐                           │
        │  │        │  MERGE   │──► 记录SHA+revert ──┐     │
        │  │        └────┬─────┘                    │     │
        │  │             │                          │     │
        │  │             ▼                          │     │
        │  │        ┌──────────┐                    │     │
        │  └────────┤ CLEANUP  │(prune worktree,    │     │
        │           │          │ 更新STATE, 记log)   │     │
        │           └────┬─────┘                    │     │
        │                │                          │     │
        └────────────────┘                          │     │
                    (回到 IDLE)                      │     │
                                                   ▼     │
        ESCALATE ──► 通知人 + 写 STATE[Waiting] + log + ►─┘
```

### 每状态的契约

| 状态 | 输入 | 输出 | 超时 | 失败转移 |
|------|------|------|------|----------|
| **IDLE** | 调度触发/webhook | 进入 TRIAGE 或保持 IDLE | — | — |
| **TRIAGE** | STATE.md + 事件源 | `actionable: bool` + 分类 | 60s | 无可操作项 → EXIT |
| **INVESTIGATE** | 分类后的问题 | 诊断结论 + 拟修范围 | 180s | 超时/超预算 → ESCALATE |
| **FIX** | 诊断 + worktree | diff | 300s | 试次 > MAX_ATTEMPTS → ESCALATE |
| **VERIFY** | diff | `pass: bool` + 测试日志 | 测试本身耗时 | 失败且 < MAX → 回 FIX |
| **REVIEW** | diff + 范围 | `approve: bool` + 理由 | 120s | denylist/半径超标 → ESCALATE |
| **GATE** | 全部证据 | `merge: bool` | 10s | 命中 human-gate → ESCALATE |
| **MERGE** | 放行 | commit SHA + revert cmd | 60s | 合并失败 → ESCALATE + revert |
| **CLEANUP** | merge 结果 | pruned STATE + worktree | 30s | 清理失败仅 log，不阻塞 |
| **ESCALATE** | 任意失败上下文 | 通知人 + STATE[Waiting] | — | 终态，回 IDLE |

> **铁律：每个状态有超时，每条转移路径都收敛到 IDLE 或 ESCALATE。** 不存在「永远在 FIX↔VERIFY 循环」的路径——这正是 Infinite Fix Loop 的解药。

---

## 三、护栏系统（第②层）—— L3 的命脉

L3 与 L2 的全部差距，在护栏。七类护栏，每一类都对应一种真实事故。

### 3.1 Kill Switch（全局停止）

最高优先级，任何状态必须能被立即叫停。三条通道，任一触发即停：

| 通道 | 实现 | 用途 |
|------|------|------|
| **文件开关** | `~/.pi/loop-control/CI_SWEEPER.kill` 存在即停 | 最快、最可靠，每个 tick 检查 |
| **HTTP** | `POST /kill`（runner 自带小 HTTP server） | 远程、临时 |
| **intercom** | pi 双向通道，人在 Telegram/Slack 回 `/kill ci-sweeper` | 移动端、长程 |

```typescript
// 每个 tick / 每个状态入口检查
function shouldKill(): boolean {
  if (existsSync("~/.pi/loop-control/CI_SWEEPER.kill")) return true;   // 文件
  if (killFlag) return true;                                           // HTTP
  return false;
}
if (shouldKill()) { await escalate("kill switch triggered"); return; }
```

### 3.2 预算上限（Token / 成本 / 时间）

L3 loop 失控最常见原因是**成本爆炸**。硬预算，超出即停。

```markdown
## Loop Budget — CI Sweeper
- max_tokens_per_run: 500_000
- max_tokens_per_day: 2_000_000
- max_duration_per_run_s: 900        (15 分钟)
- max_subagent_spawns_per_run: 4
- on_exceed: pause + escalate
```

关键设计：**TRIAGE 是廉价的（~5k tokens），子 agent 只在「有可操作项」时才 spawn。** 空监听列表 → 立即 EXIT（<5k tokens）。这是 CI Sweeper 每天跑 96 次却不破产的唯一办法。

### 3.3 重试上限（防 Infinite Fix Loop）

```typescript
const MAX_ATTEMPTS_PER_ITEM = 3;   // 同一 CI 失败最多修 3 次
// STATE.md 记录 attempt_count，FIX 入口检查
if (item.attemptCount >= MAX_ATTEMPTS_PER_ITEM) {
  await escalate(`第 ${item.attemptCount} 次仍未修好，交还给人`);
  return;
}
```

> **Cobus 的事故分类**：Infinite Fix Loop 是 **S2（有害）**——同一 PR/CI 被自动修 5+ 次。根因三选一：verifier 太弱、误诊（治症不治本）、把 flaky test 当 regression。对策：硬上限 3 次 → escalate。

### 3.4 路径 Denylist（绝碰不得的文件）

```
.env / .env.*
**/secrets/**
**/credentials/**
**/*_key* / **/*_secret*
.terraform/** / k8s/production/**
**/migrations/**          # 除非专门的 migration loop
auth/** / payments/** / billing/**
**/package-lock.json / **/yarn.lock / **/pnpm-lock.yaml   # CI Sweeper 绝不碰 lockfile
```

双重编码：① skill 里写明（软约束，给模型）② GATE 状态用 `git diff --name-only` 硬检查（强约束，代码兜底）。

```typescript
const DENYLIST = [/^\.env/, /secrets\//, /\/migrations\//, /lock\./, /* ... */];
const changedFiles = exec(`git diff --name-only main`).split("\n");
const violations = changedFiles.filter(f => DENYLIST.some(re => re.test(f)));
if (violations.length) { await escalate(`denylist 命中: ${violations}`); return; }
```

### 3.5 Auto-Merge 策略

```markdown
## 允许自动合并（CI Sweeper）
- 单文件、<20 行 diff
- 仅限 src/**（或更窄的 src/{failed-module}/**）
- 测试 + lint + typecheck + build 全绿
- 改动类型: 修 bug（非新功能/重构）

## 绝不自动合并（→ ESCALATE）
- 触碰 denylist
- diff > N 行 或 文件数 > M（建议 N=20, M=3）
- 依赖升级（供应链风险）
- 涉及 auth/security/payments/infra
- 第 3 次尝试
```

### 3.6 变更半径白名单

L3 必须收窄到**最小可信半径**。CI Sweeper 只能改 `src/`，甚至更窄——按失败模块限定。worktree 里超出半径的改动，REVIEW 直接拒。

### 3.7 Human Gates（强制升级）

无论「看起来多安全」，以下一律 ESCALATE，绝不自动合并：

- 安全 / 认证 / 授权相关
- 支付 / 计费 / PII
- 基础设施 / Terraform / K8s prod
- 依赖升级（供应链）
- 改动 > N 文件（建议 N=10）
- 同一 item 第 3 次尝试

---

## 四、验证链（第④层）—— Adversarial

L3 的验证链必须**对抗式（adversarial）**，每个角色独立、目标相反。

| 角色 | 模型 | 上下文 | 目标 | 失败即 |
|------|------|--------|------|--------|
| **Implementer** | 标准 | worktree，读源码 | 「让它过」 | 回 FIX 重试 |
| **Verifier** | 更强或同等 | **fresh**，只看 diff + 跑测试 | 「证明它坏」 | 回 FIX 重试 |
| **Reviewer** | 更强 | **fresh**，审 diff 安全/正确/半径 | 「找理由拒绝」 | ESCALATE |
| **Gate** | 代码（非 LLM） | 全部证据 | 机械检查 denylist/半径/预算/试次 | ESCALATE |

> **Verifier Theater（验证器戏剧）** 是 L3 最阴险的失败：verifier「批准」了，CI 却挂、review 一眼就出 bug。根因三选一：verifier prompt 太虚（"looks good"）、没真跑测试、跟 implementer 同模型同上下文。对策：**verifier 必须跑测试命令并报告输出；prompt 写「找拒绝的理由」；L3 用更强模型或至少 fresh context。**

pi 里的实现：每个角色一个**独立 fresh session**（SDK 的 `SessionManager.inMemory`），或 subagent 的 `context: "fresh"`。绝不复用 implementer 的上下文。

---

## 五、回滚（第⑤层）

每个 merge 必须可一键回滚。三步：

```typescript
// MERGE 状态产出
const revertRecord = {
  mergedAt: new Date().toISOString(),
  sha: mergeCommitSha,
  branch: "ci-sweeper/fix-142",
  files: changedFiles,
  reason: "CI fix: OAuth callback 500",
  revertCmd: `git revert ${mergeCommitSha} --no-edit && git push`,
  autoRevertOn: "post-merge CI red within 10min",  // 可选: 合并后 CI 再红则自动 revert
};
appendJSONL("~/.pi/loop-control/CI_SWEEPER-reverts.jsonl", revertRecord);
```

**灰度 revert**（可选但强烈推荐）：合并后观察 N 分钟，若主干 CI 再次变红，**自动 revert 并 escalate**。这是 L3 的「后悔药」。

---

## 六、可观测（第⑥层）

### Run Log（每次运行，JSONL）

```json
{
  "run_id": "2026-06-14T09:15:00Z",
  "trigger": "ci-failed:job-8821",
  "pattern": "ci-sweeper",
  "duration_s": 412,
  "states_visited": ["TRIAGE","INVESTIGATE","FIX","VERIFY","REVIEW","GATE","MERGE","CLEANUP"],
  "items_found": 1,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 187000,
  "attempt": 1,
  "outcome": "merged",
  "merged_sha": "a1b2c3d",
  "revert_cmd": "git revert a1b2c3d --no-edit"
}
```

### 通知分级（防 Notification Fatigue）

| 级别 | 触发 | 通道 |
|------|------|------|
| **静默** | TRIAGE empty、EXIT | 仅 run-log |
| **常规** | MERGE 成功 | run-log + `#ci-sweeper` 汇总（每小时一条） |
| **升级** | ESCALATE、kill switch | run-log + `#loop-escalations` 即时 @ 人 |
| **告警** | 预算超限、连续失败、回滚 | run-log + `#loop-escalations` + PagerDuty |

> **Notification Fatigue 是 S1→S2**：Slack 每 5 分钟响一次，团队把 bot 静音，真正的升级被错过。对策：**只对 actionable findings 通知，不对每次运行通知。**

### Metrics（每周看）

| 指标 | 健康阈值 |
|------|----------|
| TRIAGE 命中率（actionable/runs） | >10%，否则 cadence 太密 |
| FIX 首次成功率 | >60%，否则 verifier/诊断有问题 |
| ESCALATE 率 | 20-40%，太低=护栏太松，太高=能力不足 |
| 平均 attempt | <1.5，接近 MAX_ATTEMPTS 说明系统性问题 |
| 回滚率 | <5%，>10% 立即降级回 L2 |

---

## 七、升级判定：什么时候才该上 L3

L3 不是能力问题，是**成熟度问题**。从 L2 升 L3，需要这些信号**全部**满足：

| 信号 | 含义 | 怎么验证 |
|------|------|----------|
| L2 连续 4 周稳定 | 提议质量可靠 | 提议被 review 接受率 >85% |
| Verifier 误判率 <2% | 验证器能拦错 | 追踪 verifier 放行后人 review 拒绝的次数 |
| 护栏六层齐全 | 安全工程到位 | 本文 checklist 逐项过 |
| 回滚演练通过 | 能快速止血 | 实测 revert < 2 分钟生效 |
| run-log + 预算可观测 | 可审计 | `loop-audit` 达 L3 分数 |
| 杀过一次 kill switch | 知道怎么停 | 演练过文件/HTTP/intercom 三通道 |

**任一不满足，留在 L2。** 升级判定标准永远是「**验证器能否在无人介入时拦住错误**」，不是「worker 能否跑」。

---

## 八、完整实现：CI Sweeper（基于 pi）

把上面六层落成一个能跑的 CI Sweeper。事件驱动（GitHub Actions webhook）+ 定时巡检兜底（poll fallback）。

### 8.1 目录结构

```
ci-sweeper/
├── sweeper.ts                 # 主 runner（状态机 + 六层）
├── control/                   # 护栏运行时
│   ├── kill.ts                # kill switch（文件/HTTP/intercom）
│   ├── budget.ts              # 预算追踪
│   └── denylist.ts            # 路径检查
├── roles/                     # 验证链（每个角色一个文件）
│   ├── triage.ts
│   ├── investigator.ts
│   ├── fixer.ts               # implementer (worktree)
│   ├── verifier.ts            # 跑测试
│   └── reviewer.ts            # 审 diff
├── .pi/skills/ci-sweeper/
│   └── SKILL.md               # intent 记忆
├── server.ts                  # webhook 接收（CI 失败事件）
└── STATE.md                   # loop 记忆（项目仓库根）
```

### 8.2 状态机骨架（sweeper.ts）

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { checkKill } from "./control/kill";
import { Budget } from "./control/budget";
import { checkDenylist, checkRadius } from "./control/denylist";

const REPO = process.env.REPO_CWD!;
const MAX_ATTEMPTS = 3;

type State = "IDLE"|"TRIAGE"|"INVESTIGATE"|"FIX"|"VERIFY"|"REVIEW"|"GATE"|"MERGE"|"CLEANUP"|"ESCALATE"|"EXIT";

async function runAgent(role: string, tools: string[], prompt: string, budget: Budget) {
  if (checkKill()) throw new KillError();
  budget.checkOrThrow();
  let out = "";
  const { session } = await createAgentSession({
    cwd: REPO,
    tools,
    sessionManager: SessionManager.inMemory(REPO),
  });
  session.subscribe(e => {
    if (e.type==="message_update" && e.assistantMessageEvent.type==="text_delta")
      out += e.assistantMessageEvent.delta;
    // 真实实现: 累计 token usage 喂给 budget
  });
  await session.prompt(prompt);
  session.dispose();
  budget.addTokens(estimateTokens(out));   // 简化; 实际从 session.agent.state 取 usage
  return out;
}

async function runLoop(trigger: { jobId: string; logs: string }) {
  const budget = Budget.forRun("ci-sweeper");
  const log = newRunLog({ trigger });
  let state: State = "IDLE";
  let attempt = 0;
  let diagnosis = "", diff = "";

  while (state !== "EXIT" && state !== "ESCALATE") {
    if (checkKill()) { state = "ESCALATE"; break; }

    switch (state) {
      case "IDLE":
        state = "TRIAGE"; break;

      case "TRIAGE": {
        const r = await runAgent("triage", ["read","grep","find","ls","bash"],
          `执行 /skill:ci-sweeper 的 triage 阶段。读 STATE.md + 下面 CI 日志，判断是否 actionable（true/false）+ 分类（compile/test/flaky/deps）。无高优 → 立即说 EXIT。
          --- CI logs ---\n${trigger.logs}`, budget);
        if (/EXIT/.test(r)) { state = "EXIT"; break; }
        state = "INVESTIGATE"; break;
      }

      case "INVESTIGATE": {
        diagnosis = await runAgent("investigator", ["read","grep","find","bash"],
          `基于 STATE.md 和 CI 日志诊断根因。输出: 拟改文件列表(必须全在 src/ 下) + 根因 + 修复方向。禁止碰 lockfile/secrets/migrations。`, budget);
        state = "FIX"; break;
      }

      case "FIX": {
        attempt++;
        if (attempt > MAX_ATTEMPTS) { state = "ESCALATE"; break; }
        // ① 用 pi subagent worktree 隔离改动 (L2 升级篇讲过)
        //    或在 SDK 里手动 git worktree add 后切 cwd
        diff = await runAgent("fixer", ["read","edit","write","bash","grep"],
          `执行 /skill:ci-sweeper 的 fix 阶段。诊断: ${diagnosis}。
           只改 src/ 下文件。最小改动，不重构。改完 git diff 给我看。`, budget);
        state = "VERIFY"; break;
      }

      case "VERIFY": {
        // ② Verifier 必须真跑测试 (防 Verifier Theater)
        const testResult = execInWorktree(`npm test 2>&1; npm run lint 2>&1; npm run typecheck 2>&1`);
        const verdict = await runAgent("verifier", ["read"],
          `你是独立的 verifier，目标是「证明这个修复不行」。
           diff: ${diff}
           测试/lint/typecheck 实际输出: ${testResult}
           只在全部全绿时说 VERIFY_PASS，否则说 VERIFY_FAIL + 理由。`, budget);
        state = /VERIFY_PASS/.test(verdict) ? "REVIEW" : "FIX";   // 失败回 FIX (attempt 上限拦无限循环)
        break;
      }

      case "REVIEW": {
        // ③ 硬检查 denylist + 半径 (代码兜底, 不靠 LLM)
        const violations = checkDenylist(diff);
        const radiusOk = checkRadius(diff, { maxFiles: 3, maxLines: 20, allowedPaths: ["src/"] });
        if (violations.length || !radiusOk) {
          await escalate(`REVIEW 拒绝: denylist=${violations} radiusOk=${radiusOk}`);
          state = "ESCALATE"; break;
        }
        const review = await runAgent("reviewer", ["read"],
          `独立 reviewer，找拒绝理由。diff: ${diff}。检查: 是否治症不治本? 是否引入新风险? 是否超最小改动?
           通过说 REVIEW_APPROVE，否则 REVIEW_REJECT + 理由。`, budget);
        state = /REVIEW_APPROVE/.test(review) ? "GATE" : "ESCALATE";
        break;
      }

      case "GATE": {
        // ④ 纯机械检查 (human gates 全部命中即 ESCALATE)
        const gateFail = checkHumanGates({ attempt, diff, diagnosis });   // 见 3.7
        state = gateFail ? "ESCALATE" : "MERGE";
        break;
      }

      case "MERGE": {
        const sha = await squashMerge("ci-sweeper/fix", { diff });
        const revertRecord = { sha, revertCmd: `git revert ${sha} --no-edit`, diff, at: new Date().toISOString() };
        appendJSONL("~/.pi/loop-control/CI_SWEEPER-reverts.jsonl", revertRecord);
        // 可选: 启动 10 分钟 post-merge 观察窗口, CI 再红则 auto-revert
        log.merged_sha = sha; log.revert_cmd = revertRecord.revertCmd;
        state = "CLEANUP"; break;
      }

      case "CLEANUP": {
        await pruneWorktree();
        await updateState("clear", trigger.jobId);   // State Rot 防护: 每次 prune 已合并项
        log.outcome = "merged"; state = "EXIT"; break;
      }
    }
  }

  if (state === "ESCALATE") {
    await escalate(`CI Sweeper 放弃 (attempt=${attempt}, state=${state})`);
    await updateState("waiting", trigger.jobId);
    log.outcome = "escalated";
  }
  await writeRunLog(log);
  await notify(log);   // 分级通知
}
```

### 8.3 CI Sweeper Skill（intent 记忆）

`.pi/skills/ci-sweeper/SKILL.md`：

````markdown
---
name: ci-sweeper
description: CI 失败时自动诊断+修复+合并。仅 src/，最小改动，绝不碰 lockfile/secrets。
---

# CI Sweeper

## 铁律（不可违反）
- **只改 src/** 下文件。lockfile / secrets / migrations / auth / k8s → 一律 escalate
- **最小改动**：治根因，不治症状。不重构、不加新功能
- **绝不为了过 CI 禁用测试或调大 timeout**（flaky 要 quarantine + 开 ticket，不是改代码）
- **flaky test 识别**：同类失败 <30% 出现率 → 当 flaky，escalate 而非改代码

## Triage 分类决策树
CI 日志 →
- compile/type error → INVESTIGATE（大概率可自动修）
- test assertion fail → INVESTIGATE（看是否真 regression）
- flaky / timeout / network → EXIT + quarantine ticket（不自动改）
- dependency resolution → ESCALATE（供应链，人决）
- infra/env → ESCALATE

## 失败历史查询
修前先读 `~/.pi/loop-control/CI_SWEEPER-reverts.jsonl` 和 STATE.md 的 [Waiting]，
看这个 issue 上次怎么失败的，避免重复踩坑（Memory 原语）。
````

### 8.4 预算追踪（control/budget.ts）

```typescript
export class Budget {
  private tokens = 0; private spawns = 0;
  constructor(private limits: { tokens: number; spawns: number }) {}
  static forRun(name: string) {
    const cfg = loadBudgetConfig(name);   // 从 loop-budget.md 读
    return new Budget(cfg);
  }
  addTokens(n: number) { this.tokens += n; }
  addSpawn() { this.spawns++; }
  checkOrThrow() {
    if (this.tokens > this.limits.tokens) throw new BudgetError(`tokens ${this.tokens} > ${this.limits.tokens}`);
    if (this.spawns > this.limits.spawns) throw new BudgetError(`spawns ${this.spawns} > ${this.limits.spawns}`);
  }
}
```

### 8.5 事件入口（server.ts）

```typescript
// CI 失败 webhook → 触发 runLoop
import express from "express";
const app = express();
app.post("/github-webhook", express.json(), async (req, res) => {
  if (req.body.check_run?.conclusion === "failure") {
    const logs = await fetchCILogs(req.body.check_run.id);
    runLoop({ jobId: String(req.body.check_run.id), logs }).catch(escalate);
  }
  res.sendStatus(200);
});
// 同时暴露 kill 端点 (护栏 3.1 的 HTTP 通道)
app.post("/kill", (_, res) => { killFlag = true; res.sendStatus(200); });
app.listen(3010);
```

加 crontab 巡检兜底（webhook 漏接时不漏）：

```cron
*/15 * * * * cd /ci-sweeper && bun run poll-failed-ci.ts >> logs/poll.log 2>&1
```

---

## 九、pi 在 L3 里的特色能力

| pi 能力 | L3 用法 |
|---------|---------|
| **subagent acceptance** | FIX+VERIFY 可用 `subagent({ agent:"worker", worktree:true, acceptance:{ criteria, verify:[{id:"tests",command:"npm test"}], stopRules:["连续2轮测试失败则停"] } })`——acceptance 契约就是 L3 验证链的代码化 |
| **intercom 双向** | kill switch 第三通道 + 人在 Slack/Telegram 回 `/approve ci-sweeper a1b2c3` 触发灰度观察后的放行 |
| **async/background subagent** | 长跑调查（INVESTIGATE 超时风险高）异步化，主 loop 不阻塞 |
| **memory（跨 run）** | 记「这个 CI 错上次怎么修的、为什么失败」——L3 最值钱的记忆，直接降低 attempt 数 |
| **worktree** | 每个 FIX 独立 worktree，改炸不影响主干，CLEANUP 清理 |

> **memory 是 L3 的隐形杠杆**：没有跨 run 记忆，每次都从零诊断，attempt 数居高不下；有了「上次失败原因」的记忆，第二次遇到同类问题可能首次就修对。这是把 token-rich 逐渐转 token-poor 的关键——上一篇 Mem0 视角的实战落地。

---

## 十、L3 特有的失败模式（事故目录）

| 失败 | 严重度 | 症状 | 本文对策 |
|------|--------|------|----------|
| **Infinite Fix Loop** | S2 | 同一 CI 错被修 5+ 次 | MAX_ATTEMPTS=3 硬上限 + STATE 记 attempt |
| **Verifier Theater** | S2 | verifier 放行但 CI 挂/人有 bug | verifier 真跑测试 + fresh context + 更强模型 |
| **State Rot** | S1→S2 | STATE 引用已合并 PR/关闭 ticket | CLEANUP 每 run prune + 校验 ID 存活 |
| **Notification Fatigue** | S1→S2 | bot 被静音，真升级被错过 | 只对 actionable 通知，分级通道 |
| **Token 失控** | S1→S2(钱) | 子 agent + 长跑爆账单 | 硬预算 + early exit + TRIAGE 廉价 |
| **合并坏代码** | S3 | 自动合并了错的改动 | denylist + 半径 + 灰度 auto-revert + kill switch |
| **供应链注入** | S3 | 自动升级引入恶意依赖 | 依赖升级一律 human gate，绝不自动 |
| **回滚失效** | S3 | revert 也有 bug | revert 演练 + revert 只回滚不重试 |

---

## 十一、回顾：L3 的工程纪律

1. **L3 = L2 + 六层安全工程**。差距全在护栏/回滚/可观测，不在能力。
2. **状态机保证终止性**。每状态有超时，每路径收敛到 IDLE/EXIT/ESCALATE。
3. **七类护栏是命脉**：kill switch（三通道）、预算、重试上限、denylist、合并策略、半径白名单、human gates。
4. **验证链必须对抗式**：四角色独立 fresh context，verifier 真跑测试，目标是「找拒绝理由」。
5. **每个 merge 可一键 revert**，且合并后灰度观察，CI 再红自动回滚。
6. **升级看成熟度不看能力**：6 个信号全满足才上 L3，否则留 L2。
7. **pi 的角色**：subagent acceptance = 验证链代码化，intercom = 双向 kill/approve，memory = 跨 run 降 attempt。

最后一句话收尾：**L3 的目标不是「让 loop 能自己跑」，而是「让 loop 自己跑的时候，你能睡得着觉」。** 睡不着，说明护栏还没到位——回到 L2。

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering) · [系列二：pi 上的 L1 落地](./loop-engineering-on-pi)
- [Cobus Greyling — Safety & Guardrails](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/safety.md)
- [Cobus Greyling — Failure Mode Catalog](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md)
- [Cobus Greyling — Operating Loops in Production](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [Cobus Greyling — Loop Design Checklist](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- pi 关键 API：`createAgentSession` · `subagent({ worktree, acceptance, async })` · intercom · memory · `SessionManager.inMemory`

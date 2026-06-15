# Loop 可观测性深度：Tracing、Metrics、Logging 三支柱

> 系列第二十二篇。前序篇章：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup) · [Documentation Loop](./loop-engineering-documentation) · [Intent Debt](./loop-engineering-intent-debt) · [Comprehension Debt](./loop-engineering-comprehension-debt) · [Cognitive Surrender](./loop-engineering-cognitive-surrender)
>
> 韧性篇提过 run-log/metrics/通知分级，Meta-Loop 篇讲过汇总观测数据——但都是**点状提及**。这篇把它们系统化：Loop 的可观测性三大支柱是什么、怎么设计、以及最实际的——**「昨天 10:15 那次 run 为什么那么干」怎么查**。

---

## 零、为什么 Loop 需要专属可观测性

传统 APM（Datadog、New Relic）为 request-response 微服务设计：一个请求进来，经过若干 service，返回。追踪边界清晰，单次调用生命周期短。

Loop 的可观测性需求根本不同：

| 维度 | 传统微服务 | Loop |
|------|-----------|------|
| 生命周期 | 毫秒到秒 | 分钟到小时 |
| 边界 | service-to-service（同进程网） | webhook→runner→pi session→worktree→run-log（跨进程跨文件） |
| 关键问题 | 「这个请求为什么慢？」 | 「**这个 loop 昨天为什么合并了那个 PR？**」 |
| 调试依赖 | 链路追踪 | **决策推理链**（模型怎么想的、哪步判错了） |
| 时间跨度 | 实时 | 跨天、跨 run（今天的行为受昨天 STATE 影响） |

传统 APM 看的是「**流量和延迟**」。Loop 可观测性看的是「**决策质量与趋势**」。这套东西没有现成产品，你得自己搭。

Cobus Greyling 在 operating-loops.md 开篇就说：

> 「**Running a loop is operations work.** This doc covers cost, logging, metrics, and when to pause or kill.」

loop 一旦上生产，它就是运维对象。而运维的前提是**可见**——不可见的 loop 是黑盒，黑盒出事只能盲猜。

---

## 一、三支柱对照

可观测性的三支柱（Google SRE 经典框架），映射到 Loop：

| 支柱 | 传统定义 | Loop 定义 | 核心问题 | 频率 |
|------|----------|-----------|----------|------|
| **Tracing** | 请求跨服务的链路 | traceId 从触发源贯穿到 pi session 到 run-log | 「这次 run 经过了哪些环节？」 | 每次 run |
| **Metrics** | QPS/延迟/错误率 | attempt 分布、verdict 分布、escalate 率、revert 率、token/run | 「loop 长期质量趋势如何？」 | 聚合（日/周） |
| **Logging** | 结构化日志 | JSONL append-only run-log + pi session JSONL | 「这次 run 到底干了什么？」 | 每次 run + 每 turn |

三者的关系：

```
                Metrics 回答「趋势对不对」
                   ↓ 异常时
              查 Tracing 定位「哪次 run」
                   ↓ 找到 run_id
              查 Logging 还原「为什么那么干」

Tracing 是索引，Logging 是证据，Metrics 是趋势。
```

这套流程是第六节「debug 调查路径」的骨架。先逐一讲三支柱怎么设计。

---

## 二、Tracing：traceId 贯穿一切

Tracing 的核心是**一个 ID 贯穿所有边界**，让你能从任何一个片段反查全链路。

### 2.1 traceId 的生命周期

```
webhook 收到 CI 失败
  │ runner 生成 traceId = "cs-2026-06-14T09:15-a1b2c3"
  │
  ▼
runner 启动 pi session（print mode / SDK）
  │ traceId 注入 prompt（作为元信息）
  │ session 文件: ~/.pi/agent/sessions/.../<timestamp>_<uuid>.jsonl
  │ 记录 mapping: { traceId → sessionId, traceId → runLogEntry }
  │
  ▼
pi agent 执行（多 turn：triage→fix→verify→review）
  │ 每 turn 的 message 都在 session JSONL 里
  │ turn_end 事件含 toolResults
  │
  ▼
runner 写 run-log 条目
  │ { run_id, traceId, sessionId, outcome, ... }
  │
  ▼
通知发出
  │ Slack 消息附 traceId："📋 ci-sweeper ✅ traceId: cs-2026-...a1b2c3"
```

### 2.2 traceId 的生成规则

```typescript
function generateTraceId(loopName: string, trigger: Trigger): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const nonce = crypto.randomBytes(3).toString("hex");
  return `${loopName.slice(0, 2)}-${ts}-${nonce}`;
  // 例: "cs-2026-06-14T09-15-00-a1b2c3"
}
```

设计要点：
- **人类可读**：含 loop 缩写 + 时间戳，看一眼就知道哪天哪个 loop
- **唯一性**：nonce 防同秒并发
- **可 grep**：纯 ASCII，无空格，`grep` / `jq` 友好

### 2.3 三个 ID 的映射

一次 run 涉及三个 ID，必须在 runner 层建立映射：

| ID | 谁生成 | 存在哪 | 用途 |
|----|--------|--------|------|
| `traceId` | runner | run-log + 通知 | 人查的入口（Slack/邮件里看到的） |
| `runId` | runner | run-log（== ISO 时间戳） | run-log 的主键 |
| `sessionId` | pi | `~/.pi/agent/sessions/` | pi session JSONL 的文件名 |

```typescript
// runner 建立映射并写 run-log
const traceId = generateTraceId("ci-sweeper", trigger);
const { session } = await createAgentSession({
  cwd: REPO,
  sessionManager: SessionManager.inMemory(REPO),  // 或持久化
});
const sessionId = session.sessionId;

// run-log 条目含三者
const entry = {
  run_id: timestamp,
  traceId,                    // 人查入口
  sessionId,                  // pi session 文件（调 pi 日志用）
  pattern: "ci-sweeper",
  trigger: trigger.jobId,
  outcome: "...",             // 跑完填
  // ...
};
appendRunLog("ci-sweeper-run-log.jsonl", entry);
```

**铁律：通知里必须附 traceId。** 人看到 Slack 消息「ci-sweeper 合并了 #142」时，能直接 grep traceId 查全部细节。没有 traceId = 黑盒。

---

## 三、Metrics：Loop 专用指标集

传统指标（QPS/延迟/p99）对 loop 几乎无意义——loop 不是高频请求处理。Loop 需要的是**决策质量与效率指标**。

### 3.1 核心指标集

按 Cobus 的 metrics dashboard 模板扩展，分为五组：

| 组 | 指标 | 计算 | 健康区间 | 异常信号 |
|----|------|------|----------|----------|
| **运行量** | runs/day | run-log count | 按 cadence 预期 | 突降=scheduler 挂；突升=轮询风暴 |
| | actionable_rate | items_found>0 / runs | >10% | <10% = cadence 太密或 triage 太弱 |
| **决策质量** | first_fix_success_rate | attempt=1 即成功 / 总 fix | >60% | <50% = skill/verifier 有问题 |
| | escalate_rate | escalations / runs | 20-40% | <10% 护栏失效；>50% 能力不足 |
| | revert_rate | post-merge reverted / merged | <5% | >10% 立即降级 |
| **效率** | avg_tokens_per_run | sum(tokens) / runs | 按预算 | 持续升 = 漂移 |
| | avg_attempt | sum(attempt) / fix_runs | <1.5 | >2.5 = 系统性问题 |
| | avg_duration_s | sum(duration) / runs | 按模式 | 突增 = pi hang 或改动过大 |
| **验证链** | verifier_pass_rate | verify_pass / total_verify | 70-90% | >95% = verifier 太松；<50% = fixer 太弱 |
| | reviewer_reject_rate | review_reject / total_review | 10-30% | <5% = reviewer 橡皮图章 |
| **成本** | tokens_per_success_fix | sum(tokens) / success_fixes | — | 越低越好，趋势看 |
| | daily_token_total | sum(today tokens) | < day 预算 | >80% 触发降级 |

### 3.2 Metrics 聚合管道

```
每次 run 写 run-log（含 outcome/attempt/tokens/...）
        ↓
每天 cron 聚合 run-log → metrics-day-YYYY-MM-DD.json
        ↓
每周 Meta-Loop 聚合 7 天 → metrics-week-YYYY-Wxx.json
        ↓
趋势对比（本周 vs 上周 vs 4周前基线）
        ↓
异常触发告警 / 降级 / Meta-Loop 归因
```

```typescript
// 每日聚合脚本（cron 每天 23:55 跑）
function aggregateDay(loopName: string, date: string): DayMetrics {
  const entries = readRunLog(`${loopName}-run-log.jsonl`)
    .filter(e => e.run_id.startsWith(date));

  const total = entries.length;
  const withItems = entries.filter(e => e.items_found > 0).length;
  const fixRuns = entries.filter(e => e.actions_taken > 0);
  const firstTry = fixRuns.filter(e => e.attempt === 1 && e.outcome === "merged");
  const escalated = entries.filter(e => e.escalations > 0);
  const tokens = entries.reduce((s, e) => s + e.tokens_estimate, 0);

  return {
    date,
    loop: loopName,
    runs: total,
    actionable_rate: total > 0 ? withItems / total : 0,
    first_fix_success_rate: fixRuns.length > 0 ? firstTry.length / fixRuns.length : null,
    escalate_rate: total > 0 ? escalated.length / total : 0,
    avg_tokens_per_run: total > 0 ? tokens / total : 0,
    avg_attempt: fixRuns.length > 0
      ? fixRuns.reduce((s, e) => s + e.attempt, 0) / fixRuns.length : null,
    daily_token_total: tokens,
  };
}
```

### 3.3 趋势告警阈值

Metrics 的价值不在「看数字」，在**触发动作**（韧性篇原则：阈值联动 loop 行为）：

| 指标 | 阈值 | 自动动作 |
|------|------|----------|
| `revert_rate` | >10% | loop L3→L2 |
| `first_fix_success_rate` | <50%（连续 3 天） | 触发 Meta-Loop 归因 |
| `escalate_rate` | <10% | 调查护栏是否失效 |
| `avg_attempt` | >2.5 | 调查诊断 skill |
| `daily_token_total` | >day 预算 80% | 全 loop 降级 L1 |
| `verifier_pass_rate` | >95% | 怀疑 Verifier Theater |

> **单指标看噪音，多指标同向才是信号。** revert 升 + attempt 升 + token 升 = 系统性退化（韧性篇漂移检测原则）。

---

## 四、Logging：JSONL Run-Log + Session JSONL

Logging 有两层，各有用途。

### 4.1 第一层：Loop Run-Log（runner 写，JSONL append-only）

这是 Cobus 的核心设计——loop runner 每次运行后 append 一个 JSON 条目。**不是 pi 自带的，是 runner 自己写的。**

```jsonl
{"run_id":"2026-06-14T09:15:00Z","traceId":"cs-2026-06-14T09-15-00-a1b2c3","sessionId":"3f8e...","pattern":"ci-sweeper","trigger":"ci-failed:job-8821","duration_s":412,"states_visited":["TRIAGE","INVESTIGATE","FIX","VERIFY","REVIEW","GATE","MERGE","CLEANUP"],"items_found":1,"actions_taken":1,"escalations":0,"attempt":1,"outcome":"merged","tokens_estimate":187000,"merged_sha":"a1b2c3d","revert_cmd":"git revert a1b2c3d --no-edit"}
{"run_id":"2026-06-14T09:30:00Z","traceId":"cs-2026-06-14T09-30-00-d4e5f6","sessionId":"4a9f...","pattern":"ci-sweeper","trigger":"ci-failed:job-8822","duration_s":38,"states_visited":["TRIAGE"],"items_found":0,"actions_taken":0,"escalations":0,"attempt":0,"outcome":"exit-empty","tokens_estimate":4200,"notes":"empty watchlist, early exit"}
{"run_id":"2026-06-14T10:15:00Z","traceId":"cs-2026-06-14T10-15-00-g7h8i9","sessionId":"5b1a...","pattern":"ci-sweeper","trigger":"ci-failed:job-8835","duration_s":605,"states_visited":["TRIAGE","INVESTIGATE","FIX","VERIFY","FIX","VERIFY","REVIEW"],"items_found":1,"actions_taken":0,"escalations":1,"attempt":2,"outcome":"escalated","tokens_estimate":312000,"notes":"attempt 2 verifier still failing on src/auth/oauth.ts, escalated"}
```

**字段设计原则**：
- **每行自包含**：一条 JSON 就是一次 run 的完整摘要，不依赖上下文
- **机器可查**：`jq` / `grep` 直接用——`jq 'select(.outcome=="escalated")'`
- **人类可读**：`notes` 字段用自然语言总结关键信息
- **append-only**：只追加不改不删，历史完整可审计
- **定期归档**：长尾迁到按月文件（`run-log-2026-06.jsonl`），主文件不膨胀

### 4.2 Run-Log 的最小字段集

Cobus 的 operating-loops.md 给了最小格式：

```json
{
  "run_id": "2026-06-09T08:15:00Z",
  "pattern": "daily-triage",
  "duration_s": 45,
  "items_found": 4,
  "actions_taken": 1,
  "escalations": 0,
  "tokens_estimate": 52000,
  "outcome": "success"
}
```

扩展后加上 loop 工程必需的字段：

```json
{
  "run_id": "2026-06-14T09:15:00Z",
  "traceId": "cs-2026-06-14T09-15-00-a1b2c3",
  "sessionId": "3f8e2a1b-...",
  "pattern": "ci-sweeper",
  "trigger": "ci-failed:job-8821",
  "duration_s": 412,
  "states_visited": ["TRIAGE","INVESTIGATE","FIX","VERIFY","REVIEW","GATE","MERGE","CLEANUP"],
  "items_found": 1,
  "actions_taken": 1,
  "escalations": 0,
  "attempt": 1,
  "outcome": "merged",
  "tokens_estimate": 187000,
  "token_breakdown": { "input": 145000, "output": 32000, "cache": 10000 },
  "merged_sha": "a1b2c3d",
  "revert_cmd": "git revert a1b2c3d --no-edit",
  "notes": "OAuth callback 500, root cause: expired token. Fixed token refresh logic in src/auth/oauth.ts."
}
```

> `states_visited` 是新增的关键字段——它记录了**状态机走过了哪些状态**。如果一次 run `outcome: escalated`，但 `states_visited` 里 FIX 出现了两次，立刻知道「attempt=2 仍未通过 verify」。

### 4.3 第二层：pi Session JSONL（pi 自动写）

pi 自己把每次 session 存成 JSONL：

```
~/.pi/agent/sessions/--Users-jiaxia-development-myproject-/2026-06-14T09-15-00_3f8e2a1b.jsonl
```

文件内容（每行一个事件）：

```jsonl
{"type":"session","version":3,"id":"3f8e2a1b-...","timestamp":"2026-06-14T09:15:00Z","cwd":"/Users/..."}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":[{"type":"text","text":"执行 /skill:ci-sweeper..."}]}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"开始 triage..."}]}}
{"type":"turn_end","message":{...},"toolResults":[...]}
{"type":"turn_start"}
{"type":"message_start","message":{"role":"assistant","content":[{"type":"toolCall","name":"read","arguments":{"path":"STATE.md"}}]}}
{"type":"message_end","message":{...}}
{"type":"turn_end","message":{...},"toolResults":[{"name":"read","result":"..."}]}
...
{"type":"agent_end","messages":[...]}
```

**关键**：session JSONL 是**最细粒度**的日志——每个 tool call、每次 LLM 推理都在。run-log 是摘要，session JSONL 是证据。

### 4.4 两层的关系

| 层 | 写者 | 粒度 | 查什么 |
|----|------|------|--------|
| **Run-Log** | runner | 每次 run 一行 | 「这次 run 结果如何？趋势怎样？」 |
| **Session JSONL** | pi | 每 turn 多行 | 「这次 run 里某一步，模型到底怎么想的？」 |

**调查路径**：先 grep run-log 找到 `traceId` / `sessionId` → 再去 `~/.pi/agent/sessions/` 查对应 session JSONL → 逐 turn 还原推理链。

### 4.5 STATE.md 的人类可读补充

Cobus 推荐在 STATE.md footer 也留一行人类可读的 run 摘要：

```markdown
---
Run: 2026-06-14 09:15 | traceId: cs-...a1b2c3 | 1 finding | 1 merged | 0 escalate | ~187k tokens
```

这是给人**不打开 JSONL 就能扫一眼**用的。run-log 是给机器查的，STATE footer 是给人扫的。

---

## 五、Token 提取：从哪里拿到准确数字

run-log 里的 `tokens_estimate` 要尽量准。三个来源，精度递降：

### 5.1 pi SDK 事件流（最准）

SDK 的 `session.subscribe()` 可以拿到 `agent_end` 事件，其中含 usage。实际从 `session.agent.state` 或 turn_end 事件的 usage 字段提取：

```typescript
session.subscribe((event) => {
  if (event.type === "turn_end") {
    // turn_end 含本 turn 的 message + toolResults
    // usage 在 message 的 metadata 里（取决于 provider）
  }
  if (event.type === "agent_end") {
    // agent_end 含本次 prompt 的全部 messages
    // 累计 token 从 messages 的 usage metadata 提取
  }
});
```

### 5.2 Session JSONL（事后查）

session 文件是 JSONL，可以用命令行提取 usage：

```bash
# 提取某次 session 的 token 使用
SESSION="~/.pi/agent/sessions/.../2026-06-14T09-15-00_3f8e2a1b.jsonl"
cat "$SESSION" | grep '"usage"' | jq -s '
  {
    input: (map(.usage.input_tokens // 0) | add),
    output: (map(.usage.output_tokens // 0) | add),
    cache: (map(.usage.cache_read_input_tokens // 0) | add),
    turns: length
  }
'
```

### 5.3 Subagent Artifacts（子 agent 场景）

如果 loop 用了 subagent（pi-subagents），每个子 agent 跑完会在 `subagent-artifacts/` 下产生 `*_meta.json`：

```bash
for f in subagent-artifacts/*_meta.json; do
  python3 -c "
import json; d=json.load(open('$f'))
print(f'{d[\"runId\"][:8]}_{d[\"agent\"]:20s} in={d[\"inputTokens\"]:6d} out={d[\"outputTokens\"]:5d} cache={d.get(\"cacheTokens\",0):5d}')
"
done
```

一键汇总所有子 agent 的 token 消耗。这在多 agent 编排（Sub-agent 篇）的成本核算里极有用。

> **缓存偏差提醒**：同一 session 连续调用后续会命中前缀缓存 → input_tokens 偏低。A/B 对比时要**每案例独立会话 + 双轮交替**抹平缓存偏差。

---

## 六、「昨天 10:15 那次 run 为什么那么干」—— 完整调查路径

这是整篇最实际的章节。把上面所有东西串成一条**从告警到根因**的调查链。

### 6.1 场景

同事问：「昨天 CI Sweeper 合并了一个 PR #145，改了 src/api/handlers.ts，但我觉得改得不对——它把错误处理删了。为什么那么干？」

### 6.2 调查七步

**Step 1：从 PR 反查 traceId**

```bash
# CI Sweeper 的通知里应附 traceId，但同事可能没记
# 从 run-log 查昨天合并 #145 的记录
grep "145" ci-sweeper-run-log.jsonl | jq 'select(.outcome=="merged")'
```

```json
{
  "run_id": "2026-06-13T10:15:00Z",
  "traceId": "cs-2026-06-13T10-15-00-x7y8z9",
  "sessionId": "5b1a3c2d-...",
  "pattern": "ci-sweeper",
  "outcome": "merged",
  "merged_sha": "e4f5g6h",
  "attempt": 1,
  "states_visited": ["TRIAGE","INVESTIGATE","FIX","VERIFY","REVIEW","GATE","MERGE"],
  "notes": "CI failed: unhandled promise rejection in handler. Fixed by removing error handler that was swallowing errors."
}
```

看到了：`notes` 说「移除了吞错误的 error handler」。这是 loop 的理解——但同事觉得不对。

**Step 2：查 session JSONL 还原推理链**

```bash
# 找到 pi session 文件
SESSION=$(find ~/.pi/agent/sessions/ -name "*5b1a3c2d*" | head -1)
wc -l "$SESSION"   # 看有多少行（多少事件）
```

**Step 3：逐 turn 看 FIX 阶段**

```bash
# 提取所有 assistant 消息（模型的推理和决策）
cat "$SESSION" | jq -c 'select(.type=="message_end" and .message.role=="assistant") | .message.content[] | select(.type=="text") | .text'
```

看到模型在 FIX 阶段的推理：
```
"CI 日志显示 unhandled promise rejection。定位到 src/api/handlers.ts:42 的 try-catch。
这个 catch 块吞掉了错误（catch 了但不 rethrow）。
最小修复：移除这个 try-catch，让错误自然抛出。"
```

**Step 4：看 VERIFY 阶段 verifier 怎么说的**

```bash
# verifier 是另一个 session（maker/checker 分离），找 verifier 的 session
grep "5b1a3c2d" ci-sweeper-run-log.jsonl | jq '.sessionId'
# 或从 subagent-artifacts 找 verifier 记录
cat subagent-artifacts/*verifier*_meta.json | jq '.task'
```

verifier 说：「测试全绿。移除吞错误的 catch 确实让错误暴露了。」

**Step 5：看 REVIEW 阶段 reviewer 怎么判断的**

```bash
# reviewer 的输出
cat "$SESSION" | jq -c 'select(.type=="turn_end") | .message.content[] | select(.type=="text" and (.text | test("REVIEW"))) | .text'
```

reviewer 说：「改动在 src/api/ 内，<20 行，denylist 未触碰。治根因（不是治症状）。REVIEW_APPROVE。」

**Step 6：发现问题——诊断对但修复方向可商榷**

还原完整推理链后，发现：
- ✅ 诊断正确：try-catch 吞了错误
- ⚠️ 修复有争议：移除 try-catch → 错误暴露了，但可能导致 500 返给用户
- ✅ 测试通过：但测试没覆盖「错误暴露后的用户侧行为」
- ✅ reviewer 批准：因为从「最小改动 + 治根因」标准看确实合规

**根因**：loop 的 skill 没有约定「错误处理改动需考虑用户侧影响」。

**Step 7：把结论记进 memory + 提议改 skill**

```typescript
// 记调查结论到 memory（下次类似情况能查到）
await memory("insight", "CI Sweeper 移除 src/api/handlers.ts 吞错误的 catch（PR #145）。诊断正确但修复方向有争议：移除后错误暴露但可能 500 返用户。根因：skill 没约定错误处理改动需考虑用户侧影响。调查: traceId cs-...x7y8z9");
```

提议改 skill（走 Meta-Loop 的 Skill Evolution 闭环——Meta-Loop 篇第五节）：

```markdown
## 建议（进 Review Queue）
在 ci-sweeper SKILL.md 补一条：
"## 错误处理改动特殊约定
涉及 try-catch / error handler 的移除或修改时：
- 必须检查错误暴露后的用户侧行为（不只是测试通过）
- 如果错误会直接返给用户 → 标 [建议-需人工确认]，不自动合并
来源: PR #145 调查, traceId cs-...x7y8z9"
```

### 6.3 调查路径总结

```
同事报告「PR #145 改得不对」
    │
    ▼ Step 1: grep run-log → 找到 traceId + sessionId + notes
    │
    ▼ Step 2: find session JSONL → 定位 pi session 文件
    │
    ▼ Step 3: jq 逐 turn → 还原 FIX 阶段推理（模型怎么想的）
    │
    ▼ Step 4: 查 verifier session → 验证链怎么判的
    │
    ▼ Step 5: 查 reviewer 输出 → review 怎么批准的
    │
    ▼ Step 6: 综合判断 → 根因（skill 缺约定）
    │
    ▼ Step 7: memory 记结论 + 提议改 skill（Meta-Loop 闭环）
```

**这条路径的前提**是三支柱齐全：traceId 把 PR 和 session 串起来（Tracing），run-log 给出摘要和 sessionId（Logging），metrics 告诉你这只是偶发还是趋势（Metrics）。缺任何一环，调查就断。

---

## 七、Dashboard：周报/月报模板

Meta-Loop（第八篇）的观测职责，产出物就是定期报告。这里给出模板。

### 7.1 周报模板

```markdown
## Loop System Weekly Report — 2026-W24

### 运行概况
| Loop | Runs | Actionable | Merged | Escalated | Tokens | Reverted |
|------|------|-----------|--------|-----------|--------|----------|
| ci-sweeper | 96 | 12 | 8 | 4 | 4.2M | 1 |
| pr-babysitter | 288 | 34 | 0 | 6 | 6.6M | — |
| daily-triage | 7 | 7 | 0 | 2 | 0.36M | — |
| dep-sweeper | 4 | 2 | 1 | 1 | 1.25M | 0 |

### 趋势（本周 vs 上周）
| 指标 | 上周 | 本周 | 变化 |
|------|------|------|------|
| ci-sweeper first_fix_success | 75% | 62% | ⬇ -13pp |
| ci-sweeper avg_attempt | 1.3 | 1.7 | ⬆ +0.4 |
| pr-babysitter escalate_rate | 18% | 6% | ⬇ -12pp ⚠️ |
| daily token total | 10.8M | 12.4M | ⬆ +15% |

### 异常标记
- ⚠️ ci-sweeper first_fix_success 连续两周下降（75→62%），建议 Meta-Loop 归因
- ⚠️ pr-babysitter escalate_rate 从 18% 降到 6%，可能 Verifier Theater（护栏失效）
- ⚠️ 日均 token 增 15%，接近周预算上限

### 本周 revert
- ci-sweeper PR #145 (sha: e4f5g6h): 移除 error handler 后用户侧 500，已 revert。根因: skill 缺错误处理约定。已提议 skill 改动（Review Queue #42）。
```

### 7.2 月报模板

月报增加**趋势图**（文本形态）和**自治级别评估**：

```markdown
## Loop System Monthly Report — 2026-06

### ci-sweeper first_fix_success_rate（4 周趋势）
W21: 78%  W22: 75%  W23: 71%  W24: 62%  ⬇ 持续下降
→ 建议: 调查 src/auth/ 相关修复（该模块成功率仅 40%）

### ci-sweeper escalate_rate（4 周趋势）
W21: 25%  W22: 22%  W23: 28%  W24: 33%  ⬆ 正常波动

### 自治级别评估
| Loop | 当前 | 建议 | 理由 |
|------|------|------|------|
| ci-sweeper | L3 | L2 ⬇ | first_fix 连续降 + 1 revert |
| pr-babysitter | L2 | L2 | 稳定但 escalate_rate 需调查 |
| daily-triage | L1 | L1 | 稳定 |
| dep-sweeper | L2 | L2 | 稳定 |
```

> 月报的**自治级别重新评估**是反衰减篇机制 3（Review Gate）的落地——定期决定 loop 留在当前级别还是降级。

---

## 八、pi 实践

把三支柱落到 pi 的具体能力上。

### 8.1 Run-Log 不是 pi 自带的

**重要认知**：pi 没有内置的「loop run-log」机制。run-log 是**你的 runner 脚本**写的。pi 只提供 session JSONL（自动）和事件流（SDK），run-log 是你在 runner 里自己 append 的。

```typescript
// runner 每次跑完 append run-log
function appendRunLog(file: string, entry: RunLogEntry) {
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(file, line, { flag: "a" });
}

// 跑完后调用
const entry: RunLogEntry = {
  run_id: startTime.toISOString(),
  traceId,
  sessionId: session.sessionId,
  pattern: "ci-sweeper",
  // ...
};
appendRunLog("ci-sweeper-run-log.jsonl", entry);
```

### 8.2 Session JSONL 复盘

pi 的 session JSONL 是事后调查的**金矿**。几个常用 jq 查询：

```bash
SESSION="~/.pi/agent/sessions/.../2026-06-14T09-15-00_3f8e2a1b.jsonl"

# 总 turn 数
cat "$SESSION" | jq -c 'select(.type=="turn_end")' | wc -l

# 所有 tool 调用
cat "$SESSION" | jq -c '
  select(.type=="message_end") | .message.content[]
  | select(.type=="toolCall") | {name, args: .arguments}' 2>/dev/null

# 所有 assistant 文本（推理链）
cat "$SESSION" | jq -r '
  select(.type=="message_end" and .message.role=="assistant")
  | .message.content[] | select(.type=="text") | .text' 2>/dev/null

# thinking 内容（如果开了 thinking）
cat "$SESSION" | jq -r '
  select(.type=="message_end" and .message.role=="assistant")
  | .message.content[] | select(.type=="thinking") | .thinking' 2>/dev/null

# token 使用
cat "$SESSION" | grep '"usage"' | jq '.usage' 2>/dev/null
```

### 8.3 Memory 工具记录调查

调查完一次异常，结论用 memory 工具存下来（Memory 篇第四层语义记忆）：

```
值得存的（写 memory）:
- "ci-sweeper PR #145 调查: 移除 error handler 导致用户 500。根因 skill 缺错误处理约定。traceId cs-...x7y8z9" (调查结论)
- "src/api/handlers.ts 的错误处理改动需人工确认" (项目特定约定)
- "verifier 对用户侧行为覆盖不足，考虑加 integration test 到 acceptance" (改进建议)

下次类似问题出现 → memory_search → 直接复用调查经验
```

### 8.4 Meta-Loop 消费 run-log

Meta-Loop（第八篇）是观测的自动化执行体。它消费所有 loop 的 run-log：

```typescript
// Meta-Loop 的 Collector 读所有 run-log
const allLogs = ["ci-sweeper","pr-babysitter","daily-triage","dep-sweeper"]
  .flatMap(name => readRunLog(`${name}-run-log.jsonl`));

await session.prompt(`你是 Meta-Loop Analyzer。读下面所有 loop 的 run-log,
  发现系统性问题（反复失败、漂移、预算异常）。归因到根因。
  --- run-logs ---\n${JSON.stringify(allLogs.slice(-50))}`);  // 最近 50 条
```

三支柱的数据流闭环：

```
Loop run → run-log（Logging）
              ↓ 聚合
         metrics（Metrics）
              ↓ 异常
         Meta-Loop 归因
              ↓ 需深查
         traceId → session JSONL（Tracing → 证据）
              ↓ 结论
         memory（沉淀调查经验）
```

---

## 九、可观测性特有的失败模式

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **告警盲化** | S1→S2 | 告警太多，团队全部静音 | 只对 actionable findings 告警（反衰减篇通知分级）；静默 TRIAGE empty |
| **Trace 断裂** | S2 | sessionId 没记进 run-log，查不到 pi session | run-log 必含 sessionId + traceId（三 ID 映射） |
| **指标过载** | S1 | 20 个指标，没人看 | 核心指标 ≤12 个，分五组，Dashboard 优先看趋势不看绝对值 |
| **日志脱漏** | S2 | exit-empty 的 run 没写 run-log | 每次 run 必 append（含 empty exit），否则 metrics 分母错误 |
| **Token 估算偏差** | S1 | tokens_estimate 全靠猜，预算管理失效 | 用 SDK 事件流 / session JSONL 取真实 usage（第五节） |
| **缓存偏差** | S1 | 同 session 连续调用命中缓存，token 偏低 | 每案例独立会话 + 双轮交替（成本对比时） |
| **Session 清理丢失** | S2 | pi 清了旧 session，历史调查断档 | session JSONL 定期备份到 run-log 关联存储 |
| **notes 太虚** | S1 | notes 写「修复了问题」，无细节 | notes 必含根因 + 改了什么文件 + 为什么这么改 |
| **run-log 膨胀** | S1 | append-only 不清理，文件巨大 | 按月归档（run-log-YYYY-MM.jsonl），主文件只留近期 |

### 最危险的两个

**Trace 断裂**：如果 run-log 里没有 `sessionId`，你查到了「昨天 10:15 那次 run escalated」，但**无法深入到 pi session 看推理链**。调查到此为止，只能猜。**sessionId 是 run-log 的必填字段，不是可选。**

**日志脱漏**：Cobus 的反模式 #10「No run log」——如果 TRIAGE empty（无可操作项）就不写 run-log，metrics 的 `actionable_rate` 分母就会错（只统计了有 items 的 run，看起来总很忙，实际大量空跑）。**每次 run 必 append，包括 empty exit。**

---

## 十、回顾

1. **Loop 需要专属可观测性**：传统 APM 看流量延迟，Loop 看决策质量与趋势。没有现成产品，自己搭。
2. **三支柱**：Tracing（traceId 贯穿）、Metrics（决策质量趋势）、Logging（run-log + session JSONL）。
3. **三 ID 映射是 Tracing 的核心**：traceId（人查入口）→ runId（run-log 主键）→ sessionId（pi session 文件）。三者必须在 runner 层建立映射。
4. **Metrics 五组十二项**：运行量、决策质量、效率、验证链、成本。单指标看噪音，多指标同向才是信号。
5. **Logging 两层**：run-log（runner 写的 JSONL 摘要）+ session JSONL（pi 写的逐 turn 证据）。run-log 是索引，session JSONL 是证据。
6. **Token 提取三源**：SDK 事件流（最准）→ session JSONL grep usage（事后查）→ subagent meta.json（子 agent 场景）。
7. **调查七步**：grep run-log → 找 sessionId → jq 逐 turn → 看 verifier → 看 reviewer → 综合判断 → memory 记结论。
8. **run-log 不是 pi 自带的**：是你的 runner 写的。pi 只提供 session JSONL 和事件流。
9. **Meta-Loop 是观测的自动化执行体**：消费 run-log 聚合 metrics，发现异常归因，需深查时用 traceId 回溯 session。
10. **两个最危险失败**：Trace 断裂（没 sessionId 无法深入）+ 日志脱漏（empty exit 不写导致 metrics 错）。

一句话收尾：**Loop 可观测性的终极目标，是让每一次「为什么那么干」都能在 5 分钟内查到答案——从 Slack 通知里的 traceId，一路追到模型某一步的推理文本。做到这一点，loop 就不再是黑盒。**

---

## 参考资料

- [系列八：Meta-Loop 自我演进](./loop-engineering-meta-loop)（消费 run-log 汇总观测）
- [系列九：韧性与评估](./loop-engineering-resilience-eval)（run-log/metrics/通知分级的原始引入）
- [系列七：反衰减](./loop-engineering-antidegradation)（Behavior Drift 的指标检测）
- [系列四：Memory 系统](./loop-engineering-memory)（memory 记调查结论）
- [Cobus Greyling — Operating Loops（logging/metrics/when to kill）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [Cobus Greyling — Loop Run Log Example](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/loop-run-log-example.md)
- [Cobus Greyling — Loop Design Checklist §9 Observability](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- Google SRE — 可观测性三支柱（Tracing / Metrics / Logging）概念框架
- pi 能力：session JSONL（`~/.pi/agent/sessions/`）· SDK 事件流（`agent_end`/`turn_end`）· `subagent-artifacts/*_meta.json` · memory 工具

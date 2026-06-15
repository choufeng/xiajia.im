# 可观测性与可调试性：Harness 的仪表盘

> Harness Engineering 系列第九篇（共 10 篇）。前一篇：[8. 沙箱、权限与安全模型](./harness-engineering-security)——安全模型让 agent「闯不了大祸」，本篇接着讲守护面的另一半：怎么**看见**它干了什么。安全是刹车，可观测是仪表盘。
>
> 与 [Loop Engineering 第 22 篇（可观测性深度）](./loop-engineering-observability) 互补：那篇讲 **loop 运维层**——traceId 跨 webhook→runner→session 贯穿、runner 自己写 run-log、Meta-Loop 聚合趋势；本篇讲 **harness 内建层**——turn 级 trace、token usage 挂载、session replay、子代理汇总。前者是「车队长怎么调度」，后者是「每辆车的仪表盘长什么样」。

---

## 目录

1. [引言：黑盒 agent 不可运维](#引言黑盒-agent-不可运维)
2. [9.1 三支柱：tracing / metrics / logging](#91-三支柱tracing--metrics--logging)
3. [9.2 turn 是最小 trace 粒度](#92-turn-是最小-trace-粒度)
4. [9.3 token 计量：成本的承重数据](#93-token-计量成本的承重数据)
5. [9.4 session replay：事后审计](#94-session-replay事后审计)
6. [9.5 子代理的可观测：把黑盒汇总](#95-子代理的可观测把黑盒汇总)
7. [9.6 debug loop：从异常到根因](#96-debug-loop从异常到根因)
8. [9.7 pi 的 instrumentation](#97-pi-的-instrumentation)
9. [9.8 反模式](#98-反模式)
10. [迁移清单](#迁移清单)
11. [下一步](#下一步)

---

## 引言：黑盒 agent 不可运维

裸 LLM 只输出 token，你能看见输入和输出。套上 harness、接上工具、跑上几十个 turn 之后，中间全黑：哪轮调了 `bash` 跑了什么、为什么改了那个文件、为什么花了那么多 token、子代理到底干了啥——一概不知。

黑盒的代价很具体：

- 「上次跑挂了」——哪轮、哪个工具、为啥挂，全靠猜；
- 「这次比上次贵了三倍」——贵在哪、哪个 turn、哪个子代理，查不到；
- 「它改对了吗」——没有推理链，只能盲信结果；
- 「子代理派出去的活」——返回了，但过程是黑盒，出事无法回溯。

不可观测的 agent 不可运维，更不可信任。传统 APM 为请求-响应设计，套不到「一次会话、一次 turn、一次工具调用」这种长生命周期粒度上。harness 必须自己长出仪表盘。

> **核心论点**：可观测性是 harness 的内建责任，不是外挂可选。三支柱（tracing/metrics/logging）必须在 harness 层落地到 turn 粒度；token 必须计量；session 必须可重放；子代理必须可汇总。否则 agent 永远是黑盒。

---

## 9.1 三支柱：tracing / metrics / logging

经典可观测性三支柱（Google SRE 框架），落到 harness 层重新定义：

| 支柱 | 传统定义 | Harness 定义 | 核心问题 | 粒度 |
|------|----------|-------------|----------|------|
| **Tracing** | 请求跨服务的链路 | 一次 turn 内「模型推理 → 工具批 → 工具结果」的调用树 | 「这一轮到底调了什么、耗时多少、卡在哪」 | turn |
| **Metrics** | QPS / 延迟 / 错误率 | token 消耗、成本、成功率、turn 数、工具失败率 | 「这个 session/日/模型花了多少、成不成」 | turn → session → 日聚合 |
| **Logging** | 结构化日志 | 完整对话流 + 工具入参与结果（不可变落盘） | 「事后能一字不漏还原整场会话」 | 每个事件 |

三者关系：

```
           Metrics 回答「趋势与成本对不对」
                  ↓ 异常时
           Tracing 定位「哪轮 turn 出问题」
                  ↓ 锁定 turn
           Logging 还原「那轮里模型怎么想、工具返了啥」

   Tracing 是索引，Logging 是证据，Metrics 是趋势。
   没有 Logging，Tracing 只是空骨架；没有 Metrics，异常藏在噪音里。
```

**与 loop 层的分工**（[Loop 第 22 篇](./loop-engineering-observability)）：loop 层的 tracing 关注 `traceId` 跨进程贯穿（webhook→runner→pi session→run-log），粒度是「一次 run」；harness 层的 tracing 关注**一次 run 内部的 turn 调用树**，粒度是「一个 turn」。前者管跨边界串联，后者管边界内解剖。

---

## 9.2 turn 是最小 trace 粒度

**定义**：turn 是 agent 一次「模型推理 + 执行一批工具」的完整单元。harness 的 trace 树以 turn 为最小节点。

**为何**：session 太粗（一次会话几十 turn，看不清哪轮出问题），单条消息太细（一条 assistant 消息只是推理，不含执行）。turn 天然是一个「输入 → 思考 → 行动 → 结果」的闭环——它就是 agent 的最小可调试单元。把 trace 钉在 turn 上，既能看清每轮干了啥，又不至于碎成 token 流。

**怎么做（pi）**：harness 用 `turn_start` / `turn_end` 一对事件包裹每个 turn。一个 turn 的 trace 树长这样：

```
turn_start  ─────────────────────────────  ← trace 根节点
  │
  ├─ 模型推理（assistant 消息）
  │    └─ 决定调用 3 个工具（并发）
  │
  ├─ toolCall: read   ─→ 结果: 文件内容     ← span
  ├─ toolCall: grep   ─→ 结果: 12 行匹配   ← span
  ├─ toolCall: bash   ─→ 结果: 测试通过     ← span
  │
  └─ turn_end  ───────────────────────────  ← 汇总本 turn：usage + toolResults
```

每个 turn 节点挂四类元数据：**耗时**（turn_start 到 turn_end）、**工具清单**（调了什么）、**工具结果**（每个返了啥）、**token usage**（这轮烧了多少）。这四样凑齐，一个 turn 就是可独立审阅的标本。

trace 树的嵌套：一个 session 是一棵 turn 树（线性展开），若 turn 内派了子代理，则该 turn 下挂一棵子 session 树（见 9.5）。

**反模式**：把 trace 粒度定在「整个 session」或「每条消息」。session 粒度看不出哪轮崩；消息粒度看不到工具执行与结果关联。

---

## 9.3 token 计量：成本的承重数据

**定义**：token 计量，指 harness 对每个 turn 的 input / output / cache / total token 做精确记录，并按 turn → run → session 三级汇总，换算成成本。

**为何**：token 是 agent 唯一的「燃料」单位，三条理由让它必须计量：

1. **预算控制**——不知道烧了多少，就没法在烧穿前降级（[Loop 韧性篇](./loop-engineering-resilience-evaled) 的预算闸、[安全篇](./harness-engineering-security) 的付费 API 上限，全依赖准确 token 数）。
2. **调试归因**——「这次为什么这么贵」必须能下钻到「哪个 turn、哪个工具结果把上下文撑大了」。
3. **成本归因**——多 agent / 多任务时，账要算到具体子代理、具体任务，不能糊成一锅。

**怎么做**：每个 turn 的 usage 拆四项，模型 provider 一般直接返回：

```jsonc
// 单 turn usage（挂在 assistant 消息上）
{
  "input_tokens": 14500,              // 本轮喂进去的 prompt
  "output_tokens": 3200,              // 本轮生成的 token
  "cache_read_input_tokens": 9000,    // 命中前缀缓存的部分（便宜）
  "cache_creation_input_tokens": 0,   // 本轮新建缓存（贵）
  "total": 17700                      // input + output（计量基准）
}
```

三级汇总：

| 层级 | 汇总方式 | 回答 |
|------|---------|------|
| **turn** | 单条 assistant 消息的 usage | 「这轮花了多少」 |
| **run / session** | 累加所有 turn 的 usage | 「这场会话花了多少」 |
| **日 / 周** | 聚合所有 session（loop 场景由 runner 写 run-log） | 「今天花了多少、趋势如何」 |

成本换算要**分价计费**——cache_read 便宜、output 贵、input 中等，混算会失真：

```ts
// 伪代码：按价表换算单 turn 成本（美元）
function turnCost(u: Usage): number {
  const PRICE = {
    input:        3.00 / 1_000_000,
    output:      15.00 / 1_000_000,
    cacheRead:    0.30 / 1_000_000,
    cacheCreate:  3.75 / 1_000_000,
  };
  return u.input_tokens * PRICE.input
       + u.output_tokens * PRICE.output
       + u.cache_read_input_tokens * PRICE.cacheRead
       + u.cache_creation_input_tokens * PRICE.cacheCreate;
}
```

> **缓存偏差提醒**：同一 session 连续调用命中前缀缓存 → input 偏低、cache_read 偏高，**总成本**可能不准。A/B 对比、预算测算时，每案例独立会话 + 双轮交替抹平偏差。

**反模式**：只记一个 `total_tokens` 总数，不拆 cache。结果账单上 cache 占了大头还以为很贵，预算决策全错；或反之，缓存失效后成本暴涨却查不到归因。

---

## 9.4 session replay：事后审计

**定义**：session replay，指从落盘的完整事件流（JSONL）重放整场会话，逐 turn 复现模型推理与工具结果，用于事后审计与 debug。

**为何**：agent 出问题时往往**已经跑完**——现场没盯、报错已过、状态已变。若没有可重放的完整记录，「上次为什么那么干」只能凭印象猜。replay 把会话变成可反复审视的标本：同一条 trace，今天 debug、明天审计、后天回归测试集。

**怎么做**：核心是 harness 把每个事件**不可变地 append 到 session 文件**，重放即按时间序重读事件流、重建状态：

```
session.jsonl（append-only，每个事件一行）
   │
   ▼  replay 工具按行重放
   ├─ 重建 turn 树（turn_start / turn_end 配对）
   ├─ 还原每轮 assistant 推理 + 工具结果
   ├─ 累加 token usage
   └─ 定位异常 turn / 异常工具结果
```

replay 的两种用途：

| 用途 | 场景 | 关注点 |
|------|------|--------|
| **事后 debug** | 「这次跑挂了，哪轮出的错」 | 逐 turn 看推理链 + 工具结果，定位根因 |
| **审计 / 复盘** | 「它为什么改了那个文件 / 合了那个 PR」 | 还原决策推理链，判断决策质量 |
| **回归集** | 把异常 session 固化成测试用例 | 重放验证修复后不再复现 |

replay 与 trace 的关系：trace 是「索引」（哪轮有异常），replay 是「全文」（那轮到底发生了什么）。先看 trace 定位，再 replay 还原。

**反模式**：只存最终输出不存中间过程。一旦结果有问题，连「模型当时看到什么」都还原不了——replay 失效，debug 退回盲猜。

---

## 9.5 子代理的可观测：把黑盒汇总

**定义**：子代理（[第 5 篇](./harness-engineering-subagents)）是 harness 派出去的独立 session，每个都有自己的 turn 树和 token 账。可观测要求把它们**汇总回父**，而不是任其黑盒。

**为何**：子代理最容易成黑盒——父只看到「返回了结果」，不知道子代理烧了多少 token、跑了几个 turn、acceptance 契约（[5.3 节](./harness-engineering-subagents)）是否真的通过。一场会话派了五个子代理，账单翻五倍却查不到谁烧的；或某个子代理没满足 acceptance 却自报完成，污染父决策。不汇总，子代理就是一组共谋的黑盒。

**怎么做**：每个子代理作为独立 session 落盘，跑完产出 meta 汇总文件，父（或控制平面）聚合：

```
父 session
  ├─ turn: 派出 3 个 async 子代理
  │    ├─ child-A session.jsonl  ─→ meta: {tokens, turns, acceptance: pass}
  │    ├─ child-B session.jsonl  ─→ meta: {tokens, turns, acceptance: pass}
  │    └─ child-C session.jsonl  ─→ meta: {tokens, turns, acceptance: FAIL}
  │
  └─ 父汇总: 子代理 token 总账 + 失败的 child-C 需处理
```

每条子代理汇总至少含四类信息：

| 字段 | 含义 | 用途 |
|------|------|------|
| **token 账** | input/output/cache/total | 成本归因到具体子代理 |
| **turn 数 / 耗时** | 子代理跑了几轮、多久 | 效率与是否空转 |
| **acceptance 结果** | pass / fail + criteria 命中情况 | 判定是否真完成（防自报完成） |
| **promise 状态** | resolved / rejected / 仍在跑 | async 子代理的收尸依据（防孤儿进程） |

控制平面的 `status` 原语（[第 5 篇](./harness-engineering-subagents)）就是为这而生——查 `{ phase, turns, tokens, cost, tasks }`，让派活变成可观测、可干预的过程。

**反模式**：子代理 fire-and-forget——派出去不看 token、不验 acceptance、不追踪 promise。结果孤儿进程无人收尸、成本失控、acceptance 成摆设。

---

## 9.6 debug loop：从异常到根因

可观测性最终服务 debug。一条从「发现异常」到「定位根因」的标准调查路径：

```
发现异常（测试红 / 成本暴涨 / 结果不对 / 子代理挂）
    │
    ▼ 1. 看 metrics 定位是哪场 session / 哪类问题
    │
    ▼ 2. 看 trace 定位是哪个 turn（turn 树找异常节点）
    │
    ▼ 3. replay 那个 turn：看模型推理（怎么想的）
    │
    ▼ 4. 看该 turn 的工具结果（工具返了啥、是否报错）
    │
    ▼ 5. 综合判断根因：
    │      ├─ 推理错？→ 上下文/skill 问题
    │      ├─ 工具错？→ 工具实现 / 权限 / 外部服务问题
    │      └─ 数据错？→ 喂进去的文件 / 命令输出有问题
    │
    ▼ 6. 沉淀：memory 记结论 / 改 skill / 固化成回归用例
```

每一步依赖一种支柱：metrics 选方向（tracing 索引），trace 选节点，replay 看证据（logging）。三支柱缺一环，调查就断。

**典型根因映射**：

| 症状 | 大概率根因 | 看哪 |
|------|-----------|------|
| 测试在 turn 5 转红 | 某工具改错文件 / 跑错命令 | turn 5 工具结果 |
| 成本突然翻倍 | 上下文爆炸 / 子代理空转 | 该 session 的 usage 曲线 + 子代理 token |
| 结果对但改过头 | acceptance 缺失 / 推理发散 | 子代理 turn 数 + acceptance 字段 |
| 反复修同一个错 | verifier 太松 / 诊断错 | 状态机 FIX→VERIFY 循环次数 |

debug loop 的产出不止「修这次」，更是**沉淀**——异常 session 固化成回归用例、结论写进 memory、缺的约束补进 skill。

---

## 9.7 pi 的 instrumentation

把抽象落回 pi，它的 instrumentation 几个要点。

**1. session JSONL 自动落盘**。pi 把每个 session 存成 JSONL，路径形如：

```
~/.pi/agent/sessions/<cwd-slug>/<timestamp>_<uuid>.jsonl
```

每行一个事件，append-only、不可变。这是 replay 与事后调查的**原始证据**。

**2. turn_start / turn_end 包裹每个 turn**。事件流里 turn 是显式边界：

```jsonl
{"type":"turn_start"}
{"type":"message_start","message":{"role":"user","content":[{"type":"text","text":"修一下测试"}]}}
{"type":"message_end","message":{"role":"assistant","content":[{"type":"text","text":"先看测试文件"},{"type":"toolCall","name":"read","arguments":{"path":"src/auth.test.ts"}}]}}
{"type":"turn_end","message":{...},"toolResults":[{"name":"read","result":"..."}]}
{"type":"turn_start"}
...
{"type":"agent_end"}
```

`turn_end` 挂 `toolResults`——本 turn 所有工具的执行结果。这是 trace 树每个节点的「证据包」。

**3. assistant 消息挂 usage**。token 计量挂在 assistant 消息的 metadata 上（provider 返回什么字段，pi 透传什么）：

```jsonc
// 伪代码：turn_end 携带的 assistant 消息含 usage
{
  "type": "turn_end",
  "message": {
    "role": "assistant",
    "content": [ /* ... */ ],
    "usage": {
      "input_tokens": 14500,
      "output_tokens": 3200,
      "cache_read_input_tokens": 9000
    }
  },
  "toolResults": [ /* ... */ ]
}
```

事后用 jq 提取整场 session 的 token 账：

```sh
SESSION=~/.pi/agent/sessions/<slug>/2026-06-16T10-00-00_<uuid>.jsonl
grep '"usage"' "$SESSION" | jq -s '{
  input: (map(.usage.input_tokens // 0) | add),
  output: (map(.usage.output_tokens // 0) | add),
  cache:  (map(.usage.cache_read_input_tokens // 0) | add),
  turns:  length
}'
```

**4. 子代理 meta 汇总**。子代理跑完在 `subagent-artifacts/` 下产出 `*_meta.json`，含 token 账与验收结果（[第 5 篇](./harness-engineering-subagents)）：

```jsonc
// 伪代码：subagent-artifacts/<runId>_meta.json
{
  "runId": "3f8e2a1b-...",
  "agent": "fixer",
  "inputTokens":  42000,
  "outputTokens":  8500,
  "cacheTokens":  18000,
  "turns": 6,
  "acceptance": { "passed": true, "criteria": [/* ... */] }
}
```

一键汇总所有子代理的 token 总账，做成本归因：

```sh
for f in subagent-artifacts/*_meta.json; do
  jq -r '"\(.agent): in=\(.inputTokens) out=\(.outputTokens) accept=\(.acceptance.passed)"' "$f"
done
```

**5. SDK 事件流（实时观测）**。SDK 的 `session.subscribe()` 拿到实时事件，可挂在自定义仪表盘上：

```ts
// 伪代码：实时观测 token 与 turn
session.subscribe((event) => {
  if (event.type === "turn_end") {
    dashboard.pushTurn({
      tools: event.toolResults.map(r => r.name),
      usage: event.message.usage,
    });
  }
  if (event.type === "agent_end") {
    dashboard.finalize();   // 会话结束，落总账
  }
});
```

**关键认知**：pi 提供的是 **session JSONL + 事件流 + meta 文件**这套**原始 instrumentation**。loop 层的 run-log、metrics 聚合、告警阈值（[Loop 第 22 篇](./loop-engineering-observability)）是**你的 runner 在这之上搭的**。pi 给证据，runner 给摘要与趋势——两者分层，缺一不可。

---

## 9.8 反模式

| 反模式 | 症状 | 根因 | 对策 |
|--------|------|------|------|
| **只记最终输出** | 出问题无法回溯，只能猜 | 不存中间 turn | 每个事件落盘 JSONL，replay 可还原（9.4） |
| **不记工具结果** | trace 树有调用无结果，断在推理与行动之间 | 只存 toolCall 不存 toolResults | turn_end 必挂 toolResults（9.7） |
| **无 token 计量** | 预算失控、成本暴涨查不到归因 | usage 没挂 / 没拆 cache | assistant 消息挂 usage，拆 input/output/cache（9.3） |
| **子代理黑盒** | 派出去不看 token、不验 acceptance、孤儿进程 | fire-and-forget | 控制平面 status + meta 汇总（9.5） |
| **trace 粒度错** | session 太粗、消息太碎，定位不到轮 | 粒度未定在 turn | 以 turn 为最小 trace 节点（9.2） |
| **缓存当全价** | 成本算错，预算决策失真 | total 不拆 cache | 分价计费（9.3） |
| **三支柱断层** | metrics 查到异常却追不到 turn / replay | 三者 ID 未串联 | trace/sessionId/runId 贯穿（[Loop 第 22 篇](./loop-engineering-observability)） |

**最危险的两条**：①**不记工具结果**——这是 harness 可观测性最常见的偷工减料。toolCall 看着像「调用了」，但没有 result 就不知道执行成没成、返了什么；trace 树看似完整实则空心，debug 时只能看模型说要干嘛，看不到实际干成啥。②**子代理黑盒**——派五个子代理，账单翻五倍却查不到谁烧的，acceptance 形同虚设。子代理必须可汇总，否则黑盒乘以黑盒，整场会话不可审计。

---

## 迁移清单

| 可观测能力 | pi | Claude Code | Cursor | Aider | 通用 harness 实现 |
|-----------|----|-------------|--------|-------|------------------|
| **session 事件落盘** | JSONL 自动（`~/.pi/agent/sessions/`） | 本地会话记录 / `--resume` | 本地历史 / checkpoint | `.aider.chat.history.md` | append-only JSONL + sessionId |
| **turn 级 trace** | `turn_start`/`turn_end` + toolResults | 事件流（hook 拿 tool call） | 无显式 turn 边界 | 以 commit 为天然断点 | turn 根节点 + 工具 span |
| **token 计量** | assistant 消息挂 usage（含 cache） | usage 上报 / 成本显示 | UI token 计数 | `/tokens` 命令 | 拆 input/output/cache + 分价计费 |
| **session replay** | 重放 JSONL 逐 turn 复现 | `--resume` + 历史 | checkpoint 回放 | chat history 回读 | 事件流重放 + 状态重建 |
| **子代理汇总** | 控制平面 status + `*_meta.json` | subagent / Task 工具日志 | 无原生子代理 | 不适用 | meta 文件 + token/acceptance 聚合 |
| **实时观测** | SDK `session.subscribe()` | hooks（PreToolUse 等） | UI 状态面板 | 终端输出 | 事件流 → 仪表盘 |
| **成本归因** | per-turn usage + subagent meta | 按 session 累计 | UI 显示 | 按会话 | turn→session→日三级汇总 |

**一句话**：pi 在「session JSONL + turn 事件 + usage 挂载 + 子代理 meta」这套原始 instrumentation 上最完整、最可审计；Claude Code 靠 hooks + `--resume` 拼出近似能力；Cursor/Aider 偏轻，靠 checkpoint / chat history。自建 harness 至少要凑齐 **turn 级 trace（含工具结果）+ token 计量（拆 cache）+ session replay + 子代理汇总**这四件——少一件，agent 就在对应维度退回黑盒。

---

## 下一步

可观测性让 agent「看得见、查得到、审得清」。但 agent 要真正走出单机、融入团队工程流，还差最后一层——**协议层与分发**：怎么用 MCP / A2A 让 harness 互操作，怎么用 SDK 嵌进 CI，怎么 npm 打包分发、版本升级。

> 本文是 Harness Engineering 系列第 9 篇 / 共 10 篇。
> 上一篇：[8. 沙箱、权限与安全模型](./harness-engineering-security)
> 下一篇：[10. 协议层与分发](./harness-engineering-protocols-distribution) —— MCP/A2A 互操作、SDK 嵌入、npm 打包、版本升级。
>
> 与 [Loop Engineering 第 22 篇（可观测性深度）](./loop-engineering-observability) 呼应：那篇讲 **loop 运维层**（traceId 跨进程贯穿、runner 写 run-log、Meta-Loop 聚合趋势），本篇讲 **harness 内建层**（turn 级 trace、token usage、session replay、子代理汇总）。一个管跨边界串联，一个管边界内解剖——两层拼起来，agent 才从黑盒变成可运维系统。

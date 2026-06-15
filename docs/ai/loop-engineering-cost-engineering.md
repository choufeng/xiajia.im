# Loop 成本工程：token 经济学与预算治理

> 系列第二十三篇。Loop Engineering 系列的工程实践篇（共 2 篇，前一篇 [可观测性深度](./loop-engineering-observability)）。
>
> 前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性评估](./loop-engineering-resilience-eval) · [Sub-agent](./loop-engineering-sub-agent) · [Skills](./loop-engineering-skills) · [Worktree](./loop-engineering-worktree) · [Scheduling](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup) · [Documentation](./loop-engineering-documentation) · [Intent Debt](./loop-engineering-intent-debt) · [Comprehension Debt](./loop-engineering-comprehension-debt) · [Cognitive Surrender](./loop-engineering-cognitive-surrender)
>
> token 预算、成本爆炸、early exit——这些词在前二十多篇里反复出现，但始终零散。这篇把它们系统化：**loop 的成本经济学，从单 token 到全局预算，怎么算、怎么省、怎么治。**

---

## 一、为什么 loop 成本与传统 API 调用不同

传统 LLM 应用的成本是**加法**：调一次算一次，N 次调用 = N × 单次成本。

loop 的成本是**乘法**。三个维度同时放大：

```
传统调用:   cost = N_calls × cost_per_call
loop:       cost = cadence × sessions_per_run × subagents_per_session × tokens_per_turn
```

| 放大维度 | 传统调用 | loop | 倍数差异 |
|----------|----------|------|----------|
| **频率** | 用户触发，日均几十次 | cron 调度，15m = 96 次/天 | 10-100× |
| **session 数** | 1 个 | triage + implementer + verifier，每个独立 session | 2-4× |
| **subagent** | 无 | 每 session 可能再 spawn 子 agent | 1-8× |

三个维度叠加，loop 的日均成本可达传统应用的**数百倍**。这不是理论推演——Cobus Greyling 给了真实数字：

> CI Sweeper 以 15 分钟 cadence 跑，单 run 200k tokens，如果**每次都跑全量**（不做 early exit），96 runs/天 × 200k = **19.2M tokens/天**。按 Claude Sonnet 定价，**一天烧掉数百美元**。

这就是为什么成本工程在 loop 工程里不是「优化项」，而是**生存项**。L3 设计篇把预算上限列为七护栏之一，韧性篇把预算滚动列为五类韧性之一——成本失控不是「花钱多」，而是**让 loop 停摆**（预算耗尽 → 所有 loop 降级甚至全停）。

---

## 二、Token 生命周期成本：input / output / cache 三分解

大多数人对 token 成本的理解停在「input + output」。loop 工程必须三分解——**cache token 是隐藏的折扣杠杆**。

### 三种 token 的经济特性

| token 类型 | 含义 | 单价 | loop 里的占比 | 关键特征 |
|------------|------|------|---------------|----------|
| **input** | 发给模型的 prompt | 标准价 | 50-80% | 大头，可压缩 |
| **output** | 模型生成的回复 | 3-5× input 价 | 10-30% | 贵但量少 |
| **cache hit** | 命中前缀缓存的部分 | 0.1-0.25× input 价 | 可达 50%+ | **最容易被忽视的省钱杠杆** |

### 为什么 cache 是隐藏折扣

prompt caching 的原理：如果两次请求的**前缀相同**（system prompt + skill 描述 + 上下文），provider 只对「重复部分」收缓存价。

```
不带缓存:  input = 80k tokens × $3/M  = $0.24
带缓存:    cache = 75k tokens × $0.30/M + 5k input × $3/M = $0.023 + $0.015 = $0.038
                                                                    ↓
                                                            省 84%
```

对 loop 来说这极其重要——**同一个 loop 的 system prompt + skill 描述每次运行都一样**，天然适合缓存。问题是你得**让它能命中**（见第四节）。

### 真实成本拆解示例

一个 CI Sweeper 的单次运行（L2，implementer + verifier）：

| 组件 | input | output | cache hit | 实际计费 |
|------|-------|--------|-----------|----------|
| system prompt + skill | 12k | — | 12k (100%) | ~$0.004 |
| STATE.md + CI 日志 | 35k | — | 0 | ~$0.105 |
| implementer 推理（3 turns） | 45k | 8k | 30k | ~$0.135 + $0.12 |
| verifier 推理（1 turn） | 20k | 2k | 15k | ~$0.015 + $0.03 |
| **合计** | 112k | 10k | 57k | **~$0.41** |

无缓存版本同样跑：~$0.70。**缓存省了 40%**。这个比例会随 skill/STATE 越稳定越高。

---

## 三、模型路由策略：把贵的钱花在刀刃上

loop 不是铁板一块——它有多个角色（triage、implementer、verifier），每个角色的能力需求不同。**给所有角色用同一个模型，要么浪费（triage 用 opus），要么不安全（verifier 用 haiku）。**

### 角色成本矩阵

| 角色 | 能力需求 | 推荐模型档位 | 理由 |
|------|----------|-------------|------|
| **Triage** | 分类、过滤、摘要 | 廉价/快速（Haiku/Flash） | 任务简单，高频，贵了浪费 |
| **Implementer (fixer)** | 写代码、改文件 | 标准（Sonnet/Pro） | 需要中等推理，但非最复杂 |
| **Verifier** | 找 bug、批判、安全审查 | 强（Opus/最强可用） | **L3 唯一该花大钱的地方**——它拦错误 |
| **Changelog Drafter** | 汇总、分类 | 廉价/快速 | 文本整理，低频 |
| **Meta-Loop Analyzer** | 归因、系统性分析 | 强（且**不同**于被监督的 loop） | 反衰减篇：用不同模型避免盲点一致 |

### 路由的核心原则

> **Cobus Greyling：「Stronger model on verifier is worth it for unattended.」**
> （verifier 用更强模型，对无人值守场景值得。）

这句话道出了成本工程的灵魂：**钱要花在「拦错误」上，不是「干粗活」上**。Triage 跑 96 次/天，用 opus 是烧钱；verifier 每次 L3 合并才跑一次，用 opus 是买保险。频率 × 单次成本的交叉点决定路由。

### pi 里的模型路由

```typescript
// runner 里为不同角色选不同模型
const { session: triage } = await createAgentSession({
  model: getModel("anthropic", "claude-haiku-4"),      // 廉价快
  tools: ["read", "grep", "find", "bash"],
});

const { session: verifier } = await createAgentSession({
  model: getModel("anthropic", "claude-opus-4"),        // 最强
  tools: ["read"],                                       // 只读
});
```

或 CLI 层面用 `--model` 切换：

```bash
# triage 用 haiku
pi -p --model anthropic/claude-haiku-4 "执行 /skill:ci-sweeper 的 triage 阶段" \
  -t read,grep,find,bash

# verifier 用 opus
pi -p --model anthropic/claude-opus-4 "独立审核下面 diff..." \
  -t read
```

---

## 四、Prefix Caching 利用：让重复前缀命中缓存

第三节说缓存能省 40%+，但前提是**前缀能命中**。怎么保证？

### 缓存命中的三个条件

| 条件 | 含义 | loop 怎么满足 |
|------|------|-------------|
| **前缀稳定** | system prompt + skill 描述不变 | 用 skill（progressive disclosure，描述常驻） |
| **顺序一致** | 前缀部分的排列每次相同 | 固定上下文加载顺序（system → skill → state） |
| **达到阈值** | 前缀长度超过 provider 缓存门槛（通常 1024+ tokens） | skill 描述 + system prompt 通常够 |

### pi 的缓存机制

pi 在两个层面自动帮你利用缓存：

1. **Claude 模型自动启用**：pi 对 ID 含可识别模型名的 Claude 模型自动启用 prompt caching。application inference profile（ARL 不含模型名）需设 `AWS_BEDROCK_FORCE_CACHE=1`。
2. **Cloudflare Workers AI 前缀缓存**：pi 自动设置 `x-session-affinity`，让相同前缀的请求路由到同一节点，命中缓存折扣。

### 破坏缓存命中的常见做法

| 反模式 | 后果 | 正确做法 |
|--------|------|----------|
| 每次把完整 STATE.md 塞 system prompt | STATE 变 → 前缀变 → 缓存失效 | STATE 放 prompt **末尾**，前缀留给固定内容 |
| 在 system prompt 里拼时间戳/随机值 | 每次不同 → 永不命中 | 时间戳放用户消息里，不碰 system prompt |
| 不同 run 用不同 skill 组合 | 前缀变化 | 同一 loop 固定 skill 集合 |

**关键洞察**：缓存命中的本质是**「不变的部分放前面，变的部分放后面」**。system prompt → skill 描述 → 固定上下文 → 变化的 STATE/日志——这个顺序让前缀尽可能长地保持稳定。

---

## 五、标记语言 Token 效率：选对格式省钱

loop 大量用标记语言序列化数据（STATE、诊断结论、工具输出）。不同格式 token 效率差异巨大。

实测对比（相同语义内容，流式场景）：

| 格式 | 典型 token 数 | 相对效率 | 适用场景 |
|------|--------------|----------|----------|
| **YAML** | ~70 | ★★★★★ 最省 | 简单结构、配置、state |
| **XML** | ~120 | ★★★★ 省 | 复杂布局、嵌套、流式兼容 |
| **JSON** | ~220 | ★★★ 中 | 结构化、API 交互 |
| **Markdown** | ~240 | ★★ 费 | 文档（但人读友好） |
| **HTML** | ~800 | ★ 极费 | 避免用于 loop 内部 |

> 经验法则：**简单结构用 YAML，复杂布局用 XML，避免用 HTML 给模型。** JSON 适合 API 边界，但 loop 内部数据传递用 YAML/XML 能省 3-10×。

### 在 loop 设计里的应用

| 场景 | 推荐格式 | 理由 |
|------|----------|------|
| STATE.md 结构化数据 | YAML frontmatter | 省 token + 人可读 |
| skill 内的步骤 | Markdown（人读） | skill 是给人+模型，平衡 |
| agent 间消息传递 | XML 或 YAML | 内部传递，省 token 优先 |
| verifier 输出判定 | YAML | `verdict: PASS` 比 Markdown 段落省 |
| 工具参数 | JSON（pi 要求） | 协议层，不可选 |

---

## 六、Cadence 乘法：频率是最大的成本杠杆

这是 loop 成本工程里**最重要的一张表**。频率不是线性增长，是乘法爆炸。

### 乘法效应实测

| Loop | Cadence | Runs/天 | 单 run 成本 | 日均成本（无 early exit） | 日均成本（有 early exit） |
|------|---------|---------|-------------|---------------------------|---------------------------|
| Daily Triage | 1d | 1 | ~50k | 50k | 50k |
| Issue Triage | 2h | 12 | ~30k | 360k | ~60k（多数 no-op） |
| Dependency Sweeper | 6h | 4 | ~80k | 320k | ~120k |
| CI Sweeper | 15m | 96 | ~200k | **19.2M** 🔴 | ~500k（90% no-op） |
| PR Babysitter | 5m | 288 | ~23k | 6.6M 🔴 | ~400k（95% no-op） |

**没有 early exit 的 CI Sweeper**：19.2M tokens/天。这是破产级的成本。加了 early exit（90% 的 tick 是 CI 绿的 no-op ~5k）：~500k/天。**降了 38 倍。**

### 为什么 early exit 是成本工程的头号武器

Cobus 的原话：

> 「**Best practice: Triage pass is cheap; spawn sub-agents only when state says actionable. Empty watchlist → exit in <5k tokens.**」

拆解：一个 15 分钟 cadence 的 CI Sweeper，一天 96 次 tick。如果 CI 是绿的（90% 的时间），triage 只需读 STATE、查 CI 状态、确认无失败——全程 **<5k token，不 spawn 任何 subagent**。只有那 10% CI 真红的 tick，才走完整的 implementer + verifier（~200k）。

```
无 early exit: 96 × 200k = 19.2M tokens/天
有 early exit: 86 × 5k + 10 × 200k = 430k + 2M = 2.43M tokens/天
                                                    ↓
                                            省 87%
```

### Cadence 选择决策表

| 时效需求 | 推荐 cadence | 日均 runs | 注意 |
|----------|-------------|-----------|------|
| 实时（CI 红，阻塞一切） | 事件驱动（webhook） | 按需 | 最高效，不空跑 |
| 高频（PR 活跃 review） | 5-15m | 96-288 | **early exit 必须** |
| 中频（依赖/issue） | 2-6h | 4-12 | early exit 推荐 |
| 低频（triage/changelog） | 1d | 1 | 无所谓 |

> **铁律：cadence 越密，early exit 越重要。** 1d cadence 的 loop 空跑一次才 5k，无所谓；15m cadence 的 loop 不做 early exit = 破产。

---

## 七、Early Exit：多数 run 应是 no-op

early exit 不只是「省 token」——它是 loop 成本工程的**设计哲学**。

### early exit 的三个层次

```
┌─────────────────────────────────────────────────────┐
│  层1: 业务层 early exit                               │
│  CI 绿 → STATE 无 active → 立即 EXIT (<5k token)      │
│  (triage 只读 STATE + 查 CI, 不进 implementer)        │
├─────────────────────────────────────────────────────┤
│  层2: 子 agent 层 early exit                          │
│  triage 完成 → 无 actionable → 不 spawn implementer   │
│  (省掉整个 implementer+verifier 的 ~150k)             │
├─────────────────────────────────────────────────────┤
│  层3: 工具层 early exit                               │
│  bash 先跑 `git log --since=15min` 看有无变更         │
│  无变更 → 不读全量代码, 直接 exit                      │
└─────────────────────────────────────────────────────┘
```

### 实现模式

在 skill 里显式编码 early exit 指令：

````markdown
# ci-sweeper skill — early exit 段

## 起手检查（每次 tick 先跑）
1. `gh run list --status failure --limit 1` 查有无失败 CI
2. 若无失败 → 立即输出 "EXIT: no failures" 并结束。**不要继续。**
3. 若有失败 → 检查 STATE.md 是否已记录该失败
4. 若已记录且 attempt < MAX → 继续处理
5. 若已记录且 attempt >= MAX → 跳过（已在 Waiting）

铁律：90% 的 tick 应该在第 2 步就结束。
````

### no-op 的成本应该多低

Cobus 给的基准：**no-op < 5k token**。拆解这 5k 怎么花：

| no-op 组成 | token | 说明 |
|------------|-------|------|
| system prompt + skill 描述 | ~1.5k | 常驻，cache 命中 |
| 读 STATE.md | ~0.8k | 当前状态 |
| 查 CI/API（bash） | ~0.5k | 工具调用 |
| 输出 "EXIT: no failures" | ~0.2k | 一句话 |
| 模型推理 | ~2k | 判断「无 actionable」 |
| **合计** | **~5k** | — |

如果 no-op 超过 10k，说明 triage 做了多余的事——在查全量日志、读整个代码库。**no-op 的目标是不产生任何子 agent、不读任何大文件。**

---

## 八、预算预测与归因：让成本可管可查

不知道钱花在哪，就管不了成本。两个能力：**预测**（跑之前估）和**归因**（跑之后分摊）。

### 预测：跑之前估算

Cobus 提供了 `loop-cost` CLI：

```bash
# 估算某模式在某 cadence 下的成本
npx @cobusgreyling/loop-cost --pattern ci-sweeper --cadence 15m --level L2

# 估算 daily-triage
npx @cobusgreyling/loop-cost --pattern daily-triage --cadence 1d --level L1
```

手动估算公式：

```
日均 token = runs_per_day × (p_noop × cost_noop + p_action × cost_action)

CI Sweeper 示例:
= 96 × (0.9 × 5k + 0.1 × 200k)
= 96 × (4.5k + 20k)
= 96 × 24.5k
= 2.35M tokens/天

按 Sonnet $3/M input + $15/M output (假设 90% input):
≈ 2.35M × 0.9 × $3/M + 2.35M × 0.1 × $15/M
≈ $6.35 + $3.53
≈ $9.9/天 ≈ $297/月
```

### 各模式成本画像总表

| 模式 | Tier | Cadence | no-op | full run | 日均（有 early exit） | 建议日上限 |
|------|------|---------|-------|----------|----------------------|-----------|
| Daily Triage | low | 1d | ~5k | ~50k | ~50k | 100k |
| Issue Triage | low | 2h | ~5k | ~30k | ~60k | 200k |
| Dependency Sweeper | medium | 6h | ~8k | ~80k | ~120k | 500k |
| Post-Merge Cleanup | low | 1d | ~5k | ~40k | ~40k | 100k |
| Changelog Drafter | low | 1d/tag | ~5k | ~30k | ~30k | 100k |
| PR Babysitter | **very-high** | 5m | ~5k | ~23k | ~400k | 1M |
| CI Sweeper | **very-high** | 15m | ~5k | ~200k | ~2.4M | 1M（需 hard cap） |

> 注意 PR Babysitter 和 CI Sweeper 是 **very-high tier**——它们的 full run 单次不贵（~23k），但 cadence 太密，日均爆炸。这两个**必须**有 early exit + hard daily cap。

### 归因：跑之后分摊

每个 run 记录实际 token 消耗（见下节 pi 实践），按 loop 聚合：

```markdown
## Cost Attribution — Week of 2026-W24

| Loop | Runs | Tokens used | Est. cost | 占比 | 备注 |
|------|------|-------------|-----------|------|------|
| ci-sweeper | 96 | 2.41M | $9.60 | 58% | 主力消耗 |
| pr-babysitter | 288 | 0.82M | $3.28 | 20% | early exit 生效 |
| daily-triage | 7 | 0.35M | $1.40 | 8% | 正常 |
| dep-sweeper | 4 | 0.31M | $1.24 | 8% | 含一次 major 升级调查 |
| post-merge | 7 | 0.28M | $1.12 | 6% | 正常 |
| **合计** | 402 | **4.17M** | **$16.64** | 100% | 周预算 $20 ✅ |
```

**归因的价值**：发现 ci-sweeper 占 58% → 它是优化重点；发现某 loop 实际消耗远超预测 → 调查 early exit 是否失效。

---

## 九、pi 实践：token 提取、模型选择、skill 省 token

### 9.1 提取 session token usage

pi 的 AgentSession 在 `session.agent.state` 暴露 usage 信息。SDK 订阅事件可提取：

```typescript
let inputTokens = 0, outputTokens = 0;

session.subscribe((event) => {
  // turn_end 事件含本轮 token 使用
  if (event.type === "turn_end") {
    // 从 message 的 usage 字段累计
    // 实际实现：解析 event.message.usage
  }
});

await session.prompt("...");
// session.agent.state 含 messages，每条 assistant message 有 usage
```

subagent 场景，token 提取从 `subagent-artifacts/*_meta.json` 获取（含 inputTokens/outputTokens/totalTokens/cacheTokens/turns）：

```bash
# 一键汇总所有 subagent token
for f in subagent-artifacts/*_meta.json; do
  python3 -c "
import json; d=json.load(open('$f'))
print(f\"{d['runId'][:8]} {d['agent']:20s} in={d['inputTokens']:6d} out={d['outputTokens']:5d} cache={d.get('cacheTokens',0):6d}\")
"
done
```

session log 备选（JSONL）：

```bash
# 从 session JSONL 提取 usage
grep '"usage"' ~/.pi/agent/sessions/<project>/*.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    d = json.loads(line.split(':',1)[1] if ':' in line else line)
    u = d.get('usage', {})
    print(f\"in={u.get('input_tokens',0)} out={u.get('output_tokens',0)}\")
"
```

> **缓存偏差提醒**：同一 session 连续运行后续案例会命中前缀缓存，导致 input token 偏低。抹平方案：每案例用独立 session，或双轮交替（旧→新→新→旧）取均值。

### 9.2 模型选择：`--model` / `--provider`

```bash
# CLI 指定模型 + thinking level
pi -p --model anthropic/claude-haiku-4 "triage..."      # 廉价 triage
pi -p --model anthropic/claude-opus-4:high "verify..."  # 强 verifier + 高 thinking
```

SDK 层面用 `getModel()`：

```typescript
import { getModel } from "@earendil-works/pi-ai";

const haiku = getModel("anthropic", "claude-haiku-4");
const opus = getModel("anthropic", "claude-opus-4");
```

### 9.3 skill progressive disclosure 省 token

这是 Skills 篇讲过的核心机制，从成本视角再强调：

```
不用 skill（全量塞 system prompt）:
  每次 run = system prompt + 全部指令 = ~15k token 常驻

用 skill（progressive disclosure）:
  每次 run = system prompt + skill 描述 (~50 token/skill) = ~2k 常驻
  需要时 read SKILL.md 才加载正文 (~3k)
  不需要的 skill = 0 token
```

| 方式 | 常驻 token | 一天 96 runs | 省 |
|------|-----------|-------------|-----|
| 全量塞 system prompt | ~15k | 1.44M | — |
| skill progressive disclosure | ~2k + 按需 | ~0.2M + 按需 | **86%** |

### 9.4 SessionManager.inMemory 省 IO

loop 的 session 不需要落盘（工作记忆靠 STATE.md，不靠 session 文件）：

```typescript
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(REPO),  // 不写 JSONL 文件
});
```

省掉每条消息的磁盘写入。对高频 loop（CI Sweeper 96 runs/天），减少 IO 开销 + 磁盘占用。

---

## 十、预算治理：从单 loop 到全局

### 单 loop 预算规则

```markdown
## Loop Budget — CI Sweeper
- max_tokens_per_run: 500_000
- max_tokens_per_day: 1_000_000
- max_duration_per_run_s: 900
- max_subagent_spawns_per_run: 4
- on_exceed: pause + escalate
- early_exit_required: true
- no_op_target: <5k tokens
```

### 全局聚合预算（Multi-Loop）

多个 loop 的预算必须聚合看（Multi-Loop 篇铁律 5）：

```markdown
## Aggregate Budget — All Loops
- global_max_tokens/day: 4_000_000
- ci-sweeper: 1M (50%)
- pr-babysitter: 0.5M
- dep-sweeper: 0.5M
- others: 2M shared pool
- on 80%: all degrade to L1
- on 100%: only daily-triage runs (cheapest)
- emergency_pool: 0.8M (20%, critical loops only)
```

### 预算降级阶梯（韧性篇机制 4）

```
预算 < 80%:  正常运行
预算 80%:    所有 loop 降级 L1（不停，变保守）
预算 100%:   只跑 daily-triage（最便宜，~50k/run）
预算重置:    午夜恢复

关键 loop（主干红时 ci-sweeper）:
  即使超预算也跑，但扣 emergency_pool
```

**设计哲学**：宁可降级慢跑，不要完全停摆。

### Cobus 的预算铁律

> 「Encode in skill or scheduler prompt: **If no high-priority items, exit immediately.**」

把 early exit 编码进 skill（软约束）+ 编码进 runner 预算检查（硬约束）。两层保证 loop 不会「无意义地烧 token」。

---

## 十一、回顾

1. **loop 成本是乘法不是加法**：cadence × sessions × subagents × tokens，三个维度叠加可达传统应用数百倍。
2. **Token 三分解**：input（大头，可压缩）+ output（贵但量少）+ cache（隐藏折扣，可省 40%+）。
3. **模型路由**：triage 用廉价模型、fixer 用标准、verifier 用最强。钱花在「拦错误」不在「干粗活」。
4. **Prefix caching**：前缀稳定 + 顺序一致 = 命中。system prompt/skill 放前面，STATE/日志放后面。
5. **标记语言效率**：YAML(~70t) < XML(~120t) < JSON(~220t) < Markdown(~240t) < HTML(~800t)。简单用 YAML，复杂用 XML，避免 HTML。
6. **Cadence 乘法**：15m cadence × 200k/run = 19.2M/天（破产）。CI Sweeper/PR Babysitter 是 very-high tier。
7. **Early exit 是头号武器**：90% 的 tick 应是 no-op (<5k)。三层 early exit：业务层（无失败→EXIT）+ 子 agent 层（无 actionable→不 spawn）+ 工具层（无变更→不读全量）。
8. **预算预测**：`日均 = runs × (p_noop × cost_noop + p_action × cost_action)`。用 `loop-cost` CLI 或手动估算。
9. **预算归因**：每 run 记 token，按 loop 聚合，发现哪个 loop 烧钱。
10. **全局治理**：聚合预算 + 降级阶梯（80% 降 L1，100% 只跑最便宜）。宁可慢跑不停摆。

一句话收尾：**成本工程不是「省钱」，是「让 loop 活得起」。一个每天烧 $300 的 CI Sweeper 活不过一个月；一个 early exit 做好的 CI Sweeper 每天 $10，能跑到你忘记它的存在。loop 的经济可持续性，和它的技术正确性同等重要。**

---

## 参考资料

- [系列十三：Scheduling 模式](./loop-engineering-scheduling)（调度频率与成本的关系）
- [系列三：L3 设计](./loop-engineering-l3-design)（预算上限护栏）
- [系列九：韧性与评估](./loop-engineering-resilience-eval)（预算滚动、降级阶梯、紧急配额）
- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（聚合预算）
- [系列十一：Skills 工程化](./loop-engineering-skills)（progressive disclosure 省 token）
- [系列十：Sub-agent](./loop-engineering-sub-agent)（token 提取：subagent-artifacts *_meta.json）
- [Cobus Greyling — Operating Loops（Token & Cost Budgeting 全集）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [Cobus Greyling — CI Sweeper pattern（Cost Profile）](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/ci-sweeper.md)
- [Cobus Greyling — Daily Triage pattern（Cost Profile）](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/daily-triage.md)
- [Addy Osmani — Loop Engineering（成本警告）](https://addyosmani.com/blog/loop-engineering/)
- pi 文档：prefix caching（[providers.md](https://github.com/earendil-works/pi)）· `--model`/`--provider` · `SessionManager.inMemory` · `session.agent.state`
- CLI 工具：`npx @cobusgreyling/loop-cost --pattern <id> --cadence <interval> --level <L>`

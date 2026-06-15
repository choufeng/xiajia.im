# 上下文工程与 Token 预算：Harness 的内存管理

> Harness Engineering 系列第三篇。前一篇：[工具系统与工具总线](./harness-engineering-tools) · 系列总纲：[Harness Engineering](./harness-engineering-series)
>
> 工具总线让 agent「能动手」，但它动手的依据——所见所闻——全在上下文窗口里。窗口是有限的、会衰减的、要花钱的。把窗口当无限硬盘使，agent 必然越跑越蠢、越跑越贵。这篇讲 harness 怎么管这块「RAM」。

---

## 目录

- [引言：上下文窗口是 RAM，不是硬盘](#引言上下文窗口是-ram不是硬盘)
- [一、上下文不是越多越好](#一上下文不是越多越好)
- [二、注入层次：六个信源，六种生命周期](#二注入层次六个信源六种生命周期)
- [三、Token 预算模型：固定区与动态区](#三token-预算模型固定区与动态区)
- [四、裁剪策略对比](#四裁剪策略对比)
- [五、上下文爆炸的症状与防护](#五上下文爆炸的症状与防护)
- [六、pi 的上下文编排：progressive disclosure](#六pi-的上下文编排progressive-disclosure)
- [七、反模式](#七反模式)
- [迁移清单](#迁移清单)
- [下一步](#下一步)

---

## 引言：上下文窗口是 RAM，不是硬盘

新手搭 harness 最普遍的错觉：**把上下文窗口当仓库**——能塞就塞，代码全灌进去，历史全留着，记忆全量加载，反正「窗口大得很」。这条路通向三个坏结果：账单爆炸、召回衰减、早期指令丢失。

正确的类比是 **RAM，不是硬盘**：

| | RAM（内存） | 上下文窗口 |
|---|---|---|
| 容量 | 有限，要分配 | 有限（128k/200k/1M token） |
| 访问 | 随机，但越大越慢 | 全量送进模型，越大越贵越糊涂 |
| 管理 | 分页、换出、缓存层次 | 注入层次、裁剪、摘要折叠 |
| 失败 | OOM、抖动 | 溢出截断、召回下降、账单失控 |

CPU 有寄存器 → L1 → L2 → 主存 → 磁盘的层次结构，**越靠上越快越小**。harness 同理——system prompt 是寄存器级（每轮必在、最贵），memory/向量库是磁盘级（按需检索、便宜）。好的上下文工程，本质是**把不同温度的信息放进合适的层**，而不是一股脑塞进最贵的那层。

一句话总纲：**窗口里只该有「这一步非看不可」的东西。其余的，放在能按需召回的冷层。**

---

## 一、上下文不是越多越好

定义清楚了，看为什么「多」反而是负资产。四条独立代价，每条都能独立杀死一次 run。

### 1. 召回衰减（lost in the middle）

模型对长上下文里**中间位置**的信息召回率显著低于头尾。这不是「找不到」的问题，是「注意力被稀释」。位置越靠中段、信源越拥挤，召回越差。

### 2. 信源互相干扰（distractor 效应）

无关上下文不是中性背景，是**噪声**。塞一堆当前任务用不到的文件、旧错误日志、无关 skill 正文，模型会被带偏——给出牵强引用、引用错文件、把过时约束套到新问题上。

### 3. 成本线性增长

token-in 决定每一轮的费用。**上下文是按 token 计费的 RAM**，而且每个 token 在每一轮都被重新计费一遍。10 万 token 的窗口跑 20 轮，账单是 200 万 token 的输入侧。塞得越多，每多跑一轮多花的钱越多。

### 4. 越界溢出

超过窗口上限，harness 要么硬截断（丢早期指令，包括系统提示里定下的规则），要么强制压缩（摘要可能漏关键信息）。两种都让 agent 行为漂移。

### 代价总表

| 多塞的信源 | 召回 | 决策质量 | 成本 | 溢出风险 |
|---|---|---|---|---|
| 整仓库代码 | ↓（淹没 needle） | ↓（噪声） | ↑↑ | ↑↑ |
| 全量历史对话 | ↓（中段丢失） | →~↓ | ↑↑ | ↑↑ |
| 完整工具结果（CI 日志等） | ↓ | ↓ | ↑ | ↑ |
| 全量 memory dump | ↓ | ↓ | ↑ | ↑ |
| 多个无关 skill 正文 | ↓ | ↓ | ↑ | → |

> 反直觉但关键：**对长上下文任务，删上下文常常比加上下文更能提升正确率。** 少即是多，前提是删对——把冷信息挪到可召回层，而不是直接扔掉。

---

## 二、注入层次：六个信源，六种生命周期

harness 往窗口里塞的东西，按来源拆六层。每层有自己的**注入时机、生命周期、典型大小**，混淆生命周期是上下文失控的主因。

```
┌────────────────────────────────────────────────────────────┐
│ ⑥ live code        模型 read 出的当前代码     （按需，单任务） │
│ ⑤ tool results     工具返回（bash/grep/read） （动态，单轮~保留）│
│ ④ memory           持久记忆（偏好/失败/约定） （按需 search）   │
│ ③ files            项目文件                    （按需 read）   │
│ ② skills           仅 name+desc；正文按需 read （索引常驻）    │
│ ① system prompt    角色/规则/AGENTS.md         （固定，每轮）  │
└────────────────────────────────────────────────────────────┘
   温度高（贵、必在） ──────────────────────── 温度低（便宜、按需）
```

| 层 | 注入时机 | 生命周期 | 典型大小 | pi 机制 |
|---|---|---|---|---|
| **① system prompt** | 启动组装 | 每轮固定常驻 | 1–8k | 系统提示 + Context Files（`AGENTS.md`）自动并入 |
| **② skills 索引** | 启动扫描 | 常驻（仅 name+desc） | 每个 ~0.1–0.3k | `available_skills` 以 XML 注入；正文 `read` 展开 |
| **③ files** | 模型主动读 | 单任务用完即弃 | 视文件 | `read` / `grep` / `find` 按需 |
| **④ memory** | 模型主动检索 | 召回后入窗口 | top-K | `memory_search` 按需检索 |
| **⑤ tool results** | 工具调用返回 | 单轮为主，重要者保留 | 视输出 | 工具返回；超长需截断/摘要 |
| **⑥ live code** | 模型主动读 | 单任务 | 视范围 | `read` 出的当前代码片段 |

**关键洞察**：①②是固定开销，跑得越久越划算（摊薄）；③④⑤⑥是动态开销，必须按需，否则随轮次线性堆。一个成熟 harness 的上下文占比，理想形态是**固定区占小头、动态区受控、冷层（memory）几乎不占常驻**。

> 为何要分这么细？因为**同一份信息，放对层是资产，放错层是负债**。用户偏好写进 system prompt 是资产（每轮必在），把整个失败案例库写进 system prompt 是负债（挤爆预算）。分层让信息归位。

---

## 三、Token 预算模型：固定区与动态区

把窗口当成**有预算的资源**来分配，而不是「装到满」。

```
┌────────────────────────── contextWindow（如 200k）──────────────────────────┐
│ ① 固定区              ② 动态区                       ③ reserve              │
│ system + skills 索引  对话历史 + 工具结果 + read 文件  输出 + action 空间     │
│ ████████              ████████████████████           ░░░░░░░░              │
└───────────────────────────────────────────────────────────────────────────┘
   常量，每轮都在        增长，需裁剪                    必须留，否则尾部被截
```

### 固定区 vs 动态区

| | 固定区 | 动态区 |
|---|---|---|
| 内容 | system prompt、角色、skills 索引、`AGENTS.md` | 对话历史、工具结果、read 出的文件、检索到的 memory |
| 行为 | 每轮常驻，占常量预算 | 随轮次/工具调用增长 |
| 管理 | 上线时一次性压到最小 | 持续裁剪、摘要折叠 |
| 反模式 | 往 system prompt 塞可按需加载的东西 | 不裁剪，任其增长到溢出 |

### 必须预留 reserve

窗口不是「可用到 200k」。模型生成回复、发起工具调用都需要空间，**不留 reserve 就会让输出或 action 尾部被截**——表现为回复不全、工具参数残缺、JSON 截断。

pi 把这件事做成了硬约束：auto-compaction 的触发条件是

```
contextTokens > contextWindow - reserveTokens
```

`reserveTokens` 默认 **16384**，在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 可配：

```json
{
  "reserveTokens": 16384,
  "keepRecentTokens": 20000
}
```

`keepRecentTokens`（默认 20k）是压缩时**保留的最近消息**量——即「不参与摘要折叠的尾部」。

### 预算分配建议（伪代码，比例随任务调）

```typescript
// 一个 200k 窗口的预算分配示意
const budget = {
  system_fixed:   8_000,   // 角色 + AGENTS.md + skills 索引
  dynamic_history: 120_000, // 对话 + 工具结果 + read 文件（受裁剪管控）
  memory_recall:  20_000,  // memory_search 召回的 top-K
  reserve:        16_384,  // 输出 + action 空间（= pi reserveTokens）
  slack:          35_616,  // 缓冲，吃工具结果突发
};
// 总和 = contextWindow。dynamic 区接近 dynamic_history 上限即触发裁剪。
```

> 铁律：**预算要主动规划，不是等溢出被动触发。** reserve 不是「省下来的零头」，是第一等公民——它决定 agent 还能不能动。

---

## 四、裁剪策略对比

动态区迟早要裁。四种主流策略，各有适用场景。

| 策略 | 做法 | 复杂度 | 保真度 | 适用场景 | pi 支持 |
|---|---|---|---|---|---|
| **FIFO** | 先进先出，丢最旧 | 极低 | 低（丢早期指令） | 纯流式、早期信息不重要 | 部分行为近似 |
| **LRU** | 丢最久未访问 | 中 | 中 | 多步任务、有热点 | 需自建 |
| **相关性裁剪** | 按与当前任务相关性打分，丢低分 | 高 | 高 | 长任务、信源杂 | 需自建（可借 memory/embedding） |
| **摘要折叠** | 把旧消息压成结构化摘要，保留 recent | 中 | 中高 | 长会话、需保留脉络 | ✅ 内置 compaction |

### pi 的 compaction（摘要折叠）

pi 默认走**摘要折叠**：上下文逼近上限时，从最新消息往回累计到 `keepRecentTokens`，把更早的消息交给 LLM 生成结构化摘要，写入 `CompactionEntry`，之后模型看到的是 `system + summary + 最近消息`。

```
压缩前（10 条消息，token 已逼近上限）:
  hdr usr ass tool usr ass tool tool ass tool
      └──── 待摘要 ────┘ └──── keepRecent ────┘

压缩后（追加 cmp 条目）:
  hdr [summary] usr ass tool tool ass tool   ← 模型实际所见
              ↑          ↑
        CompactionEntry  从 firstKeptEntryId 起的最近消息
```

- **手动触发**：`/compact [instructions]`，`instructions` 可定向摘要重点（如「聚焦未解决的失败」）。
- **多次压缩不丢**：新一轮摘要从前次压缩的 kept 边界起算，已存活的消息会再进摘要，不被悄悄丢。

> 选型建议：**绝大多数长会话用摘要折叠（pi 默认）即可**。只有当任务信源极度杂乱、相关性裁剪收益明显时，才值得在 compaction 之外叠加自建的 relevance 层。FIFO 是下策——它最简单，也最容易丢掉关键早期规则。

---

## 五、上下文爆炸的症状与防护

上下文失控不是一夜发生的，有明确的早期症状。识别它们，才能在「质量崩塌」前介入。

### 症状 → 根因 → 防护

| 症状 | 根因 | 防护 |
|---|---|---|
| **漂移（drift）** | 上下文里噪声多、约束被稀释 | 精简固定区；冷信息移入 memory |
| **遗忘早期指令** | 动态区增长挤掉/截断了 system 早期内容 | system prompt 只放铁律；reserve 保障 |
| **重复调同一工具** | 上一轮结果被裁剪/淹没，模型不记得查过 | 工具结果保留近期；摘要折叠保留「已查过 X」 |
| **自我对话循环** | 无关上下文堆积 + 无终止条件，agent 自言自语 | 工具结果摘要 + 预算硬上限 + loop 层循环守卫 |

### 三道防线

```
防线 1  预算告警      token 接近阈值 → 日志/事件，可观测
防线 2  强制摘要      达 contextWindow - reserveTokens → auto-compaction
防线 3  硬上限        超 hard cap → 拒绝继续注入 / 中止 turn（兜底）
```

pi 默认提供**第二道**（auto-compaction）和**第三道的等价效果**（reserveTokens 让 compaction 必然在溢出前触发）。第一道（可观测告警）需要 harness 自身在扩展层补——监听 token 事件、暴露 metric（详见后续可观测篇）。

### 工具结果的裁剪最容易忽视

工具结果（尤其 `bash` 的 CI 日志、`read` 的大文件）是动态区膨胀的头号元凶。实践上：

- `bash`/CI 输出超阈值 → 先截断尾部 + 头部摘要，别原样进窗口。
- `read` 大文件 → 用 `offset`/`limit` 或 `grep` 取片段，不整文件读入。
- 工具结果里重复的样板输出（如每次都打印的环境头）→ harness 侧去重。

```typescript
// 伪代码：工具结果裁剪守卫
function guardToolResult(result: string, maxTokens = 4_000): string {
  const tks = estimateTokens(result);
  if (tks <= maxTokens) return result;
  const head = sliceHead(result, maxTokens / 2);
  const tail = sliceTail(result, maxTokens / 2);
  return `${head}\n…[截断，原始 ${tks} tokens]…\n${tail}`;
}
```

---

## 六、pi 的上下文编排：progressive disclosure

把前面几节收束到 pi 的实际流水线。pi 的核心策略叫 **progressive disclosure（渐进披露）**——**描述常驻，正文按需**。

```
启动期（一次性）
  scan skills  ──► 提取每个 skill 的 name + description
  组装 system prompt ──► 内含 available_skills（仅 name+desc，XML）
  并入 Context Files（AGENTS.md）
        │
        ▼
每轮（per turn）
  模型所见 = system(含 skills 索引) + summary(若已压缩) + 最近消息
        │
        ├─ 任务命中某 skill ──► read 展开 SKILL.md 正文（一次性，用完即弃）
        ├─ 需要某文件      ──► read / grep 取片段
        ├─ 需要历史经验    ──► memory_search 召回 top-K
        └─ 调工具          ──► 结果（超长则裁剪）入窗口
        │
        ▼
预算管控（每轮检查）
  contextTokens > contextWindow - reserveTokens ?
     是 ──► auto-compaction（摘要折叠 + 保留 keepRecentTokens）
     否 ──► 继续
```

### 为什么这套省 token

| 做法 | 省在哪 |
|---|---|
| skills 只注 name+desc | 100 个 skill 正文不常驻，只占索引的几百 token |
| 文件按需 read | 没用到的代码一行不进窗口 |
| memory 按需 search | 失败案例库不 dump，只召回相关的 top-K |
| compaction 折叠 | 长会话不无限增长，旧消息压成摘要 |

### 几个易踩的细节

- **skill 缺 description 不会被加载**——`description` 是 progressive disclosure 的钥匙，写糊了等于这个 skill 不存在。好 description 要写「**做什么 + 何时用**」，别写「帮助处理 PDF」这种废描述。
- **`disable-model-invocation: true`** 可让 skill 不进系统提示（只能 `/skill:name` 手动调）——给那些「不该被模型自动触发」的 skill 用。
- **`/compact [instructions]`** 可定向压缩——长任务卡顿时，用它聚焦摘要重点，比等 auto-compaction 更可控。

> 一句话：**pi 把上下文编排拆成「常驻索引 + 按需展开 + 接近上限就折叠」三段。** 你要做的不是发明新机制，而是把信息放对层、写好每条 description、盯住 reserve。

---

## 七、反模式

把概念倒过来看，记住**不该怎么做**。

| 反模式 | 表现 | 后果 | 正解 |
|---|---|---|---|
| **整仓库塞上下文** | `cat **/*.ts` 灌进 prompt | 召收↓、账单↑↑、溢出 | `grep`/`find` 定位 → `read` 片段 |
| **永不裁剪** | 历史无限增长，等硬截断 | 早期指令丢失、漂移 | 开 compaction + 设 reserve |
| **记忆全量灌入** | memory dump 而非 search | 噪声↑、召回↓ | `memory_search` top-K 按需召回 |
| **system prompt 当仓库** | 把可按需加载的塞进系统提示 | 固定区膨胀，挤占每轮预算 | 铁律进 system，其余进 skills/memory |
| **工具结果原样保留** | 10k CI 日志整段进窗口 | 动态区爆炸 | 截断 + 摘要 + 去样板 |
| **大文件整读** | `read` 不带 offset/limit | 单文件吃掉大半预算 | 先 `grep` 再切片读 |

> 共同病根只有一个：**把窗口当硬盘。** 每条反模式都是「该放冷层的东西，硬塞进了最贵的热层」。治法一致——归位。

---

## 迁移清单

同一组概念，在不同 harness 里怎么落地。

| 概念 | pi | Claude Code | Cursor | Aider | 通用 harness |
|---|---|---|---|---|---|
| **固定区管理** | system prompt + `AGENTS.md` | `CLAUDE.md` + system | `.cursorrules` / `.cursor/rules` | conventions / `--message` | 自管 system 组装 |
| **skill 渐进披露** | `available_skills`(name+desc) + `read` | Agents/Skills 索引 + 按需 | rules 分文件 | repo map | 自建 name+desc 索引 + 按需展开 |
| **文件按需读** | `read`/`grep`/`find` | Read/Grep/Glob | @file / 内置检索 | repo map + 自动 | 自实现 retrieve-then-read |
| **记忆按需召回** | `memory_search` | memory/外部 MCP | 外部检索 | 无内建 | 接向量库 top-K |
| **裁剪策略** | compaction（摘要折叠） | 内置压缩 | 内置 | /clear + repo map | FIFO/LRU/摘要自选 |
| **reserve 预留** | `reserveTokens`(默认 16k) | 内置 | 内置 | 内置 | 自留 output/action 空间 |
| **手动压缩** | `/compact [instructions]` | `/compact` | /clear | /clear | 自实现 |

**带走三件**：渐进披露的分层思想、固定区/动态区/reserve 的预算三段、摘要折叠作为默认裁剪。这三样工具无关，换 harness 时直接复用设计。

---

## 下一步

上下文是 agent「这一步看到什么」的内存管理；下一步讲 agent「跨步骤、跨会话怎么活下来」——

- **下一篇（第 4 篇 / 共 10 篇）：[会话与运行时生命周期](./harness-engineering-runtime)** —— session/run/turn 模型、fork/resume、持久化与恢复。上下文裁剪管「窗口内」，运行时管「窗口外、轮次间、崩溃后」。
- **前一篇：[工具系统与工具总线](./harness-engineering-tools)** —— 工具结果（⑤层）怎么安全、并发地流回上下文。

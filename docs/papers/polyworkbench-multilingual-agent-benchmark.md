# PolyWorkBench：多语言长程 Agent 的真实战场

> **论文精读 · 第 6 篇**
> 论文：*PolyWorkBench: Benchmarking Multilingual Long-Horizon LLM Agents*
> arXiv:[2607.06008](https://arxiv.org/abs/2607.06008) · 2026.07 · 北京交通大学 & 腾讯微信 AI（实习工作）
>
> 与本站 [Harness Engineering 系列](../ai/harness-engineering-series) 的 **「harness 是一等变量」** 直接对话；同时戳中 [Loop Engineering 的韧性评估](../ai/loop-engineering-resilience-eval)。

---

## TL;DR

PolyWorkBench 拆掉了一个行业默契：**所有 agent benchmark 默认是单语的**。它造了 67 个**多语言长程工作流**任务（电商、知识工作、法律、本地化、制造），逼 SOTA agent 在「中→英→法」这种**跨语言链路**里跑完整条 reasoning→tool→output 闭环。

结论有三条，每一条都硬：

1. **基准仍很难**：最强的 Claude Opus 4.8 + ClaudeCode 才 0.921 Pass@1，过 0.79 的只有 3 个 entry，其余全部 < 0.77。
2. **harness 比 model 更决定分数**：同一个模型换 harness，Pass@1 浮动 **8–21 个点**。Opus 4.8 从 0.921 掉到 0.712，就因为换了 harness。
3. **LLM-as-judge 不可靠**：结构化打分 Grade 和确定性 Pytest 强相关（r=0.85），但 LLM 语义 Judge 只跟它们 r=0.18 / 0.13。

一句话：**「跑通」靠模型，「跑稳」靠 harness，「跑对」靠评估——而这三件事，多语言场景把它们全放大了。**

---

## 一、它戳中了什么盲区

先看一个被默认到不再被讨论的假设：

> 现有 agent benchmark（SWE-bench / WebArena / OSWorld）**默认整条执行链路在一个语言里**——reasoning、tool 调用、最终输出，全是同一种语言。

但真实工作流根本不是这样。一条跨境电商订单：中文的商品描述、英文的 API、法语的客服话术、日文的合规字段——**同一个 workflow 里语言是混的**。PolyWorkBench 把这种「混」显式建模成一个一等问题，并命名了它的核心机制：

> **Cross-lingual trajectory coupling（跨语言轨迹耦合）**

翻译成工程语言：错误**会跨语言边界传播**。模型在第 3 步把一个中文术语错译成英文，第 7 步的 tool 就拿到错的输入，第 12 步的输出就带着错的事实往下走。**这种长程跨语言误差，单语言 benchmark 的评估范式根本看不见。**

这一节最值钱的洞察是：多语言不是「再加一个维度」，而是**一根把 reasoning、tool use、generation 串起来的引线**——它让本来就难的 long-horizon 任务，又叠了一层**复利误差**。

呼应本站 [Loop Engineering 的抗退化篇](../ai/loop-engineering-antidegradation)：长程 loop 的头号敌人就是误差累积，而多语言把累积速度乘上了一个系数。

---

## 二、Benchmark 设计：67 任务 × 5 域 × 混合评估

### 2.1 任务结构

| 域 | 缩写 | 代表场景 |
|----|------|---------|
| Commerce | COM | 跨境电商、多语言订单处理 |
| Knowledge Work | KNW | 多语言文档整理、报告 |
| Legal Analysis | LEG | 跨语言合同审阅、合规 |
| Localization | LOC | 软件本地化、文案迁移 |
| Manufacturing | MFG | 多语言工单、规格同步 |

67 个任务，**全部要求**：处理异构多语言输入 → 迭代 reasoning → 调用外部 tool → 产出**结构化输出**。

任务准入门槛很硬：

> 每个任务在收录前，必须用 **≥3 个 agent/harness 各跑一遍**，并满足三条：(a) 确定性评估器能稳定区分正误；(b) 每个 ground-truth 事实都能从输入中找到；(c) **没有任何子任务可以靠「字符串拷贝」蒙混过关**——必须真做跨语言推理。

第 (c) 条尤其漂亮。它直接堵死了「模型抄输入当输出」的捷径，逼出真正的跨语言能力。

### 2.2 混合评估框架：三种信号交叉验证

这是全篇方法学上最值得抄的部分：

| 信号 | 类型 | 测什么 | 与 Grade 相关性 |
|------|------|-------|----------------|
| **Grade** | 结构化打分 | 字段级部分分（partial credit） | — |
| **Pytest** | 确定性可执行验证 | 功能正确性 | **r = 0.85** |
| **Judge** | LLM 语义评估 | 语义一致性 / 流畅度 | r = 0.18（与 Grade）/ 0.13（与 Pytest） |

关键发现藏在最后两列：**Grade 和 Pytest 高度一致**（因为 Grade 本来就在 Pytest 验证的结构元素上给部分分），而 **LLM Judge 几乎和它们不相关**。

这意味着什么？**用 LLM 当裁判评 agent，会评出一个跟「能不能跑对」几乎无关的分数。**

这条对正在搭 [评估观测系统](../ai/harness-engineering-observability) 的工程师是当头一棒：**别拿一个 LLM 去评另一个 LLM 的 agent，除非你已经证明这个 Judge 跟确定性信号对齐。** 否则你优化的不是 agent 能力，是 Judge 的偏好。

主指标：

- **Pass@1**：单次跑 67 任务的平均 Grade
- **Pass@3**：最多 3 次跑里的单任务最好成绩平均（衡量「采样余量」）
- 每任务超时 **1800 秒**（30 分钟）——这个预算本身就说明任务有多长程

---

## 三、实验：数字说话

### 3.1 主表（节选，按 harness 分组）

| Harness | Model | Pass@1 | Pass@3 |
|---------|-------|-------:|-------:|
| **ClaudeCode** | Claude Opus 4.8 | **0.921** | 0.927 |
| ClaudeCode | DeepSeek-v4-Flash | 0.796 | 0.814 |
| ClaudeCode | Qwen3.6-35B-A3B | 0.792 | 0.810 |
| ClaudeCode | Claude Opus 4.7 | 0.790 | 0.827 |
| ClaudeCode | Qwen3.6-27B | 0.752 | 0.801 |
| **OpenClaw** | GPT-5.5 | 0.776 | 0.917 |
| OpenClaw | Qwen-Agent-World | 0.762 | 0.783 |
| OpenClaw | Claude Opus 4.8 | 0.712 | — |
| OpenClaw | DeepSeek-v4-Flash | 0.708 | 0.816 |
| **Hermes** | Qwen-Agent-World | 0.762 | 0.796 |
| Hermes | DeepSeek-v4-Flash | 0.698 | 0.804 |
| Hermes | Qwen3.6-27B | 0.595 | 0.801 |
| **Codex** | DeepSeek-v4-Flash | 0.732 | 0.835 |

### 3.2 三个最反直觉的数字

**① Harness 抖动 = 8–21 个点**

同一个 Opus 4.8：
- ClaudeCode → **0.921**
- OpenClaw → **0.712**
- 跨度 **0.209**（21 个百分点）

Qwen3.6-27B 跨 3 个 harness 跨度 0.157；DeepSeek-v4-Flash 跨 4 个 harness 跨度 0.099。

**结论：换 harness 比换 model 抖得还狠。** 论文原文一句话最锋利：

> *Reporting a model's benchmark score without disclosing the harness is therefore not meaningful.*

→ **不报 harness 的模型跑分，没有意义。**

这正是本站 [Harness Engineering 系列](../ai/harness-engineering-series) 反复说的：harness 不是「外壳」，是性能的一等公民。PolyWorkBench 给了第一手证据。

**② Commerce dip（电商谷）**

强模型在 Knowledge / Legal / Manufacturing 都能稳在 0.85–0.90，但 Commerce 普遍跌到 **0.50–0.65**。

为什么？Commerce 任务的特征是：**结构化字段多、跨语言一致性要求严、错一个字段整单废**。它把「单点错误 → 全任务失败」的放大效应顶到了天花板。

这对应 [Loop Engineering 韧性评估篇](../ai/loop-engineering-resilience-eval) 讲的：**长程任务的失败模式不是线性的，是相变的**——某些任务类型会触发雪崩。

**③ Pass@3 − Pass@1 的巨大余量**

很多 entry 的 Pass@3 比 Pass@1 高 5–14 个点（比如 GPT-5.5/OpenClaw：0.776 → 0.917）。

意思：**模型不是不会，是不稳定。** 同一个任务跑 3 次能蒙对，但跑 1 次会挂。这是 [Loop Engineering](../ai/loop-engineering-resilience-eval) 里讲的「随机成功」陷阱——**靠运气过的 loop，不是真过。**

---

## 四、为什么它重要：与本站 Harness / Loop 工程的对照

| PolyWorkBench 发现 | 本站对应概念 | 关系 |
|------------------|------------|------|
| Harness 比 model 更决定分数 | [Harness Engineering 系列](../ai/harness-engineering-series) | 给了「harness 是一等变量」首个大规模实证 |
| LLM Judge 与确定性信号低相关 | [可观测性](../ai/harness-engineering-observability) | 警告：LLM-as-judge 评估 agent 不可信 |
| Cross-lingual trajectory coupling | [抗退化篇](../ai/loop-engineering-antidegradation) | 多语言 = 误差累积的加速器 |
| Commerce dip 的相变失败 | [韧性评估篇](../ai/loop-engineering-resilience-eval) | 长程失败非线性的实证 |
| Pass@3 − Pass@1 大余量 | [韧性评估篇](../ai/loop-engineering-resilience-eval) | 「随机成功」≠「真过」 |
| 任务准入用 ≥3 harness 验证 | [评估观测](../ai/harness-engineering-observability) | 评估器本身要先被评估 |

特别值得停一下的是最后一行：**PolyWorkBench 在收任务时，先用 ≥3 个 harness 跑一遍，确认评估器能稳定区分正误——它先把「评估器」当成一个被评估的对象。**

这跟本站反复强调的「**meta-eval**」是一个东西：**你用来评 agent 的工具，自己得先及格。** 否则你所有的优化都在拟合一个坏尺度。

---

## 五、架构一图流

```
        ┌──────────────────────────────────────────┐
        │         PolyWorkBench (67 tasks)         │
        │  COM · KNW · LEG · LOC · MFG             │
        │  异构多语言输入 → 迭代 reasoning          │
        │  → tool 调用 → 结构化输出                 │
        └────────────────┬─────────────────────────┘
                         │ 每任务 1800s 超时
                         ▼
   ┌───────────────────────────────────────────────────┐
   │   同一 model 在 4 个 harness 下各跑一遍           │
   │   ClaudeCode · OpenClaw · Hermes · Codex          │
   │   (harness 间 Pass@1 抖动 8–21 点)                │
   └────────────────┬──────────────────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────────────────┐
   │        混合评估（3 信号交叉验证）                  │
   ├───────────────────────────────────────────────────┤
   │  Grade (结构化部分分) ──┐                          │
   │  Pytest (确定性)  ──────┼─ r=0.85 (强对齐)        │
   │  Judge (LLM 语义) ──────┴─ r=0.18 (几乎不相关)    │
   └───────────────────────────────────────────────────┘
                    │
                    ▼
   ┌───────────────────────────────────────────────────┐
   │  产出：model × harness 完整矩阵（不抹平 harness）  │
   │  + per-domain / per-language 剖面                  │
   │  + Pass@3 − Pass@1 采样余量                        │
   └───────────────────────────────────────────────────┘
```

---

## 六、启发、局限与个人点评

### 启发

1. **harness 该上 CI**。PolyWorkBench 证明了「换 scaffold = 换分数」。那么项目里的 agent harness 不该只当「跑代码的工具」，该当**一个被版本化、被回归测试的性能变量**。每次改 harness 配置（系统提示、工具描述、循环上限），都该在固定任务集上跑一遍对照——这就是本站 [Harness Engineering](../ai/harness-engineering-series) 一直主张的「**把 harness 当产品**」。
2. **评估器优先级 > 模型优先级**。Judge r=0.18 那行是核弹级警告。很多人调 agent 的方式是「换更强的模型」，但如果评估器本身是坏的，换模型只是在拟合噪声。**先写确定性 Pytest，再用 LLM Judge 补语义，且永远把 Judge 当辅助信号。**
3. **「随机成功」必须显式度量**。Pass@3 − Pass@1 这个差值是个被低估的指标——它直接告诉你「这个 agent 是真稳还是靠运气」。自己项目里也该有这个对照：**同一任务跑 3 次，看方差。**
4. **任务准入门槛的设计本身是范本**。「≥3 harness 验证 + 不能靠字符串拷贝蒙混」这两条，直接搬进自己造 benchmark / 测试集的流程里。

### 局限与疑问（诚实）

- **成本没报**。67 任务 × 18 entry × 1800s 超时，token 量和 API 花费必然不低。摘要没给单位 Pass@1 的钱——这正是 [Loop Engineering 成本工程篇](../ai/loop-engineering-cost-engineering) 最该追问的。Opus 4.8/ClaudeCode 那个 0.921 的含金量，需要配上「每分花了多少」才算完整。
- **Judge 弱相关的根因没深挖**。是 Judge 模型本身不行，还是 Judge prompt 设计差，还是多语言场景下 Judge 普遍失灵？论文给了现象（r=0.18），但没给拆解。这对工程落地是关键：**如果换一个更强的 Judge 模型能拉到 r=0.5，那 LLM-as-judge 还能救；如果换什么都不行，那这条路就别走了。**
- **harness 间差异的归因不清**。Opus 4.8 在 ClaudeCode（自家 scaffold）下最强，是不是因为 ClaudeCode 对 Claude 模型有针对性优化？这种「model-harness 联合优化」的存在，会让「harness 是一等变量」的结论混入「自家 harness 加成」的噪声。论文没拆开。
- **67 任务的样本量偏小**。5 个域平均每域 ~13 任务，单域内的方差能否支撑「Commerce dip」这种结论？需要看置信区间。
- **本地化方向单一**。多语言工作流的痛点里，「低资源语言」的失败模式和「中→英→法」可能完全不同。论文的多语言分布需要看附录确认覆盖度。

这些不是否定，而是**精读该有的追问**。

### 个人点评

PolyWorkBench 最让我欣赏的是它的**诚实**：它没有为了好看把分数抹平，反而把 model × harness 的完整矩阵摆出来，主动暴露「换 harness 分数就抖」这个让行业不舒服的事实。那句 *「不报 harness 的跑分没有意义」*，应该贴在每个发 agent benchmark 的仓库 README 顶上。

对一个正在搭 agent 系统的工程师，这篇的价值不在「抄它的任务设计」，而在**校准三件事**：

1. 你的 harness 是不是被当成了一个**可变量**，而不是固定背景？
2. 你的评估里，LLM Judge 占了多少权重？它和确定性信号对齐过吗？
3. 你报的成功率，是 Pass@1 还是 Pass@3？如果是后者，你知道自己有多少是靠运气过的吗？

把这三个问题答清楚，你的 agent 系统就比 90% 的「我跑通了」项目扎实。

---

## 附：信息源

- 论文原文：[arXiv:2607.06008](https://arxiv.org/abs/2607.06008)（v2, 09 Jul 2026）
- 作者：Hongliang Li, Yijin Liu, Zhiwei Zhang, Zihe Liu, Xinyue Lou, Jinan Xu, Fandong Meng, Kaiyu Huang
- 单位：北京交通大学 · 腾讯微信 AI（实习）
- 选题来源：[arXiv cs.AI recent](https://arxiv.org/list/cs.AI/recent) + [VoltAgent/awesome-ai-agent-papers](https://github.com/VoltAgent/awesome-ai-agent-papers)

> 下一篇想读什么方向？多 agent 编排 / agent 记忆 / 工具调用 / 评估观测 / agent 安全，欢迎在 [GitHub](https://github.com/choufeng/xiajia.im) 留言。

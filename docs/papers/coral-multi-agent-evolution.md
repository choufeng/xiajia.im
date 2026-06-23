# CORAL：让多 Agent 自己「进化」的开放式发现框架

> **论文精读 · 第 1 篇**
> 论文：*CORAL: Towards Autonomous Multi-Agent Evolution for Open-Ended Discovery*
> arXiv:[2604.01658](https://arxiv.org/abs/2604.01658) · 2026.04 · Human-Agent-Society · [代码](https://github.com/Human-Agent-Society/CORAL)
>
> 与本站 [Loop Engineering 系列](../ai/loop-engineering-series) 的 **Memory / Multi-Loop / Meta-Loop** 直接对话。

---

## TL;DR

CORAL 把「进化搜索」里写死的控制规则，**全部交给长程运行的多 agent 自己**。靠三件套跑通开放式发现：**共享持久记忆 + 异步多 agent + 心跳干预**，外加四道工程护栏兜底。10 个任务刷 SOTA，改进率比固定进化搜索高 **3–10×**，用的评估次数还更少。

一句话：**它把「谁该探索、探索什么、何时合作」从代码脚本，搬进了 agent 自己的脑子。**

---

## 一、它想解决什么问题

先理解「开放式发现（open-ended discovery）」。

很多重要问题**没有标准答案**——一个 GPU kernel 怎么更快？一个算法怎么更省？这类问题没有 ground-truth 终点，进步只能靠**持续搜索 + 知识积累**。演化计算（进化算法）是经典解法：变异、交叉、选择，一代代试。

LLM 出现后，人们让 LLM 当「变异/交叉」的大脑，诞生了 EoH、FunSearch 一类 **LLM-based evolution**。但 CORAL 戳中一个痛点：

> **这些方法仍在用「固定启发式 + 硬编码探索规则」控制整个流程。**

翻译成工程语言：selection、mutation、crossover、何时停止、探索还是利用——全是人写死的 if/else 和调度脚本。LLM 只是被调用着「生成一个新解」，**自主性被脚手架卡死了**。

CORAL 的判断很干脆：既然 agent 已经能长程运行、能反思、能协作，那控制权就该**还给 agent**。

---

## 二、核心思想：从「刚性控制」到「Agent 自主」

这是全文的灵魂，值得单独拎出来。

| 维度 | 旧范式（LLM-based evolution） | CORAL |
|------|------------------------------|-------|
| 控制流 | 硬编码脚本（GA/ES 规则） | 长程运行 agent 自决 |
| 探索方向 | 预定义变异算子 | agent 自己判断 |
| 协作 | 固定拓扑 / 中心调度 | 异步 + 共享记忆涌现 |
| 调度 | 外部 cron / 固定代数 | **心跳，且 agent 能改自己的心跳** |
| 知识 | 每代重置或简单存档 | 共享持久记忆，跨 agent 复用 |

注意最后一行——这正好呼应本站 [Loop Engineering 的 Memory 系统](../ai/loop-engineering-memory) 那句反复强调的话：

> **「没有显式 memory，loop 工程会退化成在一个上下文窗口里做子串管理。」**

CORAL 在「进化搜索」这个场景里，把同一件事又验证了一遍：**没有跨 agent、跨代的持久记忆，进化就退化成无脑重试。**

下面三个机制，是这个范式转变的具体落地。

---

## 三、三大机制逐个拆

### 3.1 共享持久记忆（Shared Persistent Memory）—— 协作的「黑板」

多 agent 协作最大的难题：怎么让 A 的成果被 B 用上？

CORAL 的答案是一个**所有 agent 都能读写的共享记忆层**，存的是 artifacts（产物）、经验、中间结果。论文附录给出了具体实现，其中最值得玩味的是：

> **Symlink architecture（软链接架构）**

不是搞一个中心数据库，而是用**文件系统软链接**搭共享。这设计很巧：

- 每个 agent 有**自己的工作空间视角**，又能 symlink「看到」别人的成果
- artifact 天然落在文件系统里，**版本化、可 diff、可回滚**
- 并发模型直接建立在文件系统原语上，不引入额外中间件

这跟本站 [Harness Engineering 的沙箱与 worktree](../ai/harness-engineering-security)、以及 pi 用 git worktree 隔离并行任务的思路，是同一个工程审美：**用文件系统已有的能力，而不是再造轮子。**

论文的机制分析（mechanistic analysis）也证实：性能收益很大一部分正来自 **knowledge reuse**——后到的 agent 不必从零探索，直接复用前人的 artifact。

### 3.2 异步多 Agent 执行 —— 并发探索

多个 agent **同时**跑，而不是排队。

这条听起来平淡，实则是开放式发现的关键：搜索空间太大，串行试太慢。并发让「探索不同方向」天然发生。配合共享记忆，并发产生的多条路径**互不阻塞**，还能互相喂养成果。

对应到本站，这就是 [Multi-Loop 协调](../ai/loop-engineering-multi-loop) + [Scheduling 模式](../ai/loop-engineering-scheduling) 的实证版本：**多个 loop 并行，靠共享状态协调，而不是靠中心锁。**

### 3.3 心跳干预（Heartbeat-Based Interventions）—— 最漂亮的一笔

这是我认为全篇最精妙的设计。

多 agent 协调的老大难：**阻塞**（等别人）或**冲突**（抢资源）。传统解法要么加锁（慢），要么消息队列（重）。

CORAL 用 heartbeat：调度器周期性地「戳」一下 agent，agent 自己决定怎么响应。本质是一种**非阻塞的协调原语**。

但真正神来一笔是附录里的这行：

> **Agent-modifiable heartbeats（agent 可自修改的心跳）**

agent **能改自己的心跳频率**。

这意味着什么？agent 卡住时可以加快心跳、多被戳几次；稳定输出时放慢心跳、省资源。**调度频率本身成了 agent 可调节的参数**——这是自调度的雏形，也是 [Meta-Loop](../ai/loop-engineering-meta-loop)「loop 改 loop 自己」在微观层面的体现。

把控制权交给 agent，连「多久被唤醒一次」都交出去——这是把第二章的范式转变贯彻到了底。

---

## 四、四道工程护栏：让「自主」不等于「失控」

给 agent 极大自主，最容易翻车。CORAL 配了四道安全网，这部分最能体现工程成熟度：

| 护栏 | 作用 | 对应本站 |
|------|------|----------|
| **Isolated Workspaces** 隔离工作空间 | 各 agent 改各的，互不污染 | [沙箱与安全](../ai/harness-engineering-security) |
| **Evaluator Separation** 评估器分离 | 评估与生成分离，防作弊/防偏 | [韧性与评估](../ai/loop-engineering-resilience-eval) |
| **Resource Management** 资源管理 | 限算力/限并发，防失控烧钱 | [成本工程](../ai/loop-engineering-cost-engineering) |
| **Agent Session & Health Management** | session 持久 + **dead agent restart** | [韧性与评估](../ai/loop-engineering-resilience-eval) |

最后一条尤其值得停一下：**dead agent restart（死 agent 重启）**。

长程运行的 agent 必然会挂（OOM、超时、异常）。CORAL 不假装这不会发生，而是**显式管理 agent 生命周期**——挂了就重启，session 持久化保证重启后不丢上下文。这正是 [Loop Engineering 韧性篇](../ai/loop-engineering-resilience-eval) 讲的核心：**韧性不是不出错，是出了错能接着跑。**

---

## 五、架构一图流

```
┌──────────────────────────────────────────────────┐
│           Shared Persistent Memory               │
│      (symlink 架构 · 跨 agent 知识复用)           │
│      artifacts · 经验 · 中间结果                  │
└─────▲────────▲────────▲────────▲─────────────────┘
      │ 读/写   │ 读/写  │ 读/写  │ 读/写
┌─────┴─────┐ ┌┴──────┐ ┌┴──────┐ ┌┴──────┐
│  Agent A  │ │Agent B│ │Agent C│ │Agent D│   ← 异步并发
│  (异步)   │ │(异步) │ │(异步) │ │(异步) │
└─────┬─────┘ └───┬───┘ └───┬───┘ └───┬───┘
      │heartbeat   │         │         │
      ▼            ▼         ▼         ▼
┌──────────────────────────────────────────────────┐
│         Heartbeat Scheduler (非阻塞)              │
│   trigger → delivery · agent 可自修改频率          │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│   Safeguards 护栏层                               │
│  隔离工作空间 · 评估器分离 · 资源管理              │
│  session 持久 · dead agent restart                │
└──────────────────────────────────────────────────┘
```

---

## 六、实验：数字说话

| 指标 | 结果 |
|------|------|
| 任务覆盖 | 数学、算法、系统优化，共 **10 个任务刷 SOTA** |
| 改进率 | 比固定进化搜索基线高 **3–10×** |
| 效率 | **评估次数远少于**基线（更少试错，更多产出） |
| 标志性任务 | Anthropic kernel engineering：**4 个协同 agent 把最佳分数从 1363 → 1103 cycles** |
| 机制归因 | 收益主要来自 **knowledge reuse + 多 agent 探索与通信** |

kernel engineering 那个数字最有冲击力：4 个 agent 协同进化，硬生生把一个公开 benchmark 的最好成绩提升了近 19%。这不是微调，是**范式红利**。

---

## 七、为什么它重要：与本站 Loop Engineering 的对照

CORAL 最让我兴奋的，不是某个单一技巧，而是**它把本站 Loop Engineering 系列里多个抽象概念，用一个框架全跑通了，还给了真实数字**：

| CORAL 机制 | 本站对应概念 | 关系 |
|-----------|-------------|------|
| Shared Persistent Memory | [Memory 系统](../ai/loop-engineering-memory) | CORAL 用 symlink 落地「记忆是 loop 脊柱」 |
| Asynchronous Multi-Agent | [Multi-Loop 协调](../ai/loop-engineering-multi-loop) + [Scheduling](../ai/loop-engineering-scheduling) | 并发探索 = 多 loop 并行 |
| Agent-modifiable Heartbeat | [Meta-Loop](../ai/loop-engineering-meta-loop) | agent 改自己的心跳 = 自我演进的雏形 |
| Dead Agent Restart | [韧性与评估](../ai/loop-engineering-resilience-eval) | 死了能重启 = 韧性 |
| Isolated Workspaces | [沙箱与安全](../ai/harness-engineering-security) | = pi 的 worktree 隔离 |
| Evaluator Separation | [韧性与评估](../ai/loop-engineering-resilience-eval) | 执行与评估分离 |
| 刚性 → 自主 | [Meta-Loop 核心命题](../ai/loop-engineering-meta-loop) | loop 从「会跑」到「会改自己」 |

读 Loop Engineering 系列是在搭**理论骨架**；读 CORAL 是看这套骨架**在真实 benchmark 上长出血肉**。两者互为镜像。

---

## 八、启发、局限与个人点评

### 启发

1. **控制权该下放时就下放**。很多 agent 系统还在用「人写调度脚本 + LLM 当生成器」的老套路。CORAL 证明：把探索/协作/调度的决策交给 agent，收益是数量级的。
2. **共享记忆用文件系统就够了**。symlink 架构是个反直觉的好设计——别急着上数据库，先看文件系统能不能搞定。
3. **心跳 + 可自修改 = 优雅的非阻塞协调**。比加锁、比消息队列都轻，还自带自适应。这个模式可以直接搬到自己的多 agent 系统里。

### 局限与疑问（诚实）

- **成本没在摘要里交代**。长程运行 + 多 agent，API/token 消耗必然不低。论文没提单位改进花了多少钱——这恰恰是 [成本工程](../ai/loop-engineering-cost-engineering) 最该追问的。3–10× 改进率若伴随 10× 成本，性价比就得重算。
- **「dead agent restart」的细节**。agent 怎么算「死」？重启后上下文恢复到什么粒度？会不会丢掉刚探索到一半的关键状态？摘要没展开，需要看全文的 session persistence 设计。
- **开放式发现的评估本身是难题**。10 个任务的 baseline 强度如何？「SOTA」是相对什么？没有 ground-truth 的场景下，改进的「含金量」需要更仔细的对照。
- **agent 自修改心跳会不会退化**。如果所有 agent 都倾向「放慢心跳省力」，系统会不会集体摸鱼？摘要的 mechanistic analysis 是否覆盖了这个博弈，需要读附录。

这些不是否定，而是**精读该有的追问**。一篇好论文值得带着这些问题去读全文。

### 个人点评

CORAL 抓住了一个真问题（开放式发现的控制权），给了一个干净利落的解（三大机制 + 四道护栏），还在真实 benchmark 上跑出了硬数字。更难得的是，它的每一个设计选择都**经得起工程审美的推敲**——symlink 而非数据库、心跳而非加锁、护栏而非假装不出错。

对正在搭 agent / loop 系统的工程师，这篇论文的价值不在「抄它的代码」，而在**校准你的设计直觉**：当你在写第 N 个调度 if/else 时，停下来问一句——**这件事，能不能让 agent 自己决定？**

---

## 附：信息源

- 论文原文：[arXiv:2604.01658](https://arxiv.org/abs/2604.01658)
- 代码：[github.com/Human-Agent-Society/CORAL](https://github.com/Human-Agent-Society/CORAL)
- 作者：Ao Qu, Han Zheng, Zijian Zhou 等（Human-Agent-Society）
- 选题来源：[VoltAgent/awesome-ai-agent-papers](https://github.com/VoltAgent/awesome-ai-agent-papers)（Multi-Agent 类）

> 下一篇想读什么方向？多 agent 编排 / agent 记忆 / 工具调用 / 评估观测 / agent 安全，欢迎在 [GitHub](https://github.com/choufeng/xiajia.im) 留言。

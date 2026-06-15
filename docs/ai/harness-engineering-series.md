# Harness Engineering 系列总纲

> 本页是 Harness Engineering 系列的总索引与学习地图。如果说 [Loop Engineering](./loop-engineering-series) 讲的是「发动机怎么转」，本系列讲的就是「把发动机装上车能跑」——**承载 AI Agent 的外壳工程**。
>
> 全系列以 pi coding agent 为落地载体，但抽象层适用于 Claude Code、Cursor、Codex、Aider、Devin 等一切 agent harness。

---

## 这系列讲什么

**Harness（外壳 / 承载框架）** 是包裹在 LLM 之外、让它从「聊天框」变成「能干活的 agent」的那一层工程。一个最小可用的 harness 由三块不可分割的组件构成：

1. **Loop 容器** —— 把「感知 → 思考 → 行动 → 反馈」的循环跑起来（这一块归 [Loop Engineering](./loop-engineering-series) 管）。
2. **工具总线** —— 把「读文件、跑命令、调 API」的能力安全地接进 LLM。
3. **上下文预算** —— 在有限的 token 窗口里，编排「系统提示、技能、文件、记忆」的注入与裁剪。

围绕这三块，harness 还要做：会话生命周期、子代理调度、扩展与技能加载、记忆持久化、沙箱与权限、可观测性、协议互操作（MCP/A2A）、分发打包。

**一句话**：Loop 决定 agent「怎么想」，Harness 决定 agent「被什么托着跑」。

---

## Loop vs Harness：两条工程主线

很多人把这两者混为一谈，但它们是正交的两个工程维度。区分清楚，才能定位每一个真实问题。

| 维度 | Loop Engineering | Harness Engineering |
|------|------------------|---------------------|
| **关注对象** | 循环本身（内在动力学） | 承载循环的壳（外在框架） |
| **核心问题** | 怎么转、转多久、越转越好还是越坏 | 转的时候工具从哪来、上下文塞什么、断了怎么续、跑飞了怎么收 |
| **典型原语** | Trigger / Comprehend / Act / Feedback | 工具总线 / 上下文预算 / 会话运行时 / 调度容器 |
| **类比** | 发动机的燃烧循环 | 底盘 + 悬挂 + 仪表盘 + 油路 |
| **代表话题** | 衰减、韧性、多 loop 协调、Meta-Loop | MCP、context window、worktree、token 经济、session fork |
| **失败症状** | loop 空转、重复、漂移 | 工具报错、上下文爆炸、session 丢、并行冲突 |

两者必须配套：好的 loop 跑在烂 harness 上会频繁崩；好的 harness 没有好 loop 则空有壳子。本系列默认你已读过 [Loop Engineering 概念](./loop-engineering)，聚焦「壳」这一侧。

---

## 系列地图（10 篇）

| # | 篇 | 文件 | 解决问题 |
|---|----|------|----------|
| 0 | **总纲** | 本文 | 定边界、给地图 |
| 1 | [Harness 是什么](./harness-engineering) | `harness-engineering` | 定义、三组件、与 chatbot/SDK 的区分、范式迁移 |
| 2 | [工具系统与工具总线](./harness-engineering-tools) | `harness-engineering-tools` | tool calling 协议、schema 校验、并发与中断、MCP 接入 |
| 3 | [上下文工程与 Token 预算](./harness-engineering-context) | `harness-engineering-context` | 注入层次、裁剪策略、压缩与摘要、越界防护 |
| 4 | [会话与运行时生命周期](./harness-engineering-runtime) | `harness-engineering-runtime` | session/run/turn 模型、fork/resume、持久化与恢复 |
| 5 | [子代理调度容器](./harness-engineering-subagents) | `harness-engineering-subagents` | chain/parallel/fanout、acceptance 契约、worktree 隔离、控制平面 |
| 6 | [扩展与技能加载机制](./harness-engineering-extensions) | `harness-engineering-extensions` | extension vs skill、加载时序、热重载、冲突治理 |
| 7 | [记忆持久化分层](./harness-engineering-memory) | `harness-engineering-memory` | 短期/长期、memory/user/project、检索、consolidation |
| 8 | [沙箱、权限与安全模型](./harness-engineering-security) | `harness-engineering-security` | 工具权限、bash 沙箱、不可逆守卫、IRL 损坏防护 |
| 9 | [可观测性与可调试性](./harness-engineering-observability) | `harness-engineering-observability` | tracing/metrics/logging、session replay、token 计量 |
| 10 | [协议层与分发](./harness-engineering-protocols-distribution) | `harness-engineering-protocols-distribution` | MCP/A2A/Intercom 互操作、SDK、npm 打包、版本升级 |

**分册速览**：

- **第一册 定义（1）** —— 建立「壳」的心智模型。
- **第二册 三大支柱（2-4）** —— 工具、上下文、运行时，harness 的承重墙。
- **第三册 扩展面（5-7）** —— 子代理、扩展技能、记忆，让 harness 会派活、会加载、会记。
- **第四册 守护面（8-9）** —— 安全与可观测，让 harness 不闯祸、可查证。
- **第五册 互操作（10）** —— 标准协议与分发，让 harness 走出单机。

---

## 前置与阅读顺序

```
[LLM 基础] → [Loop Engineering 概念] → 本系列总纲
                                          │
            ┌─────────────────────────────┼──────────────────────────┐
            ▼                             ▼                          ▼
       1.是什么                      2-4.三大支柱               5-7.扩展面
                                          │                          │
                                          ▼                          ▼
                                     8.安全  9.可观测  ←─────  相互依赖
                                          │
                                          ▼
                                  10.协议与分发
```

- **必读前置**：[LLM 基础](./llm-basics)、[Loop Engineering 概念](./loop-engineering)。
- **线性读者**：从第 1 篇顺序读到第 10 篇。
- **实战读者**：搭 harness 时卡在哪就读哪——工具卡住读 2，session 丢读 4，子代理乱读 5，token 爆读 3。
- **架构决策者**：直接读 1（定义）+ 10（协议与分发），判断要不要自建、能不能复用。

---

## 落地载体与符号约定

| 约定 | 说明 |
|------|------|
| **落地载体** | pi coding agent。代码示例以 pi 的实际 API（`registerTool`、subagent、extension、skill、memory）为准。 |
| **抽象迁移** | 每篇末「迁移清单」一节，把 pi 的做法映射到 Claude Code / Cursor / 通用 harness。 |
| **原语命名** | Loop 原语用大写首字母（Trigger/Act）；Harness 组件用中文名（工具总线/上下文预算）。 |
| **代码块** | TypeScript 为主，shell 次之，配置用对应格式。 |
| **图示** | 用 ASCII / Mermaid，不依赖外部图片。 |

---

## 与其他系列的关系

- **Loop Engineering 系列**：姊妹篇，讲「循环」。本系列讲「壳」。多处交叉引用。
- **Skill Graph 改造方案**：本系列第 6 篇（扩展与技能加载）的上游设计稿。
- **PI 教程**：用户视角的 how-to；本系列是工程视角的 why & how。

---

> 下一篇：[1. Harness 是什么](./harness-engineering) —— 从「聊天框」到「能干活的 agent」，中间到底多了一层什么。

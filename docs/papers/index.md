# 论文研读

> 不搬运新闻，只做精读。每篇拆一篇 AI / Agent 前沿论文——提炼核心思想、解读关键设计、落到工程启发。

---

## 为什么开这个栏目

AI 论文每天几百篇，多数是噪声。本栏目只挑**最新、有热度、对工程有启发**的论文，做一件事：

> **把论文读薄，把核心读厚。**

- **读薄**：一句话讲清它解决什么问题
- **读厚**：核心思想逐个拆，不止「是什么」，更讲「为什么这样设计」

选题聚焦 **Agent / Harness 工程层**——多 agent 编排、记忆、工具、评估、安全。与本站 [AI 板块](../ai/index) 的 [Loop Engineering](../ai/loop-engineering-series)、[Harness Engineering](../ai/harness-engineering-series) 系列互相印证：**理论搭骨架，论文给实证。**

## 精读模板

每篇固定结构：

| 模块 | 作用 |
|----|------|
| TL;DR | 一句话定位 |
| 解决什么问题 | 背景与痛点 |
| 核心思想 | 重点深挖，1–N 个 key insight |
| 方法 / 架构 | 图解（表格 + ASCII） |
| 实验与结果 | 数字说话 |
| 工程对照 | 与本站已有系列的映射 |
| 启发与局限 | 个人点评 |

## 论文从哪来

| 来源 | 用途 |
|------|------|
| [Hugging Face Daily Papers](https://huggingface.co/papers) | 每日热榜，看社区点赞 |
| [arXiv](https://arxiv.org/list/cs.AI/recent) (cs.AI / cs.CL / cs.MA) | 全量源头 |
| Sebastian Raschka 年度论文清单 | 权威人工策展 |
| [VoltAgent/awesome-ai-agent-papers](https://github.com/VoltAgent/awesome-ai-agent-papers) | arXiv agent 论文周筛 |
| 顶会 Best Paper（NeurIPS / ICML / ICLR / ACL） | 权威背书 |

## 论文清单

| 论文 | 主题 | 时间 |
|------|------|------|
| [CORAL：让多 Agent 自己「进化」](./coral-multi-agent-evolution) | 开放式发现 · 多 agent 自主进化 | 2026.04 |
| [AOHP：Agent 原生操作系统](./aohp-os-agent-harness) | OS 级 harness · agent 作为一等公民 | 2026.06 |
| [EDV：经验学习的写入护栏](./edv-experience-verify) | 记忆工程 · 自我确认陷阱与共识验证 | 2026.06 |
| [MemGUI：上下文即动作](./memgui-context-management) | 上下文工程 · 长程任务的主动管理 | 2026.06 |
| [Skill-MAS：可进化的编排技能](./skill-mas-meta-skill) | MAS · 编排能力抽成可迁移 Meta-Skill | 2026.06 |

> 持续更新。下一本读什么，欢迎在 [GitHub](https://github.com/choufeng/xiajia.im) 留言建议。

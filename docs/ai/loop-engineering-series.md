# Loop Engineering 系列总纲

> 本页是 Loop Engineering 系列的**总索引与学习地图**。系列目标是构建一套完整、可落地的 Loop Engineering 知识体系——从「是什么」到「怎么长期自驱动且越跑越好」。
>
> 全系列以 pi coding agent 为落地载体，以 [Cobus Greyling 的 loop-engineering 仓库](https://github.com/cobusgreyling/loop-engineering)、[Addy Osmani 的 canonical essay](https://addyosmani.com/blog/loop-engineering/)、[Mem0 的 Memory-First 视角](https://mem0.ai/blog/loop-engineering-for-ai-agents-memory-first-design) 为理论根基。

---

## 系列全景（25 篇）

### 第一分册：基础（1-2）
建立心智模型，跑通第一个 loop。

| # | 篇 | 解决问题 |
|---|----|----------|
| 1 | [Loop Engineering 概念](./loop-engineering) | 是什么、六原语、范式迁移 |
| 2 | [pi L1 落地](./loop-engineering-on-pi) | 手把手搭第一个 Daily Triage loop |

### 第二分册：进阶设计（3-5）
让 loop 安全、会记、会协调。

| # | 篇 | 解决问题 |
|---|----|----------|
| 3 | [L3 设计方案](./loop-engineering-l3-design) | 无人值守自治的六层安全工程 |
| 4 | [Memory 系统](./loop-engineering-memory) | 跨 run 记忆的四层架构 |
| 5 | [Multi-Loop 协调](./loop-engineering-multi-loop) | 多 loop 不打架的五铁律 |

### 第三分册：系统接口（6）
让 loop 接得住异构输入。

| # | 篇 | 解决问题 |
|---|----|----------|
| 6 | [网关层](./loop-engineering-gateway) | CLI/Web/Slack 统一入口，三层解耦 |

### 第四分册：持续运营（7-9）
让 loop 不衰、会进化、跑得稳。

| # | 篇 | 解决问题 |
|---|----|----------|
| 7 | [反衰减](./loop-engineering-antidegradation) | 对抗熵增的四种机制 |
| 8 | [Meta-Loop 自我演进](./loop-engineering-meta-loop) | loop 改 loop 的安全设计 |
| 9 | [韧性与评估](./loop-engineering-resilience-eval) | 不死、不坏、可证 |

---

## 扩展规划（10-25，本次新增）

### 第五分册：原语深挖（10-13）
把六原语逐一拆透——每篇专注一个原语的设计哲学与 pi 实现。

| # | 篇 | 核心 |
|---|----|------|
| 10 | Sub-agent 编排模式 | chain/parallel/fan-out/review-loop，acceptance 契约，worktree/async |
| 11 | Skills 工程化 | skill 即代码，progressive disclosure，反模式，知识库管理 |
| 12 | Worktree 并行工程 | 并行隔离模型，冲突避免，cleanup，资源治理 |
| 13 | Scheduling 模式 | cron/event/webhook/混合，事件驱动 vs 轮询，self-cleanup |

### 第六分册：垂直模式实战（14-18）
把通用框架落到具体 loop 模式，每个含可套用的 skill/state/schedule。

| # | 篇 | 模式 | 级别 |
|---|----|------|------|
| 14 | PR Babysitter 实战 | PR review/rebase/merge 看护 | L1→L2 |
| 15 | Dependency Sweeper 与供应链安全 | 依赖升级 + CVE 响应 | L2 |
| 16 | Issue Triage 实战 | issue 分类/去重/路由 | L1 |
| 17 | Changelog Drafter & Post-Merge Cleanup | 轻量收尾 loop 组合 | L1 |
| 18 | Documentation Loop（扩展模式） | 文档自动维护 | L1→L2 |

### 第七分册：方法论与思想（19-21）
深挖 Loop Engineering 的三个核心「债」概念——它们是 loop 工程的灵魂。

| # | 篇 | 核心 |
|---|----|------|
| 19 | Intent Debt 与 Skill 设计哲学 | 冷启动问题，意图如何持久化 |
| 20 | Comprehension Debt 管理 | loop 产的可读，强制阅读节奏 |
| 21 | Cognitive Surrender：Loop 时代人的角色 | 反投降，人的新定位 |

### 第八分册：工程实践（22-23）
落地细节——让 loop 可观测、可负担。

| # | 篇 | 核心 |
|---|----|------|
| 22 | Loop 可观测性深度 | tracing/metrics/logging 三支柱，debug loop |
| 23 | Loop 成本工程 | token 经济学，模型路由，预算预测 |

### 第九分册：组织与生态（24-25）
跳出单 loop/单工具，看全局。

| # | 篇 | 核心 |
|---|----|------|
| 24 | 跨工具对比 | pi vs Claude Code vs Codex vs Cursor 的原语矩阵 |
| 25 | 团队引入 Loop 的路线图 | 从单人尝鲜到组织级落地 |

---

## 阅读路径建议

```
入门者:    1 → 2 → 14/16（挑一个模式练手）
实践者:    1 → 2 → 3 → 4 → 5 → 6
运维者:    7 → 8 → 9 → 22 → 23
架构师:    10 → 11 → 24 → 25
想深思考:  19 → 20 → 21
```

## 执行说明

本系列 1-9 已发布。10-25 共 16 篇由子 agent 协作生产，分批落地：
- 批 1（原语深挖 4 篇）：worker 并行
- 批 2（垂直模式 5 篇）：worker 并行
- 批 3（方法论 3 篇）：worker 并行
- 批 4（工程实践 + 组织 3 篇）：worker 并行

每篇完成后更新本导航，最终形成完整知识体系。

---

## 理论根基

- [Cobus Greyling — loop-engineering](https://github.com/cobusgreyling/loop-engineering)（六原语、七模式、安全/失败/运营文档）
- [Addy Osmani — Loop Engineering essay](https://addyosmani.com/blog/loop-engineering/)
- [Mem0 — Memory-First Design](https://mem0.ai/blog/loop-engineering-for-ai-agents-memory-first-design)
- [pi coding agent](https://pi.dev) · [GitHub: earendil-works/pi](https://github.com/earendil-works/pi) · [Philosophy](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)

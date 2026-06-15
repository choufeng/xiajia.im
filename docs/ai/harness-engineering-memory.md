# 记忆持久化分层：Harness 怎么记事

> Agent 不健忘，不靠塞满上下文，靠**分层持久化 + 按需检索 + 定期合并**——记忆工程的本质不是「记得多」，而是「在正确的层、用正确的形状、按需取出来」。

---

## 目录

1. [引言：记忆是 harness 的持久化层](#引言记忆是-harness-的持久化层)
2. [7.1 时间分层：会话态 vs 持久态](#71-时间分层会话态-vs-持久态)
3. [7.2 四目标语义分层：按「谁」而非按「何时」](#72-四目标语义分层按谁而非按何时)
4. [7.3 写入策略：什么值得固化](#73-写入策略什么值得固化)
5. [7.4 检索而非注入：memory_search 的纪律](#74-检索而非注入memory_search-的纪律)
6. [7.5 Consolidation：记忆膨胀后的合并与去重](#75-consolidation记忆膨胀后的合并与去重)
7. [7.6 会话检索：session_search 的原始片段层](#76-会话检索session_search-的原始片段层)
8. [7.7 pi 实现：四套机制拼出持久化层](#77-pi-实现四套机制拼出持久化层)
9. [7.8 反模式：记忆系统怎么变垃圾堆](#78-反模式记忆系统怎么变垃圾堆)
10. [迁移清单](#迁移清单)
11. [下一步](#下一步)

---

## 引言：记忆是 harness 的持久化层

[Loop Engineering 第 4 篇](./loop-engineering-memory)讲清了「为什么 loop 需要记忆」——那篇是**架构层**视角：四层记忆（短期/工作/长期/语义）如何撑起 loop 跨 run 的连续性。本篇换**壳的视角**：Harness 的记忆职责是**持久化层工程**——对话怎么续（落盘）、跨会话事实存什么形状（四目标 schema）、存多了怎么不让检索噪声爆炸（分层检索+合并）、临时态和长期事实混了会怎样（反模式）。

工程铁律只有一条：**记忆不是「把所有事记下来」，是「分层 + 检索 + 合并」**（对比 [Loop 第 4 篇](./loop-engineering-memory)讲动力学，本篇讲这套持久化层怎么落地、检索、维护）。下面拆这三件事。

---

## 7.1 时间分层：会话态 vs 持久态

按**寿命**切记忆，是 harness 记忆的本质两分。

```
┌──────────────────────────────────────────────────────────────┐
│  长期记忆 Long-term （跨会话、周/月/年）                        │
│    载体: memory store（~/.pi/agent/ 持久化）                   │
│    形状: 结构化条目（四目标 + 类别）                            │
│    取法: 检索式（memory_search 按需召回 top-K）                │
│    写法: 显式（agent 判定值得记才写）                           │
├──────────────────────────────────────────────────────────────┤
│  短期记忆 Short-term （当前会话）                                │
│    载体: session JSONL（~/.pi/agent/sessions/）                │
│    形状: 原始消息树（id/parentId，全量逐条）                    │
│    取法: 全量在窗口内 / resume 时整树重放                        │
│    写法: 隐式（每条消息自动 append）                            │
└──────────────────────────────────────────────────────────────┘
```

两层关键差异：

| 维度 | 短期（会话态） | 长期（持久态） |
|------|----------------|----------------|
| **寿命** | 单会话（resume 可延长） | 跨会话，直到显式删除/合并 |
| **容量** | 受 context window 限制 | 受磁盘限制，靠检索裁剪注入量 |
| **形状** | 原始消息（逐条、全量、有序） | 结构化条目（摘要式、无序、可检索） |
| **检索方式** | 默认全量在窗口内 | 按需检索（top-K），不预加载 |
| **写入时机** | 隐式自动（每条消息） | 显式主动（agent 判定后写） |
| **典型载体** | pi：session JSONL | pi：memory store + skills |

**为什么必须分两层**：短期记忆要「全量、无损、可续」（会话内每句话都可能被引用）；长期记忆要「摘要、可检索、可合并」（服务无数次未来会话，塞原始对话只会爆 token）。混成一坨——要么 resume 丢上下文，要么检索全是噪声。

> pi session 是 **JSONL 树**：消息带 `id`/`parentId`，原地分叉不建新文件——短期记忆「可续」的工程基础（见[第 4 篇 运行时](./harness-engineering-runtime)）。

---

## 7.2 四目标语义分层：按「谁」而非按「何时」

时间分层回答「活多久」还不够。偏好、约定、失败教训形状不同，塞一个池子检索必乱。pi 按**语义目标**再切一刀，四目标：

| 目标 | 存什么 | 跨界范围 | 典型例子 |
|------|--------|----------|----------|
| **user** | 用户是谁、偏好、沟通风格、长期指令 | 跨所有项目 | 「中文回复」「简洁模式 full」 |
| **memory** | 全局笔记、环境事实、跨项目工具行为 | 跨所有项目 | 「bun test 比 jest 快」「M 賻芯片 pnpm 易 OOM」 |
| **project** | 项目约定、架构决策、命令、包管理器 | 仅本项目 | 「本仓用 bun，测试 bun test」「提交前跑 biome」 |
| **failure** | 失败、纠正、洞察、约定、工具怪癖（带类别） | 跨项目或按项目 | 「改 token.ts 漏 mock 导致测试挂」（failure） |

**为什么按语义不按时间**：

1. **检索精度**：`target=project` 直接把命中范围缩到本项目，不跨项目噪声。按时间切（近一周/一月）做不到这种语义聚焦。
2. **作用域天然隔离**：换项目时 `user`/`memory` 跟着走，`project` 自动只读当前仓，无需手动管理归属。
3. **写入判定清晰**：agent 见一条信息先问「关于用户/全局/本项目/某次失败？」四选一，决策成本极低。

> failure 目标多一层**类别**：`failure`/`correction`/`insight`/`preference`/`convention`/`tool-quirk`，给失败教训细分类，便于按类别检索（见 7.4）。

四目标和时间分层是**正交**的：短期记忆不分语义目标（就是原始对话），长期记忆靠四目标做语义索引。

---

## 7.3 写入策略：什么值得固化

下一个难题：**什么时候写、什么时候别写**。做错则记忆系统变垃圾堆——[Loop 第 4 篇](./loop-engineering-memory)「memory policy 错误比不存更糟」即指此。

### 该写的四类信号

| 信号 | 触发场景 | 写到哪个目标 |
|------|----------|--------------|
| **用户纠正** | 「别再这样做」「这个项目不用 default export」 | user（全局偏好）或 failure(correction) |
| **稳定偏好** | 用户重复表达同一倾向 ≥2 次 | user |
| **环境/项目事实** | 「本仓用 bun」「部署用 pnpm」 | project |
| **失败 + 根因** | 改 X 导致 Y 挂，根因是 Z | failure(failure)，带根因 |

### 别写的四类噪声

| 噪声 | 为什么别写 | 该放哪 |
|------|------------|--------|
| **任务进度** | 「正在改第 3 个文件」——一次性，下次无意义 | session 或 STATE.md |
| **临时 TODO** | 「待办：修 login」——完成即废 | TODO 文件，不进 memory |
| **可重推事实** | 能从代码/文档重新得出的 | 不存，靠 read |
| **成功细节** | 成功是默认预期，不记 | 不存（记失败才值钱） |

### 写入三原则

```
原则 1: 记「偏离预期」，不记「符合预期」
        失败比成功值钱 10 倍——同坑踩第二次才是真损失。

原则 2: 带「可检索性」写——条目带关键词，方便未来命中
        差: 「测试挂了」
        好: 「改 token.ts 后 oauth 测试挂，根因 mock 没更新」

原则 3: 带「作用域」写——偏好写 user，项目约定写 project
        混了→换项目时误用别项目约定
```


---

## 7.4 检索而非注入：memory_search 的纪律

持久态纪律一句话：**按需检索，绝不预加载**。

### 反面：预加载（token-rich 陷阱）

```
每次会话启动 → 把 memory store 全量灌进系统提示
结果: ① token 爆  ② 噪声淹没信号  ③ 检索精度=0（全在窗口里等于没检索）
```

这是 [Loop 第 4 篇](./loop-engineering-memory)token-rich 退化在持久化层的翻版，正确做法反过来。

### 正面：按需检索

```
agent 遇到任务 → 判断「需要历史经验吗？」
   ├─ 不需要        → 不检索，零成本
   └─ 需要          → memory_search(关键词, 过滤条件) → top-K 注入
```

### memory_search 的三维过滤

`memory_search` 三个过滤维度，**组合才能压准召回范围**：

| 过滤维度 | 取值 | 作用 |
|----------|------|------|
| **target** | `memory` / `user` / `failure` | 按语义目标收窄（不传 = 全目标） |
| **project** | 项目名 | 只在本项目作用域内查（project 目标的天然范围） |
| **category** | `failure`/`correction`/`insight`/`preference`/`convention`/`tool-quirk` | 仅对 failure/lesson 类目生效，细分类检索 |

### 检索词设计

检索质量 80% 看检索词：

| 做法 | 例子 |
|------|------|
| **从任务里提具体名词** | 任务「修 oauth 登录」→ 检索词 `oauth token 过期` 而非 `登录问题` |
| **窄搜优先** | 先 `target=project` + 项目名，没命中再放宽到 `target=failure` 全局 |
| **失败类带 category** | 查「以前踩过类似的坑」→ `target=failure, category=failure` |
| **别用宽泛词** | `问题`/`错误`/`bug` 这种词命中噪声爆炸 |

检索决策树：本项目约定→`target=project`(+project)；用户偏好→`target=user`；踩过的坑→`target=failure`(+category)；全局工具怪癖→`target=memory`/`failure(tool-quirk)`。**检索是「问对问题」，当精确 DB 查询设计，不是「搜一下试试」**。

---

## 7.5 Consolidation：记忆膨胀后的合并与去重

记忆用久了必然膨胀：同一偏好写多次、失败教训越积越碎、过时条目没清。**不做 consolidation，检索噪声指数级上升**——即 [Loop 第 4 篇](./loop-engineering-memory)的「concept drift / stale memory」。

### 何时触发

| 触发信号 | 说明 |
|----------|------|
| **条目数膨胀** | 单目标条目数超过阈值（如 failure > 100） |
| **检索噪声上升** | 同一检索词命中大量语义重复条目 |
| **矛盾出现** | 新条目与旧条目冲突（用户偏好变了） |
| **引用失效** | 条目引用的 PR/issue/分支已不存在（state rot） |

### 怎么合并

三动作对应 memory 写操作：

```
合并: 多条语义重复 → 提炼成一条更完整的（replace）
去重: 同一事实多份副本 → 删冗余（remove）
清理: 过时/矛盾/失效 → 删或被新条目覆盖（remove / replace）
```

操作示意（伪代码，非真实命令）：

```typescript
// 合并前: failure 里有三条讲同一件事
//  - "改 token.ts 测试挂"
//  - "oauth mock 没更新导致测试失败"
//  - "token 模块测试老挂，根因 mock"

const dupes = await memory_search({
  target: "failure", project: "xiajia.im",
  query: "token.ts oauth mock 测试",
});
// 写回完整根因
await memory.replace({
  target: "failure", category: "failure",
  content: "改 src/auth/token.ts 后 oauth 测试必挂，根因: mock 未随 token 刷新更新。修法: 同步更新 mock 的 token 过期逻辑。",
});
// 删碎片
for (const d of dupes) await memory.remove({ id: d.id });
```

### pi 是否自动 consolidation

**不会**。pi memory 是显式写操作（add/replace/remove），无后台自动合并。这意味着：

- consolidation 是**工程纪律**，由 agent/调度任务主动执行（如定期跑「整理失败记忆」loop）。
- 矛盾覆盖靠 `replace`（新条目赢），过期清理靠 `remove`。
- 代价：**你不做就没人做**——须在流程里安排 consolidation，别指望自愈。这是有意取舍：自动合并易误删/误并（语义相近≠同一件事），显式合并可审计、可回滚。

---

## 7.6 会话检索：session_search 的原始片段层

除 memory store 外，pi 还有第二个检索入口 `session_search`，检索**历史会话原始对话片段**，而非摘要条目：

| 维度 | memory store | session_search |
|------|--------------|----------------|
| **内容** | 摘要式结构化条目 | 原始对话消息（逐字） |
| **来源** | agent 显式写入 | 会话自动落盘（session JSONL） |
| **形状** | 四目标 + 类别 | 消息树（id/parentId） |
| **检索目的** | 拿「结论/教训/偏好」 | 找「当时怎么做的/说了什么」 |
| **典型场景** | 「这项目用啥测试框架」 | 「上次 oauth 那段调试对话」 |

### 什么时候用哪个

```
要的是「事实结论」     → memory_search  （「bun test」「用户偏好中文」）
要的是「过程还原」     → session_search （「上次怎么定位到 token 过期的」）
```

**两者互补**：memory 给「是什么」（结论），session_search 给「当时怎么发现的」（过程）。

---

## 7.7 pi 实现：四套机制拼出持久化层

pi 没有单一「记忆系统」，而是**四套机制对应持久化层的不同职责**——「核心最小化、能力靠组合」（同 [工具系统](./harness-engineering-tools)、[运行时](./harness-engineering-runtime)）。

| 职责 | pi 机制 | 在持久化层扮演什么 |
|------|---------|---------------------|
| **短期记忆** | session JSONL（`~/.pi/agent/sessions/`） | 全量原始消息树，resume 重放 |
| **长期事实** | memory 工具（四目标 + 类别） | 跨会话结论/偏好/约定/教训 |
| **长期检索** | `memory_search`（target/project/category） | 按需召回 top-K，不预加载 |
| **会话过程** | `session_search` | 跨历史会话检索原始片段 |
| **过程记忆** | skill 工具（procedural memory） | 可复用工作流，progressive disclosure |

### memory 工具：四目标的读写

三类动作对应四目标：

```
动作:
  add      — 新增一条记忆（指定 target，failure 可带 category）
  replace  — 覆盖/更新一条（矛盾时新的赢，也用于 consolidation 合并）
  remove   — 删除一条（过期/冗余/失效清理）

写入示例（伪代码）:
  memory.add({ target: "project", project: "xiajia.im",
               content: "本仓用 bun，测试 bun test，lint 用 biome" })
  memory.add({ target: "user", content: "中文回复，简洁模式 full" })
  memory.add({ target: "failure", category: "tool-quirk",
               content: "pnpm 在 M 系芯片 install 易 OOM，改用 bun i" })
```

### skill：第五种「过程记忆」

skill 是**过程性**长期记忆（「怎么做」，区别于 memory 的「是什么」），存可复用工作流（部署、调试、发布），带结构化字段：

```
skill 结构化字段:
  when_to_use       — 什么场景触发这个流程
  procedure_steps   — 步骤序列
  pitfalls          — 坑
  verification_steps— 怎么验证做对了
  scope: global | project
```

skill 与 memory 的关键区别是**加载方式**：skill 用 **progressive disclosure**——仅名字+描述常驻，正文按需 `read` 加载，不占常驻 token：

```
启动: skill 描述总在（几十 token/skill）
任务匹配 → read SKILL.md → 正文进窗口（仅用时）
```

> 何时写 skill 而非 memory：**可复用工作流写 skill（带步骤、可执行），一次性结论/教训写 memory**。「怎么发布」写 skill，「发布踩的坑」写 memory(failure)。

---

## 7.8 反模式：记忆系统怎么变垃圾堆

持久化层四种死法：

| 反模式 | 症状 | 根因 | 对策 |
|--------|------|------|------|
| **全量灌入上下文** | 启动把 memory 全塞系统提示，token 爆、检索精度归零 | 把「持久」当成「常驻」 | 按需 `memory_search` top-K，不预加载 |
| **永不合并** | 同一事实存 N 份、过时条目不删、检索噪声指数上升 | 没有 consolidation 流程 | 定期 replace/remove 合并去重，清 state rot |
| **存临时状态** | 把「正在改第 3 个文件」「待办修 login」写进 memory | 分不清「持久事实」和「一次性状态」 | 临时态进 session/STATE.md，不进 memory |
| **四目标混用** | 项目约定写进 user（换项目误用）、全局偏好写进 project | 写入时不判定作用域 | 写前问「关于谁」→ 选对 target |

第五个隐性反模式——**只写不检索**：memory 越存越多却从不 `memory_search`，记忆成只进不出黑洞，agent 依旧每次从零开始。写入与检索是同一系统两条腿，缺一不可。

---

## 迁移清单

把 pi 的记忆持久化层映射到其他 harness：

| 维度 | pi | Claude Code | Cursor | Aider | 通用 harness |
|------|-----|-------------|--------|-------|--------------|
| **短期记忆** | session JSONL 树 | session 历史 | 会话历史 | chat 历史 | append-only 消息日志 |
| **长期事实存储** | memory 工具（四目标） | CLAUDE.md / memory | `.cursorrules` / settings | conventions 文件 | 结构化 KV + 语义 schema |
| **四目标分层** | user/memory/project/failure | 无一等价物（靠文件组织） | 无（单 rules 文件） | 无（单文件） | 自建目标字段做检索过滤 |
| **按需检索** | `memory_search`（三维过滤） | 全量加载 CLAUDE.md | 全量加载 rules | 全量加载 | 接向量库 top-K |
| **会话检索** | `session_search` | resume + 历史 | 历史会话 | 无 | 索引历史消息做全文/语义检索 |
| **过程记忆** | skill（progressive disclosure） | skills / commands | rules 片段 | 无 | 按需加载的流程包 |
| **consolidation** | 显式 replace/remove（无自动） | 手动编辑文件 | 手动 | 手动 | 定时任务做合并去重 |
| **矛盾覆盖** | `replace`（新的赢） | 手动改 | 手动改 | 手动改 | 冲突检测 + 新条目优先 |

> 迁移要点：能力越弱的 harness，越要把**四目标分层**（靠目录区分作用域）和**按需检索**（别全量加载 rules）外置成纪律——否则 memory 沦为越来越长的常驻文件，token 爆 + 噪声爆。

---

## 下一步

本文是 Harness Engineering 第 7 篇 / 共 10 篇。前一篇：[扩展与技能加载机制](./harness-engineering-extensions)（extension vs skill、加载时序、热重载）——本篇 skill（过程记忆）是那篇「技能加载」在记忆维度的延续，progressive disclosure 同时是加载策略与记忆策略。

记忆让 agent 跨会话连续，但**记得越多、能调工具越多，闯祸能力越大**——改文件、跑命令、调 API，哪些该拦、不可逆怎么守，即第 8 篇「沙箱、权限与安全模型」。

下一篇：[8. 沙箱、权限与安全模型](./harness-engineering-security) —— 工具权限、bash 沙箱、不可逆守卫、IRL 损坏防护。

---

## 参考资料

- [Harness Engineering 总纲](./harness-engineering-series) · [第 4 篇：会话与运行时生命周期](./harness-engineering-runtime) · [第 6 篇：扩展与技能加载机制](./harness-engineering-extensions)
- [Loop Engineering 第 4 篇：Memory 系统](./loop-engineering-memory)（互补——那篇讲记忆在 loop 跨 run 的架构，本篇讲 harness 持久化层的工程实现）
- pi 能力：memory 工具（四目标 user/memory/project/failure，failure 含类别）· `memory_search`（三维过滤）· `session_search`（原始片段检索）· skill（过程记忆）· session JSONL 树

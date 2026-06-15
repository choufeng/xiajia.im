# Issue Triage 实战：最低风险的最高杠杆 loop

> 系列第十六篇。前十五篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper)
>
> Issue Triage 是 Loop Engineering 里最经典的 L1 loop。它不碰一行代码、不合并一个 PR，却**喂给所有其他 loop**——CI Sweeper 从它拿优先级，Daily Triage 从它读今日待办，PR Babysitter 从它判断哪个 PR 先看。极低风险，极高杠杆。这篇讲怎么在 pi 上从零搭一个。

---

## 一、Issue Triage 解决什么问题

先看没有它时的世界：

| 症状 | 根因 | 后果 |
|------|------|------|
| issue 堆积无人看 | 新 issue 比处理速度快 | backlog 指数增长，团队失去全局视图 |
| 无优先级 | 好 issue 和噪音混在一起 | 工程师不知道先做哪个 |
| 重复报告 | 同一 bug 被 3 个人各报一次 | 两个人同时开始修，浪费 |
| 标签混乱 | 标签依赖人工心情打 | 统计/过滤形同虚设 |
| 第一个 label 要等一周 | 人太忙没空 triage | 高优 issue 延迟响应，用户流失 |

Issue Triage loop 做的事：**持续扫描 open issues，自动分类/去重/排优先级/打标建议，让 backlog 始终干净、可操作、有优先级。**

Cobus Greyling 给它下了一句精准定位：

> 「Continuous discovery, deduplication, prioritization, and labeling — so the team (and other loops) always have a clean, actionable top-of-queue. **Pure report / proposal mode in week one. Extremely low risk, high leverage.**」

三个关键词：
- **Pure report**：L1 只出报告/建议，绝不自动动作
- **Extremely low risk**：因为它不碰代码、不碰 PR，出错也只是报告质量差
- **High leverage**：它的输出是所有其他 loop 的**输入源**

---

## 二、四个核心动作

Issue Triage 的一切围绕四个动作展开。

### 2.1 分类（Classify）

每个 issue 进来，判断它是什么：

| 分类 | 含义 | 典型标签 |
|------|------|----------|
| **bug** | 行为不符合预期 | `bug` |
| **feature** | 请求新功能 | `enhancement` |
| **question** | 用法咨询，非缺陷 | `question` |
| **duplicate** | 与已有 issue 重复 | `duplicate` |
| **stale** | 长期无活动，可能过时 | `stale` |
| **needs-info** | 信息不足，无法判断 | `needs-more-info` |

分类是后续一切动作的基础。分类错了，优先级全错。

### 2.2 去重（Deduplicate）

两个不同的人报告了同一个 bug。loop 要识别并标记。

去重的难点在于：标题不同、描述不同，但说的是同一个问题。纯关键词匹配漏检严重，需要结合标题相似度 + body 语义匹配 + 关键错误信息（stack trace、错误码）。

L1 的去重策略：**只标记「possible duplicate of #NNN」，不自动关 issue**。留给人确认。

### 2.3 优先级（Prioritize）

给每个 issue 算一个分数，排出优先队列。这是 Issue Triage 最核心的输出。

优先级算法见第六节，核心是**信号加权**：age（多老了）、reactions（多少人 👍）、linked PR（有人已动手？）、label（bug 优先于 feature）。

### 2.4 打标建议（Label Propose）

给每个 issue 建议一组标签，如 `bug + needs-repro + area:export`。

**L1 铁律：绝不自动打标。** 只产出建议，写进 state 文件。L2 可对 allowlisted 的标签（如 `area:*`、`needs-repro`）自动打，但 `bug`/`security`/`P0` 等敏感标签永远人审。

---

## 三、为什么是 L1，为什么高杠杆

### 为什么是 L1

| 维度 | Issue Triage 的选择 |
|------|---------------------|
| **碰代码？** | 不碰。纯只读。 |
| **碰 PR？** | 不碰。只读 issue。 |
| **碰外部系统？** | 只读 GitHub Issues API，不写（L1） |
| **出错后果？** | 最坏：分类建议不准、优先级排偏——**你看一眼报告就知道，改一下 skill 就行** |
| **tools 白名单** | `read, grep, find, ls, bash`（bash 仅用于 `gh issue list`），**无 edit/write** |

L1 = 零风险试错。这正是 Issue Triage 适合作为**第一个 loop** 的原因。Cobus 的 daily-triage story 讲得很清楚：

> 「Report-only is not wasted time — it calibrates triage. **Skipping L1 is how loops get a reputation for noise.**」
> （报告模式不是浪费时间——它在校准 triage。跳过 L1 正是 loop 落得「噪音制造机」名声的原因。）

### 为什么高杠杆

一张图说清：

```
                   Issue Triage (L1)
                   产出: 干净的优先队列
                        │
          ┌─────────────┼──────────────┐
          ▼             ▼              ▼
     Daily Triage   CI Sweeper    PR Babysitter
     读它出今日待办   读它判断哪些   读它判断哪个
                     issue 关联 CI   PR 先 review
                     失败
          ▼             ▼              ▼
         人决策       loop 执行      loop 执行
```

**Issue Triage 是 backlog 的「单一事实源」**。所有 loop 和人都从它读优先级，不需要各自重复扫描 issue。这正是 Multi-Loop 篇「分离 state 文件 + 各司其职」原则的体现：Issue Triage 维护 issue 库，其他 loop 消费它。

---

## 四、与 Daily Triage 的分工

这两个最容易混。一句话区分：

| | Issue Triage | Daily Triage |
|--|-------------|--------------|
| **关注对象** | issue 仓库（全部 open issues） | 今天的待办（今日该做什么） |
| **时间尺度** | 滚动维护（持续更新优先队列） | 每日快照（一天一次） |
| **输入** | GitHub Issues API | STATE.md（含 Issue Triage 的输出）+ git log + TODO |
| **输出** | `issue-triage-state.md`（优先队列 + 标签建议） | `STATE.md` 的 Today 段（今日待办报告） |
| **频率** | 2h 或事件驱动 | 1d |
| **类比** | 图书馆管理员（整理分类编号） | 每日晨报（今天看哪几本） |

**协作链路**：

```
Issue Triage (2h)
  → 维护 issue-triage-state.md（完整优先队列）
  → Daily Triage (1d) 读它
  → 产出 STATE.md Today 段（今日 Top 5 + 建议行动）
  → 人决策
```

**Issue Triage 是「上游」，Daily Triage 是「下游」**。Issue Triage 保证 issue 库始终有优先级；Daily Triage 从中挑出今天最该做的。分开是因为它们**频率不同**（2h vs 1d）、**粒度不同**（全量队列 vs 今日精选）、**消费者不同**（所有 loop vs 人）。

---

## 五、STATE 设计

Issue Triage 的输出是 `issue-triage-state.md`——一个滚动维护的 issue 优先队列。

```markdown
# Issue Triage State
Last run: 2026-06-15 10:00 UTC
Open actionable: 14 (was 17 last run)
New since last run: 3
Needs human: 2

## Top 5 (by loop score)
1. #487 (bug, 2d, 12👍, linked PR #501) — "Crash on export with large files" — 建议: bug + needs-repro + area:export — score: 87
2. #482 (bug, 5h, 8👍) — "Login redirect fails on Safari" — 建议: bug + browser:safari + area:auth — score: 79
3. #479 (feature, 3d, 15👍) — "Add dark mode" — 建议: enhancement + area:ui — score: 72
4. #476 (question, 1d, 2👍) — "How to configure custom headers?" — 建议: question → close-after-answer — score: 35
5. #475 (duplicate?, 4h, 1👍) — "Export crash" — possible duplicate of #487 — 建议: duplicate + needs-human — score: 20

## Needs Human
- #475: 可能与 #487 重复(置信度 70%)，需人确认
- #480: 触碰 auth 模块，标签建议需人审

## Recently Closed (pruned this run)
- #460 (已合并，pruned)
- #458 (已关闭，pruned)

## Run Log
2026-06-15 10:00 | 3 new | 14 actionable | 2 needs-human | 0 auto-labeled | ~8k tokens
2026-06-15 08:00 | 1 new | 17 actionable | 1 needs-human | 0 auto-labeled | ~7k tokens
```

### 设计要点

| 区段 | 作用 | 更新策略 |
|------|------|----------|
| **Header** | 运行元信息 + 计数趋势 | 每次 run 覆盖 |
| **Top 5** | 优先队列快照 | 每次 run 重算 |
| **Needs Human** | 需人确认的歧义项 | loop 只增不删（删由人确认后操作） |
| **Recently Closed** | prune 证据（防 State Rot） | 保留最近 N 条 |
| **Run Log** | 可观测性（token/发现/动作） | append-only |

**铁律（Cobus anti-pattern #3「Vague triage output」）**：

> 「Triage skill returns paragraphs of narrative → Loop cannot parse priorities; humans ignore STATE.md.」
>
> 对策：**结构化 markdown sections，one-line items，explicit `Suggested loop action`**。

每条 issue 必须一行写完：`#ID (type, age, signals) — "title" — 建议: labels — score: N`。绝不写段落叙述——**Daily Triage 和人都要快速扫读，段落 = 被忽略**。

---

## 六、优先级算法

这是 Issue Triage 的核心智力。优先级不是「拍脑袋」，而是**信号加权**。

### 六个信号

| 信号 | 含义 | 权重方向 | 为什么 |
|------|------|----------|--------|
| **Type** | bug vs feature vs question | bug > feature > question | bug 影响现有用户，feature 是增量 |
| **Age** | issue 开了多久 | 越久越高（但不无限） | 老问题被忽视太久 = 用户流失 |
| **Reactions** | 👍 数量 | 越多越高 | 社区诉求强度 |
| **Linked PR** | 有人已提关联 PR | 有 PR 的降优先级（已有人在修） | 已有人动手，不需催 |
| **Security/Auth** | 触碰安全/认证模块 | 一律 P0，人审 | Cobus human gate 铁律 |
| **Author** | 报告者身份 | 内部员工/reporter 权重高 | 反噪声（Cobus: "weight by signals the team actually cares about"） |

### 打分公式

```typescript
function scoreIssue(issue: Issue): number {
  let score = 0;

  // ① 类型权重
  const typeWeight = { bug: 40, feature: 25, question: 10, "needs-info": 5 };
  score += typeWeight[issue.type] ?? 15;

  // ② 年龄（对数增长，防老 issue 永远霸榜）
  const ageDays = daysSince(issue.createdAt);
  score += Math.min(20, Math.log2(ageDays + 1) * 5);  // 30天封顶 20 分

  // ③ Reactions（每人 +2，封顶）
  score += Math.min(15, issue.reactions * 2);

  // ④ Linked PR（有人在修了 → 降优先级）
  if (issue.linkedPRs.length > 0) score -= 15;

  // ⑤ 安全模块 → 直接 P0，不参与普通排队
  if (touchesSecurity(issue)) return -1;  // 特殊标记，进 Needs Human

  return score;
}
```

**关键设计**：

- **年龄用对数**：防止老 issue 永远霸榜（30 天和 300 天的差距不该是 10 倍）。
- **Reactions 封顶**：防止一个网红 issue 靠 500 个 👍 压垮真正的 bug。
- **Linked PR 降权**：已有人动手的 issue 不需要 triage 催——它该转给 PR Babysitter。
- **安全模块短路**：触碰 auth/payments/security 的 issue 不参与打分排队，直接进 Needs Human（Cobus human gate 铁律）。

### 信号防噪声

Cobus 特别警告：

> 「Over-prioritizing noisy reporter — Weight by signals the team **actually cares about** (reactions, linked PRs, internal +1s). Human overrides recorded in state.」

意思是：不是所有信号都可信。一个用户连续报 10 个低质量 issue，不应把他的 issue 全推到高优。对策：**记录人的 override**——人把某项降过级，下次 loop 记住，不再推高。

---

## 七、去重策略

去重是 Issue Triage 最难的动作，也是最容易出错的。

### 三层去重

| 层 | 方法 | 成本 | 精度 | 用途 |
|----|------|------|------|------|
| **L1 标题相似度** | Jaccard / Levenshtein 编辑距离 | 极低 | 低 | 快速粗筛 |
| **L2 关键信息匹配** | error code / stack trace / 文件名提取 | 低 | 中 | 精确匹配已知模式 |
| **L3 语义匹配** | body embedding + cosine 相似度 | 中 | 高 | 捕获「说法不同但意思一样」 |

### L1 保守原则

> 「Conservative matching + always surface 'possible duplicate of #NNN' for human confirmation in L1.」

L1 的去重**宁可漏检不可误杀**。误杀（把两个不同的 issue 标成重复）= 一个真 bug 被埋没。漏检（漏掉一个重复）= 浪费但不致命。

实现：三层匹配后，**只标「possible duplicate」并写进 Needs Human，不自动关 issue**。置信度 < 70% 不标（保守）。

```typescript
function detectDuplicates(newIssue: Issue, existing: Issue[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const ex of existing) {
    // L1: 标题相似度
    const titleSim = jaccardSimilarity(tokenize(newIssue.title), tokenize(ex.title));
    // L2: 关键信息
    const sharedErrors = sharedErrorPatterns(newIssue.body, ex.body);
    // L3: 语义（可选，需 embedding）
    // const semSim = cosineSimilarity(embed(newIssue.body), embed(ex.body));

    const confidence = titleSim * 0.4 + (sharedErrors ? 0.5 : 0);  // + semSim * 0.3
    if (confidence > 0.7) {
      matches.push({ of: ex.number, confidence });
    }
  }
  return matches;   // 全部进 Needs Human，不自动关
}
```

---

## 八、必备 Skill

### issue-triage SKILL.md

````markdown
---
name: issue-triage
description: 扫描 open issues，分类/去重/排优先级/打标建议。L1 只读，绝不自动打标或关 issue。
---

# Issue Triage

## 任务
每次运行，扫描所有 open issues，维护一个干净的优先队列。

## 步骤
1. 读 `issue-triage-state.md`，了解上次状态和已有队列
2. `gh issue list --state open --json number,title,body,labels,reactions,createdAt` 获取全部 open issues
3. 识别上次以来新增/更新的 issue
4. 对每个 issue:
   a. 分类（bug/feature/question/duplicate/stale）
   b. 检测重复（标题相似度 + 关键错误信息 + 保守阈值 70%）
   c. 打分（type + age + reactions + linkedPR，见 scoreIssue）
   d. 建议标签
5. 产出更新后的 Top 5 + Needs Human + 计数
6. prune 已关闭的 issue（State Rot 防护）

## 铁律
- **绝不自动打标、关 issue、评论 issue**（L1）
- 重复检测只标 "possible duplicate"，写 Needs Human
- 触碰 security/auth/payments 的 issue → 直接进 Needs Human，不参与排队
- 每条 issue 一行写完，不写段落（vague output = 人不看）
- 置信度 < 70% 的判断不输出（保守）
````

### skill 设计要点

| 要点 | 为什么 |
|------|--------|
| 「绝不自动打标/关/评论」写在最显眼处 | 软约束给模型；硬约束靠 tools 白名单兜底 |
| 明确的 `gh issue list` 命令 | 减少模型猜 API 用法（intent debt） |
| 「每条一行」 | 防 Cobus anti-pattern #3（vague output） |
| 「置信度 < 70% 不输出」 | 保守原则——宁可漏检不可误杀 |

---

## 九、pi 实现

### 9.1 事件 + 定时混合调度

Issue Triage 最适合**混合调度**（Scheduling 篇模式 ④）：

| 调度源 | 触发 | 用途 |
|--------|------|------|
| **GitHub webhook**（`issues` event） | 新 issue opened | 即时响应，秒级 triage |
| **cron 兜底**（2h） | 定时巡检 | 防 webhook 漏接；扫已更新但未重 triage 的 issue |

```yaml
# .github/workflows/issue-triage.yml
name: Issue Triage Loop
on:
  # ① 事件驱动：新 issue
  issues:
    types: [opened, reopened, edited]
  # ② cron 兜底：每 2 小时
  schedule:
    - cron: "0 */2 * * *"
  workflow_dispatch: {}

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install @earendil-works/pi-coding-agent
      - name: Run Issue Triage
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # L1 严格只读：read/grep/find/ls/bash，无 edit/write
          pi -p "执行 /skill:issue-triage。读 issue-triage-state.md，扫描 open issues，更新优先队列。绝不打标或关 issue。" \
            -t read,grep,find,ls,bash
```

### 9.2 Runner（SDK 版，含 verifier）

更可控的写法用 SDK，加一个轻量 verifier：

```typescript
// issue-triage/index.ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const REPO = process.env.REPO_CWD!;

async function runAgent(role: string, tools: string[], prompt: string) {
  let out = "";
  const { session } = await createAgentSession({
    cwd: REPO,
    tools,
    sessionManager: SessionManager.inMemory(REPO),
  });
  session.subscribe((e) => {
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta")
      out += e.assistantMessageEvent.delta;
  });
  await session.prompt(prompt);
  session.dispose();
  return out;
}

// ① 先拉取 issue 数据（用 gh CLI，不靠模型调 API）
//    这一步在 pi 外做，保证数据准确
import { execSync } from "child_process";
const issuesJson = execSync(
  `gh issue list --state open --json number,title,body,labels,reactions,createdAt --limit 100`,
  { cwd: REPO, encoding: "utf8" }
).trim();

// ② Implementer: 分类/去重/打分
const result = await runAgent(
  "triage",
  ["read", "grep", "find", "ls", "bash"],   // L1 严格只读
  `执行 /skill:issue-triage。
   读 issue-triage-state.md 获取上次状态。
   下面是当前所有 open issues（JSON）:
   ${issuesJson}
   产出: 更新后的 issue-triage-state.md（Top 5 + Needs Human + 计数 + Run Log）。
   铁律: 绝不打标/关 issue/评论。重复只标 possible duplicate。`,
);

// ③ Verifier: 轻量检查（L1 的 verifier 可以很轻）
const verdict = await runAgent(
  "verifier",
  ["read"],
  `审这份 issue triage 输出，只检查三点:
  (a) 有没有自动打标或关 issue（应一律是建议）?
  (b) Needs Human 里有没有触碰 security/auth 但漏标的?
  (c) Top 5 有没有把 question 排在 bug 前面?
  输出 PASS 或 FAIL + 理由。
  --- 输出 ---
  ${result}`,
);

const ok = verdict.trim().toUpperCase().startsWith("PASS");

// ④ 回写 state + 通知
if (ok) {
  // 写回 issue-triage-state.md（在 runner 里写，不让 agent 写）
  // pi agent 的输出是 state 内容，runner 验证后落盘
  console.log("Triage PASS, state updated");
} else {
  console.log("Triage FAIL:", verdict);
  // FAIL 时不落盘，保留旧 state，告警
}

console.log(`done: ${ok ? "PASS" : "FAIL"}`);
```

### 9.3 关键设计点

| 设计 | 原因 |
|------|------|
| **`gh issue list` 在 pi 外做** | 数据获取靠确定性 CLI，不靠模型「猜 API」。模型只做推理（分类/打分），不做数据获取 |
| **tools 白名单无 edit/write** | L1 硬边界。模型物理上无法打标/关 issue |
| **state 由 runner 落盘，不由 agent 写** | agent 产出 state 内容 → runner 验证（verifier PASS）→ runner 写文件。agent 无 write 工具，无法绕过验证 |
| **verifier 轻量** | L1 的 verifier 不需要跑测试（没代码改），只检查「有没有越权」和「分类有没有明显错误」 |
| **混合调度** | webhook 即时 triage 新 issue + cron 兜底防漏。Scheduling 篇模式 ④ |

### 9.4 L2 升级路径

Issue Triage 的 L2 很克制——**只允许自动打 allowlisted 标签**：

| 可自动打（L2） | 仍需人审 |
|----------------|----------|
| `area:*`（area:export, area:auth...） | `bug` |
| `needs-repro` | `security` |
| `question` | `P0`/`P1` |
| `stale`（超 N 天无活动） | 关 issue（close） |

```typescript
const ALLOWLIST_AUTO_LABEL = /^area:/;
const proposed = parseLabels(result);
for (const label of proposed) {
  if (ALLOWLIST_AUTO_LABEL.test(label)) {
    await execSync(`gh issue edit ${issue.number} --add-label "${label}"`);
  } else {
    // 非 allowlist → 写进 Needs Human
    needsHuman.push({ issue: issue.number, suggested: label });
  }
}
```

> **L2 的升级标准**：L1 连续 2 周运行，triage 准确率 > 85%（人抽检判定），且 Needs Human 的误报率 < 10%。没到这个标准，L1 的报告模式继续校准 triage。

---

## 十、失败模式与护栏

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **过度自动打标** | S2 | L1 越权自动打标 | tools 白名单无 edit/write（硬边界）+ skill 铁律（软约束） |
| **误去重** | S2 | 两个不同 issue 被标重复，真 bug 被埋没 | 保守阈值 70% + 只标 possible duplicate + 人确认 |
| **优先级被噪声干扰** | S1→S2 | 网红 feature 靠 reactions 压过真 bug | reactions 封顶 + 人 override 记录 |
| **vague output** | S1 | triage 输出段落叙述，人看也不看 | 强制 one-line items + structured sections |
| **State Rot** | S1→S2 | state 引用已关闭的 issue | 每 run prune + 校验 ID 存活 |
| **context overload** | S1 | 一次 run 新增 >X 个 issue，模型处理不过来 | Cobus human gate: ">X new issues → escalate" |
| **标签膨胀** | S1 | 建议越来越多无意义标签 | label allowlist + 去重 |
| **notification fatigue** | S1→S2 | 每个新 issue 都 ping 人 | 只对 Needs Human 通知，其余写 state |

> **Cobus 的三层防噪声**：
> 1. Weight by signals the team **actually cares about**（不是所有信号都可信）
> 2. Human overrides **recorded in state**（人改过的优先级，loop 记住不再推高）
> 3. Only notify human for the **"needs human" slice**（其余写 state，不 ping）

---

## 十一、成功指标

| 指标 | 目标 | 怎么测 |
|------|------|--------|
| **issue → 首个 label 的时间** | < 2h（之前可能 > 1 周） | GitHub issue timeline |
| **24h 内有明确优先级的 issue 占比** | > 90% | 扫 state 的覆盖率 |
| **重复 caught 率** | > 80% 的重复在 4h 内标出 | 人工事后审计 |
| **人 override 率** | < 15%（太高说明 triage 不准） | state 记录的 override |
| **工程师反馈** | "我总知道 top 5 是什么" | 定性，从 state review |

> Cobus 给了一个漂亮的定性指标：**「Engineer-reported 'I always know what the top 5 things are' score」**。如果工程师打开 state 文件就知道今天该关注什么，Issue Triage 就成功了。

---

## 十二、回顾

1. **Issue Triage 是最低风险的最高杠杆 loop**。L1 只读，出错只是报告不准；但它的输出喂给所有其他 loop。
2. **四个核心动作**：分类、去重、优先级、打标建议。L1 全部只建议不执行。
3. **与 Daily Triage 分工**：Issue Triage 维护 issue 库（2h，上游），Daily Triage 读它出今日待办（1d，下游）。
4. **优先级 = 信号加权**：type + age(对数) + reactions(封顶) - linkedPR，安全模块短路到 Needs Human。
5. **去重三层 + 保守原则**：标题相似度 + 关键信息 + 语义匹配；置信度 < 70% 不标；只标 possible duplicate，人确认。
6. **STATE 一行一项**：每条 issue 一行写完，绝不段落叙述（Cobus anti-pattern #3）。
7. **pi 实现**：`gh issue list` 在 pi 外取数据（确定性），模型只做推理；tools 严格只读；混合调度（webhook + cron 兜底）。
8. **L2 升级**：只自动打 allowlisted 标签（`area:*`/`needs-repro`/`question`/`stale`），`bug`/`security`/`P0` 永远人审。
9. **防噪声三层**：信号权重可信度 + 人 override 记录 + 只对 Needs Human 通知。
10. **成功标准**：工程师打开 state 就知道 top 5——Issue Triage 的终极指标。

一句话收尾：**Issue Triage 不碰一行业务代码，却让整个 loop 系统知道「先做什么」。它是 backlog 的图书馆管理员——从不自己写书，但让每本书都在正确的时间被正确的人找到。**

---

## 参考资料

- [系列二：pi L1 落地](./loop-engineering-on-pi)（L1 只读 loop 的原始范式）
- [系列十三：Scheduling 模式](./loop-engineering-scheduling)（事件 + cron 混合调度）
- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（Issue Triage 作为其他 loop 的输入源）
- [系列四：Memory 系统](./loop-engineering-memory)（STATE.md 设计、State Rot 防护）
- [Cobus Greyling — Issue Triage pattern](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/issue-triage.md)
- [Cobus Greyling — Anti-Patterns #3 Vague triage output](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md)
- [Cobus Greyling — Daily Triage report-only story](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/daily-triage-report-only.md)
- [Cobus Greyling — Loop Design Checklist](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- pi 工具：`gh issue list` CLI · `pi -p` print mode · SDK `createAgentSession` · tools 白名单

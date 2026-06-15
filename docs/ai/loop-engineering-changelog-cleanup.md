# Changelog Drafter & Post-Merge Cleanup：轻量收尾 loop 组合

> 系列第十七篇。前十三篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop 协调](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行工程](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling)
>
> 这篇把两个天然轻量、低风险、适合 off-peak 的收尾 loop 放一起讲——**Changelog Drafter**（release notes 起草）和 **Post-Merge Cleanup**（合并善后）。它们是除 Daily Triage 外最该先上的 loop：风险极低、价值直观、不与活跃开发抢资源。如果你已经搭稳了 Daily Triage，这俩是第二、第三个 loop 的首选。

---

## 一、为什么收尾 loop 是入门首选

Loop Engineering 系列讲到第十七篇，CI Sweeper（L3）、PR Babysitter（高频）这些 loop 听起来很猛，但上手门槛高、风险大、token 贵。真正该作为「第二个 loop」练手的，是**收尾类 loop**——它们处理的是「合并已经发生之后」的善后工作。

### 收尾 loop 的三个天然优势

| 优势 | 含义 | 对比 |
|------|------|------|
| **风险极低** | 合并已经完成，loop 动的是「已经安全过线的代码」的收尾 | CI Sweeper 改的是「还在挂的代码」 |
| **off-peak 友好** | 不急，夜间/下班后跑即可 | PR Babysitter 必须工作时段高频跑 |
| **不抢主干** | 收尾 loop 动 docs / CHANGELOG / 死代码，不碰 src/ 核心逻辑 | CI Sweeper 直接改 src/ |

Cobus Greyling 对 Changelog Drafter 的评价：

> 「**One of the cheapest high-value loops.** Safe to run alongside others.」
> （最廉价的高价值 loop 之一。可安全与其他 loop 并行跑。）

对 Post-Merge Cleanup：

> 「**Lower risk than CI sweeper — good second loop after daily triage is stable.**」
> （比 CI Sweeper 风险更低——Daily Triage 稳定后的好选择。）

### 两个 loop 各管什么

```
   代码合并到 main
        │
        ├──► Post-Merge Cleanup（善后）
        │      删死代码、清 TODO、修文档链接、清 feature flag
        │      关注：合并留下了什么「尾巴」
        │
        └──► Changelog Drafter（记账）
               扫合并 PR → 分类 → 起草 release notes
               关注：合并做了什么「值得告诉用户的事」
```

一个管**内部卫生**（清理），一个管**外部沟通**（记账）。天然互补，且都不碰正在开发中的代码。

### 为什么放一起讲

这俩 loop 有太多共性，分开讲会重复：

| 共性 | Changelog Drafter | Post-Merge Cleanup |
|------|-------------------|--------------------|
| 触发源 | 合并 PR / tag | 合并到 main |
| 自治级别起步 | L1（只起草） | L1（只报告） |
| 调度 | off-peak（1d / 6h） | off-peak（1d / 夜间） |
| 花费 | 极低（~35k/run） | 低（~40k/run） |
| 与活跃开发的关系 | 不竞争 | 不竞争 |
| 风险 | 起草错（人审兜底） | 误删（verifier 兜底） |

所以这篇用一个统一的工程框架讲二者，只在分歧处分开。

---

## 二、Changelog Drafter：扫合并 → 分类 → 起草

### 目标

每次发版前（或定期），自动扫自上次 release 以来的所有合并，分类成标准的 release notes，人审后发布。

### 典型运行周期

```
1. 确定 "since" 窗口（上次 tag，或 STATE 记的 last run）
2. changelog-scan：列出 main 上合并的 PR + 直接 commit
   提取：标题、标签（breaking/security）、关联 issue、conventional commit 类型
3. 分组到标准分区：
   Features / Bug Fixes / Performance / Breaking Changes / Security / Docs / Internal
4. draft-release-notes：写一份人话的 Markdown 草稿
5. Verifier 审：有没有编造功能？漏了高影响项？语气对不对？
6. 人审通过 → 写入 CHANGELOG.md 或 GitHub Release body
7. 回写 STATE：标记已发布，prune 旧条目
```

### 分区设计

release notes 的价值在于**用户能快速找到自己关心的**。标准分区：

| 分区 | 什么进这里 | 用户关心度 |
|------|-----------|-----------|
| **🟢 Features** | 新功能（`feat:` / `feature` label） | 高 |
| **🔵 Bug Fixes** | 修的 bug（`fix:` / `bug` label） | 高 |
| **🔴 Breaking Changes** | 破坏性变更（`breaking` label / `BREAKING CHANGE`） | **最高（必须置顶 + callout）** |
| **🔒 Security** | 安全修复（`security` label / CVE） | 高 |
| **⚡ Performance** | 性能改进 | 中 |
| **📚 Documentation** | 文档变更 | 低 |
| **🔧 Internal / Chores** | 内部杂项（重构、CI、deps） | 低（可折叠或省略） |

> **铁律：Breaking Changes 永远置顶 + 醒目标注。** Cobus 的 week-one 故事里，第一版草稿把一个 breaking change 埋在中间，被 verifier 抓出来强制置顶加 callout。breaking change 被用户漏看 = 升级后生产挂。

### 过滤规则（降噪）

并非所有合并都值得写进 changelog。scan 阶段要过滤：

| 过滤 | 为什么 | 怎么做 |
|------|--------|--------|
| **Dependabot / bot PR** | 用户不关心依赖小版本 | scan skill 里 `ignore bot + pure deps` 规则 |
| **纯 CI/lint 配置** | 内部杂项，非用户面 | 归入 Internal 或省略 |
| **合并 commit** | 噪音 | 只看 squash merge 的实际内容 |

Cobus week-one 故事里的真实教训：

> 「First draft included too many internal chore PRs (Dependabot noise). Fixed by strengthening the 'ignore bot + pure deps' rule in the scan skill.」
> （第一版草稿塞了太多内部杂项 PR（Dependabot 噪音）。通过增强 scan skill 里的「忽略 bot + 纯依赖」规则修复。）

### 成本画像

| 场景 | Token/run | 说明 |
|------|-----------|------|
| 无新合并（no-op） | ~5k | 自上次 tag 无变化 → early exit |
| 扫描 + 分类 | ~35k | PR/commit 扫描 |
| 起草 + 验证 | ~80k | 完整 release notes 草稿 |

**Cadence：1d · Tier：低 · 建议日预算上限：100k tokens**

> Cobus 的评价：「One of the highest-ROI, lowest-risk loops.」——每个用户和贡献者都看到产出，但风险极低（只读 + 提议）。

---

## 三、Post-Merge Cleanup：扫合并 → 找善后 → 清理

### 目标

合并到 main 后，扫 diff 找「合并留下的尾巴」——死代码、遗留 TODO、文档没同步、过期的 feature flag——然后提议小修复或开 ticket。

### 典型运行周期

```
1. 列出自上次运行以来的 main 合并（或最近 N 天）
2. 对每个合并，扫 diff 找：
   - 新增的 TODO / FIXME / "remove after" 注释
   - 被替换但没删的旧代码（死代码）
   - 改了代码但文档没跟着改的（API 文档过时）
   - 该清但没清的 feature flag
   - 断掉的文档链接
3. 交叉验证：关联的 Linear/GitHub issue 有没有显式的后续任务
4. 分流：
   - 小 + 低风险 → 提议 fix（L2 时在 worktree 里做）
   - 大 / 需设计 → 开 ticket + 标记人
   - 噪音 → 忽略并记录（避免重复扫）
5. Verifier 确认：清理没改变行为（除非显式删死代码）
6. 开小 PR 或攒成一条「cleanup」PR
7. 更新 STATE：prune 已完成项
```

### Cleanup 的分类决策树

```
合并 diff 里发现线索
        │
   ┌────┼────────────┬──────────────┐
   ▼    ▼            ▼              ▼
 死代码  TODO注释    文档没同步      feature flag
 (删)   (评估)      (修文档)        (评估)
   │      │            │              │
   │   需设计?       链接断?       生产在用?
   │   ├─是→ticket   ├─是→修        ├─是→ticket(人决)
   │   └─否→小fix    └─否→skip      └─否→删
   │      │            │
   ▼      ▼            ▼
 L2 fix  L2/ticket   L2 fix
```

### 「不改行为」铁律

Post-Merge Cleanup 的安全基石：

> **Cleanup must not alter behavior unless explicitly removing dead code paths.**
> （清理不得改变行为，除非显式删除死代码路径。）

- Verifier 跑**完整测试套件**——任何回归 = 立即交还给人
- 触碰 >10 文件的 cleanup PR 不自动合并（需人审）
- `auth/`、`payments/` 一律人-only（denylist，见 Multi-Loop 篇共享 denylist）

### 成本画像

| 场景 | Token/run | 说明 |
|------|-----------|------|
| 无新合并（no-op） | ~5k | 无近期合并可扫 |
| 扫描 + 分流 | ~40k | 合并列表 + TODO 扫描 |
| 小修复（L2） | ~150k | worktree + verifier |

**Cadence：1d–6h · Tier：低 · 建议日预算上限：200k tokens**

---

## 四、二者的配合：Cleanup 准备，Drafter 记账

这两个 loop 不是孤立的，它们天然配合，形成一条「合并后善后链」。

### 时间线配合

```
Day 1 14:00  PR #142 合并到 main（新功能 + 留了 TODO + 旧代码没删）
        │
Day 1 22:00  Post-Merge Cleanup 扫到
        │    → 发现 TODO "remove legacyAuth after migration"
        │    → 发现旧 auth/handler.ts 12 行死代码
        │    → L2: 删死代码 + 修文档 → 开 cleanup PR #145
        │
Day 2 09:00  cleanup PR #145 合并
        │
Day 2 18:00  Changelog Drafter 扫
        │    → #142: Features（新功能）
        │    → #145: Internal（cleanup，可折叠/省略）
        │    → 起草 v2.15.0 release notes 草稿
        │
Day 3        人审 release notes → 发布 v2.15.0
```

**Cleanup 让代码干净 → Drafter 记账时不会被噪音干扰。Drafter 让用户知道发生了什么 → 下次 Cleanup 有干净的基线。** 互相成就。

### 与其他 loop 的关系：不抢主干

| 维度 | 收尾 loop（这俩） | 活跃开发 loop（CI Sweeper / PR Babysitter） |
|------|-------------------|---------------------------------------------|
| **调度时段** | off-peak（夜间 / 下班后） | active hours（工作时段） |
| **改动对象** | docs / CHANGELOG / 死代码 | src/ 核心逻辑 |
| **优先级** | 低（Multi-Loop 篇优先级表第 4-5） | 高（第 1-2） |
| **冲突可能** | 极低（时段 + 对象都不撞） | 高（都动 src/） |

这正是 Multi-Loop 篇（第五篇）五铁律的体现：**分离 state 文件 + off-peak 调度 + 不抢主干**。收尾 loop 是多 loop 体系里最「安分」的成员。

### 共享 STATE 布局

```
STATE.md                       # Daily Triage（优先级、人工收件箱）
changelog-drafter-state.md     # Drafter（已扫描窗口、待审草稿）
post-merge-state.md            # Cleanup（待清理项、已完成、已延后）
loop-run-log.md                # 所有 loop 共用的 append-only 日志
```

三个独立 state + 一个共享 log，互不污染（Multi-Loop 篇铁律 2）。

---

## 五、L1 → L2 演进

这两个 loop 都从 L1 起步，演进路径清晰且安全。

### Changelog Drafter 的演进

| 级别 | 行为 | 何时升级 |
|------|------|----------|
| **L1 起草** | 扫描 → 分类 → 写草稿到 `RELEASE_NOTES_DRAFT.md`，人审后手动发布 | 起步（2 周） |
| **L1.5 提议 PR** | 草稿审过后，loop 自动开一个更新 CHANGELOG.md 的 PR（仍需人 merge） | 草稿连续 5 次人审通过 |
| **L2 自动 PR** | 常规 release 自动开 PR + 请求 review；breaking/security 仍强制人审 | L1.5 稳定 2 周 |

> **升级门槛**：「草稿连续 5 次人审无修改」才考虑 L1.5。如果人每次都要改，说明 scan skill 或 draft skill 还不够准，升级只会放大错误。

### Post-Merge Cleanup 的演进

| 级别 | 行为 | 何时升级 |
|------|------|----------|
| **L1 报告** | 扫合并 → 列 cleanup 候选 → 人挑哪些做 | 起步（2 周） |
| **L2 小 fix** | docs/comment-only 路径自动 worktree 修复 + verifier + 开 PR | 报告连续准确（候选人认可率 >80%） |
| **L2 扩展** | 允许删死代码（仍 verifier + 不改行为铁律） | L2 docs-only 稳定 2 周 |

Cobus 的 honest-win 故事里的真实建议：

> 「Start L1 for two weeks. If the report is consistently right, enable L2 for docs and comment-only paths. Keep architectural debt in Linear, not in the loop.」
> （L1 跑两周。如果报告持续准确，对 docs 和纯注释路径开 L2。架构债留在 Linear，别塞进 loop。）

### 演进的安全护栏

| 护栏 | Changelog Drafter | Post-Merge Cleanup |
|------|-------------------|--------------------|
| **denylist** | 不碰 tags / live CHANGELOG（无人审） | auth/ payments/ 一律人-only |
| **attempt 上限** | 草稿被拒 ≤2 次 → 回 L1 | 同一 cleanup 项 ≤2 次失败 → ticket |
| **半径限制** | 单 PR 只改 CHANGELOG.md | 单 cleanup PR ≤10 文件 |
| **强制人审** | breaking / security / major version | feature flag 移除 / 外部 API consumer |

---

## 六、各自的必备 Skill 与 STATE

### Changelog Drafter Skill

`.pi/skills/changelog-drafter/SKILL.md`：

````markdown
---
name: changelog-drafter
description: 扫合并 PR 起草 release notes。只读 + 起草，绝不发布。
---

# Changelog Drafter

## 任务
定期（或发版前）扫自上次 release 以来的合并，分类起草 release notes。

## 步骤
1. 读 `changelog-drafter-state.md` 确定 "since" 窗口（上次 tag / last run）
2. `git log --merges --since="<window>"` + GitHub API 列合并 PR
3. 提取每个 PR：标题、标签、conventional commit 类型、关联 issue
4. 过滤噪音：忽略 Dependabot/bot PR、纯 CI 配置、纯 lockfile
5. 分组到分区：Features / Bug Fixes / Breaking / Security / Performance / Docs / Internal
6. 起草人话 Markdown：用户能看懂，不是 commit message 复读
7. 写入 `RELEASE_NOTES_DRAFT.md`
8. 回写 state：更新 last run、记录草稿位置、标记待审

## 铁律
- **Breaking Changes 永远置顶 + callout**（⚠️ 标注 + 升级指南）
- **绝不编造功能**：每条必须有对应 PR/commit 出处
- **绝不发布**：只写草稿，发布是人的事
- **语气跟着项目**：读 AGENTS.md 里的 "Release voice" 段（如有）
- 忽略 bot PR 和纯依赖 bump（降噪）
````

### Post-Merge Cleanup Skill

`.pi/skills/post-merge-cleanup/SKILL.md`：

````markdown
---
name: post-merge-cleanup
description: 扫合并找善后机会（死代码/TODO/文档/flag）。L1 报告，L2 仅 docs/comment。
---

# Post-Merge Cleanup

## 任务
合并到 main 后，扫 diff 找「留下的尾巴」，提议小修复或开 ticket。

## 步骤
1. 读 `post-merge-state.md` 确定 last run
2. `git log --merges --since="<window>"` 列近期合并
3. 对每个合并扫 diff：
   - 新增 `TODO|FIXME|remove after|deprecated` 注释
   - 被替换未删的旧代码（死代码）
   - 改了代码但 docs/ 没跟着改
   - feature flag 该清未清
   - 断掉的文档链接
4. 交叉验证关联 issue 有无显式后续任务
5. 分流：小+低风险→提议fix；大/需设计→ticket；噪音→记录忽略
6. 回写 state：待清理 / 已完成 / 已延后

## 铁律
- **不改行为**：除非显式删死代码路径，cleanup 不改运行逻辑
- **denylist**：auth/ payments/ secrets/ migrations → 一律人-only
- **噪音控制**：只处理有合并上下文的 TODO，不是仓库里所有 TODO
- **bot 合并忽略**：Dependabot 合并不扫 cleanup（它自己会清）
````

### STATE 文件

`changelog-drafter-state.md`：

```markdown
# Changelog Drafter State

Last run: 2026-06-14 18:30 UTC
Last release: v2.14.0 (tag 2026-06-01)

## Pending Drafts
- v2.15.0-rc (unreleased)
  Items scanned: 17 PRs + 4 direct commits
  Draft: RELEASE_NOTES_DRAFT.md
  Status: ready for human review

## Recently Published
- v2.14.0 — published 2026-06-01 (reviewed by @jon)
```

`post-merge-state.md`：

```markdown
# Post-Merge Cleanup

Last run: 2026-06-14 22:00 UTC

## Pending Cleanup
- [ ] PR #1245 merged — remove legacyAuth flag (TODO in merge)
  Source: commit abc1234, auth/handler.ts:42
  Risk: low | Effort: small
- [ ] PR #1240 merged — update API docs for new endpoint
  Risk: low | Effort: small

## Completed (last 14d)
- PR #1230 — removed unused import cluster (cleanup PR #1248)

## Deferred (human decision)
- PR #1238 — large refactor deferred; ticket ENG-1001

## Ignored (noise, don't rescan)
- PR #1235 — Dependabot merge (bot, skip)
```

---

## 七、pi 实现

两个 loop 都是标准 L1 结构（系列第二篇 Daily Triage 的模式），这里讲收尾 loop 特有的实现点。

### 7.1 git log 扫描（核心数据源）

两个 loop 的输入都是「近期合并」。关键命令：

```bash
# 列自上次 tag 以来的合并 PR（Drafter 用）
git log $(git describe --tags --abbrev=0)..HEAD --merges --pretty=format:"%h %s"

# 列最近 24h 的合并（Cleanup 用）
git log --since="24 hours ago" --merges --pretty=format:"%h %s"

# 扫某个合并的 diff 找 cleanup 线索（Cleanup 用）
git show <merge-sha> | grep -nE 'TODO|FIXME|remove after|deprecated'
```

### 7.2 Runner（print mode 最简版）

收尾 loop 不需要复杂的 verifier 编排（L1 阶段），print mode 就够：

```bash
# changelog-drafter.sh — 每日 off-peak 跑
cd "$REPO_CWD"
pi -p "执行 /skill:changelog-drafter。读 state 确定窗口，扫合并 PR，
      分类起草 release notes 到 RELEASE_NOTES_DRAFT.md，回写 state。
      breaking change 必须置顶。绝不发布。" \
  -t read,grep,find,ls,bash \
  >> "logs/changelog-$(date +%F).log" 2>&1

# post-merge-cleanup.sh — 每日夜跑
cd "$REPO_CWD"
pi -p "执行 /skill:post-merge-cleanup。扫最近 24h 合并找 cleanup 机会。
      小+低风险项提议 fix 标记；大项开 ticket 标记；噪音记 ignored。
      回写 post-merge-state.md。L1 只报告，不改代码。" \
  -t read,grep,find,ls,bash \
  >> "logs/cleanup-$(date +%F).log" 2>&1
```

### 7.3 tag/release 事件触发（Drafter 特有）

Changelog Drafter 除了定期跑，最好在**打 tag / 发 release 时**也触发一次——确保 release notes 跟 release 同步。

```yaml
# .github/workflows/changelog-on-release.yml
name: Changelog on Release
on:
  push:
    tags: ["v*"]          # 打 version tag 时触发
  workflow_dispatch: {}   # 手动触发
jobs:
  draft:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # 需要完整历史才能扫 tag 间内容
      - run: pi -p "执行 /skill:changelog-drafter。扫自上次 tag 以来的合并，
                      起草 release notes。这是发版触发，务必覆盖所有合并。" \
          -t read,grep,find,ls,bash
```

### 7.4 off-peak 调度

收尾 loop 的核心调度原则：**不与活跃开发竞争**（Scheduling 篇 off-hours 策略）。

```cron
# Changelog Drafter — 每日 18:30（下班前，当天合并都进 main 了）
30 18 * * * cd /loops && bun run changelog-drafter.sh >> logs/cd.log 2>&1

# Post-Merge Cleanup — 每日 22:00（夜间，不抢 CI Sweeper / PR Babysitter）
0 22 * * * cd /loops && bun run post-merge-cleanup.sh >> logs/pm.log 2>&1
```

用 croner 的 activeHours（Scheduling 篇）：

```json
[
  { "name": "changelog-drafter", "cron": "30 18 * * *", "command": "bun run changelog-drafter.sh" },
  { "name": "post-merge-cleanup", "cron": "0 22 * * *", "command": "bun run post-merge-cleanup.sh" }
]
```

> **时段设计逻辑**：Drafter 放 18:30（当天合并都进 main 了，数据完整）；Cleanup 放 22:00（最深夜间，与所有活跃 loop 错峰）。两个都在 active hours 之外（Scheduling 篇定义的 9-20 之外），不抢 token 预算、不抢 worktree。

### 7.5 L2 小改动的 worktree（Cleanup 专属）

Post-Merge Cleanup 升到 L2 时，小修复用 worktree 隔离（Worktree 篇）：

```typescript
// cleanup L2: 删死代码（worktree 隔离 + verifier）
await subagent({
  agent: "worker",
  task: `PR #1245 留下了死代码: src/auth/legacy-handler.ts 整个文件已无引用。
         删掉它，确认 npm test 全绿。不改任何其他文件。`,
  worktree: true,
  acceptance: {
    criteria: [
      "仅删除 src/auth/legacy-handler.ts",
      "无其他文件改动",
      "npm test 全绿",
    ],
    verify: [{ id: "tests", command: "npm test" }],
    stopRules: ["测试失败即停，交还给人"],
  },
});
```

**acceptance 的「不改行为」铁律用 verify 兜底**：测试全绿 = 行为没变。测试挂了 = 改动越界了，立即交还给人。

---

## 八、失败模式

### Changelog Drafter 特有

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **编造功能** | S2 | 草稿里有实际不存在的 feature | verifier 逐条核对 PR 出处；state 记 source PR |
| **漏高影响项** | S2 | breaking change 没写进 notes | scan 同时看 PR 和直接 commit；用 label + conventional commit |
| **噪音过多** | S1 | Dependabot / CI 配置塞满 notes | scan skill 强化「ignore bot + pure deps」规则 |
| **语气不对** | S1 | 太干/太随意，不符合项目调性 | AGENTS.md 写「Release voice」段让 drafter 读 |
| **意外发布** | S2 | loop 自己把草稿推到 live CHANGELOG | 永不给 loop 写 tag/live CHANGELOG 权限；必须人审 + PR |
| **breaking 被埋** | S2 | breaking change 在 notes 中间，用户漏看 | verifier 强制 breaking 置顶 + callout |

### Post-Merge Cleanup 特有

| 失败 | 严重度 | 症状 | 对策 |
|------|--------|------|------|
| **误删活代码** | S2 | 把还在用的代码当死代码删了 | verifier 跑全量测试；denylist 保护 auth/payments |
| **过度清理** | S2 | 改了不该改的（行为变更） | 「不改行为」铁律 + verify 全绿 |
| **漏扫合并** | S1 | 用本地 git log 漏了 GitHub 上的 squash merge | 用 GitHub API merge list，不只本地 git |
| **TODO 噪音** | S1 | 对仓库里所有 TODO 都动手 | 只处理有合并上下文的 TODO（来自近期合并 diff） |
| **与活跃开发冲突** | S1 | cleanup PR 和正在开发的 feature 改同一文件 | off-peak 调度 + 每日 auto-PR 上限（如 2 个） |
| **off-peak 误判** | S1 | 时区设错，夜间 loop 在对方白天跑 | 明确时区；croner activeHours 明确标注 |
| **重复扫描** | S1 | 同一合并被扫三天 | state 记 ignored 列表，prune 已扫合并 |

### 二者共通

| 失败 | 症状 | 对策 |
|------|------|------|
| **bot 合并噪音** | Dependabot/renovate 合并触发无意义扫描 | scan skill 加 ignore list（Cobus 故事里踩过） |
| **state 膨胀** | state 文件越积越大 | 每 run prune 已完成/已发布项（反衰减篇 State Rot 防护） |
| **窗口错位** | since 窗口算错，重复或遗漏 | state 明确记 last run timestamp + last tag |

---

## 九、成功指标

### Changelog Drafter

| 指标 | 目标 | 说明 |
|------|------|------|
| 「合并到发布 notes」延迟 | patch <1 天 | 别再「又忘了写 changelog」 |
| 首次发布就带 notes 的比例 | >95% | |
| 人审时间/release | <5 分钟（Cobus 数据：从 15-20min 降到 4min） | loop 学会项目语气后递减 |
| 用户「surprise」遗漏项 | 接近 0 | 用户发现 notes 没写的 |

### Post-Merge Cleanup

| 指标 | 目标 | 说明 |
|------|------|------|
| 「合并后忘删 X」事故 | 持续下降 | |
| cleanup 项的平均年龄 | <7 天 | 别让尾巴拖太久 |
| cleanup PR 无评论直接合并率 | >80% | 说明提议质量高 |
| 误删率 | <2% | 超了回 L1 |

---

## 十、回顾

1. **收尾 loop 是入门首选**：风险极低、off-peak 友好、不抢主干。Daily Triage 稳定后的第二、三个 loop。
2. **Changelog Drafter 管外部沟通**：扫合并 → 分类 → 起草 release notes。人审后发布。breaking 永远置顶。
3. **Post-Merge Cleanup 管内部卫生**：扫合并 → 找尾巴（死代码/TODO/文档/flag）→ 提议 fix 或 ticket。
4. **二者天然配合**：Cleanup 清理代码 → Drafter 记账时不受噪音干扰；Drafter 发布 → 下次 Cleanup 有干净基线。
5. **与其他 loop 不冲突**：off-peak 时段 + docs/死代码对象 + 低优先级，是 Multi-Loop 体系里最安分的成员。
6. **L1→L2 演进清晰**：Drafter 从「起草」→「提议 PR」；Cleanup 从「报告」→「docs-only fix」→「删死代码」。每步看前一步准确率。
7. **「不改行为」是 Cleanup 安全基石**：verify 全量测试兜底，denylist 保护 auth/payments。
8. **「不发布」是 Drafter 安全基石**：只写草稿，发布权限永不给 loop。
9. **降噪是关键**：过滤 bot PR / 纯依赖 / 无上下文 TODO，否则草稿和报告全是噪音。
10. **off-peak 调度**：Drafter 18:30（数据完整）、Cleanup 22:00（最深错峰），都在 active hours 之外。

一句话收尾：**收尾 loop 的价值不在「做了多猛的事」，而在「让合并的后果被妥善处理」——代码干净了，用户知道了，而你睡着了。** 这是 loop 工程里投入产出比最高的一块，也是让团队真正信任 loop 的第一步。

---

## 参考资料

- [系列二：pi L1 落地](./loop-engineering-on-pi)（L1 loop 的标准结构、skill/STATE/runner 范式）
- [系列五：Multi-Loop 协调](./loop-engineering-multi-loop)（分离 state、off-peak、不抢主干、共享 denylist）
- [系列十二：Worktree 并行工程](./loop-engineering-worktree)（L2 cleanup 的 worktree 隔离）
- [系列十三：Scheduling 模式](./loop-engineering-scheduling)（off-hours 策略、croner activeHours）
- [系列七：反衰减](./loop-engineering-antidegradation)（State Rot 防护、prune 机制）
- [Cobus Greyling — Changelog Drafter pattern](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/changelog-drafter.md)
- [Cobus Greyling — Post-Merge Cleanup pattern](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/post-merge-cleanup.md)
- [Cobus Greyling — Changelog Drafter Week One story](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/changelog-drafter-week-one.md)
- [Cobus Greyling — Post-Merge Cleanup honest-win story](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/post-merge-cleanup-honest-win.md)
- pi 能力：`pi -p`（print mode）· bash（git log 扫描）· skills · STATE.md · worktree（L2）· croner off-peak 调度

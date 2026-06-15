# Skills 工程化：意图的持久化与 progressive disclosure

> 系列第十一篇。前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval)
>
> 前十篇反复出现一个词——「**还意图债**」。Daily Triage skill、CI Sweeper skill、反衰减的过时 skill、Meta-Loop 的 skill evolution……所有这些场景都指向同一个原语：**Skill**。但它到底怎么设计、怎么管理、怎么分发，一直没展开。这篇补上。

---

## 零、Skill 不是文档，是代码

先破除一个根深蒂固的误解：**skill 不是给人看的文档，是给 loop（模型）用的「可执行意图」。**

Cobus Greyling 对 skill 的定义精准到一句话：

> 「**Skills are the persistent memory of *intent*.**」（技能是意图的持久记忆。）

在 Loop Engineering 里，每次 loop 运行，agent 都是**冷启动**——它不知道你的项目用什么测试框架、哪条路不能碰、上一次踩了什么坑。Cobus 把这个缺口叫 **Intent Debt（意图债）**：

> 「每个 session，agent 都是冷启动。缺失的意图会被自信的猜测填满。**Skills 是你还意图债的方式**——约定、构建步骤、『我们不这样做因为某次事故』，写一次，每次运行都读。」

所以 skill 的本质是：**把一次性的意图教化，变成每次自动加载的能力。** 它不是 README（给人读的），不是 AGENTS.md（全量进上下文的背景），而是一个**按需加载的、可执行的、版本化的意图包**。

### Skill vs AGENTS.md vs README

| 载体 | 给谁看 | 加载方式 | 适合放 |
|------|--------|----------|--------|
| **README** | 人 | 不自动加载 | 项目介绍、安装步骤 |
| **AGENTS.md**（Context Files） | 模型 | **启动全量加载**进 system prompt | 全局约定、常用命令、铁律 |
| **Skill（SKILL.md）** | 模型 | **progressive disclosure**（描述总在，正文按需 read） | 专项流程、特定任务的完整步骤 |

关键区别在加载方式：AGENTS.md **全量进上下文**（每个 token 都花钱），skill 是**渐进披露**——只有简短描述常驻系统提示，完整指令只在需要时被 `read` 加载。这让 skill 能承载更重的内容（几十行步骤、脚本调用、铁律清单）而不挤爆上下文窗口。

---

## 一、Progressive Disclosure：skill 的核心机制

这是 skill 工程化最关键的概念，也是 pi 的 skill 系统设计哲学的核心。

### 工作原理（pi 实现）

```
启动时:
  ① pi 扫描所有 skill 位置
  ② 提取每个 skill 的 name + description（仅这两个字段）
  ③ 把所有描述以 XML 格式注入 system prompt

  system prompt 里大概长这样:
  <skill name="ci-sweeper" description="CI 失败时自动诊断+修复..." />
  <skill name="daily-triage" description="每日扫描仓库产出待办报告..." />
  <skill name="minimal-fix" description="产出最小改动修复特定问题..." />

运行时（需要某 skill 时）:
  ④ 模型判断任务匹配某 skill
  ⑤ 模型主动 read SKILL.md 全文
  ⑥ 按 SKILL.md 里的步骤执行
```

**成本结构**：

| 阶段 | token 消耗 | 频率 |
|------|-----------|------|
| 描述注入 system prompt | 每个技能 ~50 tokens | **每次会话**（常驻） |
| 正文 read 加载 | 每个技能 ~500-2000 tokens | **按需**（匹配时才花） |

假设你有 20 个 skill，描述常驻 = ~1000 tokens/次。如果全量加载正文 = ~20000-40000 tokens/次。**progressive disclosure 省 95%+ 的 token。** 这就是为什么 skill 能承载重内容而不破产。

### 模型不总是主动 read 的问题

pi 文档直言：

> 「模型并不总是会这样做[主动读取]；使用 prompt 技巧或 `/skill:name` 来强制执行它。」

这是 progressive disclosure 的弱点——**模型可能看到描述却不去 read 正文**，自以为知道怎么做，实际是冷启动的猜测。三种解法：

| 解法 | 写法 | 场景 |
|------|------|------|
| **显式 `/skill:name`** | prompt 里写「执行 /skill:daily-triage」 | loop runner 最可靠 |
| **SDK 强注入** | `skillsOverride` 把特定 skill 正文直接注入 | 需要确保 100% 加载 |
| **描述写得触发欲强** | description 写「Use when...」让模型想 read | 交互式会话 |

> **Loop 工程的铁律**：loop runner 的 prompt 里**永远显式写 `/skill:name`**，不依赖模型自动触发。skill 自动匹配是交互式的便利，loop 要确定性。

---

## 二、SKILL.md 设计原则

把 skill 当代码写，有设计原则。

### 原则 1：描述要 boring 且 specific

pi 文档对 description 的要求精准：**「The description determines when the agent loads the skill. Be specific.」**

```yaml
# 好：具体说做什么、什么时候用
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.

# 坏：太泛，不知道什么时候触发
description: Helps with PDFs.
```

为什么「boring 且 specific」？因为 description 是**唯一的触发信号**——模型只看这一句话决定要不要 read 正文。太泛 = 误触发或漏触发。太花哨 = 模型理解偏差。

Loop 场景下，description 应包含：
- **做什么**（动词开头）
- **什么时候用**（Use when...）
- **边界**（只读/不改源码等关键约束可以放描述里）

```yaml
# Loop skill 的好描述
description: CI 失败时自动诊断根因并修复。仅 src/ 下最小改动，绝不碰 lockfile/secrets/migrations。Use when CI check fails.
```

### 原则 2：正文要结构化、可执行

正文不是散文，是**可执行的步骤清单**：

````markdown
---
name: ci-sweeper
description: CI 失败时自动诊断根因并修复。仅 src/ 下最小改动...
---

# CI Sweeper

## 步骤
1. 读 `STATE.md` 的 Active 段，查失败历史
2. `git log --since="1 day ago"` 看近期合并
3. 读 CI 日志，分类失败类型（compile/test/flaky/deps）
4. 按分类决策（见下表）
5. 改动后 `npm test && npm run lint`
6. 回写 STATE.md 的 Active 段

## 分类决策表
| 类型 | 动作 |
|------|------|
| compile | INVESTIGATE → 最小改动修复 |
| test (regression) | INVESTIGATE → 对比上次通过的 commit |
| flaky | EXIT + quarantine ticket（不改代码） |
| deps | ESCALATE（供应链，人决） |

## 铁律（不可违反）
- 只改 src/ 下文件
- 绝不碰 lockfile / secrets / migrations
- flaky 不改代码，只 quarantine
- 最小改动，不重构
````

结构化的好处：模型按编号执行，每步可验证，失败可定位到具体步骤。散文式的 skill = 模型跳步、遗漏、自由发挥。

### 原则 3：用相对路径引用资源

skill 目录可以包含脚本、参考文档、模板。pi 文档明确要求用**相对路径**：

```
ci-sweeper/
├── SKILL.md              # 主指令
├── scripts/
│   └── classify.sh       # 分类脚本（bash 可执行）
├── references/
│   └── failure-catalog.md # 失败案例参考（按需 read）
└── assets/
    └── state-template.md  # STATE.md 模板
```

SKILL.md 里引用：

```markdown
分类失败类型时，参考 [failure-catalog.md](references/failure-catalog.md) 里的历史案例。
```

**相对路径的约束**：skill 可能被安装到任意位置（全局/项目/包），绝对路径会断裂。相对路径保证 skill 可移植。

### 原则 4：铁律放显眼位置

「铁律」是 skill 里最重要的部分——它定义**不可逾越的边界**。设计原则：

- 放在正文的**显眼位置**（开头或独立 section）
- 用**祈使句**（「绝不碰」「只允许」「禁止」）
- 与 runner 的 `tools` 白名单**互为兜底**：skill 说「禁止改 src/」是软约束，tools 不含 `edit`/`write` 是硬约束

```markdown
## 铁律（不可违反）
- 绝不修改 .env / secrets / migrations
- 只改 src/ 下文件
- flaky test → quarantine，不改代码
- 改动不超过 3 文件 / 20 行
```

> 两者缺一不可：只有 skill 铁律 = 模型可能「忘记」；只有 tools 白名单 = 模型知道不能做却不知道为什么（无法做合法操作时的替代方案）。**软约束教意图，硬约束兜底线。**

---

## 三、Skill 的层次：pi 的发现路径

pi 从六个位置发现 skill，各有用途。理解层次是 skill 工程化的基础。

| 层次 | 路径 | 作用域 | 需 trust | 适合放 |
|------|------|--------|----------|--------|
| **全局（pi 专用）** | `~/.pi/agent/skills/` | 所有项目 | 否 | 个人通用能力（搜索、PDF 处理） |
| **全局（跨工具）** | `~/.agents/skills/` | 所有项目 | 否 | 多工具共享（Claude Code/Codex 通用） |
| **项目（pi 专用）** | `.pi/skills/` | 本仓库 | **是** | 项目特定 loop（ci-sweeper） |
| **项目（跨工具）** | `.agents/skills/` | 本仓库 + 祖先 | **是** | 团队共享的约定 |
| **包** | `package.json` 的 `pi.skills` | 安装即生效 | 随包 | 可分发的复用 skill |
| **CLI** | `--skill <path>` | 本次运行 | 否 | 临时加载/调试 |

### 发现规则细节

```
~/.pi/agent/skills/         根目录 .md 文件 → 独立 skill
                            含 SKILL.md 的子目录 → skill
                            递归发现

.pi/skills/                 同上（项目信任后加载）

~/.agents/skills/           含 SKILL.md 的子目录 → skill
                            根目录 .md 文件 → 忽略（不发现）

.agents/skills/             同上 + 向祖先目录递归（到 git root 或 FS root）
```

**为什么 `~/.agents/skills/` 忽略根目录 `.md`**：这是 Agent Skills 标准的约定。`.md` 文件是文档，不是 skill；`SKILL.md` 才是 skill 的入口。pi 在 `~/.pi/agent/skills/` 和 `.pi/skills/` 放宽了这条（允许根目录 `.md`），但标准目录保持严格。

### 跨工具复用

pi 原生支持加载其他工具的 skill：

```json
// settings.json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

```json
// .pi/settings.json（项目级）
{
  "skills": ["../.claude/skills"]
}
```

这是 skill 工程化的关键能力：**一份 SKILL.md，多个 agent 工具复用**。因为 Agent Skills 是跨工具标准，pi/Claude Code/Codex 都实现了它。你写的 ci-sweeper skill，换个工具照样能用。

---

## 四、好的 Skill vs 坏的 Skill

Cobus 的 anti-patterns 文档里，好几条本质都是 skill 写得差。这里集中列反模式。

### 反模式 1：太长（没有 progressive disclosure）

```markdown
❌ 把整个 CI 修复流程 + 所有历史案例 + 测试命令 + 代码规范
   全写进一个 SKILL.md（3000+ tokens 正文）

   → 如果模型每次都 read，3000 tokens 飞了
   → 更可能模型看了太长直接跳过，自己瞎搞
```

**正确**：SKILL.md 正文控制在 500-1500 tokens。长内容拆进 `references/` 子目录，按需 read。

```markdown
✅ SKILL.md (500 tokens): 核心步骤 + 铁律 + 分类决策表
   references/failure-catalog.md (2000 tokens): 历史案例，按需 read
   references/test-conventions.md (800 tokens): 测试约定，按需 read
```

### 反模式 2：太虚（没有可执行步骤）

```markdown
❌ "修复 CI 失败。分析根因，提出修复方案，确保测试通过。"

   → 这是 prompt 不是 skill。模型已经会「分析根因」，
     skill 的价值是告诉它「怎么分析、按什么分类、什么不做」
```

**正确**：具体步骤 + 分类决策表 + 铁律。skill 补的是模型**不知道的**（项目特定约定），不是模型**已经会的**（通用推理）。

### 反模式 3：缺铁律（没有边界）

```markdown
❌ 只有步骤，没有「禁止做什么」

   → 模型按步骤跑，碰到 lockfile 也改了
   → 因为它不知道这个项目 lockfile 是人手动维护的
```

**正确**：铁律与步骤同等重要。铁律定义**不可逾越的边界**，步骤定义**该怎么做**。

### 反模式 4：与代码重复

```markdown
❌ SKILL.md 里写 "运行 npm test 来测试"

   → 但 package.json 里 scripts.test 已经定义了
   → 改了 package.json 忘了改 skill = 两个真相源
```

**正确**：skill 引用代码，不复制代码。

```markdown
✅ "运行 package.json 里定义的 test script"
   或 "运行 npm test（脚本定义见 package.json）"
```

### 反模式 5：描述太泛导致误触发

```yaml
❌ description: "帮助处理代码问题"

   → 模型遇到任何代码问题都想加载这个 skill
   → 应该只在 CI 失败时触发，却 PR review 时也触发了
```

**正确**：description 写明触发条件（Use when...）+ 边界。

### 对照总表

| 维度 | 好 skill | 坏 skill |
|------|----------|----------|
| 描述 | specific + Use when | 泛泛一句话 |
| 正文 | 500-1500 tokens，结构化步骤 | 3000+ tokens 散文 或 50 tokens 空话 |
| 铁律 | 明确边界，祈使句 | 无 |
| 长内容 | 拆 references/ 按需 read | 全堆 SKILL.md |
| 与代码 | 引用不复制 | 复制粘贴 |
| 触发 | description 精准 | 泛到哪都触发 |

---

## 五、Skill 与 Memory 的分工

这是最容易混淆的边界。Memory 篇把 skill 归类为「③长期记忆（主动）」，这里展开它与 memory 工具的区别。

| 维度 | Skill（SKILL.md） | Memory（memory 工具） |
|------|-------------------|----------------------|
| **存什么** | **怎么干**（稳定的流程/约定/铁律） | **干了啥**（变化的状态/历史/偏好） |
| **变化频率** | 低（周/月级修改） | 高（每次 run 可能写） |
| **谁写** | 人（或 Meta-Loop 提议 → 人审） | loop 运行时自动 |
| **加载方式** | progressive disclosure（描述常驻，正文按需） | memory_search 检索注入 |
| **版本管理** | Git（进仓库或包） | memory 工具内部管理 |
| **失效形态** | 过时（项目变了 skill 没跟） | stale（引用过期） |

**一句话区分**：

> **Skill = 稳定的「怎么干」（编译型知识）；Memory = 变化的「干了啥」（运行时数据）。**

具体例子：

| 信息 | 放 Skill | 放 Memory |
|------|----------|-----------|
| 「本项目用 bun test 不用 jest」 | ✅ | ❌（太稳定，不需要 memory） |
| 「src/auth/ 改动前必读 token-refresh.ts」 | ✅ | ❌ |
| 「上次 #142 CI 失败是因为 mock 没更新」 | ❌ | ✅（一次性事件） |
| 「用户偏好用中文回复」 | ❌ | ✅（偏好类） |
| 「CI 失败分类：compile→修，flake→quarantine」 | ✅ | ❌（决策规则不变） |
| 「这个 loop 本周合并了 3 个 PR」 | ❌ | ✅（状态类） |

**Meta-Loop 的 skill evolution 是两者的桥梁**（Meta-Loop 篇已详述）：memory 里积累的失败经验，被 Meta-Loop 归因后提炼成 skill 条目——**变化的「干了啥」沉淀成稳定的「怎么干」**。这是 loop 越跑越聪明的机制。

---

## 六、Skill 版本管理与跨项目复用

Skill 是代码，就该用代码的方式管理：版本化、可分发、可复用。

### 6.1 Git 化

项目级 skill（`.pi/skills/`）天然进 Git，随仓库版本化。团队 clone 仓库 = 自动获得所有 skill（信任后加载）。

全局 skill（`~/.pi/agent/skills/`）建议也用 Git 管理：

```bash
# 把全局 skill 放一个 Git 仓库
~/.pi/agent/skills/
├── .git/
├── brave-search/
│   └── SKILL.md
├── pdf-tools/
│   └── SKILL.md
└── web-scraper/
    └── SKILL.md
```

### 6.2 pi Package 分发

pi 的 package 系统让 skill 可通过 npm/git 分发。在 `package.json` 声明：

```json
{
  "name": "@myteam/loop-skills",
  "keywords": ["pi-package"],
  "pi": {
    "skills": ["./skills"]
  }
}
```

安装：

```bash
# 从 npm
pi install npm:@myteam/loop-skills@1.0.0

# 从 git（团队私有）
pi install git:github.com/myteam/loop-skills@v1

# 项目级安装（写 .pi/settings.json，团队共享）
pi install npm:@myteam/loop-skills -l
```

**版本固定**：`@1.0.0` 会 pin 版本，`pi update` 不升级。不固定 = 最新。对 loop skill 这种影响行为的制品，**建议固定版本**——避免静默升级导致行为漂移（反衰减篇的 Behavior Drift）。

### 6.3 包内 skill 的过滤

不是所有 skill 都该对所有项目生效。pi 支持包级别过滤：

```json
{
  "packages": [
    {
      "source": "npm:@myteam/loop-skills",
      "skills": ["skills/ci-sweeper", "skills/daily-triage"],
      "!skills": ["skills/legacy-triage"]
    }
  ]
}
```

- `skills: ["skills/ci-sweeper"]` 只加载指定
- `skills: []` 加载零个
- `!skills: [...]` 排除指定
- 不写 = 加载全部

**Multi-loop 场景**：不同项目用不同 loop 子集。生产项目只装 ci-sweeper + daily-triage；实验项目只装 daily-triage。

### 6.4 跨工具兼容

Agent Skills 是跨工具标准。一个写得规范的 SKILL.md：

```
my-skill/
├── SKILL.md          # 标准 frontmatter（name + description）
├── scripts/
└── references/
```

- pi 发现它（`.pi/skills/` 或 `~/.agents/skills/`）
- Claude Code 发现它（`.claude/skills/`）
- Codex 发现它（`.codex/skills/`）

**铁律**：SKILL.md 里**不写工具特定的指令**（不写 `/skill:name`、不写 pi API）。只用标准的 `read`/`bash` 等通用工具操作。这样 skill 才真正跨工具可移植。

---

## 七、实战：完整的 ci-sweeper SKILL.md + 发现配置

把前面的原则集合成一个完整范例。

### 7.1 目录结构

```
.pi/skills/
└── ci-sweeper/
    ├── SKILL.md
    ├── scripts/
    │   └── classify.sh           # CI 日志分类脚本
    └── references/
        ├── failure-catalog.md    # 历史失败案例（按需 read）
        └── test-conventions.md   # 测试约定（按需 read）
```

### 7.2 SKILL.md

````markdown
---
name: ci-sweeper
description: CI 失败时自动诊断根因并修复。仅 src/ 下最小改动，绝不碰 lockfile/secrets/migrations。Use when CI check run fails.
---

# CI Sweeper

## 铁律（不可违反）
- **只改 src/ 下文件**
- 绝不碰 lockfile（package-lock.json / yarn.lock / pnpm-lock.yaml）
- 绝不碰 secrets / migrations / auth / k8s
- flaky test → quarantine + 开 ticket，**不改代码**
- 改动不超过 3 文件 / 20 行
- 不为过 CI 禁用测试或调大 timeout

## 步骤
1. 读 `STATE.md` 的 Active 段，查这个 issue 的失败历史
2. `git log --since="1 day ago" --oneline` 看近期合并
3. 读 CI 日志，用 `./scripts/classify.sh` 分类失败类型
4. 按分类决策（见下表）
5. 改动后运行测试：`npm test && npm run lint && npm run typecheck`
6. 回写 `STATE.md` 的 Active 段（记录 attempt + 根因）

## 分类决策表
| 类型 | 症状 | 动作 |
|------|------|------|
| **compile** | TypeScript/语法错 | INVESTIGATE → 最小改动修复 |
| **test (regression)** | 断言失败 | 对比上次通过的 commit，找引入点 |
| **test (flaky)** | 间歇性超时/网络 | EXIT + quarantine ticket |
| **lint** | 格式/规范 | INVESTIGATE → auto-fix |
| **deps** | 依赖解析失败 | **ESCALATE**（供应链，人决） |
| **infra/env** | 环境变量/配置 | **ESCALATE** |

## 失败历史查询
修前先读 [failure-catalog.md](references/failure-catalog.md) 找相似案例。
修后（无论成败）把根因追加到 failure-catalog.md。
测试约定见 [test-conventions.md](references/test-conventions.md)。

## MAX_ATTEMPTS
同一 issue 最多修 3 次。第 3 次仍失败 → ESCALATE。
````

### 7.3 分类脚本

```bash
# scripts/classify.sh
#!/bin/bash
# 从 stdin 读 CI 日志，输出分类
LOG=$(cat)
if echo "$LOG" | grep -qiE "error TS[0-9]|syntax error|cannot find"; then
  echo "compile"
elif echo "$LOG" | grep -qiE "timeout|ETIMEDOUT|flaky"; then
  echo "flaky"
elif echo "$LOG" | grep -qiE "assert|expected.*got|toMatch"; then
  echo "test"
elif echo "$LOG" | grep -qiE "npm ERR|ENOTFOUND|ERESOLVE"; then
  echo "deps"
else
  echo "unknown"
fi
```

**为什么用脚本而不是让模型分类**：分类是**确定性逻辑**（正则匹配），不是推理。用脚本 = 快、省 token、不漂移。模型负责用分类结果做决策（推理部分），不负责分类本身（机械部分）。

### 7.4 发现配置

```json
// .pi/settings.json
{
  "skills": [".pi/skills/ci-sweeper"],
  "enableSkillCommands": true
}
```

或什么都不配——pi 自动发现 `.pi/skills/` 下含 `SKILL.md` 的目录（项目信任后）。

### 7.5 loop runner 里强制加载

```typescript
await session.prompt(
  `执行 /skill:ci-sweeper。读 STATE.md，处理 CI 失败，产出修复。`
);
```

`/skill:ci-sweeper` 强制加载全文，不依赖模型自动匹配。

---

## 八、Skill 特有的失败模式

| 失败模式 | 症状 | 根因 | 对策 |
|----------|------|------|------|
| **描述太泛** | skill 被错误触发（不该用时用了） | description 没有 Use when 条件 | 加触发条件，boring 且 specific |
| **正文不 read** | 模型看到描述却跳过正文，自己瞎搞 | progressive disclosure 的固有弱点 | loop prompt 显式 `/skill:name`；交互式靠 description 吸引力 |
| **skill 膨胀** | SKILL.md 越写越长，挤爆上下文 | 长内容堆主文件 | 拆 `references/`，正文 ≤1500 tokens |
| **过时 skill** | 项目变了 skill 没跟（命令改了/约定变了） | 没有定期审查 | 反衰减篇机制（Meta-Loop 审查 + 人定期 audit） |
| **铁律失效** | 模型「忘记」铁律，越界操作 | 只有软约束（skill 文字），无硬约束 | tools 白名单兜底（`-t` 不含 edit/write） |
| **skill 冲突** | 两个 skill 描述重叠，都触发 | 没有排他性设计 | 描述写清各自边界；name 唯一（pi 发现重名会警告） |
| **跨工具不兼容** | SKILL.md 写了 pi 特定指令，换工具失效 | 违反 Agent Skills 标准 | 只用通用工具（read/bash），不写工具特定 API |
| **版本漂移** | 包升级后 skill 行为变了 | 没固定版本 | `pi install npm:pkg@1.0.0` pin 版本 |

### 最危险的两个

**正文不 read** 是 loop 场景最危险的——loop 要确定性，不能靠「模型可能 read」。**解法只有一条**：loop runner prompt 里永远显式 `/skill:name`。

**铁律失效** 是 L3 场景最危险的——skill 说「禁止改 lockfile」但模型改了。**解法**：tools 白名单是硬底线。skill 铁律 + tools 白名单，两层缺一不可。

---

## 九、Skill 工程化检查清单

| 维度 | 检查项 |
|------|--------|
| **描述** | specific？含 Use when？≤1024 字符？ |
| **正文** | ≤1500 tokens？结构化步骤？有铁律？ |
| **长内容** | 拆 references/？相对路径引用？ |
| **铁律** | 有不可逾越的边界？与 tools 白名单互为兜底？ |
| **触发** | loop runner 显式 `/skill:name`？ |
| **层次** | 全局/项目/包 放对位置了？ |
| **版本** | 包固定版本？全局 skill Git 管理？ |
| **跨工具** | 只用通用工具？不写工具特定指令？ |
| **过时防护** | 有定期审查机制（Meta-Loop/人 audit）？ |
| **冲突** | 与其他 skill 描述不重叠？name 唯一？ |

---

## 十、回顾

1. **Skill 是意图的持久化，不是文档**。它让冷启动的 agent 每次都「知道怎么干」，是还 Intent Debt 的工具。
2. **Progressive disclosure 是核心机制**。描述常驻 system prompt（~50 tokens/skill），正文按需 read（~500-2000 tokens）。省 95%+ token。
3. **SKILL.md 四原则**：描述 boring 且 specific；正文结构化可执行；相对路径引用；铁律放显眼位置。
4. **pi 六层发现路径**：全局（pi/跨工具）、项目（pi/跨工具）、包、CLI。项目级需 trust。
5. **好 skill vs 坏 skill**：结构化步骤 vs 散文；有铁律 vs 无边界；拆 references vs 堆主文件；引用代码 vs 复制代码。
6. **Skill vs Memory**：skill = 稳定的「怎么干」（编译型知识）；memory = 变化的「干了啥」（运行时数据）。
7. **版本管理 = 代码管理**。Git 化 + pi package 分发 + 版本固定 + 包级过滤 + 跨工具兼容。
8. **正文不 read 和铁律失效最危险**。解法：loop 永远显式 `/skill:name`；tools 白名单硬兜底。
9. **Meta-Loop 的 skill evolution 桥接两者**：memory 积累 → 归因 → 提炼成 skill → 人审 → 下次不失败。

一句话收尾：**好的 skill 系统，让 loop 第 100 次运行和第 1 次一样「知道怎么干」——不是因为模型记住了，而是因为意图被持久化在了代码里。这就是 skill 工程化的本质：把人的判断力，编译成 loop 的肌肉记忆。**

---

## 参考资料

- [pi 官方文档 — Skills](https://pi.dev) · [GitHub: earendil-works/pi](https://github.com/earendil-works/pi)
- [pi 官方文档 — Packages（skill 分发）](https://pi.dev)
- [Agent Skills 标准](https://agentskills.io/specification)
- [Cobus Greyling — Primitives（Skills 段）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/primitives.md)
- [Cobus Greyling — Concepts（Intent Debt）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [系列四：Memory 系统（skill 作为长期记忆的定位）](./loop-engineering-memory)
- [系列二：pi L1 落地（SKILL.md 写法范例）](./loop-engineering-on-pi)
- [系列七：反衰减（过时 skill 的防治）](./loop-engineering-antidegradation)
- [系列八：Meta-Loop（skill evolution 闭环）](./loop-engineering-meta-loop)
- pi 能力：progressive disclosure · 六层发现路径 · `/skill:name` · pi package · skillsOverride（SDK）· enableSkillCommands

---
title: Pi-Mono 多级 Skill Graph 改造方案
---

# Pi-Mono 多级 Skill Graph 改造方案

> 本文档描述如何在 Pi-Mono 框架基础上，实现支持三级架构（Compound → Molecule → Atom）的 Skill Graph 系统。涵盖问题识别、解决思路与完整实现方案，可供其他开发者或 AI Agent 直接复现。

---

## 目录

1. [问题描述](#1-问题描述)
2. [解决思路](#2-解决思路)
3. [实现方案](#3-实现方案)
   - [3.1 三层架构设计](#31-三层架构设计)
   - [3.2 Skill 文件规范](#32-skill-文件规范)
   - [3.3 目录结构](#33-目录结构)
   - [3.4 人机交互规则](#34-人机交互规则)
   - [3.5 Skill Graph Enforcer 扩展](#35-skill-graph-enforcer-扩展)
   - [3.6 子 Agent 兼容性方案](#36-子-agent-兼容性方案)
4. [完整实现步骤](#4-完整实现步骤)
5. [验证清单](#5-验证清单)

---

## 1. 问题描述

### 1.1 Pi 当前 Skill 加载机制的局限

Pi 框架当前的 Skill 加载流程如下：

```
Pi 启动
  │
  ├─ 扫描所有 skill 目录（.pi/skills/, ~/.pi/agent/skills/ 等）
  ├─ 仅提取每个 skill 的 frontmatter 中的 name + description
  ├─ 生成 <available_skills> XML 注入系统提示词
  │     └─ 所有 skill 平铺展示，无层级概念
  │
用户输入 prompt
  │
  ├─ LLM 看到平铺的 skill 列表
  ├─ LLM 自行决定用 read 工具加载哪个 SKILL.md
  ├─ Pi 将完整 SKILL.md 注入为 <skill name="xxx"> 块
  └─ LLM 按 SKILL.md 正文指引自行决定是否 read 下级 skill
```

**核心问题：Pi 对 Skill 之间的层级关系毫无感知。** 所有 skill 在 `<available_skills>` 中平铺展示，依赖关系完全依赖 LLM 的自觉性来遵守。

### 1.2 具体风险场景

| 风险场景 | 严重程度 | 示例 |
|---------|---------|------|
| **跳过顶层直接加载底层** | 高 | LLM 看到某个底层 atom 直接 read，绕过了 compound 和 molecule 的完整流程编排 |
| **跨层调用** | 高 | compound 直接 read atom，跳过 molecule 层 |
| **循环依赖** | 中 | LLM 在 molecule A → molecule B → molecule A 之间循环 read |
| **依赖缺失无法检测** | 中 | SKILL.md 的 `delegates-to` 引用的 skill 不存在或已改名 |
| **无法追踪加载状态** | 低 | 不知道当前处于哪个层级、下一步该加载什么 |

### 1.3 子 Agent 场景下的冲突

当父 Agent 启动子 Agent 来执行具体步骤时（Pi 的 subagent 扩展通过 `spawn("pi", [...])` 创建独立进程），子 Agent 同样会：
- 扫描相同的 `.pi/skills/` 目录
- 加载相同的 `.pi/extensions/` 扩展

此时如果强制要求"自顶向下加载"，子 Agent 只需调用某个 atom 时会被 Enforcer 拦截并报错：

```
父 Agent → 子 Agent 执行某个 atom
  └─ Enforcer: 🚫 跨层违规！atom 被直接加载，跳过了 molecule 层
```

**根本矛盾：完整工作流需要"自顶向下"的严格规则，而子 Agent 场景只需要原子能力的按需调度。**

---

## 2. 解决思路

### 2.1 不改造 Pi 内核，利用 Extension 系统

Pi 提供了强大的 Extension 扩展机制，可以在运行时拦截和修改行为，无需修改 Pi 源码。可用的事件钩子：

| 事件 | 拦截点 | 可用于 |
|------|--------|--------|
| `before_agent_start` | Agent 启动前，系统提示词已构建 | 注入 Skill Graph 拓扑图和加载规则 |
| `tool_call` | 工具调用前 | 检测 read 操作，验证加载顺序 |
| `tool_result` | 工具返回后 | 在 read 结果中注入引导信息 |
| `context` | 上下文准备阶段 | 跟踪已加载 skill 状态 |
| `session_start` | 会话初始化 | 重置加载状态 |

### 2.2 双模式兼容：standalone 标记

通过 `metadata.standalone` frontmatter 字段区分两种调用模式：

- **`standalone: true`**：可被独立调用（子 Agent 场景），跳过层级验证
- **`standalone: false`** 或不标注：必须遵循自顶向下加载规则

这样：
- **完整工作流模式**：compound → molecule → atom（Enforcer 强制层级）
- **子 Agent 模式**：直接调用 atom（Enforcer 放行 standalone skill）

### 2.3 人机交互规则内置

在涉及人机交互的 Skill 正文中内置两条规则：
1. **一次只问一个问题**：禁止一次性抛出多个问题
2. **选项推荐规则**：提供推荐选项 + 最推荐提示 + 自由输入选项

---

## 3. 实现方案

### 3.1 三层架构设计

```
┌────────────────────────────────────────────────────────────────────┐
│                    COMPOUND (化合物)                                │
│                                                                    │
│  高层编排，人类驱动。对应"业务流程"或"工作剧本"。                      │
│  依赖分子，赋予 agent 较高的自主判断权。                                │
│  建议依赖上限：8-10 个 molecule。                                     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  compound-<业务名称>                                           │  │
│  │  描述：完整的端到端业务流程                                      │  │
│  │  人类驱动点：关键决策节点需要人类确认                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  compound-<业务名称>                                           │  │
│  │  ...（可根据需要定义多个 compounds）                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ delegates-to
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        MOLECULE (分子)                                │
│                                                                      │
│  流程组合，显式编排。组合 2-10 个原子完成一个有范围的任务。                │
│  编排逻辑（顺序、条件分支、并行）写进正文，不留给 agent 猜测。             │
│  建议依赖上限：10 个 atom。                                             │
│                                                                      │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐              │
│  │ molecule-<    │ │ molecule-<    │ │ molecule-<    │              │
│  │  阶段名称>    │ │  阶段名称>    │ │  阶段名称>    │              │
│  │               │ │               │ │               │              │
│  │ N 个 atoms    │ │ N 个 atoms    │ │ N 个 atoms    │              │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘              │
└──────────┼─────────────────┼──────────────────────────────────────────┘
           │ delegates-to    │
     ┌─────┼────┐      ┌─────┼────┐
     ▼     ▼    ▼      ▼     ▼    ▼      ▼     ▼     ▼
┌────────────────────────────────────────────────────────────────────┐
│                            ATOM (原子)                              │
│                                                                    │
│  单一职责，接近确定性。不调用其他任何 skill。                            │
│  输入输出明确，执行结果高度一致。                                       │
│  metadata.standalone: true → 可被子 Agent 直接调用                    │
│                                                                    │
│  atom-<操作名>   atom-<操作名>   atom-<操作名>                        │
│  atom-<操作名>   atom-<操作名>   atom-<操作名>                        │
│  ... (所有 atom 均标记为 standalone)                                   │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 Skill 文件规范

#### 3.2.1 Frontmatter 规范

每个 `SKILL.md` 必须包含 YAML frontmatter：

```yaml
---
name: skill-name                     # 必填。与所在目录名完全一致。
description: >                       # 必填。供 agent 判断是否加载本 skill。
  一句话描述本 skill 的用途和适用场景。
layer: atom                          # 必填。取值：atom | molecule | compound
delegates-to:                        # 分子和化合物必填，原子禁填（standalone 除外）。
  - skill-name-1
  - skill-name-2
metadata:                            # 可选。
  standalone: true                   # 标记为 true 表示可被独立调用（子 Agent 场景）。
---
```

**字段约束：**

| 字段 | 必填 | 约束 |
|------|------|------|
| `name` | 是 | 小写字母+数字+连字符，与目录名一致，最长 64 字符 |
| `description` | 是 | 描述"做什么 + 什么场景触发"，最长 1024 字符 |
| `layer` | 是 | 只能取 `atom` / `molecule` / `compound` |
| `delegates-to` | 分子/化合物必填 | 列出所有被调度的下层 skill 名称 |
| `metadata.standalone` | 可选 | `true` 表示可被独立调用，跳过层级验证 |

#### 3.2.2 各层正文结构

**Atom 正文结构：**

```markdown
## 用途

[一句话说明这个原子做什么]

## 前置条件

[执行前需要满足的条件]

## 输入

[接受什么输入，格式要求]

## 执行步骤

1. [步骤 1，极其具体，不留歧义]
2. [步骤 2]
3. [步骤 3]

## 输出

[产出什么，格式是什么]

## 错误处理

[遇到什么情况应停止并报告]
```

**Molecule 正文结构：**

```markdown
## 用途

[说明这个分子解决什么问题]

## 依赖的原子

使用 read 工具按需加载以下原子 skill：

- `../atom-1/SKILL.md`：[用于什么步骤]
- `../atom-2/SKILL.md`：[用于什么步骤]

## 编排流程

> **铁律：一次只问一个问题。** ...
> **选项推荐规则：** ...

[明确的步骤序列，指定在哪一步加载哪个原子]

1. 加载并执行 `atom-1`：[说明传入什么、期望得到什么]
2. 根据 atom-1 的结果：
   - 如果 [条件 A]，加载并执行 `atom-2`
   - 如果 [条件 B]，直接进入步骤 3
3. 加载并执行 `atom-3`：[说明]

## 输出

[整体产出什么]

## 失败处理

[某个原子失败时，整体如何响应]
```

**Compound 正文结构：**

```markdown
## 用途

[说明这个化合物对应的业务流程或工作剧本]

## 人类驱动点

> **铁律：一次只问一个问题。** ...
> **选项推荐规则：** ...

[说明人类需要在哪些决策点介入，以及介入方式]

## 依赖的分子

使用 read 工具按需加载以下分子 skill：

- `../molecule-1/SKILL.md`：[用于什么阶段]
- `../molecule-2/SKILL.md`：[用于什么阶段]

## 编排策略

[描述分子的编排逻辑。默认顺序、并行时机、何时需要人类确认]

## 成功标准

[什么状态代表化合物执行完成]

## 已知局限

[在哪些场景下可能不可靠，人类应注意什么]
```

### 3.3 目录结构

```
项目根目录/
├── AGENTS.md                              # 项目上下文文件
├── .pi/
│   ├── settings.json                      # Pi 配置
│   ├── skills/                            # 项目级 Skills
│   │   ├── atom-<操作名>/
│   │   │   └── SKILL.md
│   │   ├── atom-<操作名>/
│   │   │   └── SKILL.md
│   │   ├── ... (其他 atoms)
│   │   ├── molecule-<阶段名>/
│   │   │   └── SKILL.md
│   │   ├── ... (其他 molecules)
│   │   ├── compound-<业务名>/
│   │   │   └── SKILL.md
│   │   └── ... (其他 compounds)
│   └── extensions/
│       └── skill-graph-enforcer.ts        # Skill Graph 强制执行扩展
```

### 3.4 人机交互规则

#### 规则一：一次只问一个问题

> **铁律：一次只问一个问题。** 每次与用户交互时，仅提出一个问题，等待用户回答后再进行下一步。禁止一次性抛出多个问题。

**应用场景：**
- 访谈利益相关者时逐个提问
- 大纲/草稿确认时逐章展示
- 修改建议逐条询问
- 确认事项逐项进行

#### 规则二：选项推荐规则

> **选项推荐规则：** 向用户提问时，如果问题有推荐可选项，必须同时提供：
> 1. **推荐选项**：2-4 个常见选择
> 2. **最推荐提示**：标注 "⭐ 推荐"，基于当前上下文给出最优建议
> 3. **自由输入**：提供 "自定义" 选项，允许用户输入任何值

**示例格式：**

> A) 选项一  B) 选项二  C) 选项三  ⭐ D) 推荐选项  E) 自定义：___

### 3.5 Skill Graph Enforcer 扩展

#### 3.5.1 扩展职责

| 职责 | 实现方式 | 触发时机 |
|------|---------|---------|
| **拓扑注入** | `before_agent_start` 修改系统提示词 | 每次 Agent 启动前 |
| **加载验证** | `tool_call` 拦截 read，验证层级关系 | read 执行前 |
| **循环检测** | `tool_call` 检查最近 10 次加载历史 | read 执行前 |
| **引导注入** | `tool_result` 在 read 结果末尾追加注释 | read 返回后 |
| **状态查询** | `/skill-graph-status` 命令 | 用户手动调用 |
| **违规警告** | 自定义消息类型渲染 | 检测到违规时 |

#### 3.5.2 Skill Graph 拓扑定义

```typescript
interface SkillNode {
  name: string;           // skill 名称，与目录名一致
  layer: "compound" | "molecule" | "atom";
  delegatesTo: string[];  // 依赖的下层 skill 名称
  standalone: boolean;    // 是否可被独立调用
}
```

#### 3.5.3 运行时状态

```typescript
interface LoadingState {
  loadedSkills: Set<string>;   // 已完整加载的 skill 名称集合
  activeCompound: string | null; // 当前正在执行的根 compound
  loadHistory: Array<{
    skill: string;
    timestamp: number;
    context: string;
  }>;  // 加载历史记录
}
```

#### 3.5.4 核心验证逻辑

```typescript
function validateTopDownLoading(
  targetSkill: string,
  state: LoadingState,
): { valid: boolean; reason?: string; suggestion?: string } {
  const node = SKILL_MAP.get(targetSkill);

  // 不在 Graph 中的 skill，不干预
  if (!node) return { valid: true };

  // Compound 始终是入口点
  if (node.layer === "compound") return { valid: true };

  // ★ 关键：standalone skill 允许独立调用（解决子 Agent 冲突）
  if (node.standalone) return { valid: true };

  // Molecule：检查父 compound 是否已加载
  if (node.layer === "molecule") {
    const parents = SKILL_GRAPH.filter(
      s => s.layer === "compound" && s.delegatesTo.includes(targetSkill)
    );
    if (!parents.some(p => state.loadedSkills.has(p.name))) {
      return { valid: false, reason: "...", suggestion: "..." };
    }
  }

  // Atom：检查父 molecule 是否已加载
  if (node.layer === "atom") {
    const parents = SKILL_GRAPH.filter(
      s => s.layer === "molecule" && s.delegatesTo.includes(targetSkill)
    );
    if (!parents.some(p => state.loadedSkills.has(p.name))) {
      return { valid: false, reason: "...", suggestion: "..." };
    }
  }

  return { valid: true };
}
```

#### 3.5.5 系统提示词注入内容

Enforcer 在 `before_agent_start` 时向系统提示词追加：

```markdown
## Skill Graph 加载规则

你必须严格按照以下层级结构加载 skill，从顶层 compound 开始，逐层向下：

**compound-<业务名>**
  └─ molecule-<阶段名>
     └─ atom-<操作名>
     └─ atom-<操作名>
  └─ molecule-<阶段名>
     └─ atom-<操作名>
     └─ ...

（Enforcer 根据 SKILL_GRAPH 数组动态生成完整的拓扑树）

### 强制规则
1. **必须从 compound 开始**：先加载 compound SKILL.md，再按需加载其依赖的 molecule
2. **不跨层调用**：compound 只调用 molecule，molecule 只调用 atom，atom 不调用任何 skill
3. **按需加载**：只有在执行到需要某层 skill 的步骤时才 read 对应的 SKILL.md
4. **禁止循环依赖**：不得重复加载同一个 skill

### Standalone Skills（可独立调用）
以下 atom 被标记为 standalone，可以被直接调用，无需遵循自顶向下规则：
- `atom-<操作名>`
- `atom-<操作名>`
...

### 加载模板
1. read compound-xxx/SKILL.md        ← 入口点，了解整体流程
2. read molecule-yyy/SKILL.md          ← 按需加载当前步骤需要的 molecule
3. read atom-zzz/SKILL.md              ← molecule 指引你加载需要的 atom
4. 执行 atom 的操作
5. 返回 molecule 继续下一步骤
```

#### 3.5.6 事件处理流程图

```
用户输入 prompt
    │
    ▼
before_agent_start
    │ 注入 Skill Graph 拓扑 + 加载规则到系统提示词
    ▼
LLM 决定加载某个 compound
    │
    ▼
tool_call: read compound-xxx/SKILL.md
    │ ✓ 验证通过（compound 是入口点）
    │ state.loadedSkills.add("compound-xxx")
    ▼
tool_result: read 返回
    │ 注入引导注释："<!-- 已加载 compound，下一步加载 molecule -->"
    ▼
LLM 加载 molecule-yyy
    │
    ▼
tool_call: read molecule-yyy/SKILL.md
    │ ✓ 验证通过（父 compound 已加载）
    ▼
LLM 尝试直接读 atom（跳过 molecule 指引）
    │
    ▼
tool_call: read atom-zzz/SKILL.md
    │ ✓ 验证通过（standalone = true，允许独立调用）
    │
    │ 但如果 atom 没有 standalone 标记且 molecule 未加载：
    │ ✗ 违规！发送警告消息
    ▼
LLM 收到警告，回退到正确的加载顺序
```

### 3.6 子 Agent 兼容性方案

#### 3.6.1 问题

Pi 的 subagent 扩展通过 `spawn("pi", ["--mode", "json", ...])` 创建独立进程。子 Agent 进程：
- 同样扫描 `.pi/skills/`，发现全部 skills
- 同样加载 `.pi/extensions/`，Enforcer 同样生效

如果 Enforcer 强制所有 skill 必须自顶向下加载，子 Agent 只需某个 atom 时会被拦截。

#### 3.6.2 解决方案：metadata.standalone

在所有 atom 的 SKILL.md 中添加：

```yaml
---
name: atom-<操作名>
layer: atom
metadata:
  standalone: true
---
```

Enforcer 验证逻辑中的关键判断：

```typescript
// ★ standalone skill 跳过层级检查
if (node.standalone) {
  return { valid: true };
}
```

#### 3.6.3 子 Agent 场景完整流程

```
父 Agent: "用 scout 搜索一下 XXX 领域的最新资料"
    │
    ▼
父 Agent 调用 subagent 工具
    │  spawn("pi", ["--mode", "json", "-p", "--no-session", ...])
    │
    ▼
子 Agent 启动（独立进程，同一 cwd）
    │
    ├─ 扫描 .pi/skills/ → 发现全部 skills
    ├─ 加载 .pi/extensions/ → Enforcer 激活
    │  before_agent_start → 注入 Skill Graph 拓扑
    │
    ▼
子 Agent 直接 read atom-<操作名>/SKILL.md
    │
    ▼
Enforcer 拦截 tool_call (read)
    │
    ├─ detectSkillNameFromPath → "atom-<操作名>"
    ├─ SKILL_MAP.get("atom-<操作名>") → { standalone: true, layer: "atom", ... }
    │
    └─ validateTopDownLoading:
         node.standalone === true → 返回 { valid: true }
         不发送违规警告
    │
    ▼
子 Agent 执行操作，返回结果给父 Agent
    │
    └─ 进程结束
```

#### 3.6.4 设计语义

| 层级 | standalone | 语义 |
|------|-----------|------|
| Compound | `false` | 必须作为完整工作流的入口 |
| Molecule | `false` | 必须由 compound 调度，不独立使用 |
| Atom | `true` | 可被 molecule 调度，也可被独立调用（子 Agent / 手动调用） |

---

## 4. 完整实现步骤

### 步骤 1：创建项目目录结构

```bash
# 进入项目根目录
cd /path/to/project

# 创建 skills 目录（根据实际需求调整 skill 名称和数量）
mkdir -p .pi/skills/{atom-<操作名>,molecule-<阶段名>,compound-<业务名>}
mkdir -p .pi/skills/{<所有需要的 atom 目录>}
mkdir -p .pi/skills/{<所有需要的 molecule 目录>}
mkdir -p .pi/skills/{<所有需要的 compound 目录>}

# 创建 extensions 目录
mkdir -p .pi/extensions
```

### 步骤 2：创建所有 Skill 文件

**自底向上创建：**

1. **先创建所有 atoms**：每个 `SKILL.md` 包含 frontmatter（含 `metadata.standalone: true`）+ 正文（用途→前置条件→输入→执行步骤→输出→错误处理）

2. **再创建所有 molecules**：每个 `SKILL.md` 包含 frontmatter（含 `delegates-to` 列出依赖的 atoms）+ 正文（用途→依赖的原子→编排流程→输出→失败处理），编排流程开头注入人机交互规则

3. **最后创建 compounds**：每个 `SKILL.md` 包含 frontmatter（含 `delegates-to` 列出依赖的 molecules）+ 正文（用途→人类驱动点→依赖的分子→编排策略→成功标准→已知局限），人类驱动点注入人机交互规则

**每个 SKILL.md 的 frontmatter 模板：**

```yaml
---
name: <与目录名一致>
description: >
  <描述做什么 + 什么场景触发>
layer: <atom|molecule|compound>
delegates-to:       # 仅 molecule 和 compound
  - <依赖的 skill 名称>
metadata:           # 仅 atom
  standalone: true
---
```

### 步骤 3：创建 Enforcer 扩展

创建 `.pi/extensions/skill-graph-enforcer.ts`：

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ============================================================================
// 1. Skill Graph 拓扑定义
// ============================================================================

interface SkillNode {
  name: string;
  layer: "compound" | "molecule" | "atom";
  delegatesTo: string[];
  standalone: boolean;
}

const SKILL_GRAPH: SkillNode[] = [
  // 在此列出所有 compounds
  { name: "compound-<业务名>", layer: "compound", delegatesTo: ["molecule-<阶段名>", ...], standalone: false },
  // ...

  // 在此列出所有 molecules
  { name: "molecule-<阶段名>", layer: "molecule", delegatesTo: ["atom-<操作名>", ...], standalone: false },
  // ...

  // 在此列出所有 atoms（standalone: true）
  { name: "atom-<操作名>", layer: "atom", delegatesTo: [], standalone: true },
  // ...
];

const SKILL_MAP = new Map(SKILL_GRAPH.map((s) => [s.name, s]));

// ============================================================================
// 2. 运行时状态
// ============================================================================

interface LoadingState {
  loadedSkills: Set<string>;
  activeCompound: string | null;
  loadHistory: Array<{ skill: string; timestamp: number; context: string }>;
}

function createLoadingState(): LoadingState {
  return {
    loadedSkills: new Set(),
    activeCompound: null,
    loadHistory: [],
  };
}

// ============================================================================
// 3. 核心验证逻辑
// ============================================================================

function detectSkillNameFromPath(path: string): string | null {
  const match = path.match(/skills\/([^/]+)\//);
  return match ? match[1] : null;
}

function validateTopDownLoading(
  targetSkill: string,
  state: LoadingState,
): { valid: boolean; reason?: string; suggestion?: string } {
  const node = SKILL_MAP.get(targetSkill);

  // 不在 Graph 中的 skill，不干预
  if (!node) return { valid: true };

  // Compound 始终是入口点
  if (node.layer === "compound") return { valid: true };

  // ★ 关键：standalone skill 允许独立调用
  if (node.standalone) return { valid: true };

  // Molecule：检查父 compound 是否已加载
  if (node.layer === "molecule") {
    const parents = SKILL_GRAPH.filter(
      (s) => s.layer === "compound" && s.delegatesTo.includes(targetSkill),
    );
    if (!parents.some((p) => state.loadedSkills.has(p.name))) {
      return {
        valid: false,
        reason: `跨层违规：molecule "${targetSkill}" 被加载，但其父 compound 尚未加载`,
        suggestion: `请先加载以下 compound 之一：${parents.map((p) => p.name).join(", ")}`,
      };
    }
  }

  // Atom：检查父 molecule 是否已加载
  if (node.layer === "atom") {
    const parents = SKILL_GRAPH.filter(
      (s) => s.layer === "molecule" && s.delegatesTo.includes(targetSkill),
    );
    if (!parents.some((p) => state.loadedSkills.has(p.name))) {
      return {
        valid: false,
        reason: `跨层违规：atom "${targetSkill}" 被直接加载，跳过了 molecule 层`,
        suggestion: `请先加载以下 molecule 之一：${parents.map((p) => p.name).join(", ")}`,
      };
    }
  }

  return { valid: true };
}

function detectCircularDependency(
  targetSkill: string,
  state: LoadingState,
): { hasCycle: boolean; cycle?: string } {
  const recentSkills = state.loadHistory.slice(-10).map((h) => h.skill);
  const seen = new Set<string>();
  for (const skill of recentSkills) {
    if (seen.has(skill)) {
      return { hasCycle: true, cycle: `检测到潜在循环依赖：${skill} 被重复加载` };
    }
    seen.add(skill);
  }
  return { hasCycle: false };
}

// ============================================================================
// 4. 生成 Skill Graph 拓扑提示
// ============================================================================

function generateGraphPrompt(): string {
  let prompt = `## Skill Graph 加载规则\n\n`;
  prompt += `你必须严格按照以下层级结构加载 skill，从顶层 compound 开始，逐层向下：\n\n`;

  for (const compound of SKILL_GRAPH.filter((s) => s.layer === "compound")) {
    prompt += `**${compound.name}**\n`;
    for (const moleculeName of compound.delegatesTo) {
      const molecule = SKILL_MAP.get(moleculeName);
      prompt += `  └─ ${moleculeName}\n`;
      if (molecule) {
        for (const atomName of molecule.delegatesTo) {
          prompt += `     └─ ${atomName}\n`;
        }
      }
    }
    prompt += `\n`;
  }

  prompt += `### 强制规则\n`;
  prompt += `1. **必须从 compound 开始**：先加载 compound SKILL.md，再按需加载其依赖的 molecule\n`;
  prompt += `2. **不跨层调用**：compound 只调用 molecule，molecule 只调用 atom，atom 不调用任何 skill\n`;
  prompt += `3. **按需加载**：只有在执行到需要某层 skill 的步骤时才 read 对应的 SKILL.md\n`;
  prompt += `4. **禁止循环依赖**：不得重复加载同一个 skill\n\n`;

  prompt += `### Standalone Skills（可独立调用）\n`;
  prompt += `以下 atom 被标记为 standalone，可以被直接调用，无需遵循自顶向下规则：\n`;
  const standaloneAtoms = SKILL_GRAPH.filter((s) => s.standalone).map((s) => s.name);
  prompt += standaloneAtoms.map((n) => `- \`${n}\``).join("\n") + "\n\n";

  prompt += `### 加载模板\n`;
  prompt += `\`\`\`\n`;
  prompt += `1. read compound-xxx/SKILL.md        ← 入口点，了解整体流程\n`;
  prompt += `2. read molecule-yyy/SKILL.md          ← 按需加载当前步骤需要的 molecule\n`;
  prompt += `3. read atom-zzz/SKILL.md              ← molecule 指引你加载需要的 atom\n`;
  prompt += `4. 执行 atom 的操作\n`;
  prompt += `5. 返回 molecule 继续下一步骤\n`;
  prompt += `\`\`\`\n`;

  return prompt;
}

// ============================================================================
// 5. Extension 入口
// ============================================================================

export default function (pi: ExtensionAPI) {
  const state = createLoadingState();

  // 会话初始化
  pi.on("session_start", async (_event, _ctx) => {
    Object.assign(state, createLoadingState());
  });

  // 注入拓扑到系统提示词
  pi.on("before_agent_start", async (event, _ctx) => {
    const graphPrompt = generateGraphPrompt();
    return {
      systemPrompt: event.systemPrompt + `\n\n` + graphPrompt,
    };
  });

  // 拦截 read，验证加载顺序
  pi.on("tool_call", async (event, _ctx) => {
    if (event.toolName !== "read") return;

    const targetPath = (event.input as { path?: string }).path;
    if (!targetPath) return;
    if (!targetPath.endsWith("SKILL.md") && !targetPath.endsWith("SKILL.MD")) return;

    const skillName = detectSkillNameFromPath(targetPath);
    if (!skillName) return;

    // 循环依赖检测
    const cycleCheck = detectCircularDependency(skillName, state);
    if (cycleCheck.hasCycle) {
      pi.sendMessage(
        { customType: "skill-graph-enforcer", content: `⚠️ ${cycleCheck.cycle}`, display: true },
        { deliverAs: "steer" },
      );
    }

    // 加载顺序验证
    const validation = validateTopDownLoading(skillName, state);
    if (!validation.valid) {
      pi.sendMessage(
        {
          customType: "skill-graph-enforcer",
          content: `🚫 Skill Graph 加载违规\n\n${validation.reason}\n\n💡 ${validation.suggestion}`,
          display: true,
          details: {
            violatedRule: validation.reason,
            suggestion: validation.suggestion,
            targetSkill: skillName,
            isStandalone: SKILL_MAP.get(skillName)?.standalone ?? false,
          },
        },
        { deliverAs: "steer", triggerTurn: true },
      );
    }

    // 记录加载历史
    state.loadedSkills.add(skillName);
    state.loadHistory.push({ skill: skillName, timestamp: Date.now(), context: `read ${targetPath}` });

    const node = SKILL_MAP.get(skillName);
    if (node && node.layer === "compound") {
      state.activeCompound = skillName;
    }
  });

  // 在 read 结果中注入引导
  pi.on("tool_result", async (event, _ctx) => {
    if (event.toolName !== "read") return;
    if (!event.content || !Array.isArray(event.content)) return;

    const targetPath = (event.input as { path?: string }).path;
    if (!targetPath) return;
    if (!targetPath.endsWith("SKILL.md") && !targetPath.endsWith("SKILL.MD")) return;

    const skillName = detectSkillNameFromPath(targetPath);
    if (!skillName) return;

    const node = SKILL_MAP.get(skillName);
    if (!node) return;

    let guidance = "";
    if (node.layer === "compound") {
      guidance = `\n\n<!-- Skill Graph Enforcer: 已加载 compound "${skillName}"。下一步请按需加载以下 molecule 之一：${node.delegatesTo.join(", ")} -->`;
    } else if (node.layer === "molecule") {
      guidance = `\n\n<!-- Skill Graph Enforcer: 已加载 molecule "${skillName}"。请按正文中的编排流程执行，需要时 read 以下 atom：${node.delegatesTo.join(", ")} -->`;
    } else if (node.standalone) {
      guidance = `\n\n<!-- Skill Graph Enforcer: "${skillName}" 是 standalone skill，可被独立调用，无需遵循自顶向下加载顺序 -->`;
    }

    if (guidance) {
      const lastContent = event.content[event.content.length - 1];
      if (lastContent.type === "text") {
        lastContent.text += guidance;
      }
    }
  });

  // 状态查询命令
  pi.registerCommand("skill-graph-status", {
    description: "查看当前 Skill Graph 加载状态",
    handler: async (_args, ctx) => {
      const lines: string[] = [];
      lines.push(`📊 Skill Graph 加载状态\n`);
      lines.push(`活跃 Compound: ${state.activeCompound ?? "无"}\n`);
      lines.push(`已加载 Skills (${state.loadedSkills.size}):`);

      for (const layer of ["compound", "molecule", "atom"] as const) {
        const loadedInLayer = Array.from(state.loadedSkills).filter(
          (name) => SKILL_MAP.get(name)?.layer === layer,
        );
        if (loadedInLayer.length > 0) {
          lines.push(`  [${layer}] ${loadedInLayer.join(", ")}`);
        }
      }

      lines.push(`\n加载历史:`);
      for (const entry of state.loadHistory.slice(-5)) {
        lines.push(`  → ${entry.skill} (${new Date(entry.timestamp).toLocaleTimeString()})`);
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  // 自定义消息渲染器
  pi.registerMessageRenderer("skill-graph-enforcer", (message, options, theme) => {
    const { Text } = require("@mariozechner/pi-tui");
    const { expanded } = options;
    let text = theme.fg("warning", `[Skill Graph] `) + message.content;

    if (expanded && message.details) {
      text += "\n" + theme.fg("dim", JSON.stringify(message.details, null, 2));
    }

    return new Text(text, 0, 0);
  });
}
```

### 步骤 4：创建配置文件

**`.pi/settings.json`：**

```json
{
  "enableSkillCommands": true
}
```

**`AGENTS.md`（项目上下文文件）：**

```markdown
# <项目名称> Agent

基于 pi 构建的智能体项目。

## 架构
- N 个 Compounds
- N 个 Molecules
- N 个 Atoms
- 1 个 Skill Graph Enforcer 扩展

## 使用方法
/skill:compound-<业务名>    # 启动完整工作流
```

### 步骤 5：启动验证

```bash
cd /path/to/project
pi
```

---

## 5. 验证清单

完成所有步骤后，逐项检查：

### Skill 文件验证

- [ ] `name` 字段与所在目录名完全一致
- [ ] `layer` 字段值与实际行为一致（atom 不调用其他 skill，molecule 只调用 atom，compound 只调用 molecule）
- [ ] `description` 清晰描述用途和触发场景
- [ ] 原子不含 `delegates-to`
- [ ] 分子/化合物的 `delegates-to` 列出所有被调度的 skill，且均已存在
- [ ] 正文中的相对路径均可从 skill 目录正确解析
- [ ] 没有循环依赖（A → B → A）
- [ ] 没有跨层依赖（compound 直接调用 atom）
- [ ] 所有 atom 均标注 `metadata.standalone: true`
- [ ] 涉及人机交互的 Skill 正文中包含"铁律"和"选项推荐规则"

### Enforcer 扩展验证

- [ ] `SKILL_GRAPH` 数组包含所有定义的 skills
- [ ] `SKILL_GRAPH` 中的依赖关系与 SKILL.md 中的 `delegates-to` 一致
- [ ] `standalone: true` 标记与 SKILL.md 中的 `metadata.standalone` 一致
- [ ] `before_agent_start` 正确注入拓扑图到系统提示词
- [ ] `tool_call` 正确拦截 read 操作并验证
- [ ] standalone skill 被正确放行
- [ ] 违规时正确发送警告消息
- [ ] `tool_result` 正确注入引导注释
- [ ] `/skill-graph-status` 命令正常工作

### 端到端场景验证

- [ ] 主 Agent 执行 compound 时，按自顶向下顺序加载
- [ ] 子 Agent 直接调用 atom 时，Enforcer 不报错
- [ ] 子 Agent 直接调用非 standalone skill 时，Enforcer 发出警告
- [ ] 人机交互时遵守"一次只问一个问题"
- [ ] 人机交互时提供推荐选项 + 最推荐提示 + 自定义选项

---

## 附录：项目文件结构模板

```
├── AGENTS.md
├── .pi/
│   ├── settings.json
│   ├── extensions/
│   │   └── skill-graph-enforcer.ts
│   └── skills/
│       ├── atom-<操作名>/
│       │   └── SKILL.md
│       ├── ... (所有 atoms)
│       ├── molecule-<阶段名>/
│       │   └── SKILL.md
│       ├── ... (所有 molecules)
│       ├── compound-<业务名>/
│       │   └── SKILL.md
│       └── ... (所有 compounds)
```

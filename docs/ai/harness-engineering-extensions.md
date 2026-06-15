# 扩展与技能加载机制：Harness 怎么长出新能力

> 没有扩展机制的 harness 是死的——能力只能改源码。扩展机制让 harness 成可生长底盘：不重编译就长出新工具、新命令、新知识。本篇拆 extension（带代码）与 skill（带知识）两种形态、加载时序、冲突治理、热重载。

---

## 目录

- [引言：harness 不改源码也能长能力](#引言harness-不改源码也能长能力)
- [6.1 extension vs skill：两种能力形态](#61-extension-vs-skill两种能力形态)
- [6.2 extension 的四类接口](#62-extension-的四类接口)
- [6.3 skill 的两级加载](#63-skill-的两级加载)
- [6.4 加载时序：扫描→注册→注入](#64-加载时序扫描注册注入)
- [6.5 进程内 vs 进程外](#65-进程内-vs-进程外)
- [6.6 冲突治理](#66-冲突治理)
- [6.7 热重载与版本管理](#67-热重载与版本管理)
- [6.8 反模式](#68-反模式)
- [迁移清单](#迁移清单)
- [下一步](#下一步)

---

## 引言：harness 不改源码也能长能力

harness 出厂只有内置原语：read/write/edit/bash、固定系统提示、一套会话模型。能力边界被源码焊死。想加「危险命令拦截器」「外部 API 检索」「团队代码规范」都得改 harness 本体——每家用一份 fork，升级 rebase 到吐。

扩展机制打破焊缝：把「能力」从「源码」解耦，变成**可独立加载、可分发、可热替换的模块**。内核只留 loop、上下文、工具调度，其余外包给扩展与技能。这层抽象沿两轴展开——轴一**带不带代码**（执行逻辑 vs 注入知识），轴二**加载时机**（启动全量 vs 运行时按需），交叉落出两种形态：

- **extension**：带代码的可执行模块——注册工具、命令、钩子、上下文提供器，启动时加载进进程。
- **skill**：带知识的轻量文件——一份 `SKILL.md`，描述常驻、正文按需读。

## 6.1 extension vs skill：两种能力形态

### 定义

**extension**：跑在 harness 进程内的代码模块，经注册接口把新能力挂进 loop。带逻辑、带状态、带副作用——能拦工具、发 HTTP、开子进程。

**skill**：一份遵循 [Agent Skills 标准](https://agentskills.io/specification) 的 `SKILL.md`，只装知识（步骤、规范、脚本引用），靠「被模型 read 进上下文」生效。

### 为何要分两种

两种本质不同的需求：「harness 原生不会做」需**代码执行**（调 API、开进程、改文件）→ extension；「模型会做但不知规矩」需**注入知识**（规范、流程）→ skill。混进一种都踩坑：extension 装大段文本是杀鸡用牛刀（常驻内存、改字要 reload）；skill 描述执行逻辑是空中楼阁（Markdown 拦不了工具、发不了请求，模型不照做能力就消失）。判别：**这能力需不需要 harness 主动参与？**→extension 还是 skill。

### 对比表

| 维度 | extension（带代码） | skill（带知识） |
|------|---------------------|-----------------|
| **形态** | TS 模块（`index.ts`），经 jiti 加载 | `SKILL.md` + frontmatter |
| **加载成本** | 启动全量加载进进程；常驻 | frontmatter 常驻；正文按需 read |
| **生效方式** | 注册工具/命令/钩子，主动参与 loop | 注入描述→模型按需读正文→照做 |
| **失败影响** | 崩溃可能拖垮主进程 | 最坏知识缺失，不致崩 |
| **副作用** | 有（拦工具、发请求、改文件） | 无（纯文本，靠模型执行） |
| **适用场景** | 拦截器、外部集成、自定义工具、UI | 规范、流程、领域 SOP、操作指南 |
| **分发** | npm 包 / git / 本地文件 | 目录 / 仓库 / 多 harness 共享 |

一句话：**extension 改「能做什么」，skill 改「怎么做」。**

### 怎么做（pi）

```
~/.pi/agent/
├── extensions/
│   └── danger-gate.ts        # extension：拦 rm -rf
└── skills/
    └── deploy-sop/
        └── SKILL.md          # skill：部署操作规范
```

pi 启动扫描两目录，分别走 extension 加载与 skill 注入（见 6.4）。

### 反模式

- **extension 装大段规范文本**：启动开销、改字要重载，不如 skill 轻。
- **skill 描述需副作用的能力**：「这 skill 会拦 bash」——Markdown 拦不了，必须落成 extension。

## 6.2 extension 的四类接口

### 定义

| 概念接口 | 作用 | pi 实现 |
|----------|------|---------|
| **registerTool** | 注册 LLM 可调用的工具 | `pi.registerTool(definition)` |
| **registerCommand** | 注册用户可调用的斜杠命令 | `pi.registerCommand(name, { handler })` |
| **promptHook** | 在系统提示/对话流上挂钩子 | `pi.on("before_agent_start", ...)` |
| **contextProvider** | 向上下文注入信息 | `pi.on("context", ...)` / `pi.on("resources_discover", ...)` |

> 映射要点：`registerTool`/`registerCommand` 是显式方法；`promptHook`/`contextProvider` 是**概念分类**——pi 无同名方法，用**事件系统**（`pi.on`）实现。`before_agent_start` 充当 prompt hook（改系统提示、注入消息）；`context`（每轮改消息）与 `resources_discover`（贡献 skill/prompt/theme 路径）充当 context provider。四类本质是「extension 能挂的四个挂载点」。

### 为何是这四类

四类恰好覆盖 agent loop 全部干预面，每个咽喉点对应一类：

```
用户输入 ──> [registerCommand] 斜杠命令拦截
              │（非命令）
              ▼
         [promptHook] before_agent_start：改系统提示/注入消息
              │
              ▼
       ┌─ LLM 推理 ──┐
       │  [contextProvider] context：每轮改 messages
       └────工具调用──┘
              │
              ▼
         [registerTool] 自定义工具执行
```

少任一类，extension 就在 loop 某段够不着（缺 registerTool 模型调不到新能力，缺 contextProvider 没法每轮动态注入，以此类推）。

### 怎么做（pi）

四挂载点各一例：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // ① registerTool：LLM 可调工具
  pi.registerTool({
    name: "fetch_doc",
    label: "Fetch Doc",
    description: "拉取内部文档系统某篇文档",
    promptSnippet: "Fetch internal docs by id",
    parameters: Type.Object({ id: Type.String() }),
    async execute(_id, params, _s, _u, _ctx) {
      const text = await fetch(`https://docs.local/${params.id}`).then(r => r.text());
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  // ② registerCommand：用户斜杠命令
  pi.registerCommand("sweep", {
    description: "扫当前目录 TODO",
    handler: async (_args, ctx) => { ctx.ui.notify("Sweeping...", "info"); /* ... */ },
  });

  // ③ promptHook：before_agent_start 改系统提示
  pi.on("before_agent_start", async (event, _ctx) => {
    return { systemPrompt: event.systemPrompt + "\n\n本仓库强制 4 空格缩进。" };
  });

  // ④ contextProvider：resources_discover 贡献路径
  pi.on("resources_discover", async (_e, _ctx) => ({
    skillPaths: ["/team/shared-skills"],
  }));
}
```

关键特性：`registerTool` **运行时也能调用**——在 `session_start`、命令、事件里新工具**立即生效**进 `pi.getAllTools()`，无需 `/reload`，支撑「动态工具集」。

### 反模式

- **context hook 里做阻塞 IO**：`context` 每轮都跑，一次阻塞全 loop 卡死。重活异步化。
- **promptHook 注入超大文本**：每轮系统提示膨胀、token 被吃光。静态规范走 skill 按需 read。
- **registerTool 不写 `promptSnippet`/`description`**：模型不知何时该用，注册了等于没注册。
- **状态塞模块级变量**：reload 拆旧 runtime，模块级状态失效。持久化走 `pi.appendEntry`。

## 6.3 skill 的两级加载

skill 精妙不在内容，在**加载策略**——用两级加载把「常驻成本」压到极低。

### 定义

skill 采用 **progressive disclosure（渐进披露）**：第一级（常驻）启动只提取每个 skill 的 `name`+`description`，拼成 `<available_skills>` XML 注入系统提示；第二级（按需）任务命中时模型用 `read` 把完整 `SKILL.md` 正文读进上下文。

```
启动：扫 skills/ → 提 frontmatter → 注系统提示：
    <available_skills>
      <skill name="deploy-sop" description="生产部署规范..."/>
      <skill name="db-migrate" description="数据库迁移步骤..."/>
    </available_skills>
  → 仅名+描述常驻，正文 0 token

运行（命中）：用户"帮我部署" → 模型 read deploy-sop/SKILL.md → 正文进上下文 → 照步骤执行
```

### 为何要两级

若所有 skill 正文一次性塞系统提示，三后果：token 爆炸（N 个 × 几百行撑爆窗口）；注意力稀释（模型在无关正文里找任务）；启动慢（全量读盘+注入）。两级加载用「目录+摘要常驻，正文懒加载」解决——该调才付读全文的代价，把预算支配权交还模型。这是 skill 区别于「静态 AGENTS.md」的关键：后者全量常驻，skill 按需展开。

### 怎么做（pi）

skill 目录只放一个 `SKILL.md`，frontmatter 两字段必填：

````markdown
---
name: deploy-sop
description: 生产环境部署规范。用于发版、回滚、灰度切换。涉及 k8s 与 CDN。
---

# Deploy SOP

## 前置检查
```bash
./scripts/preflight.sh
```

## 发版步骤
1. 打 tag → 2. 触发 CI → 3. 等镜像就绪 → 4. kubectl apply
````

| 字段 | 必填 | 规则 |
|------|------|------|
| `name` | 是 | ≤64 字符，小写字母/数字/连字符，无连续连字符 |
| `description` | 是 | ≤1024 字符，写清「做什么 + 何时用」 |
| `disable-model-invocation` | 否 | `true` 时隐藏于系统提示，只能 `/skill:name` 强制 |
| `allowed-tools` | 否 | 预批准工具列表（实验性） |

> **description 是命脉**：决定模型何时加载该 skill。`帮助部署` 太虚模型不知何时调；`生产环境部署规范，用于发版/回滚/灰度，涉及 k8s 与 CDN` 才让「帮我部署」精准命中。写法：列触发场景（匹配任务词）、点技术栈边界（避免同类误调）、别写「怎么做」（正文活）。

强制加载（模型有时不主动 read）：

```bash
/skill:deploy-sop              # 加载并执行
/skill:db-migrate add-column   # 带参数加载
```

`/skill:name` 绕过「模型判该不该读」直接喂正文，调试常用。

### 反模式

- **正文太长**：SKILL.md 写成万字，一 read 吃半窗口。长内容拆 `references/`，正文只放主干 + 相对链接。
- **description 写成标题**：「Deploy SOP」≠ 何时用，必须写场景。
- **靠模型主动 read 不验证**：模型不总读，关键 skill 在系统提示点名或 `/skill:` 强制。

## 6.4 加载时序：扫描→注册→注入

extension 与 skill 加载发生在启动不同阶段，理解时序才能定位「能力没生效」。

### 定义

启动加载四步：

```
pi 启动
  │
  ① 扫描（SCAN）
  │   ~/.pi/agent/extensions/ + .pi/extensions/  → extension 列表
  │   ~/.pi/agent/skills/    + .pi/skills/       → skill 列表
  │
  ② 信任裁决（TRUST）   ← 仅 project-local 资源需过 project_trust
  │
  ③ 注册（REGISTER）
  │   extension：jiti 加载 TS → 执行 factory → registerTool/Command/on(...)
  │   skill：提取 frontmatter，存入 available_skills 目录
  │
  ④ 注入（INJECT）
  │   available_skills XML 拼进系统提示；extension 工具进 selectedTools
  ▼
session_start → resources_discover（extension 可再贡献 skill/prompt 路径）
  ▼
loop 就绪
```

### 为何要分阶段

关键区分：**extension 启动时全量加载，skill 正文运行时按需 read**。extension 代码须 loop 跑起来前就位——钩子注册晚了前几轮拦不到，工具没注册模型看不见。skill 正文绝不能启动加载——正文常驻等于退化成 AGENTS.md。

`project_trust` 是安全闸门：项目级 `.pi/extensions` 与 `.agents/skills` 在**项目被信任前不加载**，只有全局 extension 与 CLI `-e` extension 参与 trust 决策——没它，克隆仓库就能执行任意代码。

### 怎么做（pi）

诊断「能力没生效」按四步排查：

| 症状 | 排查点 |
|------|--------|
| 命令/工具不出现 | 扫描目录对不对；项目是否 trusted；factory 有没有抛错 |
| skill 在目录里但模型不调 | description 是否命中场景；是否被 `disable-model-invocation` 隐藏 |
| 工具注册了但 LLM 不调 | `promptSnippet`/`description` 写没写；`setActiveTools` 有没有禁用 |
| 修改后没生效 | extension 是否需 `/reload`；skill 正文 read 重读即可 |

### 反模式

- **factory 顶层阻塞初始化**：factory 返回 Promise 时 pi 会 await，阻塞整个启动。重活挪进 `session_start` 或后台。
- **注册命令撞内置**：覆盖 `/help` 之类，用户行为突变（见 6.6）。

## 6.5 进程内 vs 进程外

extension 还有维度：**代码跑哪**——主进程内还是外部进程，决定隔离性、性能、故障半径。

### 定义

| 形态 | 代码位置 | 典型实现 |
|------|----------|----------|
| **进程内** | 与 loop 同进程，共享内存/ctx | pi 默认：jiti 加载 TS 进主进程 |
| **进程外** | 独立进程/服务，经 IPC 桥接 | MCP server / HTTP 服务 / 子进程工具 |

```
进程内 extension：
  ┌──────── 主进程 ─────────┐
  │  loop  ↔  extension.ts  │   零 IPC，共享 ctx/ui/sessionManager
  └─────────────────────────┘

进程外能力源：
  ┌──── 主进程 ────┐        ┌──── 外部进程 ────┐
  │ loop ↔ bridge  │ ─IPC─> │ MCP server / 子进程│
  │  (extension)   │ <────  │ (任意语言/降权)    │
  └────────────────┘        └───────────────────┘
```

### 为何要选：权衡四要素

内核是**故障半径**：这能力的 bug 能不能拖垮整个 harness？拦截器、上下文改写**必须进程内**（要用主进程 `ctx`/`sessionManager`/UI，进程外够不着），代价是 bug 直接打 loop 脸、handler 须包 try/catch。调外部不可信 API、跑用户脚本、跨语言库则**该进程外**——崩了不拖垮 harness，且可降权、跨语言。

| 维度 | 进程内 | 进程外 |
|------|--------|--------|
| **性能** | 零 IPC，最快 | 有序列化/IPC 开销 |
| **隔离性** | 差：崩了拖垮主 loop | 好：外部崩了主 loop 不死 |
| **权限** | = 用户全权 | 可降权（外部进程单独身份） |
| **部署** | 一个文件，jiti 直跑 | 要起服务/管子进程，复杂 |
| **跨语言** | 仅 TS/JS | 任意 |
| **状态** | 直接共享主进程内存 | 必须序列化传递 |

### 怎么做（pi）：选型决策

```text
要拦工具调用 / 改系统提示 / 操控 UI / 读 sessionManager？
  → 必须 进程内（这些 API 只在主进程 ctx 上）

要调外部服务 / 跑危险命令 / 用非 JS 库 / 跨 harness 复用？
  → 进程外：extension 在进程内当桥接层，转发到外部进程
```

pi 的 extension 文件本身是**进程内** TS 模块（jiti 加载）。「进程外能力」两种接入：一是进程内 extension 用 `child_process`/`fetch` 桥接外部服务/子进程，主 loop 受保护；二是 MCP/RPC 工具源，能力以独立 server 暴露，harness 当 client 接入，多 harness 共用、语言无关。

> **何时上进程外：能力不可信、需降权、要跨语言、或崩了不能拖垮主 loop。** 进程内是默认，进程外是「故障半径不能覆盖 harness 本身」时才上——IPC 与部署复杂度是实打实成本。

### 反模式

- **不可信库直接 `import` 进进程内**：库崩了拖垮 loop。不可信逻辑进程外化。
- **进程内不做错误隔离**：handler 抛未捕获异常息火整个会话。外部调用包 try/catch。
- **进程外不做超时**：外部进程挂住，工具调用永远等。设超时 + 心跳。
- **能进程内的硬上进程外**：简单工具也起 MCP server，部署与延迟都不值。

## 6.6 冲突治理

能力越多冲突越多。两 extension 注册同名工具、两 skill 重名、命令撞内置——治理不好就是「能力互相打架」。

### 定义 + 为何必须

| 冲突类型 | 触发 | 不治理后果 |
|----------|------|-----------|
| **工具名冲突** | 两 extension 注册同名工具 | 后者覆盖前者 / 调用歧义 |
| **命令冲突** | `/cmd` 撞内置或撞别家 | 行为突变，用户困惑 |
| **skill 重名** | 两 skill 同 `name` | 加载歧义，描述打架 |

根因：**扁平命名空间下名字是唯一协调点**，多源加载（全局+项目+包）几乎必然撞名——这是机制使然。治理不是「避免撞」，而是给名字加结构，让冲突从「偶发 bug」变「可预测的覆盖规则」。

### 怎么做（pi + 通用治理）

| 冲突 | pi 行为 | 治理对策 |
|------|---------|----------|
| skill 重名 | warn，**保留第一个找到的** | 加载顺序决定；团队用命名空间前缀（`team-`） |
| 工具/命令重名 | 按加载顺序注册，后到者覆盖 | **强制 scope 前缀**：`team_fetch` 而非 `fetch` |
| 撞内置命令 | 自定义优先 | 不覆盖高频内置（`/help`/`/reload`），改名 |

工程层硬规矩：

1. **命名空间**：自定义工具/命令带 scope 前缀（`org_`、`team-`），从源头避撞——唯一能预防而非事后发现冲突的手段。
2. **加载顺序显式化**：global → project → CLI `-e`/`--skill`，后者覆盖前者。诊断冲突先查加载链。
3. **工具启用集**：`pi.setActiveTools()` 动态开关，冲突时按场景裁剪启用集。
4. **skill 目录隔离**：团队 skill 与个人 skill 分目录，`name` 自带归属前缀。
5. **冲突可观测**：启动打印已加载能力清单与覆盖关系，warn 别淹没在日志。

核心思想：**把冲突从隐式 bug 变成显式规则**，任一环节缺失就变难复现的神秘行为。

```typescript
// 命名空间前缀：从源头防撞
pi.registerTool({ name: "acme_fetch_doc", /* ... */ });
pi.registerCommand("acme-sweep", { /* ... */ });
```

### 反模式

- **裸名注册**：`registerTool({ name: "search" })` 必撞——几十个扩展都想要 `search`。
- **依赖加载顺序解决冲突**：顺序是隐式的，换机器/换用户就变。靠命名空间，不靠顺序。
- **skill 重名只 warn 不修**：warn 在日志一闪而过，实际是「想要的 skill 没加载」的隐形 bug。

## 6.7 热重载与版本管理

开发扩展/skill 最痛是「改一行要重启」。热重载决定迭代速度，版本管理决定可分发性。

### 定义

- **热重载**：不重启进程，让改动（extension 代码 / skill 正文 / 模板）立即生效。
- **版本管理**：扩展/技能作为可分发单元，版本化、依赖化、跨项目复用。

### 怎么做（pi）

**放置决定能否热重载**：extension 放自动发现目录（`~/.pi/agent/extensions/` 或 `.pi/extensions/`）才支持 `/reload`；`pi -e ./path.ts` 只适合一次性测试，不支持热重载。

```bash
/reload   # 重载 extensions + skills + prompts + themes
```

时序（理解它才能 debug）：

```
/reload
  → session_shutdown（旧 runtime 拆除）
  → 重新扫描资源
  → session_start { reason: "reload" }
  → resources_discover { reason: "reload" }
  → 新版 extension/skill 就位
```

> **坑**：`/reload` 后**当前命令处理函数仍在旧 call frame 里**——reload 后那行代码用旧版本。可靠写法把 reload 当命令终点：`await ctx.reload(); return;`。

**registerTool 即时生效**：动态注册工具**不需 reload**，调用即进 `getAllTools()`。区分：改扩展源码是「文件级」变动要 reload；代码里 `pi.registerTool()` 是「运行时」注册即时生效，两者混淆是调试常见坑。

**版本与分发**：扩展作为 npm 包或 git 仓库分发，`settings.json` 声明：

```json
{
  "packages": ["npm:@acme/pi-ext@1.2.0", "git:github.com/acme/skills@v3"],
  "extensions": ["./local/extension.ts"],
  "skills": ["../shared-skills"]
}
```

skill 因遵循 Agent Skills 标准，可跨 harness 复用——同一份 `~/.agents/skills/` 给 pi、Claude Code、Codex 共用，零迁移。

### 何时 reload vs 何时重启

| 改动 | 生效方式 |
|------|----------|
| extension TS 代码 | `/reload`（在自动发现目录） |
| skill 的 SKILL.md 正文 | 模型重新 `read` 即新值，无需 reload |
| skill 的 frontmatter | `/reload`（要重扫目录、重注 XML） |
| extension 的 npm 依赖 | `npm install` 后重启（reload 不重装依赖） |
| 进程外服务代码 | 重启该服务，harness 侧无需动 |

### 反模式

- **`pi -e` 做长期开发**：不支持 reload，每次重启，迭代慢。挪进自动发现目录。
- **reload 后复用旧闭包状态**：reload 拆了旧 runtime，闭包连接/句柄已废，重建。
- **skill 正文改了不验证**：模型可能 read 过旧版（同 session 缓存）——开新 session 或 `/skill:` 重读。

## 6.8 反模式

加载机制典型翻车，逐条给对策：

| 反模式 | 症状 | 对策 |
|--------|------|------|
| **skill 堆积** | 装几十个 skill，启动慢、描述干扰、命中率反降 | 常驻只有目录（轻）；无用 skill 移出目录或 `disable-model-invocation` |
| **extension 侧效应未声明** | extension 偷偷发请求/改文件，用户与模型都不知情 | 工具 `description` 写明副作用；危险操作走 `tool_call` 拦截确认 |
| **能力碎片化无目录** | 装一堆 extension/skill，没人知道有哪些、何时用 | 维护能力清单；description 统一写场景；团队建命名空间 |
| **reload 依赖未重装** | 改依赖没重启，旧依赖仍生效 | 改依赖必重启进程 |

最该警惕**skill 堆积 + 能力碎片化**：装得越多命中率反降——能力不是越多越好，是「能被正确选中」才算有效。没有目录治理、命名混乱的扩展库，比裸 harness 还糟：给了能力幻觉，却让模型无从调用。

---

## 迁移清单

把 pi 的扩展/技能加载机制映射到其他 harness：

| 机制 | pi | Claude Code | Cursor | Aider | 通用 harness |
|------|-----|-------------|--------|-------|--------------|
| **extension（带代码）** | TS 模块 + jiti，`~/.pi/agent/extensions/` | hooks / extension / plugin | `.cursor/rules` + MCP | 无原生 | 可执行模块 + 注册接口 |
| **skill（带知识）** | `SKILL.md` + Agent Skills 标准 | skills（同标准）/ `.claude/skills` | rules（知识形态） | 无原生 | Markdown + frontmatter |
| **registerTool** | `pi.registerTool()` | 工具定义 / MCP 工具 | MCP 工具 | 内置工具集 | 工具注册 API |
| **registerCommand** | `pi.registerCommand()` | slash command | slash command | `/command` | 命令注册 API |
| **promptHook** | `pi.on("before_agent_start")` | system prompt / hook | `.cursorrules` | system prompt | 提示钩子事件 |
| **contextProvider** | `pi.on("context")` / `resources_discover` | MCP resource | context index | repo map | 上下文注入接口 |
| **skill 两级加载** | frontmatter 常驻 + 按需 read | 同标准 progressive disclosure | rules 全量/按需 | 无 | 摘要常驻 + 正文懒加载 |
| **热重载** | `/reload`（自动发现目录） | 重启 / 部分热更 | 重启 | 重启 | 文件监听 + 重注册 |
| **冲突治理** | skill 重名 warn 保留首个；工具按序覆盖 | 命名空间 | 命名空间 | 无 | scope 前缀 + 加载顺序 |
| **分发** | npm/git 包 + `settings.json` | skills 仓库 | rules 仓库 | 无原生 | 包管理 + 配置声明 |

> 迁移要点：能力越弱的 harness（Aider、老版 Cursor），越要把「知识」外置成 `.md` 规范、「代码能力」外置成 MCP 工具或脚本——用 harness 不认的格式装能力等于没装。Agent Skills 标准是跨 harness 复用 skill 的最大杠杆：同一份技能目录多家用，零迁移。

---

## 下一步

本文是 Harness Engineering 第 6 篇 / 共 10 篇。前一篇：[子代理调度容器](./harness-engineering-subagents)（subagent = 进程、调度四象限、acceptance 契约、worktree 隔离）——子代理本身也是一种「可加载的能力源」，读完更能理解能力如何被编排。

extension 与 skill 解决了「能力从哪来、怎么挂进来」，但还有一种能力形态跨在两者之间：**跨会话的记忆**。它既非一次性注入的知识（skill），也非带副作用的代码（extension），而是 harness 对自身历史的**持久化读写**——下一篇拆解它。

下一篇：[7. 记忆与持久化状态](./harness-engineering-memory) ——记忆层级、跨会话状态、记忆污染治理。第 7 篇 / 共 10 篇。

---

## 参考资料

- [Harness Engineering 总纲](./harness-engineering-series) · [第 5 篇：子代理调度容器](./harness-engineering-subagents)
- [pi Extensions 文档](https://github.com/earendil-works/pi-coding-agent)（`registerTool`/`registerCommand`/`pi.on` 事件、`/reload`、packages 分发）
- [pi Skills 文档](https://github.com/earendil-works/pi-coding-agent)（frontmatter、progressive disclosure、`/skill:name`）
- [Agent Skills 标准](https://agentskills.io/specification)（跨 harness 的 skill 复用规范）

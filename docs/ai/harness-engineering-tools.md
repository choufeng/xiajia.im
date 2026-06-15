# 工具系统与工具总线：Agent 的手脚

> Harness Engineering 系列第二篇（共 10 篇）。前一篇：[1. Harness 是什么](./harness-engineering)。本篇承接三组件里的「工具总线」——agent 能做什么，取决于它的手脚。
>
> 如果说 [Loop Engineering](./loop-engineering) 讲的是「脑子怎么转」，Harness 第一篇讲的是「壳由什么搭」，这一篇就拆壳上最关键的一根承重梁：**工具**。没有工具的 agent 只会说话，有了工具它才能动手。

---

## 目录

1. [引言：能力边界 = 手脚边界](#引言能力边界--手脚边界)
2. [协议本质：tool calling 在做什么](#协议本质tool-calling-在做什么)
3. [工具三要素：name / schema / handler](#工具三要素name--schema--handler)
4. [元数据与提示词引导](#元数据与提示词引导)
5. [为什么必须 schema 化](#为什么必须-schema-化)
6. [调度语义：并行 / 串行 / 中断](#调度语义并行--串行--中断)
7. [错误处理：错误是上下文，不是崩溃](#错误处理错误是上下文不是崩溃)
8. [MCP：标准化工具市场](#mcp标准化工具市场)
9. [反模式](#反模式)
10. [迁移清单](#迁移清单)
11. [下一步](#下一步)

---

## 引言：能力边界 = 手脚边界

一个裸 LLM 是个只会输出 token 的嘴。它不能读你的文件、不能跑测试、不能联网查文档。给它套上 harness 后，它真正「能干的事」全集，等于**它能调用的工具集合**。

> **能力边界 = 工具边界。** 你没给它 `bash`，它就永远跑不了测试；你没给它 `edit`，它就只能口头描述改动。harness 的第一道工程，就是决定「给 agent 一双手，还是一双手套」。

工具系统（tools）回答「有哪些手脚」，工具总线（tool bus）回答「这些手脚怎么被调用、怎么调度、出错怎么办」。本篇把两者合在一起讲，因为它们在工程上不可分割——注册一个工具，就同时定义了它的能力边界和它的调度契约。

落地载体仍是 pi，但协议层（tool calling / function calling）是整个行业的共识，抽象适用于一切 harness。

## 协议本质：tool calling 在做什么

**定义**：tool calling（也叫 function calling）是一套约定——用 JSON Schema 描述「有哪些工具、每个工具吃什么参数」，模型在回复时输出**结构化的工具调用**（而不是自由文本），harness 执行后把结果回灌进上下文。

**为何**：自由文本不可靠。让模型「用自然语言说我要读 package.json」，解析它的句子又脆又爱幻觉。换成「让它输出 `{tool: "read", path: "package.json"}`」，机器侧稳定、可校验、可并发。

**怎么做（pi）**：一次 turn 的数据流如下：

```
系统提示:  注入工具清单（name + description + parameters schema）
            ↓
模型输出:  tool_calls: [{ name:"read", input:{ path:"package.json" } }]
            ↓
harness:   校验 schema → 执行 handler → 拿到结果
            ↓
回灌上下文: tool_result: { content:[{ type:"text", text:"{...}" }] }
            ↓
模型续写:  基于结果决定下一步（再调工具 / 回答用户）
```

关键点：**模型从不直接执行，它只「下指令」**。真正的执行权永远在 harness。这是安全模型的总闸——第 8 篇（沙箱与权限）会展开。这里只要记住：tool calling 协议天然把「想」和「做」分离，harness 是唯一能落地的那只手。

**反模式**：把工具调用当「必选动作」。模型有权选择**不调用任何工具**直接回答。强行要求每轮都调工具，会逼模型编造无意义调用。

## 工具三要素：name / schema / handler

**定义**：一个工具由三样东西唯一确定——

| 要素 | 作用 | 给谁看 |
|------|------|--------|
| **name** | 唯一标识，模型靠它点名 | 模型 + harness |
| **schema**（parameters） | 参数的 JSON Schema，声明类型/必填/枚举 | 模型（决定怎么填）+ harness（决定怎么校验） |
| **handler**（execute） | 真正执行的代码，吃参数吐结果 | harness |

**为何**：三者缺一不可。没 name 无法点名，没 schema 模型乱填且无法校验，没 handler 就是个空壳。

**怎么做（pi）**：`pi.registerTool` 用 Typebox 写 schema，handler 是 `execute`。

```typescript
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";

pi.registerTool({
  name: "fetch_issue",
  label: "Fetch Issue",          // 给人看（UI 渲染）
  description: "按编号拉取 GitHub issue 标题与正文",  // 给模型看
  promptSnippet: "Fetch a GitHub issue by number",
  parameters: Type.Object({
    repo: Type.String({ description: "owner/name" }),
    number: Type.Integer({ description: "issue 编号" }),
    state: Type.Optional(StringEnum(["open", "closed", "all"])),
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }
    onUpdate?.({ content: [{ type: "text", text: "拉取中…" }] });
    const res = await fetch(
      `https://api.github.com/repos/${params.repo}/issues/${params.number}`,
      { signal },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${params.repo}#${params.number}`);
    const data = await res.json();
    return {
      content: [{ type: "text", text: `#${data.number} ${data.title}\n\n${data.body ?? ""}` }],
      details: { url: data.html_url },
    };
  },
});
```

要点：`StringEnum`（来自 `@earendil-works/pi-ai`）替代 `Type.Union`，因为后者在 Google API 上不工作；`signal` 透传给 `fetch`，Esc 中断能立即生效；`onUpdate` 流式上报进度。

**反模式**：把 schema 当摆设、在 handler 里再悄悄接受 schema 没声明的字段。模型看不见的字段永远不会被填，结果是「工具永远调不对」。

## 元数据与提示词引导

**定义**：工具不只是代码。除了 name/schema/handler，harness 还接受**元数据**，它们决定「工具怎么出现在系统提示里、模型什么时候该用」。

**为何**：模型选不选某个工具、用得对不对，很大程度上取决于提示词里对它的描述。代码定义了「能做什么」，元数据教模型「什么时候做、怎么做」。这是 prompt engineering 沉到工具层的体现。

**怎么做（pi）**：三个字段分工——

| 字段 | 注入位置 | 作用 |
|------|----------|------|
| `description` | 工具定义体 | 告诉模型这个工具是干嘛的 |
| `promptSnippet` | `Available tools` 一行 | 一句话兜底，让模型知道有这么个工具 |
| `promptGuidelines` | `Guidelines` 列表项 | 工具激活时追加的使用准则 |

```typescript
pi.registerTool({
  name: "my_tool",
  promptSnippet: "List or add items in the project todo list",
  promptGuidelines: [
    "Use my_tool for todo planning instead of direct file edits when the user asks for a task list.",
  ],
  // ...
});
```

pi 的坑：`promptGuidelines` 是**平铺**进 `Guidelines` 段的，没有工具名前缀。所以每条准则必须自带工具名——写「Use my_tool when…」而不是「Use this tool when…」，否则模型分不清「this」指谁。

**反模式**：description 写「做某事」这种废话。模型只会照字面理解，模糊描述 → 用错时机 → 工具闲置或滥用。description 要写「做什么 + 何时用」，越具体越省 token 越准。

## 为什么必须 schema 化

**为何必须**：对比一下就知道 schema 化不是洁癖，是工程刚需。

| 维度 | 自由文本指令 | schema 化工具 |
|------|--------------|---------------|
| **防幻觉参数** | 模型瞎编字段名，handler 崩 | 未声明字段直接校验失败 |
| **可校验** | 靠正则猜，脆 | JSON Schema 原生校验 |
| **可文档化** | 散在 prompt 里 | name/schema 即文档 |
| **可组合** | 无法并发解析 | 多工具同批下发 |
| **可演化** | 改一个指令全场失控 | `prepareArguments` 兜底老会话 |

**怎么做（pi）**：schema 是「公开契约」，handler 是「私有实现」。pi 还提供 `prepareArguments(args)`：它在 schema 校验**之前**跑，用来把老会话里过时的参数形态折叠成新 schema。这样老 session resume 时不会因为 schema 演进而全线崩。原则：**保持公开 schema 严格，把兼容逻辑藏在 prepareArguments 里**，别为了老会话往 schema 里塞废弃字段。

```typescript
prepareArguments(args) {
  // 老 session 存的是顶层 oldAction，新 schema 只要 action
  const a = args as { action?: string; oldAction?: string };
  if (a.oldAction && a.action === undefined) return { ...a, action: a.oldAction };
  return args;
},
```

**反模式**：为了「灵活」把所有参数设成 `Type.Optional` + `Type.Any`。这等于没 schema，校验形同虚设，幻觉参数原样进 handler。

## 调度语义：并行 / 串行 / 中断

**定义**：一条助手消息可以带**多个 tool_call**。harness 怎么执行这一批，决定了 agent 的吞吐和正确性。三种语义——

- **并行**：无依赖的工具同时执行，结果一起回灌。
- **串行**：有依赖（后一个要前一个的结果）必须排队。
- **中断**：长任务可被软中断（Esc / 超时），已执行的部分要能干净收尾。

**为何**：并行能把「读 5 个文件」从 5 轮压成 1 轮，大幅省 token 和延迟；但写同一文件的两工具并行就会**静默覆盖**（A、B 都读到 v1，各改各的，谁后写谁赢，另一个改动丢失）。

**怎么做（pi）**：pi 默认**并行工具批**——同一条消息的兄弟工具调用先逐个 preflight，再并发执行，结果按批次回灌。

```
助手消息:  read a.ts | read b.ts | read c.ts   ← 无依赖，并行
           ↓ 一次回灌
           写 d.ts   ← 依赖上面读取的结果，自然落下一批
```

文件写入的串行化用 `withFileMutationQueue(path, fn)`：它把「读-改-写」整个窗口排进 per-file 队列，确保同一文件不会有两个工具并发踩踏。自定义工具若改文件，**必须**套这层队列，否则会和内置 `edit`/`write` 抢同一个文件。

```typescript
import { withFileMutationQueue } from "@earendil-works/pi-coding-agent";

async execute(_id, params, _sig, _on, ctx) {
  const abs = resolve(ctx.cwd, params.path);
  return withFileMutationQueue(abs, async () => {
    const cur = await readFile(abs, "utf8");
    await writeFile(abs, cur.replace(params.from, params.to));
    return { content: [{ type: "text", text: `改了 ${params.path}` }], details: {} };
  });
}
```

**中断**：`signal`（`AbortSignal`）透传进 `fetch`、`pi.exec` 和任何 abort-aware 操作；Esc 立即生效。`execute` 里要主动检查 `signal?.aborted`，返回「Cancelled」而不是抛异常。另外 `terminate: true` 让模型在本批工具结果都是终止型时**跳过后续 LLM 调用**——结构化输出工具用它收尾。

运行时还能用 `pi.setActiveTools(["read", "bash"])` 动态开关工具集（如切到只读模式），`getAllTools()` 查当前全量。

**反模式**：把有依赖的工具硬塞进并行批。比如「读 A 再根据 A 写 B」拆成两个独立工具并行，B 读到空文件，逻辑静默崩。

## 错误处理：错误是上下文，不是崩溃

**定义**：在 agent 世界里，工具报错**不是程序的崩溃，是喂给模型的一条上下文**。模型要看到「这个路径不存在」「这个命令退出码 1」，才能自己调整下一步。

**为何**：把错误当异常抛出整个 harness，agent 就死了；把错误当数据回灌，agent 能自己重试、换路、降级。这是 agent 比「写死流程的脚本」强的地方——它会读错误、会改主意。

**怎么做（pi）**：核心规则——**抛错 = 标记失败**。在 `execute` 里 `throw new Error(...)`，pi 自动给结果置 `isError: true` 并把错误信息报给 LLM。**不要**试图在返回对象里塞 `isError`，那样无效。

```typescript
async execute(_id, params) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return { content: [{ type: "text", text: await res.text() }], details: {} };
}
```

错误信息要写给模型看，不是写给栈跟踪。好的错误：`Error: 端口 5432 拒绝连接，postgres 是否启动？`。坏的错误：一坨 Node 原生栈。重试与降级策略分层：

| 策略 | 适用 | 实现 |
|------|------|------|
| **重试** | 瞬时网络错 | handler 内指数退避，或让模型看到 5xx 自己重调 |
| **降级** | 主工具不可用 | 备用工具 / 缓存路径，错误里给替代建议 |
| **熔断** | 连续失败 | `setActiveTools` 暂时禁用该工具 |

**反模式**：handler 吞掉所有异常返回空成功。模型看到「成功但空」，会以为任务完成，其实啥也没干。**宁可抛错也别假装成功**。

## MCP：标准化工具市场

**定义**：MCP（Model Context Protocol）把工具从「harness 内置」变成「外挂服务」。client（harness）通过统一协议调用 server（任意工具提供方），工具实现与 harness 解耦。

**为何**：内置工具是 harness 的私货，换 harness 就要重写。MCP 让工具变成**可复用的市场**——一个 GitHub MCP server，Claude Code、Cursor、pi（经桥接）都能用，工具生态归社区，不归某家厂商。

```
传统:   harness 内置 [read/edit/bash/git]   ← 锁死在一家
MCP:    harness ←→ MCP client ←→ [github-server, db-server, slack-server, …]
                                          ↑ 任何 server，任何语言，任何厂商
```

**怎么做（pi）**：诚实地说——**pi 故意不内置 MCP**。这是它的组合哲学：与其把 MCP 客户端焊进内核，不如让你用扩展或 package 自己接。需要 MCP 时，写一个扩展桥接 MCP server（client 跑在扩展里，工具经 `registerTool` 暴露给模型），或装一个现成的 pi package。代价是要多写一层胶水；收益是 MCP 的接入方式、版本、安全策略全归你掌控，不绑内核。

这个选择本身是个 harness 设计样本：**MCP 是标准，接不接、怎么接是 harness 的工程决策**。抽象上，任何 harness 都该支持「外挂工具市场」这个能力——pi 用扩展实现，Claude Code/Cursor 用内置 MCP client 实现，殊途同归。

**反模式**：把 MCP server 当可信代码。MCP server 跑在你的权限下，能读写你的盘、发网络请求。装前看源码、限权限（第 8 篇细讲）。

## 反模式

把上面散落的坑汇总成一张「别这么干」清单。

| 反模式 | 症状 | 对策 |
|--------|------|------|
| **工具爆炸** | 注册几十上百个工具，系统提示臃肿、模型选错、延迟上升 | 按场景用 `setActiveTools` 动态收窄；skill 按需加载而非全量注册 |
| **命名冲突** | 两个工具都叫 `search`，模型点到错的那个 | 命名带领域前缀（`search_docs` / `search_code`）；pi 同名工具后者覆盖前者 |
| **副作用工具无确认** | `deploy`、`rm`、发邮件类工具直接执行不可逆操作 | 在 handler 里 `ctx.ui.confirm(...)` 二次确认；或限权限 |
| **粒度太粗** | 一个 `do_everything` 工具吃十几个参数 | 拆成职责单一的小工具，可组合可复用 |
| **粒度太细** | `open_file` / `read_file` / `close_file` 分三个 | 合并成合理动作单元，减少模型调用轮次 |
| **假成功** | 吞异常返回空 | 抛错让模型看见，宁可失败也别骗 |
| **改文件不排队** | 自定义写工具和内置 edit 抢同一文件，静默覆盖 | 套 `withFileMutationQueue` |

一条总纲：**工具是 agent 的手脚，手脚要少而精、命名清、副作用要确认、出错要可见**。工具系统的健康度，直接决定 agent 是「能干活」还是「只会闯祸」。

## 迁移清单

工具系统是 harness 里工具相关度最高、迁移差异最大的一块。pi 的「无内置、全扩展」哲学，映射到其他 harness 时要换实现。

| pi 做法 | Claude Code | Cursor | Aider | 通用 harness |
|---------|-------------|--------|-------|--------------|
| `registerTool` + Typebox schema | 配置文件 / hooks / slash command | MCP / `.cursor/rules` | `/commands` + 模型原生工具 | 实现各自 tool registry |
| `promptSnippet` / `promptGuidelines` | tool description + 系统提示注入 | rules 自动注入 | 约定提示 | 提示词模板拼装 |
| 默认并行工具批 + `withFileMutationQueue` | 并行 tool use + 内置文件锁 | 内置调度 | 单工具为主 | 自实现并发控制 + 锁 |
| `execute` 抛错 → `isError` | 工具结果 `is_error` 字段 | 错误回灌 | 错误进对话 | 统一错误协议 |
| `signal` 中断 + `terminate` | Esc 中断 | 中断支持 | — | 透传 AbortSignal |
| **无内置 MCP**（扩展桥接） | 内置 MCP client | 内置 MCP client | 无 | 按 MCP 标准接或自建 |
| `setActiveTools` 动态收窄 | 权限 / 模式切换 | 模式切换 | 工具开关 | 工具集分层 |

**可迁移**：schema（JSON Schema 全行业通用）、错误回灌语义、并行/串行心智模型、MCP 标准。**要重写**：注册 API、提示词注入字段名、并发与文件锁实现、MCP 接入方式。你设计工具时越贴近「name + schema + 错误回灌」这套抽象，迁移越轻松。

## 下一步

工具给了 agent 手脚，但手脚动一次就要吃掉上下文。读个文件、跑条命令、报个错，全是 token。工具系统的下一站必然是**上下文预算**——在有限的窗口里，编排系统提示、工具结果、技能、记忆的注入与裁剪。

本篇（第 2 篇 / 共 10 篇）就到这里。下一篇：[3. 上下文工程与 Token 预算](./harness-engineering-context)。前一篇：[1. Harness 是什么](./harness-engineering)。

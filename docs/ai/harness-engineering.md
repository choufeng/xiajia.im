# Harness 是什么：从聊天框到能干活的 Agent

> 给 LLM 一个终端，它就成了 agent 吗？不。差的不是模型，是承载它的那一层壳——harness。本篇定义 harness 的三组件，划清它与 chatbot / SDK / framework 的边界，并讲清从「问答」到「循环执行」的范式迁移。

---

## 目录

1. [引言：终端不等于 agent](#引言终端不等于-agent)
2. [1.1 重新定义 Harness](#11-重新定义-harness)
3. [1.2 三组件为何不可分割](#12-三组件为何不可分割)
4. [1.3 边界光谱：Chatbot 到 Autonomous Agent](#13-边界光谱chatbot-到-autonomous-agent)
5. [1.4 范式迁移：问答到循环执行](#14-范式迁移问答到循环执行)
6. [1.5 一个最小 harness](#15-一个最小-harness)
7. [1.6 harness 成熟度阶梯](#16-harness-成熟度阶梯)
8. [反模式小结](#反模式小结)
9. [迁移清单](#迁移清单)
10. [下一步](#下一步)

---

## 引言：终端不等于 agent

一个常见错觉：把 Claude / GPT 接上 bash，或者给它开个文件系统，它就「是」 agent 了。于是有人反复追问「哪个模型最适合做 agent」「GPT-5 出来是不是 agent 就成了」，却从没人问「我给它搭的那个壳，够格吗」。

答案往往是不够。

差的不是模型。同样的模型，丢进一个对话网页，它是聊天框；接进一个有工具总线、有上下文预算、有会话恢复的容器里，它能连跑二十轮修掉一个 CI 失败。模型没变，壳变了。**这层壳，就是 harness。**

本系列要讲的就是这层壳的工程。它和站内 [Loop Engineering 系列](./loop-engineering)是互补的两条主线：Loop 讲「发动机怎么转」（循环内在动力学），Harness 讲「把发动机装上车能跑」（底盘、悬挂、仪表盘、油路）。本篇先把「壳」的定义钉死。

---

## 1.1 重新定义 Harness

**Harness（承载壳）**：包裹在 LLM 之外，让它从「一次性应答器」变成「能持续干活」的那一层工程框架。

一个最小可用的 harness，由三块组件构成，缺一不可：

```
        ┌─────────────────────────────────────────────┐
        │            ② 上下文预算 Context Budget        │
        │   在有限 token 窗口里，编排系统提示/技能/      │
        │   文件/记忆的注入与裁剪                       │
        └────────────────┬────────────────────────────┘
                         │ 喂进去 / 拿出来
        ┌────────────────▼────────────────────────────┐
        │            ① Loop 容器 Loop Container         │
        │   感知 → 思考 → 行动 → 反馈，一圈圈转         │
        └────────────────┬────────────────────────────┘
                         │ 行动 / 观察
        ┌────────────────▼────────────────────────────┐
        │            ③ 工具总线 Tool Bus                │
        │   把读文件 / 跑命令 / 调 API 安全接进 LLM     │
        └─────────────────────────────────────────────┘
```

**① Loop 容器**：把「感知环境 → 思考下一步 → 行动（调工具） → 收到反馈」这个循环跑起来的运行时。它决定 agent「怎么转、转多久」。这一块的内在动力学归 [Loop Engineering](./loop-engineering) 管，harness 只负责把它**承住**：给它一个进程、给它终止条件、给它恢复点。

**② 上下文预算**：LLM 的窗口是有限的。harness 必须在每个回合决定——这次请求里塞系统提示、塞哪些文件、塞几条记忆、塞多少对话历史、什么时候该压缩或裁剪。这是 agent 越跑越久却不崩的前提。本系列第 3 篇专门展开。

**③ 工具总线**：把「读文件、写文件、跑 shell、查 DB、建 PR、调外部 API」这些能力，以 LLM 可调用的形式（通常遵循 tool calling 协议）接进来，并管好校验、并发、权限、超时、错误回灌。没有它，模型只能空谈。第 2 篇展开。

一句话：**Loop 决定 agent 怎么想，Harness 决定 agent 被什么托着跑。**

---

## 1.2 三组件为何不可分割

这三块不是「锦上添花」，而是互相支撑的承重墙。去掉任何一块，agent 都会退化成一个远不如它名字响亮的东西。

| 缺失组件 | 退化成 | 症状 |
|----------|--------|------|
| **缺 Loop 容器** | 问答机（Q&A machine） | 一问一答，无状态。问完即忘，不会主动接着干。等于 ChatGPT 网页版 |
| **缺工具总线** | 嘴炮（talker） | 能规划、能讲方案，但碰不到真实文件和命令。产出的全是「你应该这样改」，不动手 |
| **缺上下文预算** | 健忘症患者（amnesiac） | 跑几轮就忘掉最初的约束，重复犯错，窗口塞爆后行为漂移，长任务必崩 |

三者耦合很紧：Loop 容器每个回合都要从上下文预算取输入、把工具执行结果回写进上下文；工具总线产出的观察（observation）是下一轮思考的原料。任何一个接口设计不好，整套都跟着跛。

这也解释了为什么「换个更强的模型」往往治不好一个烂 agent——烂在壳上，不在发动机上。

---

## 1.3 边界光谱：Chatbot 到 Autonomous Agent

harness 不是凭空冒出来的概念，它处在一条光谱上。把容易混淆的五类东西从左到右排开，每一级都比上一级多了点东西：

| 级别 | 定义 | 比上级多了什么 | 例子 |
|------|------|----------------|------|
| **① Chatbot** | 无状态单轮对话 UI | — | ChatGPT 网页闲聊 |
| **② SDK** | 封装 API 调用的库 | 程序化调用、流式、消息拼装 | OpenAI SDK、Anthropic SDK |
| **③ Framework** | 给 agent 开发提供脚手架 | 抽象层、编排原语、约定 | LangChain、LlamaIndex |
| **④ Harness** | 承载 agent 实际跑起来的壳 | **三组件齐全**：Loop + 工具总线 + 上下文预算，外加会话生命周期、沙箱、权限 | **pi、Claude Code、Cursor、Aider** |
| **⑤ Autonomous Agent** | 长期自治、跨会话调度 | 调度层、状态持久化、验证链、kill switch、多 loop 协调 | Devin、CI Sweeper（见 [Loop L3](./loop-engineering-l3-design)） |

关键区分在 ③→④：framework 给你积木，**你自己拼**；harness 是**已经拼好、能直接装上发动机跑**的整车。framework 不替你管 token 预算、不替你做 bash 沙箱、不替你处理 worktree 冲突——这些都是 harness 的活。

而 ④→⑤ 的跨越，正是 Loop Engineering 系列的主题：harness 是「单次会话的设置」，autonomous agent 是「harness + 调度 + 状态 + 验证链」。本系列聚焦 ④，但要时刻记住它往上还能长。

---

## 1.4 范式迁移：问答到循环执行

理解 harness，本质是理解一次范式切换。做 chatbot 和做 harness，工程预设完全不同。

| 维度 | 问答范式（Chatbot） | 循环执行范式（Harness） |
|------|---------------------|-------------------------|
| **状态** | 无状态 | 有状态，跨回合保持 |
| **交互** | 单次 request-response | 多轮循环，可能数十上百轮 |
| **副作用** | 无（只产文本） | 有（改文件、跑命令、发请求） |
| **错误处理** | 用户重问一句 | harness 必须捕获、重试、降级 |
| **中断恢复** | 不存在 | session/run 可 fork、可 resume |
| **关注点** | 这条回答好不好 | 这一整段执行稳不稳、可不可查、可不可恢复 |
| **验收** | 人看一眼 | 测试 / 验证器 / 门禁 |

这张表才是 harness 工程的真正考卷。绝大多数「我的 agent 不好用」的抱怨，根因都落在右侧某一栏：要么没管状态、要么没管副作用、要么断电就丢、要么出错了不知道怎么收。模型再强，也回答不了「上一轮我改到哪了」——这得 harness 替它记。

> 一个粗暴但好用的判据：**如果你的系统断电重启后会「忘了自己在干什么」，它就还不是 harness，只是个套了壳的问答机。**
>
> 换句话说，harness 工程的第一道分水岭，就是「你的 agent 有没有一段可以被打断、被观察、被接回去的执行轨迹」。问答范式里没有轨迹，只有一问一答的孤点；循环执行范式里轨迹是头等公民，谁都能 fork、谁都能 replay。

---

## 1.5 一个最小 harness

剥到骨头，harness 也就是「一个 while 循环 + 工具分发 + 上下文追加」。下面这段约 40 行 TypeScript 是**伪代码**，省略了 schema 校验、错误重试、token 计量、流式处理，只为展示三组件如何咬合：

```typescript
// 伪代码：仅示意三组件咬合，非生产可用
type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string };

// ③ 工具总线：把能力注册成 LLM 可调用的 schema
const tools = {
  read_file: { schema: { path: "string" }, run: (a: any) => readFileSync(a.path, "utf8") },
  write_file:{ schema: { path: "string", content: "string" }, run:(a:any)=>writeFileSync(a.path,a.content) },
  run_bash:  { schema: { cmd: "string" }, run: (a: any) => execSync(a.cmd).toString() },
};

async function harness(task: string) {
  // ② 上下文预算：初始窗口 = 系统提示 + 用户任务
  const context: Msg[] = [
    { role: "system", content: "你是一个编码 agent。按需调工具完成任务。" },
    { role: "user", content: task },
  ];

  // ① Loop 容器：感知 → 思考 → 行动 → 反馈，转圈
  for (let step = 0; step < 50; step++) {           // 终止条件之一：步数上限
    // 思考：把当前上下文喂给 LLM
    const reply = await llm.chat({ messages: context, tools: schemas(tools) });

    context.push({ role: "assistant", content: reply.text });

    if (!reply.tool_calls?.length) break;            // 模型没再调工具 → 视为完成

    // 行动 + 反馈：分发每个工具调用，结果回灌进上下文
    for (const call of reply.tool_calls) {
      const result = await tools[call.name].run(call.args);
      context.push({ role: "tool", content: result });   // 工具观察成为下一轮原料
    }
    // ② 真实 harness 在这里还要做：超长则裁剪/压缩上下文
  }
}
```

三组件在这段里一目了然：`for` 循环是 Loop 容器，`tools` 字典是工具总线，`context` 数组 + 末尾注释那行裁剪是上下文预算。真实 harness（pi 等）在这三块上各自加了几千行工程，但骨架就是这个。

> 对照 pi：上面这套用 pi SDK 写就是 `createAgentSession` 起一个会话、`session.prompt` 驱动循环、用 `registerTool` + Typebox 注册工具、`session.subscribe` 监听工具事件。pi 把「裁剪/压缩/持久化」藏进了运行时，你只需要关心任务本身。本系列第 2 篇会用真实 API 重写这段。

---

## 1.6 harness 成熟度阶梯

不是所有 harness 都一样重。按「三组件的完整度」排个阶梯，能帮你定位手里的工具处在哪一级，还差什么：

| 级别 | 名称 | Loop | 工具 | 上下文 | 典型形态 | 对应 Loop 系列概念 |
|------|------|------|------|--------|----------|--------------------|
| **L0** | 裸 API 调用 | ❌（单次） | ❌ | 手拼 messages | 直接调 SDK 一次 | — |
| **L1** | 有工具的 agent | ✅ while | ✅ | 简单追加 | 1.5 的伪代码 | Loop L1（产出报告） |
| **L2** | 会话持久化 | ✅ | ✅ | 有裁剪/压缩 | pi、Claude Code 基础态 | Loop L2（可恢复执行） |
| **L3** | 自治 harness | ✅ + 调度 | ✅ + 权限/沙箱 | ✅ + 记忆分层 | pi + subagent + worktree + intercom | Loop L3（无人值守） |

这里和 [Loop Engineering 系列](./loop-engineering)的 L1/L2/L3 **不是同一个轴**：Loop 的 L 级讲「循环跑多自治」（报告 → 提议 → 自主合并），harness 的 L 级讲「壳有多完整」（单次 → 有工具 → 可恢复 → 自治）。两者交叉：一个 harness L3 的壳，可以只跑 Loop L1 的任务（壳很强、任务很保守）；反过来，想跑 Loop L3 的无人值守，**必须**有 harness L3 的壳托着——否则没有 worktree 隔离、没有 kill switch、没有会话恢复，Loop L3 一启动就是事故。

记住一个方向：**先升级 harness，再升级 loop。** 壳没搭好就去追自治，等于给一辆没刹车的车踩油门。

---

## 反模式小结

三种最常见的「以为在做 agent，其实没做对」：

| 反模式 | 症状 | 病根 | 解药 |
|--------|------|------|------|
| **把 harness 当聊天 UI** | 系统就是个套了皮的对话框，断电即忘 | 缺 Loop 容器 + 缺上下文预算，停留在光谱 ① | 补三组件，先做到「能跨回合保持状态」 |
| **把工具当炫技** | 注册了一堆工具却没管 schema 校验、权限、超时 | 只搭了工具总线的「注册」半截，没搭「治理」半截 | 工具必须有 schema、有权限模型、有错误回灌（第 2、8 篇） |
| **忽视上下文预算** | 短任务好用，长任务必崩，且崩得莫名其妙 | 把「窗口无限」当默认，从不裁剪压缩 | 把 token 预算当一等公民，第 3 篇展开 |

一句话总括：**harness 的工程量，不在「让它能动」，而在「让它动得久、动得稳、动得可查、动得可停」。** 能动是 L0，后四者才是 harness 的本体——而每一种「不可」，背后都对应着本系列后续一篇要解的工程问题。

---

## 迁移清单

本篇的定义层是抽象的，下表把三组件 + 成熟度映射到主流工具，方便对号入座：

| pi 的做法 | Claude Code | Cursor | Aider | 通用 harness |
|-----------|-------------|--------|-------|--------------|
| `createAgentSession` 起 Loop 容器 | 内置 agent loop | Composer/Agent 内核 | `Coder.run()` 主循环 | 自建 `while` 循环 + LLM SDK |
| `registerTool` + Typebox 注册工具 | `.claude` 工具/MCP | 内置 edit/terminal | `Coder` 注册 commands | tool calling 协议 + schema 校验 |
| 运行时裁剪/压缩上下文 | 自动 compaction | 隐式 long-context | repo map + token 预算 | 显式检索 + 摘要 + 窗口策略 |
| session fork/resume（L2） | `--resume` / `--continue` | 会话历史 | `.aider.chat.history.md` | 自建状态序列化 + 恢复点 |
| subagent + worktree + intercom（L3） | Task tool + 权限 | （较弱） | （无） | 自建调度 + 验证链 + kill switch |

横向看：**越往左，三组件越内置、越省心；越往右，越要你自己拼。** pi 的位置偏右——它把积木给你、组合权留给你，这正是本系列为什么拿它当落地载体：拼的过程看得见，工程量藏不住。

---

## 下一步

本篇把「harness 是什么」钉死了：三组件（Loop 容器 / 工具总线 / 上下文预算）、五级光谱、问答到循环执行的范式迁移、L0→L3 成熟度阶梯。但三组件里，**工具总线**是 agent 真正「长出手脚」的那块，也是最容易做歪的一块——schema 校验、并发与中断、MCP 接入、权限边界，每一项都决定 agent 是靠谱还是闯祸。

下一篇我们钻进工具总线，从 tool calling 协议讲到 pi 的 `registerTool` 真实写法，再用 1.5 那段伪代码做对照，把它重写成生产级形态。

→ 下一篇：[Harness Engineering · 工具系统与工具总线](./harness-engineering-tools)

*系列第 1 篇 / 共 10 篇*

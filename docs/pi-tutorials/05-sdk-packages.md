# 教程 5：SDK 集成与 Pi Packages

> 预计用时：25 分钟 | 目标：学会用 SDK 嵌入 PI，以及打包和分享你的作品

---

## 第一部分：SDK 集成

### 1. 什么是 SDK？

PI 的 SDK 允许你将 AI 编程能力 **嵌入到你自己的应用中**，无论是构建自定义界面、自动化流程，还是集成到现有系统。

### 安装

```bash
npm install @mariozechner/pi-coding-agent
```

SDK 包含在主包中，无需额外安装。

---

### 2. 快速开始：最小示例

```typescript
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

// 设置认证和模型
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// 创建会话
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),  // 内存会话，不保存到磁盘
  authStorage,
  modelRegistry,
});

// 订阅事件，接收流式输出
session.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

// 发送提示
await session.prompt("当前目录有哪些文件？");
```

---

### 3. 核心概念

#### AgentSession

会话对象，管理 AI 生命周期、消息历史、模型状态和事件流：

```typescript
interface AgentSession {
  // 发送提示
  prompt(text: string, options?): Promise<void>;
  
  // 流式传输中的消息队列
  steer(text: string): Promise<void>;    // 引导消息
  followUp(text: string): Promise<void>; // 后续消息
  
  // 事件订阅
  subscribe(listener): () => void;
  
  // 模型控制
  setModel(model): Promise<void>;
  setThinkingLevel(level): void;
  
  // 状态访问
  model: Model | undefined;
  thinkingLevel: ThinkingLevel;
  messages: AgentMessage[];
  isStreaming: boolean;
  
  // 其他
  abort(): Promise<void>;
  dispose(): void;
}
```

---

### 4. 配置模型和 API Key

```typescript
import { getModel } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";

const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// 运行时覆盖 API Key（不持久化）
authStorage.setRuntimeApiKey("anthropic", "sk-ant-my-temp-key");

// 查找特定模型
const model = getModel("anthropic", "claude-opus-4-5");
if (!model) throw new Error("模型未找到");

const { session } = await createAgentSession({
  model,
  thinkingLevel: "medium",
  authStorage,
  modelRegistry,
  sessionManager: SessionManager.inMemory(),
});
```

---

### 5. 自定义工具

```typescript
import { Type } from "@sinclair/typebox";
import { createAgentSession, defineTool } from "@mariozechner/pi-coding-agent";

// 定义自定义工具
const statusTool = defineTool({
  name: "status",
  label: "状态",
  description: "获取系统状态",
  parameters: Type.Object({}),
  execute: async () => ({
    content: [{ type: "text", text: `运行时间: ${process.uptime()}s` }],
    details: {},
  }),
});

const { session } = await createAgentSession({
  customTools: [statusTool],
  sessionManager: SessionManager.inMemory(),
});
```

---

### 6. 使用内置工具

```typescript
import {
  createAgentSession,
  codingTools,   // read, bash, edit, write（默认）
  readOnlyTools, // read, grep, find, ls（只读）
} from "@mariozechner/pi-coding-agent";

// 使用完整工具集
const { session } = await createAgentSession({
  tools: codingTools,
});

// 只读模式
const { session } = await createAgentSession({
  tools: readOnlyTools,
});
```

**注意**：如果指定了自定义 `cwd`，需要使用工厂函数：

```typescript
import { createCodingTools } from "@mariozechner/pi-coding-agent";

const cwd = "/path/to/project";
const { session } = await createAgentSession({
  cwd,
  tools: createCodingTools(cwd),
});
```

---

### 7. 加载扩展

```typescript
import { createAgentSession, DefaultResourceLoader } from "@mariozechner/pi-coding-agent";

const loader = new DefaultResourceLoader({
  additionalExtensionPaths: ["/path/to/my-extension.ts"],
  extensionFactories: [
    (pi) => {
      pi.on("agent_start", () => {
        console.log("[扩展] Agent 启动");
      });
    },
  ],
});
await loader.reload();

const { session } = await createAgentSession({ resourceLoader: loader });
```

---

### 8. 事件系统

```typescript
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      // 流式文本输出
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    
    case "tool_execution_start":
      console.log(`工具: ${event.toolName}`);
      break;
    
    case "tool_execution_end":
      console.log(`结果: ${event.isError ? "错误" : "成功"}`);
      break;
    
    case "agent_start":
      console.log("开始处理");
      break;
    
    case "agent_end":
      console.log("处理完成");
      break;
    
    case "turn_end":
      console.log("一轮完成:", event.message);
      break;
  }
});
```

---

### 9. 会话管理

```typescript
import { SessionManager } from "@mariozechner/pi-coding-agent";

// 内存会话（不持久化）
SessionManager.inMemory()

// 持久化会话
SessionManager.create(process.cwd())

// 继续最近的会话
SessionManager.continueRecent(process.cwd())

// 打开指定文件
SessionManager.open("/path/to/session.jsonl")

// 列出会话
await SessionManager.list(process.cwd())     // 当前项目
await SessionManager.listAll(process.cwd())  // 全部
```

---

### 10. 设置管理

```typescript
import { SettingsManager } from "@mariozechner/pi-coding-agent";

// 从文件加载（全局 + 项目合并）
const settingsManager = SettingsManager.create();

// 覆盖设置
settingsManager.applyOverrides({
  compaction: { enabled: false },
  retry: { maxRetries: 5 },
});

// 内存设置（用于测试）
const inMemory = SettingsManager.inMemory({
  compaction: { enabled: false },
});

const { session } = await createAgentSession({ settingsManager });
```

---

### 11. 三种运行模式

SDK 提供了三种构建自定义界面的方式：

#### InteractiveMode（完整 TUI）

```typescript
import { InteractiveMode } from "@mariozechner/pi-coding-agent";

const mode = new InteractiveMode(runtime, {
  initialMessage: "你好",
  initialImages: [],
  initialMessages: [],
});
await mode.run();
```

#### Print Mode（单次输出）

```typescript
import { runPrintMode } from "@mariozechner/pi-coding-agent";

await runPrintMode(runtime, {
  mode: "text",
  initialMessage: "总结这段代码",
  initialImages: [],
  messages: ["还有补充"],
});
```

#### RPC Mode（JSON-RPC 进程集成）

```typescript
import { runRpcMode } from "@mariozechner/pi-coding-agent";

await runRpcMode(runtime);
```

---

### 12. SDK vs RPC 模式

| 特性 | SDK | RPC 模式 |
|------|-----|---------|
| 类型安全 | ✅ TypeScript | ❌ JSON 协议 |
| 进程内 | ✅ 同一进程 | ❌ 子进程 |
| 直接状态访问 | ✅ | ❌ |
| 跨语言 | ❌ Node.js | ✅ 任意语言 |
| 进程隔离 | ❌ | ✅ |
| 适用场景 | 构建 Node.js 应用 | 非 Node.js 集成 |

---

## 第二部分：Pi Packages

### 1. 什么是 Pi Package？

Pi Package 是将扩展、技能、提示模板和主题 **打包分享** 的方式，可以通过 npm 或 git 分发。

### 2. 创建 Pi Package

在 `package.json` 中添加 `pi` 字段：

```json
{
  "name": "my-pi-tools",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

### 目录结构

```
my-pi-tools/
├── package.json
├── extensions/
│   └── my-tool.ts
├── skills/
│   └── my-skill/
│       └── SKILL.md
├── prompts/
│   └── review.md
└── themes/
    └── ocean.json
```

如果没有 `pi` 清单，PI 会自动从约定目录发现：
- `extensions/` → 加载 `.ts` 和 `.js`
- `skills/` → 递归查找 `SKILL.md`
- `prompts/` → 加载 `.md`
- `themes/` → 加载 `.json`

---

### 3. 安装和管理

```bash
# 从 npm 安装
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3   # 固定版本

# 从 git 安装
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1

# 从 URL 安装
pi install https://github.com/user/repo

# 从本地路径安装
pi install ./my-pi-tools

# 项目级安装（-l）
pi install npm:@foo/bar -l

# 管理
pi list              # 列出已安装的包
pi update            # 更新所有未固定的包
pi remove npm:@foo   # 删除包
pi uninstall npm:@foo # 同上
pi config            # 启用/禁用包资源
```

### 全局 vs 项目级

| 安装方式 | 位置 | 用途 |
|---------|------|------|
| 默认 | `~/.pi/agent/settings.json` | 个人使用 |
| `-l` 参数 | `.pi/settings.json` | 项目级，可与团队共享 |

项目级配置可以提交到 Git，团队成员会自动安装缺失的包。

---

### 4. 依赖管理

```json
{
  "dependencies": {
    "chalk": "^5.0.0"
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*"
  }
}
```

- 运行时依赖放在 `dependencies`
- PI 核心包放在 `peerDependencies`（用 `"*"` 范围，不要打包）
- 安装时使用生产模式（`npm install --omit=dev`）

---

### 5. 包过滤

精细控制包中加载的资源：

```json
{
  "packages": [
    "npm:simple-pkg",
    {
      "source": "npm:my-package",
      "extensions": ["extensions/*.ts", "!extensions/legacy.ts"],
      "skills": [],
      "prompts": ["prompts/review.md"],
      "themes": ["+themes/legacy.json"]
    }
  ]
}
```

- 省略某个键 → 加载该类型全部
- `[]` → 不加载该类型
- `!pattern` → 排除匹配项
- `+path` → 强制包含
- `-path` → 强制排除

---

## 第三部分：完整项目示例

### 场景：构建一个带自定义工具的 PI 项目

```
my-project/
├── AGENTS.md           # 项目指令
├── .pi/
│   ├── settings.json   # 项目设置
│   ├── extensions/
│   │   └── deploy.ts   # 部署工具
│   ├── skills/
│   │   └── api-test/
│   │       └── SKILL.md
│   └── prompts/
│       └── review.md   # 代码审查模板
├── src/
│   └── ...
└── package.json
```

### .pi/settings.json

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "packages": ["pi-skills"],
  "enabledModels": ["claude-*", "gpt-4o"]
}
```

### AGENTS.md

```markdown
# my-project 开发指南

## 技术栈
- Node.js 20 + TypeScript
- 使用 pnpm
- API 部署到 Vercel

## 规范
- 所有 API 端点必须有类型定义
- 错误统一使用 AppError 类
- 提交信息遵循 Conventional Commits

## 部署
运行 `/skill:deploy` 部署到 Vercel
```

---

## 本章小结

✅ 学会了用 SDK 创建和管理 AI 会话  
✅ 掌握了自定义工具和事件订阅  
✅ 理解了 SDK 与 RPC 模式的适用场景  
✅ 学会了创建和发布 Pi Package  
✅ 构建了一个完整的定制化项目结构  

---

## 全系列总结

恭喜你完成了 PI 系列教程！现在你已经掌握了：

| 层级 | 能力 |
|------|------|
| ⭐ 入门 | 安装、认证、基本对话 |
| ⭐⭐ 日常 | 会话管理、模型切换、文件操作 |
| ⭐⭐ 进阶 | 设置配置、AGENTS.md 编写 |
| ⭐⭐⭐ 深度定制 | 扩展开发、技能创建、提示模板 |
| ⭐⭐⭐⭐ 高级 | SDK 集成、Pi Packages 发布 |

## 更多资源

- 📖 官方文档：`/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
- 💬 Discord 社区：https://discord.com/invite/3cU7Bz4UPx
- 📦 包搜索：https://www.npmjs.com/search?q=keywords%3Api-package
- 🎮 示例扩展：`/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/extensions/`

**记住 PI 的核心哲学：让 PI 适应你的工作流，而不是反过来。**

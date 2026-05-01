# 教程 4：扩展（Extensions）与技能（Skills）

> 预计用时：30 分钟 | 目标：学会用扩展和技能深度定制 PI 的能力

---

## 第一部分：扩展（Extensions）

### 1. 什么是扩展？

扩展是 **TypeScript 模块**，可以：
- 注册自定义工具（LLM 可调用的函数）
- 订阅生命周期事件（拦截、修改工具调用）
- 添加自定义命令（`/mycommand`）
- 添加快捷键
- 创建自定义 UI 组件

**存放位置：**

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/extensions/*.ts` | 全局 |
| `.pi/extensions/*.ts` | 项目级 |

放在这些位置的扩展会被自动发现，并支持 `/reload` 热重载。

---

### 2. 第一个扩展：打招呼工具

创建 `~/.pi/agent/extensions/greet.ts`：

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // 注册一个自定义工具
  pi.registerTool({
    name: "greet",
    label: "打招呼",
    description: "用指定语言向某人打招呼",
    parameters: Type.Object({
      name: Type.String({ description: "要打招呼的人名" }),
      language: Type.String({ description: "语言", default: "中文" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      const greetings: Record<string, string> = {
        "中文": `你好，${params.name}！`,
        "English": `Hello, ${params.name}!`,
        "日本語": `こんにちは、${params.name}さん！`,
      };
      const greeting = greetings[params.language] || `Hi, ${params.name}!`;
      
      return {
        content: [{ type: "text", text: greeting }],
        details: { language: params.language },
      };
    },
  });
}
```

测试：
```bash
pi -e ~/.pi/agent/extensions/greet.ts
# 然后告诉 PI：「向张三打个招呼」
```

---

### 3. 注册命令

在扩展中添加自定义命令：

```typescript
pi.registerCommand("stats", {
  description: "显示当前会话统计",
  handler: async (args, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    ctx.ui.notify(`共 ${entries.length} 条记录`, "info");
  },
});
```

使用时输入 `/stats`。

---

### 4. 事件拦截

扩展可以监听和拦截各种事件。

#### 场景：危险命令拦截

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    // 拦截 bash 工具中的危险命令
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm(
        "危险操作！",
        "确定要执行 rm -rf 吗？"
      );
      if (!ok) {
        return { block: true, reason: "用户阻止了危险命令" };
      }
    }
  });
}
```

#### 场景：注入上下文

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  return {
    message: {
      customType: "context-injector",
      content: "当前 Git 分支是 main，最近提交：feat: add login",
      display: false,  // 不在界面显示
    },
  };
});
```

---

### 5. 常用事件一览

```
session_start       → 会话启动
agent_start         → 开始处理用户输入
agent_end           → 处理完成
turn_start/turn_end → 每个 LLM 轮次
tool_call           → 工具调用前（可拦截）
tool_result         → 工具执行后（可修改结果）
context             → LLM 调用前（可修改消息）
input               → 用户输入到达后（可转换或处理）
session_shutdown    → 会话关闭（清理资源）
```

---

### 6. UI 交互

扩展可以通过 `ctx.ui` 与用户交互：

```typescript
// 通知
ctx.ui.notify("构建成功！", "success");
ctx.ui.notify("出错了", "error");
ctx.ui.notify("注意", "warning");
ctx.ui.notify("信息", "info");

// 确认对话框
const ok = await ctx.ui.confirm("标题", "确定吗？");

// 选择器
const choice = await ctx.ui.select("选择一个：", ["选项A", "选项B", "选项C"]);

// 输入框
const answer = await ctx.ui.input("请输入：");

// 状态栏文字
ctx.ui.setStatus("my-ext", "处理中...");

// 自定义组件
ctx.ui.setWidget("my-ext", ["第1行", "第2行"]);
```

---

### 7. 状态持久化

用 `pi.appendEntry()` 存储扩展状态（不参与 LLM 上下文）：

```typescript
// 存储
pi.appendEntry("todo-state", { items: ["task1", "task2"] });

// 恢复（在 session_start 事件中）
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type === "custom" && entry.customType === "todo-state") {
      console.log("恢复状态:", entry.data);
    }
  }
});
```

---

### 8. 扩展项目结构

#### 单文件（简单扩展）
```
~/.pi/agent/extensions/
└── my-extension.ts
```

#### 目录结构（复杂扩展）
```
~/.pi/agent/extensions/
└── my-extension/
    ├── index.ts       # 入口
    ├── tools.ts       # 工具定义
    └── utils.ts       # 辅助函数
```

#### 带依赖的扩展
```
~/.pi/agent/extensions/
└── my-extension/
    ├── package.json   # 声明依赖
    ├── node_modules/  # npm install 后
    └── src/
        └── index.ts
```

```json
{
  "name": "my-extension",
  "dependencies": { "chalk": "^5.0.0" },
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

---

## 第二部分：技能（Skills）

### 1. 什么是技能？

技能是 **按需加载的指令包**，遵循 [Agent Skills 标准](https://agentskills.io)。它提供专门的工作流、设置说明、辅助脚本和参考文档。

与扩展不同：
- **扩展** = TypeScript 代码，添加新功能
- **技能** = Markdown 指令 + 可选脚本，提供专业工作流

---

### 2. 技能存放位置

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/skills/` | 全局 |
| `~/.agents/skills/` | 全局（兼容标准） |
| `.pi/skills/` | 项目级 |
| `.agents/skills/` | 项目级（兼容标准） |

---

### 3. 技能结构

```
my-skill/
├── SKILL.md              # 必需：元数据 + 指令
├── scripts/              # 辅助脚本
│   └── process.sh
├── references/           # 详细文档（按需加载）
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md 格式

````markdown
---
name: my-skill
description: 处理 PDF 文件，提取文本和表格，填充表单，合并多个 PDF
---

# PDF 处理技能

## 安装

首次使用前运行：
```bash
cd /path/to/my-skill && npm install
```

## 使用方法

```bash
./scripts/extract.sh <input.pdf>      # 提取文本
./scripts/merge.sh <file1> <file2>    # 合并 PDF
```
````

### 元数据字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 是 | 1-64 字符，小写字母+数字+连字符 |
| `description` | 是 | 1024 字符以内，描述技能用途 |
| `license` | 否 | 许可证 |
| `compatibility` | 否 | 环境要求 |
| `allowed-tools` | 否 | 预批准的工具列表 |

---

### 4. 技能的使用方式

#### 自动加载

技能描述会包含在系统提示中。当任务匹配时，模型会自动用 `read` 工具加载完整的 SKILL.md 并遵循指令。

#### 手动调用

```
/skill:my-skill                    # 加载并执行技能
/skill:pdf-tools extract file.pdf  # 带参数调用
```

---

### 5. 实用技能示例

#### 搜索技能

````markdown
---
name: web-search
description: 通过网络搜索获取最新信息。当需要查询文档、查找事实或搜索解决方案时使用
---

# 网络搜索

## 搜索
```bash
node ./scripts/search.js "搜索关键词"
```

## 提取网页内容
```bash
node ./scripts/extract.js https://example.com
```
````

---

### 6. 共享技能

你可以从其他 AI 编程助手导入技能：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

---

## 第三部分：提示模板（Prompt Templates）

### 1. 什么是提示模板？

提示模板是 **可复用的 Markdown 片段**，通过 `/name` 展开为完整提示。

### 存放位置

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/prompts/*.md` | 全局 |
| `.pi/prompts/*.md` | 项目级 |

### 2. 模板格式

```markdown
---
description: 审查暂存的 Git 变更
---
审查暂存的变更（git diff --cached）。重点关注：
- Bug 和逻辑错误
- 安全问题
- 错误处理缺失
```

文件名即命令名：`review.md` → `/review`

### 3. 带参数的模板

```markdown
---
description: 创建 React 组件
---
创建一个名为 $1 的 React 组件，特性：$@
```

使用：
```
/component Button "onClick 处理" "禁用支持"
```

支持的参数语法：
- `$1`, `$2` — 位置参数
- `$@` 或 `$ARGUMENTS` — 所有参数拼接
- `${@:N}` — 从第 N 个位置开始
- `${@:N:L}` — 从第 N 个开始取 L 个

---

## 第四部分：主题（Themes）

### 快速入门

创建 `~/.pi/agent/themes/my-theme.json`：

```json
{
  "$schema": "https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "primary": "#00aaff",
    "secondary": 242
  },
  "colors": {
    "accent": "primary",
    "border": "primary",
    "borderAccent": "#00ffff",
    "borderMuted": "secondary",
    "success": "#00ff00",
    "error": "#ff0000",
    "warning": "#ffff00",
    "muted": "secondary",
    "dim": 240,
    "text": "",
    "thinkingText": "secondary",
    "selectedBg": "#2d2d30",
    "userMessageBg": "#2d2d30",
    "toolPendingBg": "#1e1e2e",
    "toolSuccessBg": "#1e2e1e",
    "toolErrorBg": "#2e1e1e",
    "toolTitle": "primary",
    "toolOutput": "",
    "mdHeading": "#ffaa00",
    "mdLink": "primary",
    "mdCode": "#00ffff",
    "toolDiffAdded": "#00ff00",
    "toolDiffRemoved": "#ff0000",
    "syntaxComment": "secondary",
    "syntaxKeyword": "primary",
    "syntaxString": "#00ff00",
    "thinkingOff": "secondary",
    "thinkingMedium": "#00ffff",
    "bashMode": "#ffaa00"
  }
}
```

> 注意：主题需要定义全部 51 个颜色令牌。上面是简化示例，完整列表请参考官方文档。

**热重载**：修改当前主题文件后，PI 会自动重新加载。

---

## 本章小结

✅ 理解了扩展和技能的本质区别  
✅ 学会了编写自定义工具和命令  
✅ 掌握了事件拦截和 UI 交互  
✅ 学会了创建和使用技能  
✅ 了解了提示模板和主题定制  

**下一步 → [教程 5：SDK 集成与 Pi Packages](./05-sdk-packages)**

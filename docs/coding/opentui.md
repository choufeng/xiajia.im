# OpenTUI 使用指南

> 基于 Zig 原生核心的终端 UI 框架，通过 TypeScript 绑定构建富交互式终端应用。

## 什么是 OpenTUI

OpenTUI 是一个用 Zig 编写的原生终端 UI 核心，带有 TypeScript 绑定。原生核心暴露 C ABI，可从任何语言使用。它由 Anomaly 团队开发，已在生产环境中驱动 [OpenCode](https://opencode.ai)，并将用于 terminal.shop。

核心特性：

- **Flexbox 布局**：基于 Yoga 的布局引擎，支持类 CSS 的定位和尺寸设置
- **语法高亮**：内置 Tree-sitter 集成，支持代码渲染
- **丰富的组件**：Text、Box、Input、Select、ScrollBox、Code、Diff 等
- **键盘处理**：内置焦点管理和输入处理
- **React / Solid.js**：一等公民的框架绑定
- **动画支持**：Timeline API，流畅的终端动画
- **高性能**：Zig 原生核心，专注正确性、稳定性和性能

## 安装

OpenTUI 目前仅支持 Bun（Deno 和 Node 支持正在进行中）。

### 快速创建项目

```bash
bun create tui
```

### 手动安装

```bash
mkdir my-tui && cd my-tui
bun init -y
bun add @opentui/core
```

### 添加为 Skill

```bash
npx skills add anomalyco/opentui --skill opentui --global
```

## 核心概念

### Renderer（渲染器）

`CliRenderer` 是 OpenTUI 的驱动引擎，管理终端输出、处理输入事件、运行渲染循环。

```typescript
import { createCliRenderer } from "@opentui/core"

const renderer = await createCliRenderer({
  exitOnCtrlC: true,   // Ctrl+C 时自动清理
  targetFps: 30,       // 目标帧率
  useMouse: true,      // 启用鼠标输入
  autoFocus: true,     // 点击时自动聚焦
})
```

### 屏幕模式

| 模式 | 说明 |
|------|------|
| `"alternate-screen"` | 默认模式，切换到终端的备用屏幕缓冲区，全屏 TUI 的标准模式 |
| `"main-screen"` | 在主屏幕上渲染，不切换缓冲区，适合测试和短生命周期工具 |
| `"split-footer"` | 底部保留固定高度的 footer，上方区域可供正常输出 |

### 渲染模式

- **自动模式（默认）**：仅在组件树变化时重新渲染
- **连续模式**：调用 `renderer.start()` 以目标 FPS 持续渲染

### Renderables vs Constructs

OpenTUI 提供两套 API：

**Renderable API（底层，面向对象）：**

```typescript
import { TextRenderable } from "@opentui/core"
const text = new TextRenderable(renderer, {
  id: "greeting",
  content: "Hello!",
  fg: "#00FF00",
})
renderer.root.add(text)
```

**Construct API（高层，声明式，推荐）：**

```typescript
import { Text } from "@opentui/core"
renderer.root.add(
  Text({ content: "Hello!", fg: "#00FF00" })
)
```

## 组件

### Text — 文本显示

```typescript
import { Text, t, bold, fg, bg, italic, underline } from "@opentui/core"

// 基础用法
Text({ content: "Hello, OpenTUI!", fg: "#00FF00" })

// 模板字面量（富文本）
Text({
  content: t`${bold("警告:")} ${fg("#FF0000")(underline("危险操作!"))}`,
})
```

可用文本属性：`BOLD`、`DIM`、`ITALIC`、`UNDERLINE`、`BLINK`、`INVERSE`、`HIDDEN`、`STRIKETHROUGH`

### Box — 容器和布局

```typescript
import { Box, Text } from "@opentui/core"

renderer.root.add(
  Box(
    { width: "100%", height: "100%", flexDirection: "row", gap: 2 },
    Box(
      { flexGrow: 1, backgroundColor: "#1a1b26" },
      Text({ content: "Sidebar", fg: "#bb9af7" })
    ),
    Box({ flexGrow: 3 }, Text({ content: "Main Content" }))
  )
)
```

Box 是工厂函数：第一个参数是 props，后续参数是子元素。

### 交互组件

```typescript
// 输入框
import { Input, Select, Slider } from "@opentui/core"

const input = Input({
  placeholder: "Type something...",
  width: 30,
})
input.focus()

// 下拉选择
const select = Select({
  options: ["Option 1", "Option 2", "Option 3"],
  label: "Choose",
})

// 滑块
const slider = Slider({ min: 0, max: 100, value: 50, width: 20 })
```

### 内容组件

```typescript
// 代码块（语法高亮）
Code({ content: "const x = 42;", filetype: "typescript", lineNumbers: true })

// Markdown 渲染
Markdown({ content: "# Hello\n\n**Bold** text", width: "100%" })

// Diff 差异显示
Diff({ oldContent: "hello world", newContent: "hello OpenTUI", width: "100%" })
```

## 布局系统

基于 Yoga 的 Flexbox 布局引擎：

| 属性 | 类型 | 说明 |
|------|------|------|
| `flexDirection` | `"row"` \| `"column"` | 主轴方向 |
| `flexGrow` | `number` | 弹性增长 |
| `width` / `height` | `number` \| `"100%"` | 尺寸 |
| `gap` | `number` | 子元素间距 |
| `padding` | `number` | 内边距 |
| `borderStyle` | `"rounded"` \| `"single"` \| `"double"` | 边框样式 |
| `position` | `"relative"` \| `"absolute"` | 定位模式 |
| `justifyContent` | `"center"` \| `"space-between"` ... | 主轴对齐 |
| `alignItems` | `"center"` \| `"stretch"` ... | 交叉轴对齐 |

## React / Solid.js 绑定

OpenTUI 提供一等公民的 React 和 Solid.js 支持：

### React

```typescript
import { createReactRenderer, Text, Box } from "@opentui/react"

const renderer = await createReactRenderer()

function App() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text fg="#00FF00">Hello from React!</Text>
    </Box>
  )
}

renderer.render(<App />)
```

### Solid.js

```typescript
import { createSolidRenderer, Text, Box } from "@opentui/solid"

const renderer = await createSolidRenderer()

function App() {
  return (
    <Box flexDirection="column" gap={1}>
      <Text fg="#00FF00">Hello from Solid!</Text>
    </Box>
  )
}

renderer.render(() => <App />)
```

## 完整示例：终端 Dashboard

```typescript
import { createCliRenderer, Box, Text, Input, t, bold, fg } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: true })

renderer.root.add(
  Box(
    { width: "100%", height: "100%", flexDirection: "column" },
    // Header
    Box(
      {
        width: "100%", height: 3,
        backgroundColor: "#1a1b26",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: 2,
      },
      Text({ content: t`${bold(fg("#bb9af7")("OpenTUI Dashboard"))}` }),
      Text({ content: "Welcome to your terminal dashboard", fg: "#565f89" }),
    ),
    // Content
    Box(
      { flexGrow: 1, flexDirection: "row", gap: 2, padding: 1 },
      Box(
        { width: 20, backgroundColor: "#16161e", borderStyle: "rounded", padding: 1 },
        Text({ content: t`${bold("Menu")}`, fg: "#7aa2f7" }),
        Text({ content: "• Home", fg: "#a9b1d6" }),
        Text({ content: "• Settings", fg: "#a9b1d6" }),
      ),
      Box(
        { flexGrow: 1, borderStyle: "rounded", padding: 1 },
        Text({ content: t`${bold("Command Input")}`, fg: "#9ece6a" }),
        Input({ placeholder: "Enter command...", width: "100%" }),
      ),
    ),
    // Footer
    Box(
      {
        width: "100%", height: 1,
        backgroundColor: "#1f2335",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingLeft: 2, paddingRight: 2,
      },
      Text({ content: "OpenTUI v1.0", fg: "#565f89" }),
      Text({ content: "Ctrl+C to exit", fg: "#565f89" }),
    ),
  ),
)
```

## 生命周期与清理

```typescript
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  clearOnShutdown: true,
  exitSignals: ["SIGINT", "SIGTERM"],
})

// 手动清理
await renderer.destroy()

// 暂停 / 恢复（处理子进程时）
await renderer.suspend()
await renderer.resume()
```

## 关键注意事项

1. **仅支持 Bun**：目前 Bun exclusive，Node.js 和 Deno 支持正在进行中
2. **推荐 Construct API**：更简洁、更声明式的写法
3. **Box 子元素通过参数传递**：不是 children prop，而是后续参数
4. **异步初始化**：使用 `await createCliRenderer()`
5. **Ctrl+C 默认触发清理**：通过 `exitOnCtrlC` 控制

## 相关链接

- 官网：[opentui.com](https://opentui.com)
- GitHub：[anomalyco/opentui](https://github.com/anomalyco/opentui)（10.7k+ stars）
- 文档：[opentui.com/docs](https://opentui.com/docs/getting-started)

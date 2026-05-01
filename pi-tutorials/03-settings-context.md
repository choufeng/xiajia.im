# 教程 3：设置与上下文文件

> 预计用时：15 分钟 | 目标：学会配置 PI 的行为和为项目编写指令

---

## 1. 设置文件

PI 使用 JSON 设置文件，**项目设置覆盖全局设置**：

| 位置 | 作用域 |
|------|--------|
| `~/.pi/agent/settings.json` | 全局（所有项目） |
| `.pi/settings.json` | 项目级（覆盖全局） |

### 编辑方式

```
# 交互式
/settings    # 修改常用选项

# 直接编辑
vim ~/.pi/agent/settings.json   # 全局设置
vim .pi/settings.json           # 项目设置
```

### 设置合并规则

项目设置与全局设置 **深合并**：

```json
// 全局 ~/.pi/agent/settings.json
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// 项目 .pi/settings.json
{
  "compaction": { "reserveTokens": 8192 }
}

// 合并结果
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```

---

## 2. 常用设置项

### 模型与思考

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "hideThinkingBlock": false,
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### 界面与显示

```json
{
  "theme": "dark",
  "quietStartup": false,
  "editorPaddingX": 0,
  "doubleEscapeAction": "tree"
}
```

### 自动重试

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "maxDelayMs": 60000
  }
}
```

### 模型循环

```json
{
  "enabledModels": ["claude-*", "gpt-4o"]
}
```

---

## 3. 上下文文件（AGENTS.md）

这是 PI 最重要的项目定制功能之一。

### 加载顺序

PI 在启动时加载以下位置的 `AGENTS.md`（或 `CLAUDE.md`）：

1. `~/.pi/agent/AGENTS.md`（全局）
2. 从当前目录向上遍历找到的所有 `AGENTS.md`
3. 当前目录的 `AGENTS.md`

所有匹配文件的内容会 **拼接** 在一起。

### AGENTS.md 写什么？

```markdown
# 项目指令

## 技术栈
- TypeScript + Node.js
- 使用 pnpm 管理依赖
- 测试框架：Vitest

## 编码规范
- 使用 async/await，不要用 .then()
- 所有函数必须有类型注解
- 错误处理统一使用 Result 模式

## 常用命令
- 安装依赖：pnpm install
- 运行测试：pnpm test
- 构建：pnpm build
- 开发：pnpm dev

## 目录结构
- src/ - 源代码
- test/ - 测试文件
- docs/ - 文档
```

### 禁用上下文文件

```bash
pi --no-context-files    # 或 -nc
```

---

## 4. 自定义系统提示

### 完全替换

创建以下文件之一：

- `~/.pi/agent/SYSTEM.md`（全局）
- `.pi/SYSTEM.md`（项目）

### 追加（不替换）

- `~/.pi/agent/APPEND_SYSTEM.md`（全局）
- `.pi/APPEND_SYSTEM.md`（项目）

### CLI 覆盖

```bash
pi --system-prompt "你是一个精简的助手，只回答技术问题" "你好"
pi --append-system-prompt "始终用中文回答" "解释这个函数"
```

---

## 5. Shell 配置

### 自定义 Shell

```json
{
  "shellPath": "/opt/homebrew/bin/fish"
}
```

### 命令前缀

每个 bash 命令都会自动添加此前缀：

```json
{
  "shellCommandPrefix": "source ~/.nvm/nvm.sh && source ~/.profile"
}
```

### npm 命令配置

如果使用 mise/asdf 等版本管理工具：

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

---

## 6. 图片与终端

```json
{
  "terminal.showImages": true,
  "images.autoResize": true,
  "images.blockImages": false
}
```

- 图片可以通过 `Ctrl+V` 粘贴或拖拽到终端
- 自动压缩到 2000×2000 以下

---

## 7. 消息传递设置

```json
{
  "steeringMode": "one-at-a-time",  // 引导消息：逐个发送
  "followUpMode": "one-at-a-time",  // 后续消息：逐个发送
  "transport": "sse"                // 传输方式：sse / websocket / auto
}
```

---

## 8. 会话目录

自定义会话文件存储位置：

```json
{
  "sessionDir": ".pi/sessions"
}
```

---

## 9. 快捷键自定义

创建 `~/.pi/agent/keybindings.json` 自定义快捷键：

```json
{
  "ctrl+shift+p": {
    "action": "command",
    "command": "/model"
  }
}
```

---

## 10. 完整设置示例

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "quietStartup": false
}
```

---

## 11. 环境变量

| 变量 | 说明 |
|------|------|
| `PI_CODING_AGENT_DIR` | 覆盖配置目录 |
| `PI_SKIP_VERSION_CHECK` | 跳过版本检查 |
| `PI_TELEMETRY` | 覆盖遥测（0 禁用） |
| `PI_CACHE_RETENTION` | 设为 `long` 延长缓存时间 |
| `VISUAL` / `EDITOR` | 外部编辑器（Ctrl+G 使用） |

---

## 本章小结

✅ 理解了全局和项目级设置的关系  
✅ 掌握了常用设置项  
✅ 学会了编写 AGENTS.md 为项目添加指令  
✅ 了解了自定义系统提示的方法  
✅ 配置了 Shell 和快捷键  

**下一步 → [教程 4：扩展与技能](./04-extensions-skills.md)**

---
name: write-blog
description: 为 XiaJia.IM（VitePress 个人笔记站点）快速生成新文章，自动处理文件创建、侧边栏导航更新、git commit 与 push 完整流程。当需要在此站点中新增文章、教程或笔记时使用。
---

# write-blog — XiaJia.IM 文章生成技能

> 本技能用于在 XiaJia.IM 站点中快速创建新文章，并自动维护导航配置和 git 版本控制。

---

## 项目概况

| 属性 | 值 |
|------|------|
| **站点** | XiaJia.IM — Code, Music, Life |
| **框架** | VitePress |
| **作者** | Jon.Xia (GitHub: choufeng) |
| **仓库** | `git@github.com:choufeng/xiajia.im.git` |
| **文档根** | `docs/` |
| **入口** | `docs/index.md` (首页)，`docs/README.md` (README) |

### 内容板块

| 板块路径 | 导航名称 | 描述 |
|----------|---------|------|
| `docs/ai/` | AI | 大模型、Prompt 工程、Agent 工程 |
| `docs/coding/` | 编程笔记 | React、Vue、HarmonyOS、函数式编程 |
| `docs/reference/` | 工具参考 | Ramda、Date-fns、TypeORM 等工具库速查 |
| `docs/pi-tutorials/` | PI 教程 | PI 编程助手系列教程 |
| `docs/about.md` | 关于 | 关于本站 |

---

## 使用方式

当用户要求「写一篇文章放到站点上」或「在站点上新增内容」时，按以下流程执行。

### 步骤 1：确认文章信息

向用户确认（或从上下文提取）：

1. **文章标题**（中文）
2. **所属板块**（ai / coding / reference / pi-tutorials）
3. **文件名**（kebab-case，如 `my-article.md`）
4. **所属分类组**（对应 sidebar 中的分组，如 AI 下的「AI 基础」或「Agent 工程」）
5. **文章内容**（如果用户未提供，则根据标题和主题生成）

### 步骤 2：生成文章文件

将文章写入 `docs/{板块}/{文件名}.md`。

#### 文章格式规范

**标准文章格式**（大多数文章使用）：

```markdown
# 文章标题

> 一句话描述或引用，概括文章核心观点。

## 一级章节标题

内容正文。使用 Markdown 格式，可以包含表格、代码块、列表等。

### 二级子标题

更多内容。

## 另一个章节

更多正文。
```

**带 Frontmatter 的文章**（需要自定义页面标题时使用）：

```markdown
---
title: 自定义页面标题（不同于正文一级标题时使用）
---

# 文章标题

> 描述...

正文内容...
```

#### 板块特定风格指南

**AI 板块 (`docs/ai/`)**：
- 风格偏系统性，结构清晰
- 善用表格对比、分点列举
- 重要概念使用 `**加粗**` 或 `> 引用` 强调
- 可以包含架构图引用 `![](/structure.png)`

**编程笔记 (`docs/coding/`)**：
- 偏个人学习记录，语气可以更随意
- 代码示例用标准代码块标注语言
- 可以是读书笔记形式

**工具参考 (`docs/reference/`)**：
- 速查表风格，善用表格
- 链接到官方文档
- 可以包含版本信息

**PI 教程 (`docs/pi-tutorials/`)**：
- 系列教程风格，编号文件名如 `06-topic.md`
- 章节末有「本章小结」和「下一步」链接
- 链接使用 VitePress 格式（无 `.md` 后缀）

### 步骤 3：更新侧边栏导航

编辑 `docs/.vitepress/config.js`，在对应板块的 `sidebar` 配置中添加新文章条目。

#### 导航规则

1. 找到文章所属板块的 sidebar 配置（`'/ai/'`, `'/coding/'`, `'/reference/'`, `'/pi-tutorials/'`）
2. 找到或创建对应的分组（`text` 字段）
3. 在 `items` 数组中添加新条目：

```javascript
{ text: '文章显示名称', link: '/板块/文件名' },
```

> **注意**：link 路径不加 `.md` 后缀。

#### 新增板块时的处理

如果是全新的板块（不属于现有 4 个板块之一），需要同时：

1. 在 `nav` 数组中添加导航项
2. 在 `sidebar` 对象中添加新的路径前缀配置

```javascript
nav: [
  // ... 现有项
  { text: '新板块', link: '/new-section/' },
],

sidebar: {
  // ... 现有配置
  '/new-section/': [
    {
      text: '分组名称',
      items: [
        { text: '第一篇文章', link: '/new-section/first-article' },
      ],
    },
  ],
},
```

### 步骤 4：验证链接

确保：
1. 侧边栏中的 `link` 路径与文件实际路径一致（去掉 `.md` 后缀）
2. 文章内部的交叉引用链接格式正确
3. 没有破坏现有链接

### 步骤 5：Git Commit & Push

```bash
cd /Users/jia.xia/development/xiajia.im

# 查看变更
git status
git diff docs/.vitepress/config.js

# 添加并提交
git add docs/板块/文件名.md docs/.vitepress/config.js
git commit -m "docs: 新增文章 — 文章标题"

# 推送
git push
```

#### Commit 信息规范

使用 Conventional Commits 格式：

```
docs: 新增文章 — 文章标题
```

如果是系列教程：
```
docs: 新增 PI 教程第 N 篇 — 教程标题
```

如果是更新导航：
```
docs: 更新侧边栏导航 — 新增文章标题
```

---

## 完整流程示例

### 示例：在 AI 板块新增「RAG 入门」文章

**用户请求**：「帮我写一篇 RAG 入门的文章放到站点上，放在 AI 板块」

**执行流程**：

1. 生成文章 `docs/ai/rag-basics.md`
2. 编辑 `docs/.vitepress/config.js`，在 `/ai/` 侧边栏的「AI 基础」分组中添加：
   ```javascript
   { text: 'RAG 入门', link: '/ai/rag-basics' },
   ```
3. 执行 git commit & push：
   ```bash
   git add docs/ai/rag-basics.md docs/.vitepress/config.js
   git commit -m "docs: 新增文章 — RAG 入门"
   git push
   ```

### 示例：创建全新板块

**用户请求**：「新建一个音乐板块，放一篇吉他入门笔记」

**执行流程**：

1. 创建目录 `docs/music/`
2. 生成文章 `docs/music/guitar-basics.md`
3. 生成板块索引 `docs/music/index.md`
4. 在 `config.js` 的 `nav` 中添加 `{ text: '音乐', link: '/music/' }`
5. 在 `config.js` 的 `sidebar` 中添加 `'/music/': [...]` 配置
6. Commit & push

---

## 现有文章索引

> 用于避免文件名冲突，以及了解各板块的现有内容。

### AI (`docs/ai/`)

| 文件 | 标题 | 分组 |
|------|------|------|
| `index.md` | AI 学习总览 | AI 基础 |
| `llm-basics.md` | LLM 基础 | AI 基础 |
| `prompt.md` | Prompt 工程 | AI 基础 |
| `architecture.md` | 技术架构 | AI 基础 |
| `applications.md` | 应用场景 | AI 基础 |
| `skill-graph-constitution.md` | Skill Graph 改造方案 | Agent 工程 |
| `skill-graph-guide.md` | Skill Graph 创建指南 | Agent 工程 |

### 编程笔记 (`docs/coding/`)

| 文件 | 标题 | 分组 |
|------|------|------|
| `react.md` | React.js | 前端框架 |
| `vue.md` | Vue.js | 前端框架 |
| `harmony-os.md` | HarmonyOS | 前端框架 |
| `functional.md` | 函数式编程 | 函数式编程 |
| `functional-thinking.md` | 函数式思维 | 函数式编程 |
| `effective-js.md` | Effective JavaScript | 学习与实践 |
| `learn-more.md` | Learn More Study Less | 学习与实践 |

### 工具参考 (`docs/reference/`)

| 文件 | 标题 | 分组 |
|------|------|------|
| `ramda.md` | Ramda.js | 工具库 |
| `date-fns.md` | Date-fns | 工具库 |
| `typeorm.md` | TypeORM | 开发与部署 |
| `cypress.md` | Cypress.js | 开发与部署 |
| `algorithms.md` | 算法笔记 | 开发与部署 |
| `serverless.md` | Serverless | 运维 & 杂项 |
| `frp.md` | 内网穿透 (FRP) | 运维 & 杂项 |
| `ss.md` | SS 部署 | 运维 & 杂项 |
| `npm-global.md` | NPM 权限 | 运维 & 杂项 |
| `unit-test.md` | 单元测试 | 运维 & 杂项 |
| `gimp.md` | GIMP 使用 | 其他 |
| `domains.md` | 域名售卖 | 其他 |
| `links.md` | 资源链接 | 其他 |
| `jianhua.md` | 简化听书笔记 | 其他 |
| `somethings.md` | 杂记 | 其他 |

### PI 教程 (`docs/pi-tutorials/`)

| 文件 | 标题 | 分组 |
|------|------|------|
| `README.md` (/pi-tutorials/) | 教程总览 | 快速上手 |
| `01-quick-start.md` | 1. 安装与首次对话 | 快速上手 |
| `02-daily-workflow.md` | 2. 会话管理与分支 | 日常工作流 |
| `03-settings-context.md` | 3. 设置与上下文文件 | 日常工作流 |
| `04-extensions-skills.md` | 4. 扩展与技能开发 | 深度定制 |
| `05-sdk-packages.md` | 5. SDK 集成与包分享 | 深度定制 |

---

## 注意事项

1. **链接格式**：VitePress 内部链接不加 `.md` 后缀，如 `/ai/prompt`
2. **文件命名**：使用 kebab-case，如 `my-article.md`
3. **中文内容**：文章标题和正文使用中文，commit 信息也使用中文
4. **导航顺序**：新文章默认添加到所属分组的 `items` 数组末尾
5. **Config 格式**：`config.js` 使用 JavaScript 格式，注意逗号、引号
6. **首页**：`docs/index.md` 是首页，`docs/README.md` 是导航页
7. **图片**：放在 `docs/public/` 目录，引用时用 `/文件名` 路径
8. **主动确认**：生成文章后，在向用户展示的同时自动执行 git commit & push

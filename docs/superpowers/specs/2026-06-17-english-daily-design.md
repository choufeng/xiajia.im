# English Daily Skill 设计文档

> **日期**：2026-06-17
> **状态**：已确认，待实现
> **分支**：`feat/english-daily-skill`

---

## 1. 概述

在 XiaJia.IM（VitePress 个人站点）中新增 `Learning English` 板块。配套一个 pi 项目级 skill `english-daily`，手动触发后：

1. 从内置 dev 高频词库随机取 **5 个未使用过** 的英文单词
2. 生成表格：单词 + 中文解释 + dev 语境英文例句
3. 基于这 5 个词生成一段**双人 dev 工作场景对话**
4. 调用**火山引擎豆包 TTS** 把对话合成 **MP3**（多角色音色）
5. MP3 落地到 `docs/public/audio/`，随 gh-pages 部署
6. 生成一篇 MD（表格 + 对话 + HTML5 `<audio>` 播放器）写入 `docs/english/`
7. 更新 VitePress 侧边栏 + git commit & push
8. 回写词库标记这 5 个词已使用

**目标受众**：计算机开发工程师。所有词汇、例句、对话围绕 dev 工作场景。

---

## 2. 目标与非目标

### 目标

- 手动触发，一次生成一篇完整的「5 词 + 对话 + 音频」学习内容
- 词库为唯一事实源，去重可靠（不依赖扫历史 MD）
- 零云存储依赖：MP3 存仓库，随站点部署
- 单一外部 API 依赖：火山豆包 TTS
- 板块作为站点左侧菜单一级导航项

### 非目标（YAGNI）

- ❌ 定时/cron 自动生成（future work，本期不做）
- ❌ 七牛/腾讯云等外部对象存储（因域名备案问题放弃）
- ❌ 词库自动扩充（手动维护 `vocab.json`，未来可加）
- ❌ 复习/测验/记忆曲线等学习功能
- ❌ 多语音模型对比/切换（本期固定火山豆包）

---

## 3. 端到端数据流

```
1. 读 docs/english/.vocab.json
2. filter words where used === false → 随机取 5 个
3. LLM 生成：
   - 5 词的「中文解释 + dev 英文例句」
   - 一段双人 dev 场景对话（自然融入 5 词）
   - 对话场景名（英文，转 kebab-case slug）
4. 重名检测：ls docs/english/ 查 <slug>.md 冲突 → 冲突加序号 -2
5. tts-volc.mjs：对话文本 → SSML 多角色 → MP3 bytes
6. MP3 写 docs/public/audio/<slug>.mp3
7. 写 docs/english/<slug>.md（表格 + 对话 + <audio>）
8. mark-used.mjs：vocab.json 这 5 词 used=true + usedDate + scene
9. 编辑 config.js：sidebar '/english/' 分组追加条目
10. git add + commit + push
```

---

## 4. 架构与组件

### 4.1 Skill 目录结构（源码）

```
.pi/skills/english-daily/
├── SKILL.md                 # 流程指令（给 pi 读）
├── scripts/
│   ├── pick-words.mjs       # 读 vocab.json → 随机5个未用词
│   ├── tts-volc.mjs         # 火山豆包 SSML多角色 → MP3
│   └── mark-used.mjs        # 生成后回写 vocab.json
└── data/
    └── vocab.seed.json      # 词库模板（首次初始化用，不运行时写）
```

**关键约定**：skill 源码目录保持纯净。运行时状态（`vocab.json` 的 `used` 标记）写到 **业务数据目录** `docs/english/.vocab.json`，不污染 skill 源码。

### 4.2 运行时数据：`docs/english/.vocab.json`

```json
{
  "version": 1,
  "generatedAt": "2026-06-17T08:00:00Z",
  "words": [
    {
      "word": "refactor",
      "used": false,
      "usedDate": null,
      "scene": null
    },
    {
      "word": "idempotent",
      "used": true,
      "usedDate": "2026-06-17",
      "scene": "deploy-pipeline-chat"
    }
  ]
}
```

- 首次运行：若 `docs/english/.vocab.json` 不存在 → 从 skill 的 `data/vocab.seed.json` 拷贝初始化
- 后续运行：直接读写该文件
- `seed.json` 约 300 词起，可持续手动扩充（扩充后重跑不影响已用标记，靠 word 字段匹配）

### 4.3 脚本职责

| 脚本 | 输入 | 输出 | 副作用 |
|---|---|---|---|
| `pick-words.mjs` | 无（读 vocab.json） | stdout: JSON `[{word}, ...]` 5 个 | 无（只读） |
| `tts-volc.mjs` | `--text <对话文本JSON>` `--out <mp3路径>` `--scene <slug>` | 写 MP3 文件 | 需环境变量凭证 |
| `mark-used.mjs` | `--words word1,word2,...` `--date YYYY-MM-DD` `--scene <slug>` | 改写 vocab.json | 5 词标记 used |

所有脚本均为 Node.js ESM（`.mjs`），项目已有 Node 环境。

---

## 5. 内容生成规范（LLM 职责）

pi 当前模型在 skill 流程中负责：

### 5.1 单词解释 + 例句（表格）

| Word | Meaning | Example |
|---|---|---|
| refactor | 重构（在不改变外部行为前提下优化代码结构） | We should refactor this module before adding new features. |

- Meaning：中文，简洁，偏 dev 语境
- Example：1 句英文，dev 工作场景，句子简短

### 5.2 双人场景对话

- **6-10 轮**（A/B 两角色交替）
- 场景 = dev 真实工作情境（code review、standup、onboarding、debug、deployment、production incident 等）
- **必须自然融入这 5 个词**（每个词至少出现一次）
- 角色名用 A / B（喂给 TTS 时映射成两个不同音色）
- 同时产出**场景标题**（英文短语，转 kebab-case 作 slug），如 `Code Review Discussion`

### 5.3 喂给 TTS 的纯对话文本

去掉中文解释，只留英文对话，格式化为脚本可解析的结构（JSON 数组）：

```json
[
  { "speaker": "A", "text": "..." },
  { "speaker": "B", "text": "..." }
]
```

---

## 6. 语音合成：火山引擎豆包 TTS

### 6.1 选型理由

- 原生支持 SSML 多角色（一段文本多音色），适合对话场景
- 国内访问稳定
- 大模型音质，情感自然

### 6.2 调用方式

- `scripts/tts-volc.mjs` 通过 HTTP REST / WebSocket 调火山豆包语音大模型 TTS
- 对话按 speaker 分段 → SSML 标注两个 voice（A/B 各一音色）→ 请求合成
- **实现阶段需核对火山官方最新 API 文档**（端点、鉴权方式、音色 voice_id 列表、SSML 语法、是否支持单请求多角色）
  - 若单请求不支持多角色 → 按段分别合成 → `ffmpeg` 本地拼接成单个 MP3
  - macOS 默认含 `ffmpeg`，若无则 skill 提示安装

### 6.3 输出

- 格式：MP3
- 落地：`docs/public/audio/<slug>.mp3`
- 比特率：默认官方推荐（一般 128kbps 够用）

### 6.4 凭证（不入 git）

环境变量（存 `~/.pi/agent/.env` 或系统环境变量）：

```
VOLC_TTS_APP_ID=<app_id>
VOLC_TTS_ACCESS_TOKEN=<access_token>
VOLC_TTS_CLUSTER=<cluster>      # 大模型版本标识，以官方文档为准
```

- 脚本启动时校验这三个变量存在，缺失 → 立即报错中止，不产生半成品
- 音色 voice_id 硬编码在 `tts-volc.mjs` 常量区（A/B 各一个，可后续调整）

---

## 7. VitePress 集成

### 7.1 新建板块（nav + sidebar）

编辑 `docs/.vitepress/config.js`：

```javascript
nav: [
  // ...现有
  { text: 'Learning English', link: '/english/' },
],

sidebar: {
  // ...现有
  '/english/': [
    {
      text: 'Daily Vocabulary',
      items: [
        // 每次生成追加：
        // { text: '场景显示名', link: '/english/<slug>' },
      ],
    },
  ],
},
```

### 7.2 板块索引页 `docs/english/index.md`

首次运行若不存在则生成，列出板块说明 + 已生成文章列表（手动或简单列表）。

### 7.3 MD 文档模板

```markdown
---
date: 2026-06-17
scene: Code Review Discussion
---

# Code Review Discussion

> 日期：2026-06-17 · 场景：Code Review Discussion

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| refactor | 重构（优化代码结构不改外部行为） | We should refactor this module before adding new features. |
| ... | ... | ... |

## 🎧 Audio

<audio controls preload="none" src="/audio/code-review-discussion.mp3"></audio>

## 💬 Dialogue

**A**: ...

**B**: ...

**A**: ...
```

- `src` 用 VitePress public 绝对路径 `/audio/<slug>.mp3`
- `preload="none"` 避免打开页面即下载

### 7.4 MP3 存放

`docs/public/audio/<slug>.mp3` —— VitePress 会把 `docs/public/` 下文件映射到站点根，故 MD 引用 `/audio/<slug>.mp3`。

---

## 8. 文件命名规则

- MD：`docs/english/<scene-slug>.md`，slug = 场景英文短语 kebab-case
  - 例：`Code Review Discussion` → `code-review-discussion.md`
  - `Daily Standup` → `daily-standup.md`
- MP3：`docs/public/audio/<scene-slug>.mp3`（与 MD 同 slug）
- **重名处理**：写前 `ls docs/english/` 检测 `<slug>.md`，冲突则 slug 追加 `-2`、`-3`（MP3 同步）
- 日期不进文件名，仅记 frontmatter `date`

---

## 9. 错误处理

| 失败点 | 处理 |
|---|---|
| vocab.json 不存在 | 从 `vocab.seed.json` 拷贝初始化，继续 |
| 可用词 < 5 | 报错：「词库可用词不足 5 个，请扩充 vocab.json」，中止 |
| 火山 TTS 鉴权失败 / 网络错 | 重试 3 次（指数退避），仍失败 → 报错中止，**不写 MD、不回写 vocab** |
| MP3 写盘失败 | 报错中止，清理临时文件 |
| MD 文件名冲突 | 自动加序号，不视为错误 |
| `git push` 失败 | 报错，提示手动 push（本地 commit 已完成） |

**原子性原则**：TTS + MD + vocab 回写 + sidebar 更新全部成功后才 commit。任一步失败 → 不 commit，保持工作树可回滚。

---

## 10. 验证标准

实现完成后，以下均需通过：

- [ ] `.pi/skills/english-daily/SKILL.md` 存在且 frontmatter 合法（`name: english-daily`，description 清晰）
- [ ] `data/vocab.seed.json` 含 ≥ 100 词，结构符合 §4.2
- [ ] 首次运行：`docs/english/.vocab.json` 从 seed 初始化成功
- [ ] `pick-words.mjs` 输出 5 个 `used===false` 的词，无重复
- [ ] `tts-volc.mjs` 成功生成 MP3 且可正常播放（人耳听 A/B 两音色）
- [ ] 生成的 MD：表格 5 行、`<audio>` src 指向存在的 MP3、对话含全部 5 词
- [ ] `vocab.json` 对应 5 词 `used=true` 且 `usedDate`/`scene` 正确
- [ ] `config.js` sidebar `/english/` 分组出现新条目
- [ ] `npm run build`（vitepress build）无报错
- [ ] 二次运行：不重复选词（与首次的 5 词无交集）
- [ ] `git push` 成功，站点可访问新页面

---

## 11. 凭证与依赖清单

### 环境变量

| 变量 | 用途 | 来源 |
|---|---|---|
| `VOLC_TTS_APP_ID` | 火山应用 ID | 火山引擎控制台开通语音服务 |
| `VOLC_TTS_ACCESS_TOKEN` | 火山访问令牌 | 同上 |
| `VOLC_TTS_CLUSTER` | 火山集群/版本标识 | 官方文档 |

### 系统依赖

- Node.js（已有，ESM）
- `ffmpeg`（macOS 默认有；仅当火山单请求不支持多角色时用于拼接）

### 外部服务

- 火山引擎豆包语音大模型 TTS（唯一外部 API）

---

## 12. 未来工作（不在本期）

- cron / pi 扩展定时自动触发
- 词库自动扩充（词库耗尽时 LLM 补充 + 人工审核）
- 七牛/腾讯云对象存储迁移（若域名备案后想瘦身 repo）
- 多语音模型切换 / 语音质量对比
- 复习、测验、记忆曲线等学习增强

---

## 13. 实现顺序建议（供 writing-plans 参考）

1. 建 skill 目录骨架 + `SKILL.md` + `vocab.seed.json`（≥100 词）
2. 实现 `pick-words.mjs` + `mark-used.mjs`（可独立测，无外部依赖）
3. 实现 `tts-volc.mjs`（需火山凭证，单测一段固定对话）
4. 串通 LLM 内容生成 + MD 写入 + sidebar 更新
5. 端到端跑一次，过 §10 验证清单
6. 补充 seed 词库到 ~300 词

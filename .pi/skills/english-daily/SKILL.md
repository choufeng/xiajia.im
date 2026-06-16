---
name: english-daily
description: 为 XiaJia.IM 站点生成「每日英语」学习内容：5 个面向开发者的英文单词（解释+例句）+ 双人 dev 场景对话 + 火山豆包语音合成大模型 2.0 生成的 MP3。手动触发，一篇 MD 一次生成。当用户说"生成今日英语"/"英语学习"/"english daily"时使用。
---

# English Daily — 每日英语生成

为 XiaJia.IM 站点的 `Learning English` 板块生成一篇学习内容。

## 前置检查

- 当前项目根：`/Users/jia.xia/development/xiajia.im`
- 环境变量已设：`VOLC_TTS_APP_ID` + `VOLC_TTS_ACCESS_TOKEN`（本应用为旧版控制台三件套鉴权，v3 端点用 X-Api-App-Id + X-Api-Access-Key 头，非新版 X-Api-Key）
  - 缺失则停止，提示用户配置 `~/.pi/agent/.env`
- `ffmpeg` 已装（macOS 默认有）

## 完整流程（严格按序）

### 1. 选词

```bash
cd /Users/jia.xia/development/xiajia.im
WORDS=$(node .pi/skills/english-daily/scripts/pick-words.mjs)
echo "$WORDS"   # JSON 数组，如 ["refactor","idempotent",...]
```

- 若 stderr 报「可用词不足」→ 停止，提示扩充 `docs/english/.vocab.json` 或 skill 的 seed
- 首次运行会自动从 `.pi/skills/english-daily/data/vocab.seed.json` 初始化 `docs/english/.vocab.json`

### 2. 生成内容（你，LLM，负责）

基于这 5 个词，产出三样东西：

**(a) 词表**（每个词）：
- 中文意思（偏 dev 语境，简洁）
- 1 个 dev 工作场景英文例句

**(b) 双人场景对话**：
- 6-10 轮，A/B 两角色交替
- dev 真实场景（code review / standup / onboarding / debug / deployment / production incident / architecture discussion 等）
- **必须自然融入全部 5 个词**，每个至少出现一次
- 给场景起英文标题（如 `Code Review Discussion`）

**(c) 对话纯文本**（喂给 TTS，去中文）：
保存为临时 JSON 文件 `/tmp/english-dialog.json`：
```json
[
  { "speaker": "A", "text": "..." },
  { "speaker": "B", "text": "..." }
]
```
- speaker 只能是 `"A"` 或 `"B"`（A=Tim 男声，B=Dacey 女声，已硬编码在 tts-volc.mjs）

### 3. 确定 slug

- 场景标题转 kebab-case，如 `Code Review Discussion` → `code-review-discussion`
- 重名检测：
```bash
ls docs/english/*.md 2>/dev/null
```
  若 `<slug>.md` 已存在 → slug 加 `-2`、`-3`

### 4. 合成 MP3

```bash
node .pi/skills/english-daily/scripts/tts-volc.mjs \
  --dialog /tmp/english-dialog.json \
  --out docs/public/audio/<slug>.mp3 \
  --scene <slug>
```

- 调用火山豆包大模型 2.0（v3 流式端点），A/B 各一音色，ffmpeg 拼接成单 MP3
- 失败（鉴权/网络）→ 停止，**不写 MD，不回写 vocab**，清理 `/tmp/english-dialog.json`
- 鉴权失败（401/Invalid）→ 检查 VOLC_TTS_APP_ID/VOLC_TTS_ACCESS_TOKEN 是否正确，本应用用旧版三件套鉴权
- 资源未授权（403/resource not granted）→ 控制台开通豆包语音合成大模型 2.0 服务

### 5. 写 MD

创建 `docs/english/<slug>.md`，模板：

```markdown
---
date: YYYY-MM-DD
scene: <场景英文标题>
---

# <场景英文标题>

> 日期：YYYY-MM-DD · 场景：<场景英文标题>

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| word1 | 中文意思 | English example sentence. |
| word2 | ... | ... |

## 🎧 Audio

<audio controls preload="none" src="/audio/<slug>.mp3"></audio>

## 💬 Dialogue

**A**: ...

**B**: ...
```

- 日期用当天日期（`date +%Y-%m-%d`）
- `<audio>` 的 `src` 用 VitePress public 绝对路径 `/audio/<slug>.mp3`（不加 docs/public 前缀）

### 6. 回写 vocab

```bash
node .pi/skills/english-daily/scripts/mark-used.mjs \
  --words <词1,词2,词3,词4,词5> \
  --date YYYY-MM-DD \
  --scene <slug>
```

### 7. 更新侧边栏

编辑 `docs/.vitepress/config.js`：
- `nav` 数组已有 `Learning English` 条目（Task 7 已建，无需重复加）
- 在 `sidebar` 对象的 `'/english/'` 键 → `Daily Vocabulary` 分组 → `items` 数组**末尾追加**：
  ```javascript
  { text: '<场景显示名>', link: '/english/<slug>' },
  ```
- link 路径**不加 .md 后缀**

### 8. 首次板块索引页

`docs/english/index.md` 已存在（Task 7 已建），无需重复创建。

### 9. Git 提交推送

```bash
cd /Users/jia.xia/development/xiajia.im
git add docs/english/<slug>.md docs/english/.vocab.json docs/public/audio/<slug>.mp3 docs/.vitepress/config.js
git commit -m "docs(english): <场景英文标题> — 每日英语"
git push
```

- push 失败 → 提示用户手动 push（本地 commit 已完成）

## 原子性原则

步骤 4-7 任一失败 → **不 commit**，不产生半成品。已生成的 MP3/MD 若后续步骤失败，手动清理或丢弃本次（vocab 未回写，词不会被标记，下次可重选）。

## 注意

- 所有脚本路径相对项目根，与 cwd 无关（脚本内用 `import.meta.url` 推导）
- `.vocab.json` 是运行时状态，勿手改 used 标记（除非排错）
- 不要修改 skill 源码目录下的 `data/vocab.seed.json` 来记录已用状态（那是模板）
- TTS 音色固定 A=Tim(`en_male_tim_uranus_bigtts`) B=Dacey(`en_female_dacey_uranus_bigtts`)，如需更换改 `tts-volc.mjs` 的 `VOICE_A`/`VOICE_B` 常量
- 词库耗尽（< 5 可用词）→ 扩充 `data/vocab.seed.json` 后，手动把新词补进 `docs/english/.vocab.json`（used=false）

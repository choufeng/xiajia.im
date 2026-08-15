---
name: xiajia-article-tts
description: 为 XiaJia.IM 站点的文章生成朗读音频。当创建或更新读书笔记、博客文章时使用此 skill 生成对应的 MP3 音频和章节时间戳，并上传到 COS。
---

# XiaJia.IM 文章语音朗读生成器

> 站点每篇文章都配有朗读音频，此 skill 用于自动化生成和发布流程。

---

## 使用场景

当用户要求：
- "生成文章的语音"
- "给这篇文章配上朗读"
- "更新音频文件"
- "为读书笔记生成朗读"
- 或刚完成一篇新的文章/读书笔记

使用此 skill 生成朗读音频。

---

## 项目概况

| 属性 | 值 |
|------|------|
| **站点** | XiaJia.IM — Code, Music, Life |
| **项目路径** | `/Users/jia.xia/development/xiajia.im` |
| **脚本** | `scripts/tts-article.mjs` |
| **音频上传脚本** | `.pi/skills/english-daily/scripts/cos-audio.mjs` |
| **COS 路径** | `xiajia.im/tts/` |
| **公网 URL** | `https://yccim-1256669708.cos.ap-guangzhou.myqcloud.com/xiajia.im/tts/{rel}.mp3` |

---

## 工作流程

### 步骤 1：生成朗读 MP3

使用 `scripts/tts-article.mjs` 生成朗读音频（火山豆包语音合成大模型 2.0，女声池随机 13 选 1）。

```bash
cd /Users/jia.xia/development/xiajia.im
export PATH="/opt/homebrew/bin:$PATH"
node scripts/tts-article.mjs docs/{板块}/{文件名}.md
```

**参数说明**：
- 默认按 h2/h3 分段生成 + 章节时间戳 chapters.json（前端段内跳转用）
- `--voice <id>`：指定音色；不传则从 13 个中文女声池随机选一（同篇固定不跳变）
- `--force`：覆盖已存在的音频

**输出文件**：
- `docs/public/tts/{板块}/{文件名}.mp3` —— 朗读音频
- `docs/public/tts/{板块}/{文件名}.chapters.json` —— 章节时间戳

**示例**：
```bash
node scripts/tts-article.mjs docs/reading/story-mckee.md
node scripts/tts-article.mjs docs/ai/rag-basics.md --voice zh_female_vv_uranus_bigtts
node scripts/tts-article.mjs docs/coding/react-philosophy.md --force
```

---

### 步骤 2：上传到 COS

生成后上传 COS（幂等，仅传新增文件）：

```bash
cd /Users/jia.xia/development/xiajia.im
node .pi/skills/english-daily/scripts/cos-audio.mjs docs/public/tts tts
```

**上传规则**：
- 脚本自动扫描 `docs/public/tts/` 目录
- 仅上传新增或修改的文件
- 目标路径：`xiajia.im/tts/...`
- 幂等：已存在的文件会跳过（`SKIP`）

---

### 步骤 3：前端自动集成

前端 `ReadAloud.vue` 会自动按页面路径拼 COS 公网 URL：

```
https://yccim-1256669708.cos.ap-guangzhou.myqcloud.com/xiajia.im/tts/{板块}/{文件名}.mp3
```

无需修改前端代码，音频会自动显示在文章页面。

---

## 依赖项

- **Node.js**（系统已装）：运行 `tts-article.mjs` 脚本
- **ffmpeg / ffprobe**（系统已装）：用于分段时长计算和音频拼接
- **火山豆包凭证**：`~/.pi/agent/.env` 需包含：
  - `VOLC_TTS_APP_ID` —— 火山豆包应用 ID
  - `VOLC_TTS_ACCESS_TOKEN` —— 火山豆包访问令牌
- **COS 凭证**：`~/.pi/agent/.env` 需包含 5 个 `COS_*` 键

---

## 音色选项

13 个中文女声池（不指定音色时随机选择）：

- `zh_female_shasha_uranus_bigtts`
- `zh_female_tiantian_uranus_bigtts`
- `zh_female_xiaoxin_uranus_bigtts`
- `zh_female_xiaomei_uranus_bigtts`
- `zh_female_xiaoyun_uranus_bigtts`
- `zh_female_xiaoya_uranus_bigtts`
- `zh_female_xiaohan_uranus_bigtts`
- `zh_female_xiaoxiao_uranus_bigtts`
- `zh_female_xiaomeng_uranus_bigtts`
- `zh_female_xiaolu_uranus_bigtts`
- `zh_female_tiexinnvsheng_uranus_bigtts`
- `zh_female_roumeinvyou_uranus_bigtts`
- `zh_female_vv_uranus_bigtts`

---

## 常见问题排查

### 问题 1：`spawnSync ffprobe ENOENT`

**原因**：`ffprobe` 不在 PATH 中

**解决**：
```bash
export PATH="/opt/homebrew/bin:$PATH"
node scripts/tts-article.mjs docs/{板块}/{文件名}.md
```

---

### 问题 2：`缺 VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN`

**原因**：火山豆包凭证未配置

**解决**：
```bash
# 检查 ~/.pi/agent/.env 是否包含凭证
cat ~/.pi/agent/.env | grep VOLC_TTS
```

---

### 问题 3：429 限流错误

**原因**：火山豆包 API 调用频率超限

**解决**：
- 脚本已内置批并发 4 + 自动退避机制
- 仍失败时稍后重试，或添加 `--force` 强制重试

---

### 问题 4：COS 上传全 FAIL

**原因**：COS 凭证未配置或过期

**解决**：
```bash
# 检查 ~/.pi/agent/.env 是否包含 5 个 COS_* 键
cat ~/.pi/agent/.env | grep COS_
```

---

### 问题 5：音频包含表格/代码块乱读

**原因**：脚本已自动跳过表格和代码块，但若有残留

**解决**：检查 `tts-article.mjs` 中的 `mdToText()` 函数，确保 `去代码块` 和 `去表格` 逻辑正确

---

## 完整示例

### 示例 1：为新文章生成音频

```bash
# 1. 确认文章路径
ls docs/reading/new-book.md

# 2. 生成音频
export PATH="/opt/homebrew/bin:$PATH"
node scripts/tts-article.mjs docs/reading/new-book.md

# 3. 上传 COS
node .pi/skills/english-daily/scripts/cos-audio.mjs docs/public/tts tts

# 4. 验证音频
open docs/public/tts/reading/new-book.mp3
```

---

### 示例 2：指定音色生成音频

```bash
export PATH="/opt/homebrew/bin:$PATH"
node scripts/tts-article.mjs docs/ai/new-article.md --voice zh_female_vv_uranus_bigtts
node .pi/skills/english-daily/scripts/cos-audio.mjs docs/public/tts tts
```

---

### 示例 3：强制重新生成音频

```bash
export PATH="/opt/homebrew/bin:$PATH"
node scripts/tts-article.mjs docs/reading/old-book.md --force
node .pi/skills/english-daily/scripts/cos-audio.mjs docs/public/tts tts
```

---

## 集成到文章发布流程

**完整的文章发布流程**（与 [write-blog](../../.pi/skills/write-blog/SKILL.md) 配合）：

1. 创建/更新文章 Markdown 文件
2. 更新 `docs/.vitepress/config.js` 侧边栏导航
3. **生成朗读音频**（本 skill）
4. 上传音频到 COS（本 skill）
5. Git commit & push

---

## 注意事项

1. **必须生成音频**：站点每篇文章都配有朗读音频，此步骤不可省略
2. **PATH 设置**：`ffprobe` 可能不在默认 PATH，务必设置 `export PATH="/opt/homebrew/bin:$PATH"`
3. **幂等上传**：COS 上传是幂等的，已存在的文件会被跳过（`SKIP`）
4. **章节时间戳**：自动生成 `.chapters.json`，前端 `ReadAloud.vue` 会自动读取
5. **表格和代码块**：脚本自动跳过这些段落，不会朗读
6. **音频时长**：约 1 分钟音频对应 200-300 字中文

---

## 相关 Skills

- **[write-blog](../../.pi/skills/write-blog/SKILL.md)**：文章生成、导航更新、Git 提交的完整流程
- **[cos-audio](../../.pi/skills/english-daily/scripts/cos-audio.mjs)**：COS 音频上传脚本（本 skill 依赖）
- **[tts-volc](../../.pi/skills/english-daily/scripts/tts-volc.mjs)**：火山豆包语音合成核心（被 `tts-article.mjs` 复用）
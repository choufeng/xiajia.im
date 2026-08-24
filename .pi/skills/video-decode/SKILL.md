---
name: video-decode
description: 视频 → 全文转录 → 结构化笔记 管线：下载 YouTube/Bilibili 视频的音频（或官方字幕），本地 whisper.cpp（Apple Metal 加速）转录为逐字稿，再整理为带章节时间轴、方法论提炼、专有名词校正表的结构化研究笔记，落库到 docs/research/。当用户说「解读视频」「总结这个视频」「视频转录」「把这个视频转成文字」「提炼这个视频的方法论」，或给出 YouTube/Bilibili 链接要求总结/提炼/转录时使用。
---

# Video Decode — 视频 → 全文转录 → 结构化笔记

把一个视频（YouTube / Bilibili）变成三样东西：**逐字稿（.srt + .txt）**、**结构化笔记（章节时间轴 + 方法论 + 专有名词校正表）**、必要时 **feasibility-plan 等衍生文档**。管线已在 brain 學霸 两视频研究（2026-08-25，commit `00a5bbf`）中全链路验证。

## 前置工具（本机已装好，直接用）

| 工具 | 路径 | 说明 |
|---|---|---|
| yt-dlp | `~/.local/bin/yt-dlp` | 2026.08.19 版。调 YouTube 时**必须**同时满足：`PATH="$HOME/.local/bin:$PATH"`（让 yt-dlp 找到 deno）+ `--cookies-from-browser chrome` |
| deno | `~/.local/bin/deno` | 新版 yt-dlp 解 YouTube 签名挑战的必备 JS 运行时。缺了会报 `No supported JavaScript runtime could be found` |
| whisper 转录 | `~/tools/whispercpp/whisper.sh <wav> <out-prefix> [lang]` | whisper.cpp large-v3-turbo + Apple Metal，内置 DYLD_LIBRARY_PATH 修复。默认 lang=zh |
| afconvert | 系统自带 | 音频转码，免 ffmpeg |

**坑位速查（务必先读）：**

1. **YouTube 音频必须拉 140 号 m4a**：格式写 `-f "140/bestaudio[ext=m4a]"`。默认的 webm/opus **无法被 afconvert 打开**（`Couldn't open input file`）。
2. **不要直接调** `~/tools/whispercpp/build/bin/whisper-cli`：其 rpath 烤死了 `/tmp/whispercpp` 旧路径，会 dyld 报 `Library not loaded: libwhisper.1.dylib`。必须走 `whisper.sh` 包装脚本。
3. **首次用 Chrome cookies 可能弹 macOS 钥匙串授权框**（「yt-dlp 想访问 "Chrome Safe Storage"」），需要用户点「始终允许」；点过一次后不再弹。脚本内的 `--list-subs` 已带 180 秒超时兜底。
4. 很多视频**根本没有字幕**（本项目两个目标视频均无人工/自动字幕），字幕路线失败是常态不是故障——直接走音频转录，成本也就每 26 分钟音频约 2 分钟机器时间。
5. Chrome cookies 偶发报「cookies are no longer valid（已被浏览器轮换）」：重跑一次通常即过；若持续，改用 B 站兜底（Step 3b）。

## 完整流程（严格按序）

### Step 0 建工作目录

```bash
mkdir -p ~/tools/yt-research/<topic-slug>/media   # 持久化 scratch：音频/页面快照/中间产物
```

最终产出复制进仓库 `docs/research/<topic-slug>/`（见「产出约定」）。

### Step 1 元数据

先免认证拿标题（永远不会被风控）：

```bash
curl -s "https://www.youtube.com/oembed?url=<视频URL>&format=json"
```

再拿完整元数据（**含章节 chapters、描述、时长**，写笔记时间轴要用；需 deno + cookies）：

```bash
PATH="$HOME/.local/bin:$PATH" ~/.local/bin/yt-dlp --skip-download \
  --cookies-from-browser chrome --write-info-json \
  -o "~/tools/yt-research/<slug>/meta_%(id)s" "<url>"
```

info-json 里重点看：`title` / `duration` / `chapters[]` / `description`（B 站搬运版和 YouTube 官方描述常含章节导航文本）。

### Step 2-4 一键：字幕检查 + 音频下载 + 转码

```bash
bash .pi/skills/video-decode/scripts/fetch-audio.sh <url> <workdir> <name>
# 例：bash .pi/skills/video-decode/scripts/fetch-audio.sh \
#       "https://www.youtube.com/watch?v=_j_Sbp_6Os4" ~/tools/yt-research/brain v2
# 产出：<workdir>/media/<name>_16k.wav（+ 字幕 .vtt 若存在）
```

脚本自动：判平台（YouTube/Bilibili）→ `--list-subs` 列字幕（存在则下载 zh/en）→ YouTube 拉 140 m4a / B 站拉 bestaudio → afconvert 转 16kHz 单声道 WAV。任一步失败即退出并打印原因。

**手动展开（脚本失败时排障用）：**

```bash
# 字幕检查（很多视频没有，属正常）
PATH="$HOME/.local/bin:$PATH" ~/.local/bin/yt-dlp --cookies-from-browser chrome \
  --skip-download --list-subs "<url>"

# YouTube 音频（坑1：必须 140 m4a）
PATH="$HOME/.local/bin:$PATH" ~/.local/bin/yt-dlp --cookies-from-browser chrome \
  -f "140/bestaudio[ext=m4a]" --no-playlist \
  -o "<workdir>/media/<name>.%(ext)s" "<url>"

# 转码（16kHz 单声道，whisper 要求）
afconvert -f WAVE -d LEI16@16000 -c 1 <workdir>/media/<name>.m4a <workdir>/media/<name>_16k.wav
```

**Step 3b B 站兜底**（YouTube 无登录态/被 bot 风控时）：

用标题关键片段搜 B 站搬运版（中文频道几乎必有人搬）：

```bash
curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36" \
  "https://search.bilibili.com/all?keyword=<标题片段URL编码>" -o /tmp/bili_search.html
```

提取链接（正则已验证）：

```python
# 正则：<a ... href="...BVxxxxxxxxxx..." ...>锚文本</a>
import re, html
raw = open("/tmp/bili_search.html", encoding="utf-8", errors="ignore").read()
seen = set()
for m in re.finditer(r'<a[^>]+href="[^"]*?(BV[0-9A-Za-z]{10})[^"]*?"[^>]*>(.{0,200}?)</a>', raw, re.S):
    bvid, inner = m.group(1), re.sub(r'<[^>]+>', '', m.group(2))
    inner = html.unescape(inner).strip()[:90]
    if inner and len(inner) > 8 and bvid not in seen:
        seen.add(bvid); print(bvid, '=>', inner)
```

命中搬运版后直接 `yt-dlp -f bestaudio`（B 站无需 cookies）。

### Step 5 转录

```bash
~/tools/whispercpp/whisper.sh <workdir>/media/<name>_16k.wav <workdir>/<name>_transcript zh
# 产出 <name>_transcript.srt（带时间戳）+ <name>_transcript.txt（纯文本）
```

性能参考：Apple M4 16GB，26 分钟中文音频约 **133 秒**，17 分钟约 **85 秒**。若中途断了直接重跑（无断点续转）。

### Step 6 结构化笔记（你，LLM，负责）

通读 `transcript.txt` 全文，产出 `<name>-transcript-notes.md`，必须包含四块：

1. **章节时间轴**：优先用 Step 1 info-json 的 `chapters[]`（官方章节）；没有则从 SRT 时间戳 + 内容转折自行提取（写个临时 Python 按 `HH:MM:SS,mmm --> ` 正则切时间轴，再用关键句锚定章节起点）。每行 `| mm:ss | 章节名 |`。
2. **方法论提炼**：方法类视频按「步骤/原则/坑位/数据」重构，不逐句复述；叙述性视频按主题重组。
3. **专有名词校正表**：Whisper 会系统性听错中文音译名与术语，**必须修正并在文首标注校正说明**。已知实例：
   - `Caslin Snow` → **Catherine Snow**（哈佛语言心理学家）
   - `shattering` → **shadowing**（影子跟读）
   - `Miquel Tilleria / 尼迪拉拉 / Mikael` → **Mikel Telleria**（巴斯克 hyperpolyglot）
   - 文法/语言学术语、人名一律用 web_search 核对原文后修正
4. **来源链接**：原视频 URL、B 站搬运版 BV 号（若用了）、引用的文献/文章 URL。

笔记开头固定格式：来源链接 + 频道 + 时长 + 「转录：whisper.cpp large-v3-turbo」+ 校正说明。

## 产出约定

```
docs/research/<topic-slug>/
├── video<N>-transcript.srt        # 带时间戳逐字稿
├── video<N>-transcript.txt        # 纯文本逐字稿
├── video<N>-transcript-notes.md   # 结构化笔记（章节/方法论/校正表/来源）
└── feasibility-plan.md            # 可选：若研究是某项决策的输入，另立方案文档
```

多个视频同主题时共用一个目录，`video<N>-` 前缀区分。加进 git 前先 `npm run build` 确认不破坏站点构建。

## 提交规则

本项目 `AGENTS.md` 豁免了分支要求：**在 master 直接 commit & push**：

```bash
git add docs/research/<topic-slug>/ && git commit -m "docs(research): <主题> 视频转录与研究笔记" && git push origin master
```

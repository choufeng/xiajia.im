#!/bin/bash
#
# fetch-audio.sh — 视频 → (字幕?) + 16kHz mono WAV
#
# 用法: fetch-audio.sh <url> <workdir> <name>
#   url     : YouTube / Bilibili 视频链接
#   workdir : 工作目录（不存在则创建；音频落在 <workdir>/media/）
#   name    : 输出 basename → <workdir>/media/<name>_16k.wav (+ .m4a 原始音轨 + 可选 .vtt 字幕)
#
# 例: fetch-audio.sh "https://www.youtube.com/watch?v=_j_Sbp_6Os4" ~/tools/yt-research/brain v2
#
# 设计要点（来自实战验证 2026-08-25）:
#   - YouTube 必须拉 140 号 m4a：默认 webm/opus 无法被 afconvert 打开
#   - YouTube 必须 deno 在 PATH（yt-dlp 解签名）+ Chrome 登录 cookies（本机 IP 被风控）
#   - B 站无需 cookies，bestaudio 即可
#   - 首次访问 Chrome cookies 可能弹 macOS 钥匙串授权框，需用户点「始终允许」
#     （--list-subs 已用 perl alarm 包 180 秒超时，避免无人值守时挂死）
#
set -euo pipefail

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

die() { echo "ERROR: $*" >&2; exit 1; }
note() { echo "--> $*"; }

[ "$#" -eq 3 ] || usage
URL="$1"
WORKDIR="$2"
NAME="$3"

YTDLP="$HOME/.local/bin/yt-dlp"
DENO="$HOME/.local/bin/deno"
AFCONVERT="$(command -v afconvert || true)"

# ---------------- 前置检查 ----------------
[ -x "$YTDLP" ] || die "yt-dlp 不存在: $YTDLP
     安装: curl -L -o ~/.local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos && chmod +x ~/.local/bin/yt-dlp"
[ -n "$AFCONVERT" ] || die "afconvert 不存在（macOS 自带，请确认在 macOS 上运行）"

# 平台识别
case "$URL" in
    *youtube.com/*|*youtu.be/*) PLATFORM="youtube" ;;
    *bilibili.com/*|*b23.tv/*)  PLATFORM="bilibili" ;;
    *) die "不支持的 URL（仅 youtube.com / youtu.be / bilibili.com / b23.tv）: $URL" ;;
esac
echo "[1/5] 平台: $PLATFORM"

mkdir -p "$WORKDIR/media"

# yt-dlp 公共参数。注意：bash 3.2 下空数组 + set -u 会炸，故用字符串拼接、
# 下面展开处故意不加引号（参数本身不含空格）。
COOKIE_ARGS=""
if [ "$PLATFORM" = "youtube" ]; then
    [ -x "$DENO" ] || echo "WARN: deno 不存在($DENO)，YouTube 签名挑战大概率失败" >&2
    export PATH="$HOME/.local/bin:$PATH"
    COOKIE_ARGS="--cookies-from-browser chrome"
fi

# 带超时执行（macOS 自带 perl；无 perl 则裸跑）
timeout_run() {
    local secs="$1"; shift
    if command -v perl >/dev/null 2>&1; then
        perl -e 'alarm shift; exec @ARGV' "$secs" "$@"
    else
        "$@"
    fi
}

# ---------------- [2/5] 字幕检查（尽力而为） ----------------
echo "[2/5] 检查字幕（仅列出 + 存在则下载）..."
SUBS_LOG="$WORKDIR/${NAME}_list-subs.txt"
if timeout_run 180 "$YTDLP" $COOKIE_ARGS --skip-download --list-subs "$URL" >"$SUBS_LOG" 2>&1; then
    # 字幕表里有 zh/en 行则尝试下载（下载不到也不算错——很多视频就是没字幕）
    if grep -qE '^[[:space:]]*(zh|en)(-[A-Za-z]+)?[[:space:]]' "$SUBS_LOG"; then
        note "发现 zh/en 字幕，尝试下载"
        "$YTDLP" $COOKIE_ARGS --skip-download --write-subs --write-auto-subs \
            --sub-langs "zh-Hans,zh-Hant,zh,en" \
            -o "$WORKDIR/media/${NAME}.%(ext)s" "$URL" \
            || note "字幕下载失败，忽略（走音频转录兜底）"
    else
        note "该视频无字幕（正常现象，走音频转录）"
    fi
else
    note "list-subs 失败（bot 风控/无登录态/钥匙串未授权），详见 $SUBS_LOG"
    [ "$PLATFORM" = "youtube" ] && note "若持续失败：搜 B 站搬运版兜底（见 SKILL.md Step 3b）"
fi

# ---------------- [3/5] 音频下载 ----------------
echo "[3/5] 下载音频..."
if [ "$PLATFORM" = "youtube" ]; then
    FMT="140/bestaudio[ext=m4a]/bestaudio"   # 坑：必须 140 m4a，webm/opus 无法被 afconvert 打开
else
    FMT="bestaudio/best"
fi
if ! "$YTDLP" $COOKIE_ARGS -f "$FMT" --no-playlist \
        -o "$WORKDIR/media/${NAME}.%(ext)s" "$URL"; then
    die "音频下载失败。YouTube 被风控时：① 重跑一次（cookies 偶发轮换误报）② 换 B 站搬运版（SKILL.md Step 3b）"
fi

# 找到刚下的音轨（排除字幕/已转码的 wav）
AUDIO_FILE="$(ls -t "$WORKDIR/media/${NAME}".* 2>/dev/null \
    | grep -vE '\.(vtt|json3|srt|srv3|ttml|wav)$' \
    | head -n 1 || true)"
[ -n "$AUDIO_FILE" ] || die "$WORKDIR/media/ 下没找到音轨文件"
note "音轨: $AUDIO_FILE ($(du -h "$AUDIO_FILE" | cut -f1))"

# ---------------- [4/5] 转码 16kHz 单声道 WAV ----------------
echo "[4/5] afconvert 转码 16kHz mono..."
WAV="$WORKDIR/media/${NAME}_16k.wav"
if ! "$AFCONVERT" -f WAVE -d LEI16@16000 -c 1 "$AUDIO_FILE" "$WAV"; then
    die "afconvert 失败（输入: $AUDIO_FILE）。若是 webm/opus：说明没拉到 140 m4a，检查 -f 格式串"
fi

# ---------------- [5/5] 汇总 ----------------
echo "[5/5] 完成"
echo "    WAV     : $WAV"
ls "$WORKDIR/media/${NAME}"*.vtt >/dev/null 2>&1 \
    && echo "    字幕    : $(ls "$WORKDIR/media/${NAME}"*.vtt | xargs -n1 basename | tr '\n' ' ')" \
    || echo "    字幕    : 无（用转录兜底）"
echo "下一步: ~/tools/whispercpp/whisper.sh $WAV $WORKDIR/${NAME}_transcript zh"

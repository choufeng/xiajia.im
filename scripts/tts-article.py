#!/usr/bin/env python3
"""
文章朗读 MP3 生成器 — 基于 edge-tts（微软 Azure 神经音逆向，免费无 key）

用法:
  python3 scripts/tts-article.py docs/reading/company-of-one.md
  python3 scripts/tts-article.py docs/reading/company-of-one.md --voice zh-CN-YunxiNeural
  python3 scripts/tts-article.py docs/reading/company-of-one.md --force     # 覆盖已存在
  python3 scripts/tts-article.py docs/reading/company-of-one.md --chapters  # 分段生成 + 章节时间戳

输出:
  docs/public/tts/{板块}/{slug}.mp3
  docs/public/tts/{板块}/{slug}.chapters.json   （仅 --chapters）
  例: docs/reading/company-of-one.md → docs/public/tts/reading/company-of-one.mp3

环境:
  pipx install edge-tts   # 已全局安装则跳过
  ffprobe（随 ffmpeg）    # --chapters 模式读段落时长用
"""
import argparse
import asyncio
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import edge_tts
except ImportError:
    edge_tts = None

# 项目根
ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
PUBLIC_TTS = DOCS / "public" / "tts"

# 默认音色（女声晓晓，最受欢迎，温暖自然）
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"


def md_to_text(md: str) -> str:
    """Markdown → 纯文本朗读稿。"""
    # 去 frontmatter
    md = re.sub(r"^---\n.*?\n---\n", "", md, count=1, flags=re.DOTALL)
    # 去 HTML 注释
    md = re.sub(r"<!--.*?-->", "", md, flags=re.DOTALL)
    # 去 代码块（```...```）
    md = re.sub(r"```[\s\S]*?```", "", md)
    # 去 行内代码 `code`
    md = re.sub(r"`([^`]+)`", r"\1", md)
    # 去 图片
    md = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", md)
    # 链接 [text](url) → text
    md = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", md)
    # 去 HTML 标签
    md = re.sub(r"<[^>]+>", "", md)
    # 标题井号
    md = re.sub(r"^#{1,6}\s+", "", md, flags=re.MULTILINE)
    # 引用 >
    md = re.sub(r"^\s*>\s?", "", md, flags=re.MULTILINE)
    # 列表标记
    md = re.sub(r"^\s*[-*+]\s+", "", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*\d+\.\s+", "", md, flags=re.MULTILINE)
    # 表格（朗读表格会变乱码，直接跳过）
    # 识别表格块（| 开头的连续行）
    lines = md.split("\n")
    kept = []
    in_table = False
    for line in lines:
        if re.match(r"^\s*\|", line):
            in_table = True
            continue
        if in_table:
            # 表格结束后，若当前行非空且非表格，继续保留
            if line.strip() == "" :
                continue
            in_table = False
        kept.append(line)
    md = "\n".join(kept)
    # 强调标记
    md = md.replace("**", "").replace("__", "").replace("*", "").replace("_", "")
    # 多余空行压缩
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def clean_inline(t: str) -> str:
    """标题文本去 markdown 强调/代码标记，得到纯文本标题。"""
    t = re.sub(r"`([^`]+)`", r"\1", t)
    return t.replace("**", "").replace("__", "").replace("*", "").replace("_", "").strip()


def split_chapters(md: str):
    """按 h2/h3 切章节。返回 [(title, raw_md), ...]。

    第一个 h2 之前的内容（含 h1、引言）作为导言段，title 取首个 h1 文本，无则 None。
    h2/h3 各开新段；标题本身纳入该段朗读，保证音频起始点对齐标题。
    """
    md = re.sub(r"^---\n.*?\n---\n", "", md, count=1, flags=re.DOTALL)
    md = re.sub(r"<!--.*?-->", "", md, flags=re.DOTALL)

    sections = []
    cur_title = None
    cur_buf = []

    def flush():
        body = "\n".join(cur_buf)
        if cur_title is not None or body.strip():
            sections.append((cur_title, body))

    for line in md.split("\n"):
        m = re.match(r"^(#{1,6})\s+(.+)$", line)
        if m:
            level = len(m.group(1))
            raw_title = m.group(2).strip()
            title = clean_inline(raw_title)
            if level >= 2:
                # h2/h3 开新段（h4+ 并入当前段，不切）
                flush()
                cur_title = title
                cur_buf = [raw_title]  # 标题朗读
            else:
                # h1：仅当尚无任何章节时，作为导言段标题
                if not sections and cur_title is None and not any(s.strip() for s in cur_buf):
                    cur_title = title
                cur_buf.append(line)
        else:
            cur_buf.append(line)
    flush()

    # 去掉空段
    return [(t, b) for (t, b) in sections if md_to_text(b)]


def compute_output(md_path: Path) -> Path:
    """docs/reading/company-of-one.md → docs/public/tts/reading/company-of-one.mp3"""
    rel = md_path.relative_to(DOCS)  # reading/company-of-one.md
    stem = rel.with_suffix("")
    return PUBLIC_TTS / stem.with_suffix(".mp3")


async def generate_whole(text: str, out_path: Path, voice: str, rate: str = "+0%") -> None:
    """整篇一次性生成（旧路径，无章节信息）。"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    tmp = out_path.with_suffix(".mp3.tmp")
    await communicate.save(str(tmp))
    tmp.replace(out_path)


def probe_duration(path: Path) -> float:
    """ffprobe 读 mp3 时长（秒）。失败抛异常。"""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


async def tts_section(text: str, out_path: Path, voice: str, rate: str) -> None:
    """单段 TTS → 临时 mp3。"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(out_path))


async def generate_chapters(md: str, out_path: Path, voice: str, rate: str) -> dict:
    """分段生成 + 累计时长 + 二进制拼接 + 输出 chapters.json。

    返回 chapters 元信息。
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sections = split_chapters(md)
    if not sections:
        # 退化：无任何标题，整篇一段
        text = md_to_text(md)
        await generate_whole(text, out_path, voice, rate)
        dur = probe_duration(out_path)
        return {
            "version": 1,
            "generated": datetime.now(timezone.utc).isoformat(),
            "voice": voice,
            "chapters": [{"title": None, "start": 0.0, "end": round(dur, 3)}],
        }

    tmp_dir = out_path.parent / f".{out_path.stem}.parts"
    tmp_dir.mkdir(exist_ok=True)

    # 过滤空段，构造 (title, 临时文件, 纯文本) 列表
    parts = []
    for i, (title, body) in enumerate(sections):
        text = md_to_text(body)
        if not text:
            continue
        parts.append((title, tmp_dir / f"{i:03d}.mp3", text))

    # 并发生成各段（edge-tts HTTP 请求）
    await asyncio.gather(*[tts_section(text, p, voice, rate) for (_t, p, text) in parts])

    chapters = []
    cursor = 0.0
    for (title, part, _text) in parts:
        dur = probe_duration(part)
        chapters.append({
            "title": title,
            "start": round(cursor, 3),
            "end": round(cursor + dur, 3),
        })
        cursor += dur

    # 二进制拼接（mp3 帧流可直接 cat，ffprobe 验证时长 = 累加）
    tmp_out = out_path.with_suffix(".mp3.tmp")
    with open(tmp_out, "wb") as fout:
        for (_t, part, _text) in parts:
            with open(part, "rb") as fin:
                fout.write(fin.read())
    tmp_out.replace(out_path)

    # 清理临时分段
    for (_t, part, _text) in parts:
        try:
            part.unlink()
        except OSError:
            pass
    try:
        tmp_dir.rmdir()
    except OSError:
        pass

    # 修正最后一段 end 为实际总时长（避免累加浮点误差）
    total = probe_duration(out_path)
    if chapters:
        chapters[-1]["end"] = round(total, 3)

    return {
        "version": 1,
        "generated": datetime.now(timezone.utc).isoformat(),
        "voice": voice,
        "chapters": chapters,
    }


def main():
    ap = argparse.ArgumentParser(description="生成文章朗读 MP3")
    ap.add_argument("md", help="Markdown 文件路径（相对项目根或绝对）")
    ap.add_argument("--voice", default=DEFAULT_VOICE,
                    help=f"音色（默认 {DEFAULT_VOICE}）")
    ap.add_argument("--rate", default="+0%",
                    help='语速（如 "+10%%" / "-5%%"，默认 +0%%）')
    ap.add_argument("--force", action="store_true",
                    help="覆盖已存在的 mp3")
    ap.add_argument("--dry", action="store_true",
                    help="只打印提取的文本，不生成")
    ap.add_argument("--chapters", action="store_true",
                    help="按 h2/h3 分段生成，并输出章节时间戳 chapters.json（段内跳转用）")
    args = ap.parse_args()

    md_path = Path(args.md)
    if not md_path.is_absolute():
        md_path = ROOT / args.md
    if not md_path.exists():
        print(f"✗ 文件不存在: {md_path}", file=sys.stderr)
        sys.exit(1)

    md = md_path.read_text(encoding="utf-8")

    if edge_tts is None and not args.dry:
        print("✗ 未安装 edge-tts。请运行: pipx install edge-tts", file=sys.stderr)
        sys.exit(1)
    if args.dry:
        text = md_to_text(md)
        print(f"=== 提取文本（{len(text)} 字符）===\n")
        print(text[:2000])
        if len(text) > 2000:
            print(f"\n... (共 {len(text)} 字符)")
        if args.chapters:
            secs = split_chapters(md)
            print(f"\n=== 章节切分（{len(secs)} 段）===")
            for i, (t, b) in enumerate(secs):
                print(f"  [{i}] {t or '(导言)'}  ({len(md_to_text(b))} 字)")
        return

    out_path = compute_output(md_path)
    if out_path.exists() and not args.force:
        print(f"✓ 已存在: {out_path}")
        print(f"  覆盖请加 --force")
        rel_url = "/" + str(out_path.relative_to(DOCS / "public"))
        print(f"  前端引用: {rel_url}")
        return

    print(f"生成中: {md_path.relative_to(ROOT)}")
    print(f"  音色: {args.voice}")
    print(f"  语速: {args.rate}")
    if args.chapters:
        secs = split_chapters(md)
        print(f"  模式: 分段（{len(secs)} 章）")
    else:
        text = md_to_text(md)
        print(f"  文本: {len(text)} 字符")
    print(f"  输出: {out_path.relative_to(ROOT)}")

    if args.chapters:
        meta = asyncio.run(generate_chapters(md, out_path, args.voice, args.rate))
        chapters_path = out_path.with_suffix(".chapters.json")
        chapters_path.write_text(
            json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        size_kb = out_path.stat().st_size / 1024
        total = meta["chapters"][-1]["end"] if meta["chapters"] else 0.0
        print(f"\n✓ 完成（{size_kb:.1f} KB，{total:.1f} 秒，{len(meta['chapters'])} 章）")
        print(f"  章节: {chapters_path.relative_to(ROOT)}")
    else:
        text = md_to_text(md)
        asyncio.run(generate_whole(text, out_path, args.voice, args.rate))
        size_kb = out_path.stat().st_size / 1024
        print(f"\n✓ 完成（{size_kb:.1f} KB）")

    rel_url = "/" + str(out_path.relative_to(DOCS / "public"))
    print(f"  试听: open {out_path}")
    print(f"  前端引用: {rel_url}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
文章朗读 MP3 生成器 — 基于 edge-tts（微软 Azure 神经音逆向，免费无 key）

用法:
  python3 scripts/tts-article.py docs/reading/company-of-one.md
  python3 scripts/tts-article.py docs/reading/company-of-one.md --voice zh-CN-YunxiNeural
  python3 scripts/tts-article.py docs/reading/company-of-one.md --force   # 覆盖已存在

输出:
  docs/public/tts/{板块}/{slug}.mp3
  例: docs/reading/company-of-one.md → docs/public/tts/reading/company-of-one.mp3

环境:
  pipx install edge-tts   # 已全局安装则跳过
"""
import argparse
import asyncio
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:
    print("✗ 未安装 edge-tts。请运行: pipx install edge-tts", file=sys.stderr)
    sys.exit(1)

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


def compute_output(md_path: Path) -> Path:
    """docs/reading/company-of-one.md → docs/public/tts/reading/company-of-one.mp3"""
    rel = md_path.relative_to(DOCS)  # reading/company-of-one.md
    # 去掉 .md 后缀
    stem = rel.with_suffix("")
    return PUBLIC_TTS / stem.with_suffix(".mp3")


async def generate(text: str, out_path: Path, voice: str, rate: str = "+0%") -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    # 流式写出，长文自动分片，规避单次长度限制
    tmp = out_path.with_suffix(".mp3.tmp")
    await communicate.save(str(tmp))
    tmp.replace(out_path)


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
    args = ap.parse_args()

    md_path = Path(args.md)
    if not md_path.is_absolute():
        md_path = ROOT / args.md
    if not md_path.exists():
        print(f"✗ 文件不存在: {md_path}", file=sys.stderr)
        sys.exit(1)

    md = md_path.read_text(encoding="utf-8")
    text = md_to_text(md)

    if args.dry:
        print(f"=== 提取文本（{len(text)} 字符）===\n")
        print(text[:2000])
        if len(text) > 2000:
            print(f"\n... (共 {len(text)} 字符)")
        return

    out_path = compute_output(md_path)
    if out_path.exists() and not args.force:
        print(f"✓ 已存在: {out_path}")
        print(f"  覆盖请加 --force")
        rel_url = "/" + str(out_path.relative_to(DOCS / "public")).replace(".mp3", "")
        print(f"  前端路径: {rel_url}.mp3")
        return

    print(f"生成中: {md_path.relative_to(ROOT)}")
    print(f"  音色: {args.voice}")
    print(f"  语速: {args.rate}")
    print(f"  文本: {len(text)} 字符")
    print(f"  输出: {out_path.relative_to(ROOT)}")

    asyncio.run(generate(text, out_path, args.voice, args.rate))

    size_kb = out_path.stat().st_size / 1024
    print(f"\n✓ 完成（{size_kb:.1f} KB）")
    print(f"  试听: open {out_path}")
    rel_url = "/" + str(out_path.relative_to(DOCS / "public"))
    print(f"  前端引用: {rel_url}")


if __name__ == "__main__":
    main()

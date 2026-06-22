#!/usr/bin/env python3
"""交换 english 文章中 Dialogue 段和 Audio 段的顺序（Audio 移到 Dialogue 前）。

结构（交换前）:
  ...前置段...
  ## 💬 Dialogue
  ...对话...
  ## 🎧 Audio
  <audio...>

结构（交换后）:
  ...前置段...
  ## 🎧 Audio
  <audio...>
  ## 💬 Dialogue
  ...对话...
"""
import re
import sys
from pathlib import Path

RE_DIALOGUE = re.compile(r'^## .*Dialogue', re.MULTILINE)
RE_AUDIO = re.compile(r'^## .*Audio', re.MULTILINE)


def swap_one(text: str) -> tuple[str, bool]:
    """返回 (新文本, 是否改动)。"""
    m_d = RE_DIALOGUE.search(text)
    m_a = RE_AUDIO.search(text)
    if not m_d or not m_a:
        return text, False

    lines = text.split('\n')
    dial_i = m_d.string[:m_d.start()].count('\n')
    audio_i = m_a.string[:m_a.start()].count('\n')
    if dial_i >= audio_i:
        return text, False  # 顺序异常，跳过

    # 切块（audio 是末段，取到文件末）
    dialogue_block = lines[dial_i:audio_i]
    audio_block = lines[audio_i:]

    def strip_blank(lst):
        a, b = 0, len(lst)
        while a < b and lst[a].strip() == '':
            a += 1
        while b > a and lst[b - 1].strip() == '':
            b -= 1
        return lst[a:b]

    d_core = strip_blank(dialogue_block)
    a_core = strip_blank(audio_block)
    if not d_core or not a_core:
        return text, False

    # 重组：前部（含 dialogue 前空行）+ audio + 空行 + dialogue + 尾空行
    new = lines[:dial_i] + a_core + [''] + d_core + ['']
    return '\n'.join(new), True


def main():
    dry = '--dry' in sys.argv
    files = [Path(a) for a in sys.argv[1:] if not a.startswith('--')]
    if not files:
        # 默认全部 english md（排除 index）
        files = sorted(
            p for p in Path('docs/english').glob('*.md')
            if p.name != 'index.md'
        )

    changed = 0
    for f in files:
        orig = f.read_text(encoding='utf-8')
        new, did = swap_one(orig)
        if not did:
            print(f"跳过 {f.name}（未找到两段或顺序异常）")
            continue
        if dry:
            print(f"[DRY] 将交换 {f.name}")
        else:
            f.write_text(new, encoding='utf-8')
            print(f"✓ 交换 {f.name}")
        changed += 1
    print(f"\n共 {changed} 篇")


if __name__ == '__main__':
    main()

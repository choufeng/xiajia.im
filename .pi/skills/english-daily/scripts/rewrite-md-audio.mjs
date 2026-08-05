// 批量替换 docs/**/*.md 中 /audio/ → COS 公网 URL
import { readdirSync, readFileSync, writeFileSync, statSync as st } from 'node:fs';
import { join } from 'node:path';
import { audioUrl } from './cos-audio.mjs';

const ROOT = process.argv[2] || 'docs';
const AUDIO_PREFIX = '/audio/';
let changed = 0, files = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (st(p).isDirectory()) walk(p);
    else if (name.endsWith('.md')) {
      let src = readFileSync(p, 'utf8');
      let touched = false;
      // 匹配 /audio/... 直到出现引号、括号、空格等边界
      src = src.replace(/\/audio\/[^"' )]+/g, (m) => {
        touched = true;
        return audioUrl(m); // 传入 /audio/foo.mp3 → 完整 URL
      });
      if (touched) { writeFileSync(p, src); changed++; }
      files++;
    }
  }
}
walk(ROOT);
console.log(`扫描 ${files} 个 MD, 改写 ${changed} 个`);

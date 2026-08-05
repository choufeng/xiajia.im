#!/usr/bin/env node
// 文章朗读 MP3 生成器 —— 火山豆包「语音合成大模型 2.0」（复用 tts-volc.mjs 合成核心）
// Markdown → 按 h2/h3 分段 → 每段豆包合成（整篇单一随机女声，同篇不跳变）
//          → ffmpeg 拼接 → mp3 + chapters.json（格式与 edge-tts 旧版逐字段兼容）
//
// 用法:
//   node scripts/tts-article.mjs docs/reading/the-crowd.md
//   node scripts/tts-article.mjs docs/reading/the-crowd.md --force      # 覆盖已存在
//   node scripts/tts-article.mjs docs/reading/the-crowd.md --voice zh_female_vv_uranus_bigtts
//
// 输出:
//   docs/public/tts/{板块}/{slug}.mp3
//   docs/public/tts/{板块}/{slug}.chapters.json
//
// 凭证: ~/.pi/agent/.env 的 VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { synthStream, fetchWithRetry, concatMp3, VOICE_B_POOL } from '../.pi/skills/english-daily/scripts/tts-volc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const PUBLIC_TTS = path.join(DOCS, 'public', 'tts');

// 自动加载 ~/.pi/agent/.env（与 cos-audio.mjs 同逻辑；不覆盖已有环境变量）
try {
  for (const line of fs.readFileSync(`${os.homedir()}/.pi/agent/.env`, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
} catch { /* .env 不存在则沿用真实环境变量 */ }

// ---------- Markdown 清洗（从 tts-article.py 忠实移植） ----------

function mdToText(md) {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');            // 去 frontmatter
  md = md.replace(/^:::.*$/gm, '');                         // 去 VitePress ::: 行
  md = md.replace(/<!--[\s\S]*?-->/g, '');                  // 去 HTML 注释
  md = md.replace(/```[\s\S]*?```/g, '');                   // 去代码块
  md = md.replace(/`([^`]+)`/g, '$1');                      // 行内代码
  md = md.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');         // 图片 → alt
  md = md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');          // 链接 → text
  md = md.replace(/<details[\s\S]*?<\/details>/gi, '');     // 去折叠块
  md = md.replace(/<[^>]*data-tts-skip[^>]*>[\s\S]*?<\/span>/gi, ''); // 去标记跳读
  md = md.replace(/<[^>]+>/g, '');                           // 去 HTML 标签
  md = md.replace(/^#{1,6}\s+/gm, '');                       // 标题井号
  md = md.replace(/^\s*>\s?/gm, '');                         // 引用 >
  md = md.replace(/^\s*[-*+]\s+/gm, '');                     // 无序列表
  md = md.replace(/^\s*\d+\.\s+/gm, '');                     // 有序列表
  // 表格：| 开头的连续行整块跳过（朗读会乱）
  const lines = md.split('\n');
  const kept = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\s*\|/.test(line)) { inTable = true; continue; }
    if (inTable) {
      if (line.trim() === '') continue;
      inTable = false;
    }
    kept.push(line);
  }
  md = kept.join('\n');
  md = md.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/_/g, ''); // 强调标记
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function cleanInline(t) {
  t = t.replace(/`([^`]+)`/g, '$1');
  return t.replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').replace(/_/g, '').trim();
}

function splitChapters(md) {
  md = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  const sections = [];
  let curTitle = null;
  let curBuf = [];
  const flush = () => {
    const body = curBuf.join('\n');
    if (curTitle !== null || body.trim()) sections.push([curTitle, body]);
  };
  for (const line of md.split('\n')) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line);
    if (m) {
      const level = m[1].length;
      const rawTitle = m[2].trim();
      const title = cleanInline(rawTitle);
      if (level >= 2) {
        flush();
        curTitle = title;
        curBuf = [rawTitle];   // 标题纳入该段朗读，保证音频起点对齐
      } else {
        if (sections.length === 0 && curTitle === null && !curBuf.some((s) => s.trim())) curTitle = title;
        curBuf.push(line);
      }
    } else {
      curBuf.push(line);
    }
  }
  flush();
  return sections.filter(([, b]) => mdToText(b));
}

// ---------- 输出路径 / 时长 / 合成 ----------

function computeOutput(mdPath) {
  const rel = path.relative(DOCS, mdPath);            // reading/x.md
  const stem = rel.replace(/\.md$/, '');
  return path.join(PUBLIC_TTS, `${stem}.mp3`);
}

function probeDuration(p) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', p], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

const round3 = (x) => Math.round(x * 1000) / 1000;

async function generateChapters(md, outPath, voice) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const sections = splitChapters(md);
  if (!sections.length) throw new Error('未提取到可朗读内容');

  const tmpDir = path.join(path.dirname(outPath), `.${path.basename(outPath, '.mp3')}.parts`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const parts = [];
  sections.forEach(([title, body], i) => {
    const text = mdToText(body);
    if (!text) return;
    parts.push({ title, file: path.join(tmpDir, `${String(i).padStart(3, '0')}.mp3`), text });
  });

  // 批并发（大小 4）；fetchWithRetry 自带 429 长退避
  const CONC = 4;
  for (let i = 0; i < parts.length; i += CONC) {
    const batch = parts.slice(i, i + CONC);
    await Promise.all(batch.map(async (p) => {
      process.stderr.write(`[tts] 合成 ${p.title || '(导言)'} (${p.text.length} 字)\n`);
      const buf = await fetchWithRetry(p.text, voice);
      fs.writeFileSync(p.file, buf);
    }));
  }

  const chapters = [];
  let cursor = 0;
  for (const p of parts) {
    const dur = probeDuration(p.file);
    chapters.push({ title: p.title, start: round3(cursor), end: round3(cursor + dur) });
    cursor += dur;
  }

  concatMp3(parts.map((p) => fs.readFileSync(p.file)), outPath);

  // 修正尾段 end 为实际总时长（消除累加浮点误差）
  const total = probeDuration(outPath);
  if (chapters.length) chapters[chapters.length - 1].end = round3(total);

  for (const p of parts) { try { fs.unlinkSync(p.file); } catch { /* ignore */ } }
  try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }

  return { version: 1, generated: new Date().toISOString(), voice, chapters };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const a = { md: null, force: false, voice: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--force') a.force = true;
    else if (argv[i] === '--voice') a.voice = argv[++i];
    else if (!a.md) a.md = argv[i];
  }
  if (!a.md) {
    console.error('用法: tts-article.mjs <md> [--force] [--voice <id>]');
    process.exit(1);
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv);
  const mdPath = path.resolve(args.md);
  if (!fs.existsSync(mdPath)) { console.error('✗ 文件不存在:', mdPath); process.exit(1); }
  if (!process.env.VOLC_TTS_APP_ID || !process.env.VOLC_TTS_ACCESS_TOKEN) {
    console.error('✗ 缺 VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN（查 ~/.pi/agent/.env）');
    process.exit(1);
  }

  const outPath = computeOutput(mdPath);
  if (fs.existsSync(outPath) && !args.force) {
    console.log(`✓ 已存在: ${outPath}\n  覆盖请加 --force`);
    return;
  }

  const md = fs.readFileSync(mdPath, 'utf8');
  const voice = args.voice || VOICE_B_POOL[Math.floor(Math.random() * VOICE_B_POOL.length)];
  const secCount = splitChapters(md).length;

  console.log(`生成中: ${path.relative(ROOT, mdPath)}`);
  console.log(`  音色: ${voice}${args.voice ? '' : '（女声池随机）'}`);
  console.log(`  段数: ${secCount}`);
  console.log(`  输出: ${path.relative(ROOT, outPath)}`);

  const meta = await generateChapters(md, outPath, voice);
  const chapPath = outPath.replace(/\.mp3$/, '.chapters.json');
  fs.writeFileSync(chapPath, JSON.stringify(meta, null, 2));

  const sizeKB = fs.statSync(outPath).size / 1024;
  const total = meta.chapters.at(-1)?.end || 0;
  console.log(`\n✓ 完成（${sizeKB.toFixed(1)} KB，${total.toFixed(1)} 秒，${meta.chapters.length} 章）`);
  console.log(`  章节: ${path.relative(ROOT, chapPath)}`);
  console.log(`  试听: open ${outPath}`);
  console.log(`  ⚠ 上传 COS: node .pi/skills/english-daily/scripts/cos-audio.mjs docs/public/tts tts`);
}

main().catch((e) => { console.error('[error]', e.message); process.exit(1); });

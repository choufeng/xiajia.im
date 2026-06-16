import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 路径推导（与 cwd 无关）
const __filename = fileURLToPath(import.meta.url);
// lib/ → scripts/ → english-daily/ → skills/ → .pi/ → 项目根
// 注：从文件 vocab.mjs 起，需 6 个 '..'（文件→lib→scripts→english-daily→skills→.pi→root）
export const PROJECT_ROOT = path.resolve(__filename, '../../../../../..');
export const SKILL_DIR = path.resolve(__filename, '../../..');
export const VOCAB_PATH = path.join(PROJECT_ROOT, 'docs/english/.vocab.json');
export const SEED_PATH = path.join(SKILL_DIR, 'data/vocab.seed.json');

/** 读 vocab.json，返回规整后的对象 */
export function readVocab(filePath = VOCAB_PATH) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return normalizeVocab(raw);
}

/** 规整 word 条目，补全缺失字段 */
export function normalizeVocab(raw) {
  return {
    version: raw.version ?? 1,
    generatedAt: raw.generatedAt ?? null,
    words: (raw.words ?? []).map((w) => ({
      word: String(w.word).toLowerCase().trim(),
      used: Boolean(w.used),
      usedDate: w.usedDate ?? null,
      scene: w.scene ?? null,
    })),
  };
}

/** 写 vocab.json（2 空格缩进，末尾换行） */
export function writeVocab(vocab, filePath = VOCAB_PATH) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const out = {
    version: vocab.version ?? 1,
    generatedAt: vocab.generatedAt ?? new Date().toISOString(),
    words: vocab.words,
  };
  fs.writeFileSync(filePath, JSON.stringify(out, null, 2) + '\n', 'utf8');
}

/** 若 vocab 不存在，从 seed 拷贝初始化。返回 true 表示已初始化 */
export function initFromSeedIfNeeded(
  vocabPath = VOCAB_PATH,
  seedPath = SEED_PATH,
) {
  if (fs.existsSync(vocabPath)) return false;
  if (!fs.existsSync(seedPath)) {
    throw new Error(`seed 不存在: ${seedPath}`);
  }
  const seed = normalizeVocab(JSON.parse(fs.readFileSync(seedPath, 'utf8')));
  writeVocab(seed, vocabPath);
  return true;
}

/** 纯函数：从未用词中随机取 n 个，返回 word 字符串数组 */
export function pickUnused(vocab, n, rand = Math.random) {
  const unused = vocab.words.filter((w) => !w.used);
  if (unused.length < n) {
    throw new Error(
      `可用词不足: 需 ${n} 个，实际 ${unused.length} 个。请扩充 vocab.json`,
    );
  }
  // Fisher-Yates 部分洗牌
  const arr = [...unused];
  const picked = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
    picked.push(arr[i].word);
  }
  return picked;
}

/** 纯函数：把指定词标记为已用，返回新 vocab（不改原对象） */
export function markWords(vocab, words, date, scene) {
  const set = new Set(words.map((w) => String(w).toLowerCase().trim()));
  return {
    ...vocab,
    words: vocab.words.map((w) =>
      set.has(w.word) ? { ...w, used: true, usedDate: date, scene } : w,
    ),
  };
}

/** 判断 slug 文件名是否已存在，返回去重后的 slug（必要时加 -2、-3） */
export function dedupeSlug(slug, existingNames) {
  if (!existingNames.includes(`${slug}.md`)) return slug;
  let i = 2;
  while (existingNames.includes(`${slug}-${i}.md`)) i++;
  return `${slug}-${i}`;
}

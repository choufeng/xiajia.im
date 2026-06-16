# English Daily Skill 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 XiaJia.IM 站点新增 `Learning English` 板块，配套 pi 项目级 skill `english-daily`，手动触发生成「5 个 dev 单词 + 对话 + 火山豆包 TTS 合成的 MP3」学习内容。

**Architecture:** Skill 源码置于 `.pi/skills/english-daily/`（保持纯净），运行时数据写 `docs/english/.vocab.json`（词库 + used 标记，唯一去重事实源）。MP3 存 `docs/public/audio/` 随 gh-pages 部署。脚本用 Node ESM（.mjs）+ 内置 `node:test`，零运行时依赖。唯一外部 API = 火山引擎豆包 TTS。

**Tech Stack:** Node.js v22 ESM、`node:test` + `node:assert`、火山引擎豆包 TTS（HTTP）、ffmpeg（MP3 拼接）、VitePress。

**对应 Spec:** `docs/superpowers/specs/2026-06-17-english-daily-design.md`

**分支:** `feat/english-daily-skill`（已建）

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|---|---|
| `.pi/skills/english-daily/SKILL.md` | skill 主流程指令（给 pi 读） |
| `.pi/skills/english-daily/data/vocab.seed.json` | 词库种子模板（≥100 词） |
| `.pi/skills/english-daily/scripts/lib/vocab.mjs` | vocab 读写/选词/标记纯逻辑（共享） |
| `.pi/skills/english-daily/scripts/pick-words.mjs` | CLI：初始化 + 选 5 个未用词 |
| `.pi/skills/english-daily/scripts/mark-used.mjs` | CLI：回写 5 词 used=true |
| `.pi/skills/english-daily/scripts/tts-volc.mjs` | 火山豆包 TTS → MP3（分段合成 + ffmpeg 拼接） |
| `.pi/skills/english-daily/scripts/lib/test-helpers.mjs` | 测试夹具（临时 vocab 文件） |
| `.pi/skills/english-daily/scripts/__tests__/vocab.test.mjs` | vocab 纯逻辑测试 |
| `.pi/skills/english-daily/scripts/__tests__/pick-words.test.mjs` | 选词 CLI 测试 |
| `.pi/skills/english-daily/scripts/__tests__/mark-used.test.mjs` | 标记 CLI 测试 |
| `docs/english/index.md` | 板块索引页 |
| `.gitignore` 追加 | 忽略运行时临时文件（如有） |

### 修改文件

| 文件 | 改动 |
|---|---|
| `docs/.vitepress/config.js` | nav 增 `Learning English` + sidebar 增 `'/english/'` 分组 |

### 运行时生成（非源码，不入计划文件清单）

- `docs/english/.vocab.json` — 词库状态
- `docs/english/<slug>.md` — 每日文章
- `docs/public/audio/<slug>.mp3` — 音频

### 路径约定

脚本内通过 `import.meta.url` 推导项目根（见 Task 1 `lib/vocab.mjs`），与 cwd 无关：
- 项目根 = `.pi/skills/english-daily/scripts/lib/` 往上 5 层
- `VOCAB_PATH = <root>/docs/english/.vocab.json`
- `SEED_PATH  = <skill>/data/vocab.seed.json`

---

## Task 1: Skill 骨架 + vocab 纯逻辑库 + 测试

**Files:**
- Create: `.pi/skills/english-daily/scripts/lib/vocab.mjs`
- Create: `.pi/skills/english-daily/scripts/lib/test-helpers.mjs`
- Create: `.pi/skills/english-daily/scripts/__tests__/vocab.test.mjs`

- [ ] **Step 1: 建目录骨架**

```bash
mkdir -p .pi/skills/english-daily/scripts/lib
mkdir -p .pi/skills/english-daily/scripts/__tests__
mkdir -p .pi/skills/english-daily/data
```

- [ ] **Step 2: 写 vocab 纯逻辑库**

Create `.pi/skills/english-daily/scripts/lib/vocab.mjs`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 路径推导（与 cwd 无关）
const __filename = fileURLToPath(import.meta.url);
// lib/ → scripts/ → english-daily/ → skills/ → .pi/ → 项目根
export const PROJECT_ROOT = path.resolve(__filename, '../../../../..');
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
```

- [ ] **Step 3: 写测试夹具**

Create `.pi/skills/english-daily/scripts/lib/test-helpers.mjs`:

```javascript
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 建临时目录 + 临时 vocab 文件，返回 { dir, vocabPath, cleanup } */
export function makeTempVocab(words) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-'));
  const vocabPath = path.join(dir, '.vocab.json');
  fs.writeFileSync(
    vocabPath,
    JSON.stringify(
      {
        version: 1,
        generatedAt: null,
        words: words.map((w) =>
          typeof w === 'string'
            ? { word: w, used: false, usedDate: null, scene: null }
            : w,
        ),
      },
      null,
      2,
    ),
    'utf8',
  );
  return {
    dir,
    vocabPath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 4: 写 vocab 测试（失败态）**

Create `.pi/skills/english-daily/scripts/__tests__/vocab.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVocab,
  pickUnused,
  markWords,
  dedupeSlug,
  readVocab,
  writeVocab,
} from '../lib/vocab.mjs';
import { makeTempVocab } from '../lib/test-helpers.mjs';

test('normalizeVocab 补全缺失字段并小写化', () => {
  const v = normalizeVocab({ words: [{ word: 'Refactor' }] });
  assert.equal(v.version, 1);
  assert.deepEqual(v.words[0], {
    word: 'refactor',
    used: false,
    usedDate: null,
    scene: null,
  });
});

test('pickUnused 从未用词取 n 个且全在未用集', () => {
  const v = normalizeVocab({
    words: ['a', 'b', 'c', 'd', 'e', 'f'].map((w) => ({ word: w })),
  });
  const picked = pickUnused(v, 3, () => 0);
  assert.equal(picked.length, 3);
  for (const w of picked) assert.ok(['a', 'b', 'c', 'd', 'e', 'f'].includes(w));
});

test('pickUnused 词不足时抛错', () => {
  const v = normalizeVocab({ words: [{ word: 'a' }] });
  assert.throws(() => pickUnused(v, 5), /可用词不足/);
});

test('pickUnused 不选已用词', () => {
  const v = normalizeVocab({
    words: [
      { word: 'a', used: true },
      { word: 'b' },
      { word: 'c' },
    ],
  });
  const picked = pickUnused(v, 2, () => 0);
  assert.deepEqual(picked.sort(), ['b', 'c']);
});

test('markWords 标记指定词并带 date/scene', () => {
  const v = normalizeVocab({ words: [{ word: 'a' }, { word: 'b' }] });
  const marked = markWords(v, ['A'], '2026-06-17', 'standup');
  assert.equal(marked.words[0].used, true);
  assert.equal(marked.words[0].usedDate, '2026-06-17');
  assert.equal(marked.words[0].scene, 'standup');
  assert.equal(marked.words[1].used, false);
});

test('markWords 不改原 vocab', () => {
  const v = normalizeVocab({ words: [{ word: 'a' }] });
  markWords(v, ['a'], '2026-06-17', 's');
  assert.equal(v.words[0].used, false);
});

test('dedupeSlug 无冲突返回原值', () => {
  assert.equal(dedupeSlug('standup', []), 'standup');
});

test('dedupeSlug 冲突加序号', () => {
  assert.equal(dedupeSlug('standup', ['standup.md']), 'standup-2');
  assert.equal(
    dedupeSlug('standup', ['standup.md', 'standup-2.md']),
    'standup-3',
  );
});

test('writeVocab + readVocab 往返一致', () => {
  const { vocabPath, cleanup } = makeTempVocab(['x', 'y']);
  const v = readVocab(vocabPath);
  const marked = markWords(v, ['x'], '2026-06-17', 's');
  writeVocab(marked, vocabPath);
  const reread = readVocab(vocabPath);
  assert.equal(reread.words[0].used, true);
  assert.equal(reread.words[1].used, false);
  cleanup();
});
```

- [ ] **Step 5: 运行测试，预期全绿**

Run: `node --test .pi/skills/english-daily/scripts/__tests__/vocab.test.mjs`
Expected: 9 tests pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add .pi/skills/english-daily/scripts/lib/ .pi/skills/english-daily/scripts/__tests__/vocab.test.mjs
git commit -m "feat(english-daily): vocab 纯逻辑库 + 测试"
```

---

## Task 2: pick-words CLI

**Files:**
- Create: `.pi/skills/english-daily/scripts/pick-words.mjs`
- Create: `.pi/skills/english-daily/scripts/__tests__/pick-words.test.mjs`

- [ ] **Step 1: 写 pick-words.mjs**

Create `.pi/skills/english-daily/scripts/pick-words.mjs`:

```javascript
#!/usr/bin/env node
// 选 n 个未用词，stdout 输出 JSON 数组。首次运行自动从 seed 初始化。
import {
  initFromSeedIfNeeded,
  readVocab,
  pickUnused,
  VOCAB_PATH,
  SEED_PATH,
} from './lib/vocab.mjs';

function parseArgs(argv) {
  const args = { n: 5, vocabPath: VOCAB_PATH, seedPath: SEED_PATH };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n' || a === '--count') args.n = Number(argv[++i]);
    else if (a === '--vocab') args.vocabPath = argv[++i];
    else if (a === '--seed') args.seedPath = argv[++i];
  }
  return args;
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  const initialized = initFromSeedIfNeeded(args.vocabPath, args.seedPath);
  const vocab = readVocab(args.vocabPath);
  const words = pickUnused(vocab, args.n);
  return { words, initialized, vocabPath: args.vocabPath };
}

// 直接执行时
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((r) => {
      process.stdout.write(JSON.stringify(r.words));
      if (r.initialized) {
        process.stderr.write(
          `\n[info] 已从 seed 初始化 ${r.vocabPath}\n`,
        );
      }
    })
    .catch((e) => {
      process.stderr.write(`[error] ${e.message}\n`);
      process.exit(1);
    });
}
```

- [ ] **Step 2: 写 CLI 测试**

Create `.pi/skills/english-daily/scripts/__tests__/pick-words.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { main } from '../pick-words.mjs';
import { makeTempVocab } from '../lib/test-helpers.mjs';

test('main 选出 n 个未用词', async () => {
  const { vocabPath, cleanup } = makeTempVocab([
    'a', 'b', 'c', 'd', 'e', 'f', 'g',
  ]);
  const r = await main([
    'node', 'pick-words.mjs', '-n', '3', '--vocab', vocabPath,
  ]);
  assert.equal(r.words.length, 3);
  assert.equal(r.initialized, false);
  cleanup();
});

test('main 词不足时抛错并带提示', async () => {
  const { vocabPath, cleanup } = makeTempVocab(['only-one']);
  await assert.rejects(
    () => main(['node', 'pick-words.mjs', '--vocab', vocabPath]),
    /可用词不足/,
  );
  cleanup();
});

test('main 不修改 vocab 文件（只读选词）', async () => {
  const { vocabPath, cleanup } = makeTempVocab(['a', 'b', 'c', 'd', 'e']);
  const before = fs.readFileSync(vocabPath, 'utf8');
  await main(['node', 'pick-words.mjs', '--vocab', vocabPath]);
  const after = fs.readFileSync(vocabPath, 'utf8');
  assert.equal(before, after);
  cleanup();
});
```

- [ ] **Step 3: 运行测试，预期绿**

Run: `node --test .pi/skills/english-daily/scripts/__tests__/pick-words.test.mjs`
Expected: 3 tests pass

- [ ] **Step 4: Commit**

```bash
git add .pi/skills/english-daily/scripts/pick-words.mjs .pi/skills/english-daily/scripts/__tests__/pick-words.test.mjs
git commit -m "feat(english-daily): pick-words CLI"
```

---

## Task 3: mark-used CLI

**Files:**
- Create: `.pi/skills/english-daily/scripts/mark-used.mjs`
- Create: `.pi/skills/english-daily/scripts/__tests__/mark-used.test.mjs`

- [ ] **Step 1: 写 mark-used.mjs**

Create `.pi/skills/english-daily/scripts/mark-used.mjs`:

```javascript
#!/usr/bin/env node
// 回写 vocab：把指定词标记 used=true。
// 用法: mark-used.mjs --words a,b,c --date 2026-06-17 --scene standup
import {
  readVocab,
  writeVocab,
  markWords,
  VOCAB_PATH,
} from './lib/vocab.mjs';

function parseArgs(argv) {
  const args = { words: [], date: null, scene: null, vocabPath: VOCAB_PATH };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--words') args.words = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--date') args.date = argv[++i];
    else if (a === '--scene') args.scene = argv[++i];
    else if (a === '--vocab') args.vocabPath = argv[++i];
  }
  return args;
}

export function run(args) {
  if (args.words.length === 0) throw new Error('缺少 --words');
  if (!args.date) throw new Error('缺少 --date');
  if (!args.scene) throw new Error('缺少 --scene');
  const vocab = readVocab(args.vocabPath);
  const missing = args.words.filter(
    (w) => !vocab.words.some((x) => x.word === w.toLowerCase()),
  );
  if (missing.length > 0) {
    throw new Error(`词库中不存在: ${missing.join(', ')}`);
  }
  const marked = markWords(vocab, args.words, args.date, args.scene);
  writeVocab(marked, args.vocabPath);
  return { marked: args.words.length };
}

export async function main(argv = process.argv) {
  return run(parseArgs(argv));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((r) => process.stderr.write(`[ok] 标记 ${r.marked} 个词\n`))
    .catch((e) => {
      process.stderr.write(`[error] ${e.message}\n`);
      process.exit(1);
    });
}
```

- [ ] **Step 2: 写测试**

Create `.pi/skills/english-daily/scripts/__tests__/mark-used.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { main, run } from '../mark-used.mjs';
import { readVocab } from '../lib/vocab.mjs';
import { makeTempVocab } from '../lib/test-helpers.mjs';

test('run 标记词并写回文件', () => {
  const { vocabPath, cleanup } = makeTempVocab(['a', 'b', 'c']);
  run({
    words: ['a', 'b'],
    date: '2026-06-17',
    scene: 'standup',
    vocabPath,
  });
  const v = readVocab(vocabPath);
  assert.equal(v.words[0].used, true);
  assert.equal(v.words[0].scene, 'standup');
  assert.equal(v.words[2].used, false);
  cleanup();
});

test('main 缺参抛错', async () => {
  await assert.rejects(
    () => main(['node', 'mark-used.mjs', '--words', 'a']),
    /缺少 --date/,
  );
});

test('main 词库无此词抛错', async () => {
  const { vocabPath, cleanup } = makeTempVocab(['a']);
  await assert.rejects(
    () =>
      main([
        'node', 'mark-used.mjs',
        '--words', 'zzz',
        '--date', '2026-06-17',
        '--scene', 's',
        '--vocab', vocabPath,
      ]),
    /词库中不存在/,
  );
  cleanup();
});
```

- [ ] **Step 3: 运行测试**

Run: `node --test .pi/skills/english-daily/scripts/__tests__/mark-used.test.mjs`
Expected: 3 tests pass

- [ ] **Step 4: 跑全部测试确认无回归**

Run: `node --test .pi/skills/english-daily/scripts/__tests__/`
Expected: 全部 pass（vocab 9 + pick-words 3 + mark-used 3 = 15）

- [ ] **Step 5: Commit**

```bash
git add .pi/skills/english-daily/scripts/mark-used.mjs .pi/skills/english-daily/scripts/__tests__/mark-used.test.mjs
git commit -m "feat(english-daily): mark-used CLI"
```

---

## Task 4: 词库 seed（≥100 dev 高频词）

**Files:**
- Create: `.pi/skills/english-daily/data/vocab.seed.json`

- [ ] **Step 1: 写 seed 词库（120 词）**

Create `.pi/skills/english-daily/data/vocab.seed.json`:

```json
{
  "version": 1,
  "generatedAt": null,
  "words": [
    { "word": "refactor", "used": false, "usedDate": null, "scene": null },
    { "word": "idempotent", "used": false, "usedDate": null, "scene": null },
    { "word": "deprecated", "used": false, "usedDate": null, "scene": null },
    { "word": "asynchronous", "used": false, "usedDate": null, "scene": null },
    { "word": "callback", "used": false, "usedDate": null, "scene": null },
    { "word": "concurrency", "used": false, "usedDate": null, "scene": null },
    { "word": "deadlock", "used": false, "usedDate": null, "scene": null },
    { "word": "throughput", "used": false, "usedDate": null, "scene": null },
    { "word": "latency", "used": false, "usedDate": null, "scene": null },
    { "word": "bottleneck", "used": false, "usedDate": null, "scene": null },
    { "word": "scalable", "used": false, "usedDate": null, "scene": null },
    { "word": "redundancy", "used": false, "usedDate": null, "scene": null },
    { "word": "fallback", "used": false, "usedDate": null, "scene": null },
    { "word": "middleware", "used": false, "usedDate": null, "scene": null },
    { "word": "schema", "used": false, "usedDate": null, "scene": null },
    { "word": "migration", "used": false, "usedDate": null, "scene": null },
    { "word": "transaction", "used": false, "usedDate": null, "scene": null },
    { "word": "rollback", "used": false, "usedDate": null, "scene": null },
    { "word": "commit", "used": false, "usedDate": null, "scene": null },
    { "word": "branch", "used": false, "usedDate": null, "scene": null },
    { "word": "merge", "used": false, "usedDate": null, "scene": null },
    { "word": "rebase", "used": false, "usedDate": null, "scene": null },
    { "word": "conflict", "used": false, "usedDate": null, "scene": null },
    { "word": "stash", "used": false, "usedDate": null, "scene": null },
    { "word": "artifact", "used": false, "usedDate": null, "scene": null },
    { "word": "pipeline", "used": false, "usedDate": null, "scene": null },
    { "word": "deployment", "used": false, "usedDate": null, "scene": null },
    { "word": "rollback", "used": false, "usedDate": null, "scene": null },
    { "word": "provision", "used": false, "usedDate": null, "scene": null },
    { "word": "container", "used": false, "usedDate": null, "scene": null },
    { "word": "orchestration", "used": false, "usedDate": null, "scene": null },
    { "word": "namespace", "used": false, "usedDate": null, "scene": null },
    { "word": "immutable", "used": false, "usedDate": null, "scene": null },
    { "word": "mutable", "used": false, "usedDate": null, "scene": null },
    { "word": "serialize", "used": false, "usedDate": null, "scene": null },
    { "word": "deserialize", "used": false, "usedDate": null, "scene": null },
    { "word": "payload", "used": false, "usedDate": null, "scene": null },
    { "word": "endpoint", "used": false, "usedDate": null, "scene": null },
    { "word": "authentication", "used": false, "usedDate": null, "scene": null },
    { "word": "authorization", "used": false, "usedDate": null, "scene": null },
    { "word": "credential", "used": false, "usedDate": null, "scene": null },
    { "word": "token", "used": false, "usedDate": null, "scene": null },
    { "word": "session", "used": false, "usedDate": null, "scene": null },
    { "word": "cookie", "used": false, "usedDate": null, "scene": null },
    { "word": "payload", "used": false, "usedDate": null, "scene": null },
    { "word": "exception", "used": false, "usedDate": null, "scene": null },
    { "word": "stacktrace", "used": false, "usedDate": null, "scene": null },
    { "word": "graceful", "used": false, "usedDate": null, "scene": null },
    { "word": "retry", "used": false, "usedDate": null, "scene": null },
    { "word": "timeout", "used": false, "usedDate": null, "scene": null },
    { "word": "backoff", "used": false, "usedDate": null, "scene": null },
    { "word": "rate-limit", "used": false, "usedDate": null, "scene": null },
    { "word": "throttle", "used": false, "usedDate": null, "scene": null },
    { "word": "queue", "used": false, "usedDate": null, "scene": null },
    { "word": "batch", "used": false, "usedDate": null, "scene": null },
    { "word": "buffer", "used": false, "usedDate": null, "scene": null },
    { "word": "cache", "used": false, "usedDate": null, "scene": null },
    { "word": "eviction", "used": false, "usedDate": null, "scene": null },
    { "word": "invalidate", "used": false, "usedDate": null, "scene": null },
    { "word": "persist", "used": false, "usedDate": null, "scene": null },
    { "word": "volatile", "used": false, "usedDate": null, "scene": null },
    { "word": "snapshot", "used": false, "usedDate": null, "scene": null },
    { "word": "replica", "used": false, "usedDate": null, "scene": null },
    { "word": "shard", "used": false, "usedDate": null, "scene": null },
    { "word": "partition", "used": false, "usedDate": null, "scene": null },
    { "word": "index", "used": false, "usedDate": null, "scene": null },
    { "word": "query", "used": false, "usedDate": null, "scene": null },
    { "word": "optimize", "used": false, "usedDate": null, "scene": null },
    { "word": "benchmark", "used": false, "usedDate": null, "scene": null },
    { "word": "profile", "used": false, "usedDate": null, "scene": null },
    { "word": "leak", "used": false, "usedDate": null, "scene": null },
    { "word": "garbage", "used": false, "usedDate": null, "scene": null },
    { "word": "heap", "used": false, "usedDate": null, "scene": null },
    { "word": "stack", "used": false, "usedDate": null, "scene": null },
    { "word": "thread", "used": false, "usedDate": null, "scene": null },
    { "word": "worker", "used": false, "usedDate": null, "scene": null },
    { "word": "daemon", "used": false, "usedDate": null, "scene": null },
    { "word": "cron", "used": false, "usedDate": null, "scene": null },
    { "word": "hook", "used": false, "usedDate": null, "scene": null },
    { "word": "plugin", "used": false, "usedDate": null, "scene": null },
    { "word": "extension", "used": false, "usedDate": null, "scene": null },
    { "word": "runtime", "used": false, "usedDate": null, "scene": null },
    { "word": "compile", "used": false, "usedDate": null, "scene": null },
    { "word": "transpile", "used": false, "usedDate": null, "scene": null },
    { "word": "polyfill", "used": false, "usedDate": null, "scene": null },
    { "word": "shim", "used": false, "usedDate": null, "scene": null },
    { "word": "dependency", "used": false, "usedDate": null, "scene": null },
    { "word": "bundling", "used": false, "usedDate": null, "scene": null },
    { "word": "treeshaking", "used": false, "usedDate": null, "scene": null },
    { "word": "minify", "used": false, "usedDate": null, "scene": null },
    { "word": "sourcemap", "used": false, "usedDate": null, "scene": null },
    { "word": "scaffold", "used": false, "usedDate": null, "scene": null },
    { "word": "boilerplate", "used": false, "usedDate": null, "scene": null },
    { "word": "template", "used": false, "usedDate": null, "scene": null },
    { "word": "lint", "used": false, "usedDate": null, "scene": null },
    { "word": "formatter", "used": false, "usedDate": null, "scene": null },
    { "word": "coverage", "used": false, "usedDate": null, "scene": null },
    { "word": "mock", "used": false, "usedDate": null, "scene": null },
    { "word": "stub", "used": false, "usedDate": null, "scene": null },
    { "word": "fixture", "used": false, "usedDate": null, "scene": null },
    { "word": "assertion", "used": false, "usedDate": null, "scene": null },
    { "word": "regression", "used": false, "usedDate": null, "scene": null },
    { "word": "flaky", "used": false, "usedDate": null, "scene": null },
    { "word": "verbose", "used": false, "usedDate": null, "scene": null },
    { "word": "silent", "used": false, "usedDate": null, "scene": null },
    { "word": "deprecated", "used": false, "usedDate": null, "scene": null },
    { "word": "obfuscate", "used": false, "usedDate": null, "scene": null },
    { "word": "checksum", "used": false, "usedDate": null, "scene": null },
    { "word": "hash", "used": false, "usedDate": null, "scene": null },
    { "word": "encrypt", "used": false, "usedDate": null, "scene": null },
    { "word": "decrypt", "used": false, "usedDate": null, "scene": null },
    { "word": "cipher", "used": false, "usedDate": null, "scene": null },
    { "word": "payload", "used": false, "usedDate": null, "scene": null },
    { "word": "telemetry", "used": false, "usedDate": null, "scene": null },
    { "word": "metric", "used": false, "usedDate": null, "scene": null },
    { "word": "dashboard", "used": false, "usedDate": null, "scene": null },
    { "word": "alert", "used": false, "usedDate": null, "scene": null },
    { "word": "incident", "used": false, "usedDate": null, "scene": null },
    { "word": "postmortem", "used": false, "usedDate": null, "scene": null },
    { "word": "outage", "used": false, "usedDate": null, "scene": null },
    { "word": "mitigate", "used": false, "usedDate": null, "scene": null },
    { "word": "escalate", "used": false, "usedDate": null, "scene": null }
  ]
}
```

- [ ] **Step 2: 校验词数 ≥100 且 JSON 合法**

Run: `node -e "const v=require('./.pi/skills/english-daily/data/vocab.seed.json'); const unique=new Set(v.words.map(w=>w.word)); console.log('total:', v.words.length, 'unique:', unique.size)"`
Expected: total ≥ 120。注意：unique 会小于 total（因有重复词如 payload/rollback/deprecated 出现多次）。

- [ ] **Step 3: 去重 — 用脚本清理 seed 重复词**

Run:
```bash
node -e "
const fs=require('fs');
const p='./.pi/skills/english-daily/data/vocab.seed.json';
const v=JSON.parse(fs.readFileSync(p,'utf8'));
const seen=new Set(); const dedup=[];
for(const w of v.words){ if(!seen.has(w.word)){seen.add(w.word); dedup.push(w);} }
v.words=dedup; fs.writeFileSync(p, JSON.stringify(v,null,2)+'\n');
console.log('deduped to', dedup.length);
"
```
Expected: 输出 ≥ 100。若 < 100，在 seed 手动补词（参考 dev 主题：前端、后端、DevOps、数据库、安全、测试、API 设计），重跑本步直至 ≥ 100。

- [ ] **Step 4: 最终确认词数**

Run: `node -e "const v=require('./.pi/skills/english-daily/data/vocab.seed.json'); console.log('words:', v.words.length, '| all unused:', v.words.every(w=>!w.used))"`
Expected: words ≥ 100，all unused: true

- [ ] **Step 5: Commit**

```bash
git add .pi/skills/english-daily/data/vocab.seed.json
git commit -m "feat(english-daily): vocab seed 词库 (≥100 dev 高频词)"
```

---

## Task 5: tts-volc.mjs（火山豆包 TTS → MP3）

**Files:**
- Create: `.pi/skills/english-daily/scripts/tts-volc.mjs`

> **实现前必读**：spec §6.2 明确「实现阶段需核对火山官方最新 API 文档」。本任务给出基于公开知识的 HTTP 分段合成 + ffmpeg 拼接方案（最稳，不依赖火山是否支持单请求多角色）。执行者须先用真实凭证跑通 Step 3 的单段合成，确认端点/鉴权/voice_id 正确，再继续。

- [ ] **Step 1: 写 tts-volc.mjs**

Create `.pi/skills/english-daily/scripts/tts-volc.mjs`:

```javascript
#!/usr/bin/env node
// 火山引擎豆包 TTS：对话 JSON → 分段合成 → ffmpeg 拼接 → 单个 MP3
//
// 输入:
//   --dialog <path>   JSON 文件: [{speaker:"A",text:"..."},...]
//   --out <path>      输出 MP3 路径
//   --scene <slug>    场景名（仅日志用）
//
// 凭证(环境变量):
//   VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN / VOLC_TTS_CLUSTER
//
// 音色映射(实现时按火山文档核对/替换 voice_id):
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VOICE_A = 'BV001_streaming'; // A 角色 voice_id（示例，须核对）
const VOICE_B = 'BV002_streaming'; // B 角色 voice_id（示例，须核对）

// 火山豆包 TTS HTTP 端点（实现时核对官方最新值）
const TTS_ENDPOINT =
  'https://openspeech.bytedance.com/api/v1/tts';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

function parseArgs(argv) {
  const args = { dialog: null, out: null, scene: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dialog') args.dialog = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--scene') args.scene = argv[++i];
  }
  if (!args.dialog || !args.out) {
    throw new Error('用法: tts-volc.mjs --dialog <json> --out <mp3> --scene <slug>');
  }
  return args;
}

/** 单段文本 → MP3 buffer。返回 Buffer。 */
export async function synthSegment(text, voiceId) {
  const appId = requireEnv('VOLC_TTS_APP_ID');
  const token = requireEnv('VOLC_TTS_ACCESS_TOKEN');
  const cluster = requireEnv('VOLC_TTS_CLUSTER');
  const body = {
    app: { appid: appId, token, cluster },
    user: { uid: 'english-daily' },
    audio: {
      voice_type: voiceId,
      encoding: 'mp3',
      speed_ratio: 1.0,
    },
    request: {
      reqid: cryptoRandom(),
      text,
      operation: 'query',
    },
  };
  const resp = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer; ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new Error(`TTS HTTP ${resp.status}: ${await resp.text()}`);
  }
  const json = await resp.json();
  if (json.code !== 3000 || !json.data) {
    throw new Error(`TTS 失败 code=${json.code} msg=${json.message}`);
  }
  return Buffer.from(json.data, 'base64');
}

function cryptoRandom() {
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0'),
  ).join('');
}

async function fetchWithRetry(text, voiceId, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await synthSegment(text, voiceId);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw lastErr;
}

/** ffmpeg concat 拼接多段 MP3 → 单文件 */
function concatMp3(parts, outPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-parts-'));
  try {
    const listFile = path.join(tmpDir, 'list.txt');
    const files = parts.map((buf, i) => {
      const p = path.join(tmpDir, `part-${i}.mp3`);
      fs.writeFileSync(p, buf);
      return p;
    });
    // concat demuxer 要求绝对路径 + 单引号
    fs.writeFileSync(
      listFile,
      files.map((f) => `file '${f}'`).join('\n'),
      'utf8',
    );
    execFileSync('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0',
      '-i', listFile,
      '-c', 'copy',
      outPath,
    ]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  const dialog = JSON.parse(fs.readFileSync(args.dialog, 'utf8'));
  if (!Array.isArray(dialog) || dialog.length === 0) {
    throw new Error('dialog 必须是非空数组');
  }
  const parts = [];
  for (const turn of dialog) {
    const voice = turn.speaker === 'A' ? VOICE_A : VOICE_B;
    process.stderr.write(`[tts] 合成 ${turn.speaker}: ${turn.text.slice(0, 30)}...\n`);
    const buf = await fetchWithRetry(turn.text, voice);
    parts.push(buf);
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  concatMp3(parts, args.out);
  process.stderr.write(`[tts] 完成 → ${args.out} (${parts.length} 段)\n`);
  return { out: args.out, parts: parts.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    process.stderr.write(`[error] ${e.message}\n`);
    process.exit(1);
  });
}
```

- [ ] **Step 2: 写单段冒烟测试夹具（不自动跑，手动执行验证）**

Create `.pi/skills/english-daily/scripts/__tests__/tts-smoke.fixture.json`:

```json
[
  { "speaker": "A", "text": "Hey, should we refactor this module before the release?" },
  { "speaker": "B", "text": "Yes, but let's check the test coverage first." }
]
```

- [ ] **Step 3: 手动冒烟测试（需真实火山凭证）**

前置：设置环境变量（本机 shell 或 `~/.pi/agent/.env`，pi 运行时会加载）：
```bash
export VOLC_TTS_APP_ID=xxx
export VOLC_TTS_ACCESS_TOKEN=xxx
export VOLC_TTS_CLUSTER=xxx
```

Run:
```bash
node .pi/skills/english-daily/scripts/tts-volc.mjs \
  --dialog .pi/skills/english-daily/scripts/__tests__/tts-smoke.fixture.json \
  --out /tmp/tts-smoke.mp3 \
  --scene smoke
```

Expected:
- stderr 输出 `[tts] 合成 A:...` / `[tts] 合成 B:...` / `[tts] 完成 → /tmp/tts-smoke.mp3 (2 段)`
- `/tmp/tts-smoke.mp3` 存在且可播放，能听出 A/B 两种音色

> **若失败（端点/鉴权/voice_id 不对）**：查火山豆包 TTS 官方最新文档，修正 `TTS_ENDPOINT`、`synthSegment` 请求体结构、`VOICE_A`/`VOICE_B` 的 voice_id，重跑本步直到 MP3 正常。

- [ ] **Step 4: Commit**

```bash
git add .pi/skills/english-daily/scripts/tts-volc.mjs .pi/skills/english-daily/scripts/__tests__/tts-smoke.fixture.json
git commit -m "feat(english-daily): 火山豆包 TTS 合成 + ffmpeg 拼接"
```

---

## Task 6: SKILL.md 主流程编排

**Files:**
- Create: `.pi/skills/english-daily/SKILL.md`

- [ ] **Step 1: 写 SKILL.md**

Create `.pi/skills/english-daily/SKILL.md`:

````markdown
---
name: english-daily
description: 为 XiaJia.IM 站点生成「每日英语」学习内容：5 个面向开发者的英文单词（解释+例句）+ 双人 dev 场景对话 + 火山豆包 TTS 合成的 MP3。手动触发，一篇 MD 一次生成。当用户说"生成今日英语"/"英语学习"/"english daily"时使用。
---

# English Daily — 每日英语生成

为 XiaJia.IM 站点的 `Learning English` 板块生成一篇学习内容。

## 前置检查

- 当前项目根：`/Users/jia.xia/development/xiajia.im`
- 环境变量已设：`VOLC_TTS_APP_ID` / `VOLC_TTS_ACCESS_TOKEN` / `VOLC_TTS_CLUSTER`
- 缺失则停止，提示用户配置 `~/.pi/agent/.env`

## 完整流程（严格按序）

### 1. 选词

```bash
WORDS=$(node .pi/skills/english-daily/scripts/pick-words.mjs)
echo "$WORDS"   # JSON 数组，如 ["refactor","idempotent",...]
```

- 若 stderr 报「可用词不足」→ 停止，提示扩充 `docs/english/.vocab.json` 或 skill 的 seed
- 首次运行会自动从 `.pi/skills/english-daily/data/vocab.seed.json` 初始化 `docs/english/.vocab.json`

### 2. 生成内容（你，LLM，负责）

基于这 5 个词，产出三样东西（写在最终 MD 里，第 7 步落地）：

**(a) 词表**（每个词）：
- 中文意思（偏 dev 语境，简洁）
- 1 个 dev 工作场景英文例句

**(b) 双人场景对话**：
- 6-10 轮，A/B 两角色交替
- dev 真实场景（code review / standup / onboarding / debug / deployment / production incident 等）
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

- 失败（凭证/网络）→ 停止，不写 MD，不回写 vocab，清理 `/tmp/english-dialog.json`

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

- 日期用当天日期
- `<audio>` 的 `src` 用 VitePress public 绝对路径 `/audio/<slug>.mp3`

### 6. 回写 vocab

```bash
node .pi/skills/english-daily/scripts/mark-used.mjs \
  --words <词1,词2,词3,词4,词5> \
  --date YYYY-MM-DD \
  --scene <slug>
```

### 7. 更新侧边栏

编辑 `docs/.vitepress/config.js`：
- `nav` 数组添加（若首次，板块还不存在）：`{ text: 'Learning English', link: '/english/' }`
- `sidebar` 对象添加（若首次）：`'/english/'` 键，含 `Daily Vocabulary` 分组
- 在 `'/english/'` 分组的 `items` 末尾追加：`{ text: '<场景显示名>', link: '/english/<slug>' }`

### 8. 首次板块索引页

若 `docs/english/index.md` 不存在则创建：

```markdown
# Learning English

> 面向开发者的每日英语。每天 5 个 dev 高频词，配场景对话与语音。
```

### 9. Git 提交推送

```bash
cd /Users/jia.xia/development/xiajia.im
git add docs/english/<slug>.md docs/english/.vocab.json docs/public/audio/<slug>.mp3 docs/.vitepress/config.js
# 首次还需: git add docs/english/index.md
git commit -m "docs(english): <场景英文标题> — 每日英语"
git push
```

- push 失败 → 提示用户手动 push（本地 commit 已完成）

## 原子性原则

步骤 4-7 任一失败 → 不 commit，不产生半成品。已生成的 MP3/MD 若后续失败，手动清理或丢弃本次。

## 注意

- 所有脚本路径相对项目根，与 cwd 无关
- `.vocab.json` 是运行时状态，勿手改 used 标记（除非排错）
- 不要修改 skill 源码目录下的 `vocab.seed.json` 来记录已用状态（那是模板）
````

- [ ] **Step 2: 校验 frontmatter 合法**

Run: `head -4 .pi/skills/english-daily/SKILL.md`
Expected: `---` / `name: english-daily` / `description: ...` / `---` 四行

- [ ] **Step 3: Commit**

```bash
git add .pi/skills/english-daily/SKILL.md
git commit -m "feat(english-daily): SKILL.md 主流程编排"
```

---

## Task 7: VitePress 集成（nav + sidebar + index）

**Files:**
- Modify: `docs/.vitepress/config.js`
- Create: `docs/english/index.md`

- [ ] **Step 1: 读 config.js 现有 nav 结构定位插入点**

Run: `sed -n '15,35p' docs/.vitepress/config.js`

确认 nav 数组结构与 sidebar 对象的闭合位置（用于精确插入）。当前已知（见探索）：nav 在第 18 行起，含「首页/AI/编程笔记/工具参考/读书笔记/关于/PI 教程」。

- [ ] **Step 2: 在 nav 添加 Learning English**

编辑 `docs/.vitepress/config.js`，在 `nav` 数组中「关于」项之后、「PI 教程」之前插入：

```javascript
      { text: 'Learning English', link: '/english/' },
```

（精确 oldText/newText 在执行时按实际文件内容确定）

- [ ] **Step 3: 在 sidebar 添加 /english/ 分组**

在 `sidebar` 对象内（紧跟 `'/reading/'` 配置之后，或与其它板块同级）添加：

```javascript
      '/english/': [
        {
          text: 'Daily Vocabulary',
          items: [],
        },
      ],
```

`items` 初始为空，首次生成文章时由 SKILL.md 流程追加。

- [ ] **Step 4: 创建板块索引页**

Create `docs/english/index.md`:

```markdown
# Learning English

> 面向开发者的每日英语。每天 5 个 dev 高频词，配场景对话与语音。
```

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: vitepress build 成功，无报错（英语板块页面被正确收录，sidebar 配置语法正确）

- [ ] **Step 6: Commit**

```bash
git add docs/.vitepress/config.js docs/english/index.md
git commit -m "feat(english): VitePress 新增 Learning English 板块"
```

---

## Task 8: 端到端验证

**Files:** 无新文件（验证 skill 全流程跑通）

- [ ] **Step 1: 全量单元测试**

Run: `node --test .pi/skills/english-daily/scripts/__tests__/`
Expected: vocab 9 + pick-words 3 + mark-used 3 = 15 tests pass，0 fail

- [ ] **Step 2: 确认环境变量**

Run:
```bash
test -n "$VOLC_TTS_APP_ID" && echo "APP_ID ✓" || echo "APP_ID ✗"
test -n "$VOLC_TTS_ACCESS_TOKEN" && echo "TOKEN ✓" || echo "TOKEN ✗"
test -n "$VOLC_TTS_CLUSTER" && echo "CLUSTER ✓" || echo "CLUSTER ✗"
```
Expected: 三个均 ✓。若 ✗ → 配置后重试。

- [ ] **Step 3: 端到端实跑（按 SKILL.md 流程）**

在 pi 中触发："生成今日英语" → pi 加载 skill，执行完整流程。

人工核验产出：
- [ ] `docs/english/<slug>.md` 存在，含 frontmatter date/scene
- [ ] 词表 5 行，每个词有中文意思 + 英文例句
- [ ] `<audio>` 标签 src 指向 `/audio/<slug>.mp3`
- [ ] `docs/public/audio/<slug>.mp3` 存在且可播放，A/B 两音色
- [ ] 对话含全部 5 个词
- [ ] `docs/english/.vocab.json` 中这 5 词 `used=true`，usedDate/scene 正确
- [ ] `config.js` sidebar `/english/` 出现新条目
- [ ] `git push` 成功

- [ ] **Step 4: 二次运行去重验证**

再触发一次"生成今日英语"。核验：
- 新选 5 词与首次的 5 词**无交集**
- 两篇 MD 文件名不冲突（slug 不同，或自动加序号）

- [ ] **Step 5: 站点构建最终验证**

Run: `npm run build`
Expected: 成功，dist 含两篇 english 页面

- [ ] **Step 6: 最终 Commit（端到端产出的内容）**

```bash
git add docs/english/ docs/public/audio/ docs/.vitepress/config.js
git commit -m "docs(english): 端到端验证 — 生成 <场景> + <场景> 两篇"
git push
```

- [ ] **Step 7: 分支收尾（可选，交给 finishing-a-development-branch skill）**

所有验证通过后，分支可合并回 master。建议触发 `finishing-a-development-branch` skill 决定 merge / PR。

---

## Self-Review（计划自检结果）

**1. Spec 覆盖：**
- §3 数据流 → Task 1-6 全覆盖 ✓
- §4 架构/组件 → 文件结构表 + Task 1/2/3/5 ✓
- §5 内容生成规范 → Task 6 SKILL.md §2 ✓
- §6 火山 TTS → Task 5（含文档核对说明）✓
- §7 VitePress 集成 → Task 7 ✓
- §8 文件命名 → Task 6 SKILL.md §3 + dedupeSlug 单测（Task 1）✓
- §9 错误处理 → Task 5 重试 + SKILL.md 原子性原则 ✓
- §10 验证标准 → Task 8 逐条对应 ✓
- §11 凭证 → Task 5/8 ✓

**2. 占位符扫描：** Task 7 Step 2/3 的 oldText 待执行时按实际文件确定 — 这是合理的（文件内容会变），非占位符；其余步骤均含实际代码/命令。无 TBD/TODO。✓

**3. 类型一致性：** 函数名 `pickUnused`/`markWords`/`dedupeSlug`/`initFromSeedIfNeeded` 在 lib 与各 CLI/测试一致；`words` 字段小写化约定贯穿 normalizeVocab 与 markWords。✓

**4. 技术假设核实：**
- Node v22 + node:test 已确认可用 ✓
- ffmpeg 已装（/opt/homebrew/bin/ffmpeg）✓
- 项目 ESM（"type":"module"）✓
- `.pi/` 与 `docs/english/` 需创建（Task 1/7 建）✓
- 路径推导 `lib/vocab.mjs` 往上 5 层 = 项目根（lib→scripts→english-daily→skills→.pi→root）✓
- 火山端点/voice_id 为示例值，Task 5 Step 3 强制手动验证后才能继续 ✓

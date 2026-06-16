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

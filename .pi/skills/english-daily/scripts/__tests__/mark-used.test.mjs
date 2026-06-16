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

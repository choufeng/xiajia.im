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

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

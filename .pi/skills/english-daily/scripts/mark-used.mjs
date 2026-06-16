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

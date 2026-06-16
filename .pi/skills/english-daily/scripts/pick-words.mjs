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

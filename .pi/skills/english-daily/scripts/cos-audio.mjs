// 腾讯云 COS 音频工具 —— 上传（幂等）+ 拼 URL
// Env: COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION / COS_APPID
import { createRequire } from 'node:module';
import { createReadStream, statSync } from 'node:fs';
const require = createRequire(import.meta.url);
const COS = require('cos-nodejs-sdk-v5');

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;
const KEY_PREFIX = 'xiajia.im/audio'; // 桶内音频目录
const PUBLIC_BASE = `https://${BUCKET}.cos.${REGION}.myqcloud.com`;

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

// 把仓库里的 /audio/<...> 路径片段 → 完整公网 URL
export function audioUrl(audioRelPath) {
  const rel = audioRelPath.replace(/^\/?audio\//, '');
  return `${PUBLIC_BASE}/${KEY_PREFIX}/${rel}`;
}

function p(fn) { return new Promise((res, rej) => fn((e, d) => e ? rej(e) : res(d))); }

// 幂等上传：size 一致则跳过
export async function uploadAudio(localPath, audioRelPath) {
  const key = `${KEY_PREFIX}/${audioRelPath.replace(/^\/?audio\//, '')}`;
  const size = statSync(localPath).size;
  // 检查是否已存在
  let exists = false;
  try {
    const d = await p(cb => cos.headObject({ Bucket: BUCKET, Region: REGION, Key: key }, cb));
    exists = Number(d?.headers?.['content-length'] || 0) === size;
  } catch { /* 不存在 */ }
  if (exists) return { key, url: audioUrl(audioRelPath), skipped: true };
  await p(cb => cos.uploadFile({
    Bucket: BUCKET, Region: REGION, Key: key,
    FilePath: localPath, ACL: 'public-read',
  }, cb));
  return { key, url: audioUrl(audioRelPath), skipped: false };
}

// 迁移脚本 CLI 入口：扫 docs/public/audio 全量上传
import { readdirSync, statSync as st } from 'node:fs';
import { join, relative } from 'node:path';
async function migrate() {
  const root = process.argv[2] || 'docs/public/audio';
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (st(p).isDirectory()) walk(p);
      else if (name.endsWith('.mp3')) files.push(p);
    }
  })(root);
  let ok = 0, skip = 0, fail = 0;
  const CONCURRENCY = 6;
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      const rel = relative(root, f); // foo/bar.mp3
      try {
        const r = await uploadAudio(f, `audio/${rel}`);
        r.skipped ? skip++ : ok++;
        console.log(`${r.skipped ? 'SKIP' : 'UP  '} ${rel}`);
      } catch (e) {
        fail++;
        console.error(`FAIL ${rel}: ${e.code || e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n完成: 上传 ${ok}, 跳过 ${skip}, 失败 ${fail}, 共 ${files.length}`);
  if (fail) process.exit(1);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) migrate();

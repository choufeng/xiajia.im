// 腾讯云 COS 工具 —— 通用文件上传（幂等）+ 拼 URL
// 支持 audio/ 和 tts/ 两类资源，对象级 public-read ACL。
// Env: COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION / COS_APPID
import { createRequire } from 'node:module';
import { statSync, readdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
const require = createRequire(import.meta.url);
const COS = require('cos-nodejs-sdk-v5');

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;
const KEY_ROOT = 'xiajia.im'; // 桶内项目根目录
const PUBLIC_BASE = `https://${BUCKET}.cos.${REGION}.myqcloud.com`;

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID,
  SecretKey: process.env.COS_SECRET_KEY,
});

function p(fn) { return new Promise((res, rej) => fn((e, d) => e ? rej(e) : res(d))); }

// keyRel 相对 xiajia.im/（如 "audio/foo.mp3" 或 "tts/reading/x.mp3"）
export function audioUrl(keyRel) {
  const rel = keyRel.replace(/^\/+/, '');
  return `${PUBLIC_BASE}/${KEY_ROOT}/${rel}`;
}

// 幂等上传：size 一致则跳过。keyRel 同上。
export async function uploadAudio(localPath, keyRel) {
  const key = `${KEY_ROOT}/${keyRel.replace(/^\/+/, '')}`;
  const size = statSync(localPath).size;
  let exists = false;
  try {
    const d = await p(cb => cos.headObject({ Bucket: BUCKET, Region: REGION, Key: key }, cb));
    exists = Number(d?.headers?.['content-length'] || 0) === size;
  } catch { /* 不存在 */ }
  if (exists) return { key, url: audioUrl(keyRel), skipped: true };
  await p(cb => cos.uploadFile({
    Bucket: BUCKET, Region: REGION, Key: key,
    FilePath: localPath, ACL: 'public-read',
  }, cb));
  return { key, url: audioUrl(keyRel), skipped: false };
}
export const uploadFile = uploadAudio;

// 迁移 CLI：node cos-audio.mjs <localDir> <keyDir>
// localDir=docs/public/tts keyDir=tts → 上传到 xiajia.im/tts/**
async function migrate() {
  const root = process.argv[2];
  const keyDir = process.argv[3] || basename(root);
  if (!root) { console.error('用法: cos-audio.mjs <localDir> [keyDir]'); process.exit(1); }
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const fp = join(dir, name);
      const s = statSync(fp);
      if (s.isDirectory()) walk(fp);
      else files.push(fp);
    }
  })(root);
  let ok = 0, skip = 0, fail = 0;
  const CONCURRENCY = 6;
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      const rel = relative(root, f);
      try {
        const r = await uploadAudio(f, `${keyDir}/${rel}`);
        r.skipped ? skip++ : ok++;
        console.log(`${r.skipped ? 'SKIP' : 'UP  '} ${keyDir}/${rel}`);
      } catch (e) {
        fail++;
        console.error(`FAIL ${keyDir}/${rel}: ${e.code || e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n完成: 上传 ${ok}, 跳过 ${skip}, 失败 ${fail}, 共 ${files.length}`);
  if (fail) process.exit(1);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) migrate();

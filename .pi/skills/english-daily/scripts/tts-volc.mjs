#!/usr/bin/env node
// 火山引擎「豆包语音合成大模型 2.0」TTS —— v3 流式端点
// 对话 JSON（A/B 轮次）→ 每段单合成 → ffmpeg 拼接 → 单个 MP3
//
// 用法:
//   tts-volc.mjs --dialog <对话JSON路径> --out <MP3路径> --scene <slug>
//
// 凭证(环境变量): 旧版控制台三件套鉴权（本应用为旧版，非新版 X-Api-Key）
//   VOLC_TTS_APP_ID       → X-Api-App-Id
//   VOLC_TTS_ACCESS_TOKEN → X-Api-Access-Key
//   + X-Api-Resource-Id: seed-tts-2.0
//
// 参考: https://www.volcengine.com/docs/6561/2528925
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { uploadAudio } from './cos-audio.mjs';

const ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const RESOURCE_ID = 'seed-tts-2.0'; // 豆包语音合成大模型 2.0

// 双人 dev 对话音色（美式英语，豆包2.0音色）
const VOICE_A = 'en_male_tim_uranus_bigtts'; // Tim 男
// 女声池：每次生成整篇随机选一个（同篇不跳变，避免对话内声音切换）
// ponytail: 整篇单一随机；想句级切换或加权再改这里
export const VOICE_B_POOL = [
  'zh_female_vv_uranus_bigtts',          // Vivi
  'zh_female_xiaohe_uranus_bigtts',
  'zh_female_tiexinnvsheng_uranus_bigtts',
  'zh_female_gujie_uranus_bigtts',
  'zh_female_wenrouxiaoya_uranus_bigtts',
  'zh_female_roumeinvyou_uranus_bigtts',
  'zh_female_xinlingjitang_uranus_bigtts',
  'zh_female_tianmeiyueyue_uranus_bigtts',
  'zh_female_qingchezizi_uranus_bigtts',
  'zh_female_wenjingmaomao_uranus_bigtts',
  'zh_female_qinqienv_uranus_bigtts',
  'zh_female_lingling_uranus_bigtts',
  'zh_female_jiaochuannv_uranus_bigtts',
];

const AUDIO_PARAMS = { format: 'mp3', sample_rate: 24000 };

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `缺少环境变量 ${name}（v3 大模型2.0 需「控制台>API Key管理」生成的 API Key）`,
    );
  }
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
    throw new Error(
      '用法: tts-volc.mjs --dialog <json> --out <mp3> --scene <slug>',
    );
  }
  return args;
}

/**
 * 流式 JSON 解析：HTTP chunked 响应含多个 JSON 对象（成功: {code,data,...}；错误: {header:{code,...}}）。
 * 括号配平提取完整对象，感知字符串字面量内的括号。
 */
async function* parseJsonStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i = 0;
    while (i < buffer.length) {
      // 找到下一个对象起点
      if (buffer[i] !== '{') {
        i++;
        continue;
      }
      // 从 i 起做字符串感知的括号配平
      let depth = 0;
      let inStr = false;
      let esc = false;
      let end = -1;
      for (let j = i; j < buffer.length; j++) {
        const ch = buffer[j];
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === '\\') {
          esc = true;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          continue;
        }
        if (inStr) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            end = j;
            break;
          }
        }
      }
      if (end === -1) break; // 本对象未完整，等更多数据
      const jsonStr = buffer.slice(i, end + 1);
      buffer = buffer.slice(end + 1);
      i = 0;
      let obj;
      try {
        obj = JSON.parse(jsonStr);
      } catch {
        continue; // 解析失败的片段跳过
      }
      yield obj;
    }
  }
  // flush 残余
  buffer = buffer.trim();
  if (buffer.startsWith('{')) {
    try {
      yield JSON.parse(buffer);
    } catch {
      /* ignore */
    }
  }
}

/** 单段文本 → MP3 Buffer（调 v3 流式端点，收集所有 data 片段解码拼接） */
export async function synthStream(text, speaker) {
  const appId = requireEnv('VOLC_TTS_APP_ID');
  const accessKey = requireEnv('VOLC_TTS_ACCESS_TOKEN');
  const reqid = randomUUID();
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      // 旧版控制台三件套鉴权（非新版 X-Api-Key）
      'X-Api-App-Id': appId,
      'X-Api-Access-Key': accessKey,
      'X-Api-Resource-Id': RESOURCE_ID,
      'X-Api-Request-Id': reqid,
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    },
    body: JSON.stringify({
      req_params: { text, speaker, audio_params: AUDIO_PARAMS },
    }),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text().catch(() => '');
    throw new Error(`TTS HTTP ${resp.status}: ${t.slice(0, 300)}`);
  }
  const chunks = [];
  for await (const obj of parseJsonStream(resp)) {
    // 错误响应：{header:{code,message}}，code 非 0/20000000 为失败
    if (obj.header && obj.header.code !== undefined && obj.header.code !== 0 && obj.header.code !== 20000000) {
      throw new Error(
        `TTS 失败 header.code=${obj.header.code} msg=${obj.header.message ?? ''}`,
      );
    }
    // 成功码可能是 0（单段）或 20000000（流式 OK）。非 0/20000000 为失败
    if (obj.code !== undefined && obj.code !== 0 && obj.code !== 20000000) {
      throw new Error(`TTS 失败 code=${obj.code} msg=${obj.message ?? ''}`);
    }
    if (obj.data) {
      chunks.push(Buffer.from(obj.data, 'base64'));
    }
  }
  if (chunks.length === 0) {
    throw new Error('TTS 未返回任何音频数据');
  }
  return Buffer.concat(chunks);
}

/** 失败重试：429 限流长退避（3s/6s/12s）；网络瞬时错误短退避（500/1s/2s）；鉴权/参数 4xx 不重试 */
export async function fetchWithRetry(text, speaker, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await synthStream(text, speaker);
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e);
      const is429 = /HTTP 429|code=429|rate.?limit/i.test(msg);
      // 429 限流：长退避重试（不占用「不重试」分支）
      if (is429) {
        if (i < retries - 1) {
          const wait = 3000 * 2 ** i;
          process.stderr.write(
            `[tts] 429 限流，${wait}ms 后重试 (${i + 1}/${retries})\n`,
          );
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
      // 其它 4xx（鉴权/权限/参数错误）不重试
      if (/HTTP 4\d\d|header.code=|TTS 失败 code|缺少环境变量|resource not granted/.test(msg)) {
        throw e;
      }
      // 网络瞬时错误：短退避
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

/** ffmpeg concat demuxer 拼接多段 MP3 → 单文件 */
export function concatMp3(parts, outPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-parts-'));
  try {
    const files = parts.map((buf, i) => {
      const p = path.join(tmpDir, `part-${i}.mp3`);
      fs.writeFileSync(p, buf);
      return p;
    });
    const listFile = path.join(tmpDir, 'list.txt');
    fs.writeFileSync(
      listFile,
      files.map((f) => `file '${f}'`).join('\n') + '\n',
      'utf8',
    );
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c',
      'copy',
      outPath,
    ]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function main(argv = process.argv) {
  const args = parseArgs(argv);
  requireEnv('VOLC_TTS_APP_ID');     // 提前校验，避免误打"合成"日志
  requireEnv('VOLC_TTS_ACCESS_TOKEN');
  const dialog = JSON.parse(fs.readFileSync(args.dialog, 'utf8'));
  if (!Array.isArray(dialog) || dialog.length === 0) {
    throw new Error('dialog 必须是非空数组 [{speaker,text},...]');
  }
  const voiceB = VOICE_B_POOL[Math.floor(Math.random() * VOICE_B_POOL.length)];
  process.stderr.write(`[tts] 本次女声音色: ${voiceB}\n`);
  // 分句目录：<out 所在目录>/<slug>/NN.mp3（slug = out 文件名去 .mp3）
  const slug = path.basename(args.out, '.mp3');
  const lineDir = path.join(path.dirname(args.out), slug);
  fs.mkdirSync(lineDir, { recursive: true });
  const sleepMs = Number(process.env.TTS_SLEEP_MS ?? 1000);
  const parts = [];
  for (let i = 0; i < dialog.length; i++) {
    const turn = dialog[i];
    const speaker = turn.speaker === 'A' ? VOICE_A : voiceB;
    process.stderr.write(
      `[tts] 合成 ${turn.speaker}: ${String(turn.text).slice(0, 40)}...\n`,
    );
    const buf = await fetchWithRetry(turn.text, speaker);
    parts.push(buf);
    const nn = String(i + 1).padStart(2, '0');
    fs.writeFileSync(path.join(lineDir, `${nn}.mp3`), buf);
    // 每句合成后简短休息，防 429（末句不睡）
    if (sleepMs > 0 && i < dialog.length - 1) {
      await new Promise((r) => setTimeout(r, sleepMs));
    }
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  concatMp3(parts, args.out);
  process.stderr.write(
    `[tts] 完成 → ${args.out} (${parts.length} 段) + 分句目录 ${lineDir}/\n`,
  );
  // 上传 COS（幂等）。跳过则说明已存在
  process.stderr.write(`[tts] 上传 COS...\n`);
  await uploadAudio(args.out, `audio/${slug}.mp3`);
  for (let i = 0; i < parts.length; i++) {
    const nn = String(i + 1).padStart(2, '0');
    await uploadAudio(path.join(lineDir, `${nn}.mp3`), `audio/${slug}/${nn}.mp3`);
  }
  process.stderr.write(`[tts] COS 上传完成\n`);
  return { out: args.out, parts: parts.length, lineDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    process.stderr.write(`[error] ${e.message}\n`);
    process.exit(1);
  });
}

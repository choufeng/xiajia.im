#!/usr/bin/env node
// 火山引擎「豆包语音合成大模型 2.0」TTS —— v3 流式端点
// 对话 JSON（A/B 轮次）→ 每段单合成 → ffmpeg 拼接 → 单个 MP3
//
// 用法:
//   tts-volc.mjs --dialog <对话JSON路径> --out <MP3路径> --scene <slug>
//
// 凭证(环境变量): VOLC_SECRET_KEY（作 X-Api-Key，v3 大模型2.0 的 API Key，从控制台>API Key管理获取）
//
// 参考: https://www.volcengine.com/docs/6561/2528925
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const ENDPOINT = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
const RESOURCE_ID = 'seed-tts-2.0'; // 豆包语音合成大模型 2.0

// 双人 dev 对话音色（美式英语，豆包2.0音色）
const VOICE_A = 'en_male_tim_uranus_bigtts'; // Tim 男
const VOICE_B = 'en_female_dacey_uranus_bigtts'; // Dacey 女

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
async function synthStream(text, speaker) {
  const apiKey = requireEnv('VOLC_SECRET_KEY');
  const reqid = randomUUID();
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
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
    // 错误响应：{header:{code,message}}
    if (obj.header && obj.header.code && obj.header.code !== 0) {
      throw new Error(
        `TTS 失败 header.code=${obj.header.code} msg=${obj.header.message ?? ''}`,
      );
    }
    // 成功响应：{code:0,data}
    if (obj.code !== undefined && obj.code !== 0) {
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

/** 网络失败重试（指数退避 500/1000/2000ms） */
async function fetchWithRetry(text, speaker, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await synthStream(text, speaker);
    } catch (e) {
      lastErr = e;
      // 鉴权/参数错误（非瞬时网络）不重试，直接抛
      const msg = String(e.message || e);
      if (/HTTP 4\d\d|Invalid X-Api-Key|header.code=|缺少环境变量/.test(msg)) {
        throw e;
      }
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** i));
      }
    }
  }
  throw lastErr;
}

/** ffmpeg concat demuxer 拼接多段 MP3 → 单文件 */
function concatMp3(parts, outPath) {
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
  requireEnv('VOLC_SECRET_KEY'); // 提前校验，避免误打"合成"日志
  const dialog = JSON.parse(fs.readFileSync(args.dialog, 'utf8'));
  if (!Array.isArray(dialog) || dialog.length === 0) {
    throw new Error('dialog 必须是非空数组 [{speaker,text},...]');
  }
  const parts = [];
  for (const turn of dialog) {
    const speaker = turn.speaker === 'A' ? VOICE_A : VOICE_B;
    process.stderr.write(
      `[tts] 合成 ${turn.speaker}: ${String(turn.text).slice(0, 40)}...\n`,
    );
    const buf = await fetchWithRetry(turn.text, speaker);
    parts.push(buf);
  }
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  concatMp3(parts, args.out);
  process.stderr.write(
    `[tts] 完成 → ${args.out} (${parts.length} 段)\n`,
  );
  return { out: args.out, parts: parts.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    process.stderr.write(`[error] ${e.message}\n`);
    process.exit(1);
  });
}

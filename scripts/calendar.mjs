#!/usr/bin/env node
// 偏私有 ICS 订阅生成器。纯 node stdlib，0 依赖。
// 源: scripts/calendar-events.json (gitignore, 私有)
// 产物: docs/public/cal/<token>/calendar.ics (gitignore, 本地 build 带)
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA = join(__dirname, 'calendar-events.json');
const PUBLIC = join(ROOT, 'docs', 'public');
const DOMAIN = 'xiajia.im';

const [, , cmd, ...rest] = process.argv;

function parseArgs(list) {
  const o = {};
  for (let i = 0; i < list.length; i++) {
    const k = list[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const next = list[i + 1];
      if (next && !next.startsWith('--')) { o[key] = next; i++; }
      else o[key] = true;
    }
  }
  return o;
}
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const utcStamp = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const load = () => existsSync(DATA) ? JSON.parse(readFileSync(DATA, 'utf8')) : null;
const save = (d) => writeFileSync(DATA, JSON.stringify(d, null, 2) + '\n');
const nextUid = (events) => {
  let max = 0;
  for (const e of events) {
    const m = /^evt-(\d+)$/.exec(e.uid);
    if (m) max = Math.max(max, +m[1]);
  }
  return `evt-${max + 1}`;
};

function genEvent(e) {
  const out = ['BEGIN:VEVENT', `UID:${e.uid}@${DOMAIN}`, `DTSTAMP:${utcStamp()}`];
  if (e.time) {
    // ponytail: floating local time（无 Z 无 TZID），个人设备本机时区够用；跨国才需 VTIMEZONE
    const [h, m] = e.time.split(':').map(Number);
    const dur = e.durationMin || 60;
    const endMin = h * 60 + m + dur;
    const d = e.date.replace(/-/g, '');
    out.push(`DTSTART:${d}T${pad(h)}${pad(m)}00`, `DTEND:${d}T${pad(Math.floor(endMin / 60))}${pad(endMin % 60)}00`);
  } else {
    out.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`);
  }
  if (e.rrule) out.push(`RRULE:${e.rrule}`);
  out.push(`SUMMARY:${esc(e.summary)}`);
  if (e.location) out.push(`LOCATION:${esc(e.location)}`);
  if (e.description) out.push(`DESCRIPTION:${esc(e.description)}`);
  out.push('END:VEVENT');
  return out;
}

function genICS(data) {
  // ponytail: 未做 75-octet line folding，苹果日历容忍超长行；SUMMARY 极长时再补
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//XiaJia//Personal//EN`,
    `X-WR-CALNAME:${esc(data.calendarName || 'Calendar')}`, 'CALSCALE:GREGORIAN',
    ...data.events.flatMap(genEvent),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

function deploy(data) {
  const dir = join(PUBLIC, 'cal', data.token);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'calendar.ics'), genICS(data));
  console.error(`✓ docs/public/cal/${data.token}/calendar.ics`);
  console.error(`  https://${DOMAIN}/cal/${data.token}/calendar.ics`);
}

const cmds = {
  init() {
    if (load()) return console.error('已存在，用 add/list/remove');
    const token = randomUUID().replace(/-/g, '');
    const data = { token, calendarName: 'XiaJia 私人日历', events: [] };
    save(data); deploy(data);
    console.log(JSON.stringify({ token, url: `https://${DOMAIN}/cal/${token}/calendar.ics` }, null, 2));
  },
  add() {
    const a = parseArgs(rest);
    const data = load();
    if (!data) return console.error('先 init');
    if (!a.summary || !a.date) return console.error('需要 --summary --date (YYYY-MM-DD)');
    const uid = a.uid || nextUid(data.events);
    if (data.events.some(e => e.uid === uid)) return console.error(`${uid} 已存在，改用 list/remove`);
    data.events.push({
      uid, summary: a.summary, date: a.date,
      time: a.time || null, durationMin: a.duration ? +a.duration : null,
      rrule: a.rrule || null, location: a.location || '', description: a.description || '',
    });
    save(data); deploy(data);
    console.log(`✓ 添加 ${uid}: ${a.summary}`);
  },
  list() {
    const data = load();
    if (!data) return console.error('未初始化');
    console.log(`token: ${data.token}`);
    console.log(`url:   https://${DOMAIN}/cal/${data.token}/calendar.ics`);
    console.log(`事件 (${data.events.length}):`);
    for (const e of data.events) console.log(`  ${e.uid}\t${e.date}${e.time ? ' ' + e.time : ''}\t${e.summary}${e.rrule ? ' [' + e.rrule + ']' : ''}`);
  },
  remove() {
    const data = load();
    const n = data.events.length;
    data.events = data.events.filter(e => e.uid !== rest[0]);
    if (data.events.length === n) return console.error(`未找到 ${rest[0]}`);
    save(data); deploy(data);
    console.log(`✓ 删除 ${rest[0]}`);
  },
  edit() {
    // edit: 改字段保 UID，避免苹果日历出现重复
    const a = parseArgs(rest);
    const data = load();
    const e = data.events.find(e => e.uid === rest[0]);
    if (!e) return console.error(`未找到 ${rest[0]}`);
    for (const k of ['summary', 'date', 'time', 'duration', 'rrule', 'location', 'description']) {
      if (a[k] !== undefined) {
        const key = k === 'duration' ? 'durationMin' : k;
        e[key] = k === 'duration' ? +a[k] : a[k];
      }
    }
    save(data); deploy(data);
    console.log(`✓ 修改 ${rest[0]}`);
  },
  'rotate-token'() {
    const data = load();
    const oldDir = join(PUBLIC, 'cal', data.token);
    rmSync(oldDir, { recursive: true, force: true });
    data.token = randomUUID().replace(/-/g, '');
    save(data); deploy(data);
    console.log(`✓ token 已换，旧日历订阅失效，需在苹果日历重新订阅`);
  },
  regenerate() { const d = load(); if (d) deploy(d); },
  url() { const d = load(); if (d) console.log(`https://${DOMAIN}/cal/${d.token}/calendar.ics`); },
};

if (!cmd || !cmds[cmd]) {
  console.error(`用法: calendar.mjs <init|add|list|remove|edit|rotate-token|regenerate|url>
  init                            初始化（生成 token）
  add --summary "X" --date 2026-03-08 [--rrule FREQ=YEARLY] [--time 09:00] [--duration 60]
  list                            列出全部
  remove <uid>
  edit <uid> --summary "Y" --date 2026-03-09   (改字段保 UID)
  rotate-token                    token 泄露时换 URL
  regenerate                      重生 ICS
  url                             打印订阅 URL`);
  process.exit(1);
}
cmds[cmd]();

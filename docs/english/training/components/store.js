// 21 天成人英语训练营 · 数据层
// 方法论来源：docs/research/brain-xueba-videos/
//  - 视频1: 四道并行×15 / 备忘录 D2·D7·D30 三打卡 / 场景语句库(万用模板)
//  - 视频2: Excel 错题库标红→明日优先 / 听→预测→跟读 / 音色锁定
import { reactive, watch } from 'vue'

const KEY = 'xji-english-training-v1'

// ---- 日期工具（本地时区 YYYY-MM-DD） ----
export function todayStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + n)
  return todayStr(dt)
}

// ---- 预置场景（来自两个视频的示范场景） ----
const PRESET_SCENARIOS = [
  { name: '线上开会：接话与发言', note: '视频1示范①：别人说完轮到我，不知道怎么开口' },
  { name: '线上开会：表达不同意见', note: '视频1作者第二周实战场景（反驳句型）' },
  { name: '与外国客户用餐闲聊', note: '视频1示范②：对方问我对城市的看法' },
  { name: '看懂工作报告与澄清', note: '视频1示范③：遇到不懂的句子如何向同事确认' },
  { name: '生活自述语言岛', note: '视频2 Step1：把一天想说的话录下来翻译入库' },
  { name: '差旅与交通', note: '' },
  { name: '客服电话与求助', note: '' },
  { name: 'Small Talk 破冰', note: '' },
]

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function defaultState() {
  return {
    version: 1,
    settings: {
      apiBase: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-v4-flash',
      voiceName: '',        // 音色锁定（视频2：你听什么音色，跟读后就输出什么口音）
      rate: 0.9,
    },
    scenarios: PRESET_SCENARIOS.map((s) => ({
      id: uid(), name: s.name, note: s.note, createdAt: todayStr(),
    })),
    sentences: [],          // 见下方结构
    practiceLog: {},        // { 'YYYY-MM-DD': 遍数 }
    onboarded: false,
  }
}

// Sentence 结构:
// {
//   id, scenarioId, zh, en,
//   addedAt: 'YYYY-MM-DD',
//   repsTotal: 0,          // 四道并行累计遍数（目标 15）
//   listens: 0,            // 盲听遍数（听→预测阶段）
//   predictUnlocked: false,// 是否已解锁跟读（能预测了）
//   shadowReps: 0,         // 跟读遍数（目标 3-6）
//   review: { d2: null, d7: null, d30: null },  // null=未到/未打勾 'done'
//   red: false,            // Excel 标红（错题）
//   redCount: 0,           // 历史标红次数
//   lastPracticed: null,
//   source: 'generated' | 'manual',
// }

// 过期模型名 → 当前可用模型的迁移表
const MODEL_MIGRATIONS = {
  'deepseek-chat': 'deepseek-v4-flash', // 2026-08: deepseek-chat 已下线
}

function load() {
  if (typeof window === 'undefined') return defaultState()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    const state = Object.assign(defaultState(), parsed, {
      settings: Object.assign(defaultState().settings, parsed.settings || {}),
    })
    if (MODEL_MIGRATIONS[state.settings.model]) {
      state.settings.model = MODEL_MIGRATIONS[state.settings.model]
    }
    return state
  } catch {
    return defaultState()
  }
}

export const store = reactive(load())

if (typeof window !== 'undefined') {
  watch(store, (v) => {
    try { window.localStorage.setItem(KEY, JSON.stringify(v)) } catch {}
  }, { deep: true })
}

// ---- 场景 ----
export function addScenario(name, note = '') {
  const s = { id: uid(), name, note, createdAt: todayStr() }
  store.scenarios.push(s)
  return s
}
export function scenarioName(id) {
  return store.scenarios.find((s) => s.id === id)?.name || '（未分组）'
}

// ---- 句子 ----
export function addSentence({ scenarioId, zh, en, source = 'manual' }) {
  const item = {
    id: uid(), scenarioId, zh: zh.trim(), en: en.trim(),
    addedAt: todayStr(),
    repsTotal: 0, listens: 0, predictUnlocked: false, shadowReps: 0,
    review: { d2: null, d7: null, d30: null },
    red: false, redCount: 0, lastPracticed: null, source,
  }
  store.sentences.push(item)
  return item
}
export function removeSentence(id) {
  const i = store.sentences.findIndex((s) => s.id === id)
  if (i > -1) store.sentences.splice(i, 1)
}
export function updateSentence(id, patch) {
  const s = store.sentences.find((x) => x.id === id)
  if (s) Object.assign(s, patch)
}

// ---- 练习计数 ----
export function logRep() {
  const t = todayStr()
  store.practiceLog[t] = (store.practiceLog[t] || 0) + 1
}

// ---- 复习排程（视频1 备忘录法 + 视频2 Excel 标红） ----
export const MILESTONES = [
  { key: 'd2', days: 2, label: '第2天' },
  { key: 'd7', days: 7, label: '第7天' },
  { key: 'd30', days: 30, label: '第30天' },
]

// 今天到期的复习（含标红句优先）
export function dueReviews(today = todayStr()) {
  const due = []
  const red = []
  for (const s of store.sentences) {
    if (s.red) { red.push(s); continue }
    for (const m of MILESTONES) {
      const dueDate = addDays(s.addedAt, m.days)
      if (!s.review[m.key] && dueDate <= today) { due.push(s); break }
    }
  }
  return { red, due } // red 优先展示
}

// 里程碑打卡/标红
export function markMilestone(id, key) {
  const s = store.sentences.find((x) => x.id === id)
  if (s) s.review[key] = 'done'
}
export function markRed(id, red = true) {
  const s = store.sentences.find((x) => x.id === id)
  if (!s) return
  s.red = red
  if (red) s.redCount++
}

// ---- 统计 ----
export function stats(today = todayStr()) {
  const { red, due } = dueReviews(today)
  const fresh = store.sentences.filter((s) => s.repsTotal < 15)
  return {
    total: store.sentences.length,
    red: red.length,
    due: due.length,
    fresh: fresh.length,
    todayReps: store.practiceLog[today] || 0,
  }
}

// ---- 导入导出 ----
export function exportJSON() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), data: store }, null, 2)
}
export function importJSON(text) {
  const parsed = JSON.parse(text)
  const data = parsed.data || parsed
  if (!Array.isArray(data.sentences) || !Array.isArray(data.scenarios)) {
    throw new Error('格式不正确：需要 scenarios 与 sentences 数组')
  }
  Object.assign(store, data)
}

// ---- TTS（音色锁定） ----
let voices = []
export function refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  voices = window.speechSynthesis.getVoices()
}
export function enVoices() {
  return voices.filter((v) => /^en(-|_)/i.test(v.lang) || /english/i.test(v.name))
}
export function speak(text, { onEnd } = {}) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const v = voices.find((x) => x.name === store.settings.voiceName)
  if (v) u.voice = v
  u.lang = v?.lang || 'en-US'
  u.rate = store.settings.rate
  if (onEnd) u.onend = onEnd
  window.speechSynthesis.speak(u)
}

// ---- LLM（BYOK · OpenAI 兼容） ----
export async function chat(messages, { json = false } = {}) {
  const { apiBase, apiKey, model } = store.settings
  if (!apiKey) throw new Error('未配置 API Key（右上角 ⚙ 设置）')
  const res = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

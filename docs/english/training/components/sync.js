// 21 天成人英语训练营 · 多端同步层（Convex）
// 架构：localStorage 仍是第一写入（离线可用），在线时做行级 LWW 双向同步。
// 后端：convex/training.ts（配对码模式，无账号）。设计文档：docs/research/convex-backend-feasibility.md
//
// 同步语义：
//  - scenarios / sentences：行级 LWW（updatedAt 新者胜）；删除 = deletedAt 墓碑；
//  - practiceLog：每设备每日一行（无并发冲突），今日总数 = 各行之和；
//    本地未归属的增量（如导入的 JSON）会在下次 flush 归属给本机；
//  - settings：白名单同步（voiceName / rate / model），apiKey 永不上传；
//  - 首次开启同步时，从未同步过的本地行打上"现在"的时间戳（本地即最新）。
import { reactive, watch } from 'vue'
import { store } from './store.js'

const META_KEY = 'xji-english-training-sync-v1'   // { key } —— 配对码
const DEVICE_KEY = 'xji-english-training-device-v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONVEX_URL = (import.meta.env && import.meta.env.VITE_CONVEX_URL) || ''

export const syncState = reactive({
  enabled: false,
  status: 'off',        // off | connecting | online | offline | error
  key: '',
  deviceCount: 1,
  lastSyncAt: null,
  error: '',
})

let client = null
let unsub = null
let stopWatchFn = null
let applying = false    // 合并远端 → 写 store 时屏蔽本地 watch，防止回环
let ownReps = {}        // day -> 本机遍数（practiceDays 中本设备那行的值）
let othersReps = {}     // day -> 其他设备遍数合计
let settingsStamp = 0   // 当前本地 settings 状态对应的服务端时间戳
let tombstones = new Set() // 'scenario:<id>' / 'sentence:<id>' 已知删除
let snap = newSnap()    // 上次一致状态快照（脏检测基准）
let flushTimer = 0

function newSnap() {
  return {
    scenarios: new Map(), // id -> rowJson
    sentences: new Map(),
    practiceLog: {},      // day -> 数值
    settings: '',
  }
}
function rowJson(r) { return JSON.stringify(r) }
function settingsJson() {
  return JSON.stringify({
    voiceName: store.settings.voiceName,
    rate: Number(store.settings.rate) || 0.9,
    model: store.settings.model,
  })
}
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(36).slice(2, 12)
}
function deviceId() {
  if (typeof window === 'undefined') return 'ssr'
  let d = window.localStorage.getItem(DEVICE_KEY)
  if (!d) { d = uid(); window.localStorage.setItem(DEVICE_KEY, d) }
  return d
}
function readMeta() {
  if (typeof window === 'undefined') return null
  try { return JSON.parse(window.localStorage.getItem(META_KEY) || 'null') } catch { return null }
}

function rebuildSnap() {
  snap.scenarios = new Map(store.scenarios.map((s) => [s.id, rowJson(s)]))
  snap.sentences = new Map(store.sentences.map((s) => [s.id, rowJson(s)]))
  snap.practiceLog = Object.assign({}, store.practiceLog)
  snap.settings = settingsJson()
}

// ---- 对外：开启 / 加入 / 恢复 / 停止 ----
export function enableSync(existingKey) {
  if (typeof window === 'undefined' || syncState.enabled) return false
  if (!CONVEX_URL) {
    syncState.status = 'error'
    syncState.error = '此构建未启用同步后端（缺少 VITE_CONVEX_URL），本地数据不受影响。'
    return false
  }
  let key = existingKey || ''
  if (key) {
    // 粘贴容错：从输入中提取 UUID（容忍前后空格/换行/零宽字符/附带文字）
    const m = String(key).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    key = m ? m[0].toLowerCase() : ''
    if (!key) {
      syncState.status = 'error'
      syncState.error = '未识别到有效配对码（应为 UUID，可直接整段粘贴）。'
      return false
    }
  }
  if (!key) key = uid()
  if (!UUID_RE.test(key)) { // fallback uid 不是 uuid 的极端情况
    syncState.status = 'error'
    syncState.error = '无法生成配对码（浏览器不支持 crypto.randomUUID）。'
    return false
  }
  window.localStorage.setItem(META_KEY, JSON.stringify({ key }))
  syncState.key = key
  syncState.enabled = true
  syncState.status = 'connecting'
  syncState.error = ''

  // 从未同步过的本地行 → 视为"现在"的最新版本（首次合并 LWW：本地胜出并上传）
  applying = true
  for (const arr of [store.scenarios, store.sentences]) {
    for (const row of arr) if (!row.updatedAt) row.updatedAt = Date.now()
  }
  applying = false

  import('convex/browser')
    .then((mod) => {
      if (!syncState.enabled) return
      client = new mod.ConvexClient(CONVEX_URL, {
        connectionStateCallback: (s) => {
          if (!syncState.enabled) return
          if (s.isWebSocketConnected) {
            syncState.status = 'online'
            scheduleFlush(0) // 重连后重试未完成的上行
          } else {
            syncState.status = s.hasEverConnected ? 'offline' : 'connecting'
          }
        },
      })
      unsub = client.onUpdate('training:getWorkspace', { key }, onRemote, (e) => {
        syncState.status = 'error'
        syncState.error = '同步订阅失败：' + ((e && e.message) || e)
      })
      stopWatchFn = watch(store, () => { if (!applying) scheduleFlush(400) }, { deep: true })
      scheduleFlush(0)
    })
    .catch((e) => {
      syncState.enabled = false
      syncState.status = 'error'
      syncState.error = '初始化同步客户端失败：' + ((e && e.message) || e)
      window.localStorage.removeItem(META_KEY)
    })
  return true
}

export function resumeSync() {
  if (typeof window === 'undefined' || syncState.enabled) return
  const m = readMeta()
  if (m && m.key && UUID_RE.test(m.key)) enableSync(m.key)
}

export async function disableSync() {
  if (unsub) { try { unsub() } catch {} unsub = null }
  if (stopWatchFn) { try { stopWatchFn() } catch {} stopWatchFn = null }
  try { if (client) await client.close() } catch {}
  client = null
  if (typeof window !== 'undefined') window.localStorage.removeItem(META_KEY)
  snap = newSnap()
  tombstones = new Set()
  ownReps = {}
  othersReps = {}
  settingsStamp = 0
  syncState.enabled = false
  syncState.status = 'off'
  syncState.key = ''
  syncState.deviceCount = 1
  syncState.error = ''
}

// ---- 远端 → 本地（LWW 合并）----
function onRemote(remote) {
  if (!syncState.enabled || !remote) return
  try {
    applying = true
    mergeWorkspace(remote)
  } finally {
    applying = false
    rebuildSnap()
    syncState.lastSyncAt = Date.now()
  }
}

function mergeWorkspace(r) {
  const dev = deviceId()

  // scenarios / sentences：行级 LWW + 墓碑
  mergeRows(store.scenarios, r.scenarios || [], 'scenario')
  mergeRows(store.sentences, r.sentences || [], 'sentence')

  // practiceDays：每设备一行；本机行取 max（防离线重放回退），他机行求和
  const others = {}
  const devices = new Set([dev])
  for (const row of r.practiceDays || []) {
    if (row.deviceId) devices.add(row.deviceId)
    if (row.deviceId === dev) {
      ownReps[row.day] = Math.max(ownReps[row.day] || 0, row.reps || 0)
    } else {
      others[row.day] = (others[row.day] || 0) + (row.reps || 0)
    }
  }
  othersReps = others
  syncState.deviceCount = devices.size
  const days = new Set([...Object.keys(ownReps), ...Object.keys(othersReps)])
  for (const d of days) {
    const sum = (ownReps[d] || 0) + (othersReps[d] || 0)
    const local = store.practiceLog[d] || 0
    // 本地 > 合计：含未归属增量（导入等），保留本地，等下次 flush 归属，避免双计
    if (sum > 0 && local <= sum) store.practiceLog[d] = sum
  }

  // settings 白名单
  const s = r.settings
  if (s && (s.updatedAt || 0) > settingsStamp) {
    if (typeof s.voiceName === 'string') store.settings.voiceName = s.voiceName
    if (typeof s.rate === 'number' && s.rate > 0) store.settings.rate = s.rate
    if (typeof s.model === 'string' && s.model) store.settings.model = s.model
    settingsStamp = s.updatedAt || 0
  }
}

function mergeRows(arr, rows, kind) {
  for (const row of rows) {
    if (row.deletedAt) {
      tombstones.add(kind + ':' + row.id)
      const i = arr.findIndex((x) => x.id === row.id)
      if (i > -1) arr.splice(i, 1)
      continue
    }
    const local = arr.find((x) => x.id === row.id)
    if (!local) arr.push(row)
    else if ((row.updatedAt || 0) > (local.updatedAt || 0)) Object.assign(local, row)
  }
}

// ---- 本地 → 远端（脏检测 + debounce 上行）----
function scheduleFlush(ms) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, ms)
}

async function flush() {
  flushTimer = 0
  if (!client || !syncState.enabled) return
  const key = syncState.key
  const now = Date.now()
  const sends = []

  const pushRow = (table, row, markClean) => {
    const p = client
      .mutation('training:upsertRow', { key, table, row })
      .then(markClean)
      .catch((e) => {
        // 失败：快照保持落后，下次变更/重连时重试
        syncState.error = '上行失败，稍后重试：' + ((e && e.message) || e)
        throw e
      })
    sends.push(p)
  }

  // scenarios / sentences：内容有差异的行
  for (const s of store.scenarios) {
    if (snap.scenarios.get(s.id) !== rowJson(s)) {
      applying = true
      if (!s.updatedAt) s.updatedAt = now
      applying = false
      const sent = Object.assign({}, s)
      pushRow('scenario', sent, () => { snap.scenarios.set(s.id, rowJson(sent)) })
    }
  }
  for (const s of store.sentences) {
    if (snap.sentences.get(s.id) !== rowJson(s)) {
      applying = true
      if (!s.updatedAt) s.updatedAt = now
      applying = false
      const sent = Object.assign({}, s)
      pushRow('sentence', sent, () => { snap.sentences.set(s.id, rowJson(sent)) })
    }
  }

  // 删除：快照里有、store 里没有 → 用最后已知内容 + 墓碑上传（幂等）
  for (const [id, json] of [...snap.scenarios]) {
    if (!store.scenarios.find((x) => x.id === id)) {
      const row = Object.assign({}, JSON.parse(json), { updatedAt: now, deletedAt: now })
      pushRow('scenario', row, () => {
        tombstones.add('scenario:' + id)
        snap.scenarios.delete(id)
      })
    }
  }
  for (const [id, json] of [...snap.sentences]) {
    if (!store.sentences.find((x) => x.id === id)) {
      const row = Object.assign({}, JSON.parse(json), { updatedAt: now, deletedAt: now })
      pushRow('sentence', row, () => {
        tombstones.add('sentence:' + id)
        snap.sentences.delete(id)
      })
    }
  }

  // practiceLog：把本地与"本机+他机"合计的差异归属给本机行
  for (const d of Object.keys(store.practiceLog)) {
    const actual = store.practiceLog[d] || 0
    const expected = (ownReps[d] || 0) + (othersReps[d] || 0)
    if (actual !== expected) {
      ownReps[d] = Math.max(0, actual - (othersReps[d] || 0))
      const row = { day: d, deviceId: deviceId(), reps: ownReps[d], updatedAt: now }
      pushRow('practiceDay', row, () => { snap.practiceLog[d] = ownReps[d] + (othersReps[d] || 0) })
    } else if (snap.practiceLog[d] !== actual) {
      snap.practiceLog[d] = actual
    }
  }

  // settings 白名单（绝不包含 apiKey）
  const sj = settingsJson()
  if (sj !== snap.settings) {
    const row = {
      voiceName: store.settings.voiceName || '',
      rate: Number(store.settings.rate) || 0.9,
      model: store.settings.model || 'deepseek-v4-flash',
      updatedAt: now,
    }
    pushRow('settings', row, () => {
      snap.settings = sj
      settingsStamp = now
    })
  }

  if (!sends.length) return
  try {
    await Promise.all(sends)
    syncState.lastSyncAt = Date.now()
    syncState.error = ''
  } catch {
    // 单条失败已在上面的 catch 里记录；快照未更新 → 15 秒后自动重试
    scheduleFlush(15000)
  }
}

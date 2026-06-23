<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useData } from 'vitepress'

const { frontmatter, page } = useData()

// ===== 模式：detecting | audio | web-speech =====
const mode = ref('detecting')

// ===== 推断 mp3 路径：reading/company-of-one.md → /tts/reading/company-of-one.mp3 =====
const audioPath = computed(() => {
  const rel = page.value.relativePath // 如 "reading/company-of-one.md" 或 "index.md"
  if (!rel || rel === 'index.md') return null
  return `/tts/${rel.replace(/\.md$/, '.mp3')}`
})

// ===== 公共状态 =====
const status = ref('idle') // idle | playing | paused
const rate = ref(1)
const curIdx = ref(0)
const total = ref(0)
const voiceName = ref('')
const audioDuration = ref(0)
const audioCurrent = ref(0)

// ===== Web Speech / 章节 内部 =====
let chunks = []           // 全局朗读分片（按章节顺序铺平）
let sections = []         // [{ el, title, wsChunkStart, wsChunkEnd }]  index 0 为导言（无 el）
const audioChapters = ref(null) // audio 模式从 chapters.json 读到的 [{title,start,end}]
let voices = []
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
let audioEl = null
let detectTimer = null

// ===== 文本分片 =====
function splitChunks(text) {
  const MAX = 180
  const out = []
  const sentences = text.split(/(?<=[。！？!?；;\n])/)
  let buf = ''
  for (const s of sentences) {
    const seg = s.trim()
    if (!seg) continue
    if ((buf + seg).length > MAX) {
      if (buf) out.push(buf)
      if (seg.length > MAX) {
        for (let i = 0; i < seg.length; i += MAX) out.push(seg.slice(i, i + MAX))
        buf = ''
      } else {
        buf = seg
      }
    } else {
      buf += seg
    }
  }
  if (buf) out.push(buf)
  return out
}

function pickVoice() {
  if (!voices.length) return null
  const prefer = [
    /Microsoft.*(Xiaoxiao|Yunxi|Yunjian|Xiaoyi|Yunyang).*Online/i,
    /zh-CN/i,
    /Ting-Ting|Mei-Jia|Sin-ji/i,
    /Chinese/i,
  ]
  for (const re of prefer) {
    const v = voices.find(v => re.test(`${v.name} ${v.lang}`))
    if (v) return v
  }
  return voices[0]
}

// ===== 章节分节 + DOM 按钮注入 =====
function headingText(el) {
  const clone = el.cloneNode(true)
  clone.querySelectorAll('.header-anchor').forEach(a => a.remove())
  return (clone.textContent || '').trim()
}

function cleanupJumpButtons() {
  document.querySelectorAll('.ra-jump').forEach(b => b.remove())
  buildRetry = 0
}

let buildRetry = 0
const MAX_RETRY = 5

function buildSections() {
  cleanupJumpButtons()
  sections = []
  chunks = []
  total.value = 0
  const doc = document.querySelector('.vp-doc')
  if (!doc) return

  // VitePress 把正文包在 .vp-doc 下一层 div（Content 容器），
  // h2/h3 是该 div 的后代，非 .vp-doc 直接子元素 → 必须进入该容器遍历
  const root = doc.querySelector(':scope > div') || doc

  // SPA 切页时 DOM 可能尚未就绪：若 content 容器里没有标题，短延迟重试
  if (!root.querySelector('h2, h3') && buildRetry < MAX_RETRY) {
    buildRetry++
    setTimeout(buildSections, 80)
    return
  }
  buildRetry = 0

  // 导言段（第一个 h2/h3 之前的内容）
  sections.push({ el: null, title: null, wsChunkStart: 0, wsChunkEnd: 0 })
  let buf = []

  const flush = () => {
    const text = buf.join('\n').trim()
    buf = []
    if (!text) return
    const segs = splitChunks(text)
    const cur = sections[sections.length - 1]
    cur.wsChunkStart = chunks.length
    chunks.push(...segs)
    cur.wsChunkEnd = chunks.length
  }

  for (const el of root.children) {
    // 跳过播放条自身（防御：doc-before slot 偶尔注入正文容器内）
    if (el.classList && el.classList.contains('read-aloud')) continue
    const tag = el.tagName
    if (tag === 'H2' || tag === 'H3') {
      flush()
      const sec = { el, title: headingText(el), wsChunkStart: chunks.length, wsChunkEnd: chunks.length }
      sections.push(sec)
      injectJumpButton(el, sections.length - 1)
    } else if (tag === 'UL' || tag === 'OL') {
      el.querySelectorAll(':scope > li').forEach(li => buf.push(li.textContent))
    } else if (['P', 'BLOCKQUOTE', 'H4', 'H5', 'H6', 'LI'].includes(tag)) {
      buf.push(el.textContent)
    }
    // pre/code/table/图片等忽略
  }
  flush()
  // 修正导言段终点
  if (sections[0]) sections[0].wsChunkEnd = sections[1] ? sections[1].wsChunkStart : chunks.length
  total.value = chunks.length
}

function injectJumpButton(headingEl, sectionIdx) {
  const btn = document.createElement('button')
  btn.className = 'ra-jump'
  btn.type = 'button'
  btn.title = '从此处播放'
  btn.setAttribute('aria-label', '从此处播放')
  btn.textContent = '▶'
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    seekToSection(sectionIdx)
  })
  // 插到标题文本最前（header-anchor 之前）
  headingEl.insertBefore(btn, headingEl.firstChild)
}

// ===== Web Speech 播放 =====
function playFrom(index) {
  if (!synth || index >= chunks.length) { stop(); return }
  curIdx.value = index
  const u = new SpeechSynthesisUtterance(chunks[index])
  const v = pickVoice()
  if (v) { u.voice = v; voiceName.value = v.name }
  u.lang = /[\u4e00-\u9fa5]/.test(chunks[index]) ? 'zh-CN' : 'en-US'
  u.rate = rate.value
  u.onend = () => { if (status.value === 'playing') playFrom(index + 1) }
  u.onerror = () => { if (status.value === 'playing') playFrom(index + 1) }
  synth.speak(u)
}

// ===== 统一控制接口 =====
function play() {
  if (mode.value === 'audio') {
    audioEl.play()
    status.value = 'playing'
  } else if (mode.value === 'web-speech') {
    if (chunks.length === 0) buildSections()
    if (chunks.length === 0) return
    status.value = 'playing'
    playFrom(curIdx.value)
  }
}

function pause() {
  if (mode.value === 'audio') audioEl.pause()
  else if (synth) synth.pause()
  status.value = 'paused'
}

function resume() {
  if (mode.value === 'audio') audioEl.play()
  else if (synth) synth.resume()
  status.value = 'playing'
}

function stop() {
  if (mode.value === 'audio') {
    audioEl.pause()
    audioEl.currentTime = 0
    audioCurrent.value = 0
  } else if (synth) {
    synth.cancel()
  }
  status.value = 'idle'
  curIdx.value = 0
}

function toggle() {
  if (status.value === 'idle') play()
  else if (status.value === 'playing') pause()
  else if (status.value === 'paused') resume()
}

function changeRate(v) {
  rate.value = v
  if (mode.value === 'audio') {
    audioEl.playbackRate = v
  } else if (status.value === 'playing') {
    synth.cancel()
    playFrom(curIdx.value)
  }
}

// ===== 章节跳转：从某个 h2/h3 开始播放 =====
function seekToSection(sectionIdx) {
  const sec = sections[sectionIdx]
  if (!sec) return

  if (mode.value === 'audio') {
    // audioChapters 与 sections 同构（导言在前，h2/h3 按序）
    const ch = audioChapters.value && audioChapters.value[sectionIdx]
    if (ch && audioEl) {
      audioEl.currentTime = ch.start
      audioEl.play()
      status.value = 'playing'
      return
    }
    // chapters 未就绪 → 整篇从头播（兜底）
    play()
    return
  }

  if (mode.value === 'web-speech') {
    if (chunks.length === 0) buildSections()
    if (synth) synth.cancel()
    if (sec.wsChunkStart < chunks.length) {
      status.value = 'playing'
      playFrom(sec.wsChunkStart)
    }
    return
  }

  // detecting 等其他状态：忽略
}

// ===== 进度（两种模式统一） =====
const progress = computed(() => {
  if (mode.value === 'audio') {
    return audioDuration.value === 0 ? 0
      : Math.round((audioCurrent.value / audioDuration.value) * 100)
  }
  return total.value === 0 ? 0 : Math.round((curIdx.value / total.value) * 100)
})

const progressLabel = computed(() => {
  if (mode.value === 'audio') {
    const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    return `${fmt(audioCurrent.value)} / ${fmt(audioDuration.value)}`
  }
  return `${Math.min(curIdx.value + 1, total.value)} / ${total.value}`
})

const modeLabel = computed(() =>
  mode.value === 'audio' ? 'HQ 神经音' : mode.value === 'web-speech' ? '系统语音' : '检测中'
)

// ===== 生命周期 =====
function loadVoices() {
  if (!synth) return
  voices = synth.getVoices()
  if (voices.length) {
    const v = pickVoice()
    if (v) voiceName.value = v.name
  }
}

// chapters.json 预取（audio 模式段内跳转用；失败静默）
async function loadChapters() {
  if (!audioPath.value) { audioChapters.value = null; return }
  try {
    const url = audioPath.value.replace(/\.mp3$/, '.chapters.json')
    const r = await fetch(url)
    if (!r.ok) throw new Error(r.status)
    const data = await r.json()
    audioChapters.value = (data && data.chapters) ? data.chapters : null
  } catch {
    audioChapters.value = null
  }
}

// ===== 音频探测：抽取出来，onMounted 与切页 watch 共用 =====
function detect() {
  stop()
  // 清空 web-speech 缓存与章节，避免切页后播旧内容
  chunks = []
  sections = []
  curIdx.value = 0
  total.value = 0
  audioCurrent.value = 0
  audioDuration.value = 0
  audioChapters.value = null
  mode.value = 'detecting'
  clearTimeout(detectTimer)

  if (audioPath.value && typeof Audio !== 'undefined') {
    audioEl = new Audio()
    audioEl.preload = 'metadata'
    audioEl.src = audioPath.value
    audioEl.onloadedmetadata = () => {
      mode.value = 'audio'
      audioDuration.value = audioEl.duration || 0
      voiceName.value = 'Edge 神经音'
      clearTimeout(detectTimer)
    }
    audioEl.ontimeupdate = () => { audioCurrent.value = audioEl.currentTime }
    audioEl.onended = () => { stop() }
    audioEl.onerror = () => {
      if (mode.value === 'detecting') initWebSpeech()
    }
    // 2 秒未响应则回退（网络慢/无文件）
    detectTimer = setTimeout(() => {
      if (mode.value === 'detecting') initWebSpeech()
    }, 2500)
  } else {
    initWebSpeech()
  }

  // 章节按钮注入 + chapters 预取（与音频探测并行，DOM 就绪后做）
  nextTick(() => buildSections())
  loadChapters()
}

// 切页（SPA 路由变化）时重置：避免播上一篇文章内容
watch(() => page.value.relativePath, () => detect())

onMounted(() => detect())

function initWebSpeech() {
  clearTimeout(detectTimer)
  if (!synth) { mode.value = 'unsupported'; return }
  mode.value = 'web-speech'
  loadVoices()
  synth.onvoiceschanged = loadVoices
}

onBeforeUnmount(() => {
  stop()
  clearTimeout(detectTimer)
  cleanupJumpButtons()
  if (audioEl) audioEl.src = ''
})
</script>

<template>
  <div
    v-if="mode !== 'unsupported' && frontmatter.readAloud !== false"
    class="read-aloud"
  >
    <button
      class="ra-btn"
      :class="{
        'is-playing': status === 'playing',
        'is-paused': status === 'paused',
        'is-detect': mode === 'detecting'
      }"
      :disabled="mode === 'detecting'"
      @click="toggle"
      :title="status === 'idle' ? '朗读全文' : status === 'playing' ? '暂停' : '继续'"
    >
      <span class="ra-icon">{{ status === 'playing' ? '⏸' : '▶' }}</span>
      <span class="ra-label">
        {{ status === 'idle' ? '朗读' : status === 'playing' ? '暂停' : '继续' }}
      </span>
    </button>

    <button
      v-if="status !== 'idle'"
      class="ra-btn ra-stop"
      @click="stop"
      title="停止"
    >⏹</button>

    <span class="ra-mode" :class="{ 'is-hq': mode === 'audio' }">{{ modeLabel }}</span>

    <div v-if="status !== 'idle'" class="ra-rate">
      <label>语速</label>
      <input
        type="range" min="0.5" max="2" step="0.1"
        :value="rate"
        @input="changeRate(parseFloat($event.target.value))"
      />
      <span class="ra-rate-val">{{ rate.toFixed(1) }}x</span>
    </div>

    <div v-if="status !== 'idle'" class="ra-progress">
      <div class="ra-bar">
        <div class="ra-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="ra-count">{{ progressLabel }}</span>
    </div>
  </div>
</template>

<!-- 播放条本体（scoped） -->
<style scoped>
.read-aloud {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  margin: 0 0 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 14px;

  /* 滚出视口时浮动吸附在顶部 nav 下方，滚回顶端自动回原位 */
  position: sticky;
  top: var(--vp-nav-height);
  z-index: 9;
}

.ra-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--vp-c-brand);
  border-radius: 6px;
  background: var(--vp-c-brand);
  color: var(--vp-c-white);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: opacity 0.2s, background 0.2s;
}
.ra-btn:hover:not(:disabled) { opacity: 0.88; }
.ra-btn:disabled { opacity: 0.5; cursor: wait; }
.ra-btn.is-playing { background: var(--vp-c-brand-dark, var(--vp-c-brand)); }
.ra-btn.is-paused {
  background: var(--vp-c-yellow, #d4a017);
  border-color: var(--vp-c-yellow, #d4a017);
}
.ra-btn.ra-stop {
  background: transparent;
  color: var(--vp-c-text-2);
  border-color: var(--vp-c-divider);
  padding: 6px 10px;
}

.ra-mode {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--vp-c-divider);
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
.ra-mode.is-hq {
  background: var(--vp-c-brand-dim, rgba(85, 133, 247, 0.14));
  color: var(--vp-c-brand);
  font-weight: 600;
}

.ra-rate {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--vp-c-text-2);
}
.ra-rate label { font-size: 12px; }
.ra-rate input[type="range"] {
  width: 80px;
  accent-color: var(--vp-c-brand);
}
.ra-rate-val {
  font-size: 12px;
  min-width: 32px;
  color: var(--vp-c-text-1);
}

.ra-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 140px;
}
.ra-bar {
  flex: 1;
  height: 4px;
  background: var(--vp-c-divider);
  border-radius: 2px;
  overflow: hidden;
}
.ra-fill {
  height: 100%;
  background: var(--vp-c-brand);
  transition: width 0.3s;
}
.ra-count {
  font-size: 12px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .ra-progress { min-width: 100%; order: 3; }
}
</style>

<!-- 章节跳转按钮：注入到 .vp-doc 的 h2/h3 内，须用全局样式（scoped 不作用于动态 DOM） -->
<style>
.vp-doc h2,
.vp-doc h3 {
  position: relative;
}
.ra-jump {
  position: absolute;
  left: -1.5em;
  top: 50%;
  transform: translateY(-50%);
  width: 1.4em;
  height: 1.4em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
  font-size: 0.7em;
  line-height: 1;
  cursor: pointer;
  opacity: 0.15;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s, background 0.2s;
  vertical-align: middle;
}
.ra-jump:hover {
  opacity: 1;
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand-dim, rgba(85, 133, 247, 0.14));
}
.vp-doc h2:hover .ra-jump,
.vp-doc h3:hover .ra-jump {
  opacity: 0.6;
}
@media (max-width: 768px) {
  /* 窄屏左侧无 gutter，改为标题内联首字符位置，避免溢出 */
  .ra-jump {
    position: static;
    transform: none;
    margin-right: 0.4em;
    opacity: 0.35;
  }
}
</style>

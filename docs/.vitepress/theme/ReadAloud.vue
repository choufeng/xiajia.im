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

// ===== 自动跟随 + 段落高亮（audio 模式） =====
const autoFollow = ref(true)   // 浮动开关：朗读时自动滚动跟随当前章节
let lastScrollIdx = -1         // 上次定位的章节，避免重复滚动
let activeIdx = -1             // 当前高亮章节索引

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
  // 清除切页前残留的高亮标记
  document.querySelectorAll('.ra-sec').forEach(el => el.classList.remove('ra-sec', 'ra-sec-active'))
  const docOld = document.querySelector('.vp-doc.ra-highlighting')
  if (docOld) docOld.classList.remove('ra-highlighting')
  activeIdx = -1
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
  sections.push({ el: null, title: null, wsChunkStart: 0, wsChunkEnd: 0, elems: [] })
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
      const sec = { el, title: headingText(el), wsChunkStart: chunks.length, wsChunkEnd: chunks.length, elems: [el] }
      el.classList.add('ra-sec')
      sections.push(sec)
      injectJumpButton(el, sections.length - 1)
    } else if (tag === 'UL' || tag === 'OL') {
      el.querySelectorAll(':scope > li').forEach(li => buf.push(li.textContent))
      el.classList.add('ra-sec')
      sections[sections.length - 1].elems.push(el)
    } else if (['P', 'BLOCKQUOTE', 'H4', 'H5', 'H6', 'LI'].includes(tag)) {
      buf.push(el.textContent)
      el.classList.add('ra-sec')
      sections[sections.length - 1].elems.push(el)
    } else if (tag === 'TABLE') {
      // 不朗读文本，但跟随聚焦明暗（朗读时表格恒亮会破坏聚焦阅读）
      el.classList.add('ra-sec')
      sections[sections.length - 1].elems.push(el)
    } else if (tag === 'PRE') {
      // 代码块：不朗读，但跟随聚焦明暗
      el.classList.add('ra-sec')
      sections[sections.length - 1].elems.push(el)
    } else if (tag === 'P' && el.querySelector('img')) {
      // 图片（包在 p 里）：不朗读，但跟随聚焦明暗
      el.classList.add('ra-sec')
      sections[sections.length - 1].elems.push(el)
    }
    // 其他忽略
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
  // 插到标题末尾（文字之后），绝对定位浮在标题右侧
  headingEl.appendChild(btn)
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
  autoFollow.value = true
  clearHighlight()
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
      autoFollow.value = true
      lastScrollIdx = sectionIdx
      scrollToChapter(sectionIdx, true)
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

// ===== 音频跟随滚动 =====
// audioChapters 与 sections 同构（导言在前，h2/h3 按序）
function chapterIndexAt(time) {
  const chs = audioChapters.value
  if (!chs || !chs.length) return -1
  let idx = 0
  for (let i = 0; i < chs.length; i++) {
    if (chs[i].start <= time + 0.05) idx = i
    else break
  }
  return idx
}

// 段落高亮：切换 .ra-sec-active 到 idx 章节
function setActiveSection(idx) {
  const doc = document.querySelector('.vp-doc')
  if (doc) doc.classList.add('ra-highlighting')
  if (idx === activeIdx) return
  if (sections[activeIdx]) {
    sections[activeIdx].elems.forEach(el => el.classList.remove('ra-sec-active'))
  }
  activeIdx = idx
  if (sections[idx]) {
    sections[idx].elems.forEach(el => el.classList.add('ra-sec-active'))
  }
}

// 清除高亮（停止 / 切页用）
function clearHighlight() {
  const doc = document.querySelector('.vp-doc.ra-highlighting')
  if (doc) doc.classList.remove('ra-highlighting')
  if (sections[activeIdx]) {
    sections[activeIdx].elems.forEach(el => el.classList.remove('ra-sec-active'))
  }
  activeIdx = -1
}

// 把章节顶部滚到 nav + 播放条下方；force=true 时忽略 autoFollow 开关
function scrollToChapter(index, force = false) {
  if (!force && !autoFollow.value) return
  const sec = sections[index]
  if (!sec) return

  const navH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--vp-nav-height')
  ) || 0
  const bar = document.querySelector('.read-aloud')
  const barH = bar ? bar.offsetHeight : 0
  const offset = navH + barH + 12

  let topY
  if (sec.el) {
    topY = sec.el.getBoundingClientRect().top + window.scrollY - offset
  } else {
    // 导言段（H1 区，无 el）：滚到正文容器顶部
    const doc = document.querySelector('.vp-doc')
    topY = doc ? (doc.getBoundingClientRect().top + window.scrollY - offset) : 0
  }
  window.scrollTo({ top: Math.max(0, topY), behavior: 'smooth' })
}

// 浮动开关：点开时跳回当前朗读处
function toggleAutoFollow() {
  if (autoFollow.value) {
    autoFollow.value = false
    return
  }
  autoFollow.value = true
  if (audioEl && audioChapters.value) {
    const idx = chapterIndexAt(audioEl.currentTime)
    if (idx >= 0) {
      lastScrollIdx = idx
      scrollToChapter(idx, true)
    }
  }
}

// 用户手动滚动 → 关闭自动跟随
function markUserScroll() {
  if (mode.value !== 'audio' || status.value !== 'playing') return
  if (autoFollow.value) autoFollow.value = false
}
const _scrollKeys = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])
function onUserScrollEvent(e) {
  if (e.type === 'keydown') {
    if (_scrollKeys.has(e.key) || e.key === ' ') markUserScroll()
  } else {
    markUserScroll()
  }
}

// 进度条点击 seek（audio 模式）
function seekByProgress(e) {
  if (mode.value !== 'audio' || !audioEl || !audioDuration.value) return
  const rect = e.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  audioEl.currentTime = ratio * audioDuration.value
  audioCurrent.value = audioEl.currentTime
  autoFollow.value = true
  const idx = chapterIndexAt(audioEl.currentTime)
  if (idx >= 0) {
    lastScrollIdx = idx
    scrollToChapter(idx, true)
  }
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
  lastScrollIdx = -1
  autoFollow.value = true
  clearHighlight()
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
    audioEl.ontimeupdate = () => {
      audioCurrent.value = audioEl.currentTime
      if (mode.value === 'audio' && audioChapters.value) {
        const idx = chapterIndexAt(audioEl.currentTime)
        if (idx >= 0 && idx !== lastScrollIdx) {
          lastScrollIdx = idx
          scrollToChapter(idx, false)
        }
        if (idx >= 0) setActiveSection(idx)
      }
    }
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

onMounted(() => {
  window.addEventListener('wheel', onUserScrollEvent, { passive: true })
  window.addEventListener('touchmove', onUserScrollEvent, { passive: true })
  window.addEventListener('keydown', onUserScrollEvent)
  detect()
})

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
  window.removeEventListener('wheel', onUserScrollEvent)
  window.removeEventListener('touchmove', onUserScrollEvent)
  window.removeEventListener('keydown', onUserScrollEvent)
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
      <div
        class="ra-bar"
        :class="{ 'is-seekable': mode === 'audio' }"
        :title="mode === 'audio' ? '点击跳转' : ''"
        @click="seekByProgress"
      >
        <div class="ra-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span class="ra-count">{{ progressLabel }}</span>
    </div>

    <!-- 跟随开关：audio 播放时整合进工具条末尾 -->
    <button
      v-if="mode === 'audio' && status !== 'idle'"
      class="ra-follow"
      :class="{ 'is-on': autoFollow }"
      @click="toggleAutoFollow"
      :title="autoFollow ? '跟随朗读中（点击暂停跟随）' : '已暂停跟随（点击恢复，跳回当前朗读处）'"
      :aria-label="autoFollow ? '暂停跟随朗读' : '恢复跟随朗读'"
    >
      <svg class="ra-follow-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" :stroke-width="autoFollow ? 2 : 1.5" :stroke-dasharray="autoFollow ? 'none' : '2.5 2'" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span class="ra-follow-label">{{ autoFollow ? '跟随' : '已停' }}</span>
    </button>
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
  transition: height 0.15s;
}
.ra-bar.is-seekable { cursor: pointer; }
.ra-bar.is-seekable:hover { height: 8px; }
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

/* 移动端：icon 化，严格压缩到 2 行（工具行 + 进度行） */
@media (max-width: 640px) {
  .read-aloud {
    gap: 8px;
    padding: 8px 10px;
  }
  /* 隐藏按钮文字 label，只留 icon */
  .ra-label,
  .ra-follow-label {
    display: none;
  }
  .ra-btn {
    padding: 6px 10px;
  }
  .ra-stop {
    padding: 6px 9px;
  }
  /* 语速：去 label，缩 range */
  .ra-rate {
    gap: 4px;
  }
  .ra-rate > label {
    display: none;
  }
  .ra-rate input[type="range"] {
    width: 56px;
  }
  .ra-rate-val {
    min-width: 28px;
    font-size: 11px;
  }
  /* 模式标签更紧凑 */
  .ra-mode {
    font-size: 10px;
    padding: 2px 6px;
  }
  /* 跟随 icon 化 */
  .ra-follow {
    padding: 5px 8px;
    order: 2;
  }
  /* 进度条独占第二行 */
  .ra-progress {
    min-width: 100%;
    order: 3;
    margin-top: 2px;
  }
}

/* 跟随开关（整合进工具条末尾） */
.ra-follow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-3);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  white-space: nowrap;
}
.ra-follow:hover { color: var(--vp-c-text-1); border-color: var(--vp-c-text-3); }
.ra-follow-icon {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
}
.ra-follow-icon circle:last-child { fill: currentColor; stroke: none; }
/* 跟随中：主题色实心瞄准点 */
.ra-follow.is-on {
  color: var(--vp-c-brand);
  border-color: var(--vp-c-brand);
  background: var(--vp-c-brand-dim, rgba(85, 133, 247, 0.14));
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
  right: -1.5em;
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
  /* 窄屏右侧无 gutter，改为标题内联末尾，避免溢出 */
  .ra-jump {
    position: static;
    transform: none;
    margin-left: 0.4em;
    opacity: 0.35;
  }
}

/* 段落高亮：audio 模式播放时，非当前章节降低透明度，当前章节高亮 */
.vp-doc.ra-highlighting .ra-sec {
  opacity: 0.38;
  transition: opacity 0.4s ease;
}
.vp-doc.ra-highlighting .ra-sec.ra-sec-active {
  opacity: 1;
}
/* 当前章节标题左侧加一条主题色引导线 */
.vp-doc.ra-highlighting h2.ra-sec-active,
.vp-doc.ra-highlighting h3.ra-sec-active {
  border-left: 3px solid var(--vp-c-brand);
  padding-left: 0.4em;
  margin-left: -0.55em;
}
</style>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
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

// ===== Web Speech 内部 =====
let chunks = []
let voices = []
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
let audioEl = null
let detectTimer = null

// ===== 文本提取 =====
function extractText() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''
  const clone = doc.cloneNode(true)
  clone.querySelectorAll(
    'pre, code, script, style, table, .read-aloud, .vp-copy-coded, .line-numbers'
  ).forEach(el => el.remove())
  const nodes = clone.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')
  if (nodes.length === 0) return clone.textContent || ''
  return Array.from(nodes).map(n => n.textContent).join('\n')
}

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
    if (chunks.length === 0 || curIdx.value >= total.value) {
      chunks = splitChunks(extractText())
      total.value = chunks.length
      curIdx.value = 0
    }
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

onMounted(() => {
  // 1. 尝试 HQ 音频探测
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

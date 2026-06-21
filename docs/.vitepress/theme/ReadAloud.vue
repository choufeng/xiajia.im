<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { useData } from 'vitepress'

const { frontmatter } = useData()

// ===== 状态 =====
const supported = ref(false)
const status = ref('idle') // idle | playing | paused
const rate = ref(1)
const curIdx = ref(0)
const total = ref(0)
const voiceName = ref('')

// ===== 内部 =====
let chunks = []          // 文本分段数组
let voices = []          // 可用语音列表
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

// ===== 文本提取与清洗 =====
function extractText() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''
  const clone = doc.cloneNode(true)
  // 移除：代码块、表格行（保留太少价值，朗读像乱码）、脚本、style、自身组件
  clone.querySelectorAll(
    'pre, code, script, style, table, .read-aloud, .vp-copy-coded, .line-numbers'
  ).forEach(el => el.remove())
  // 取标题 + 段落 + 列表项（保留语义边界）
  const nodes = clone.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote')
  if (nodes.length === 0) return clone.textContent || ''
  return Array.from(nodes).map(n => n.textContent).join('\n')
}

// ===== 切句（Chrome 长文本会截断，限制每段 ≤ 180 字符） =====
function splitChunks(text) {
  const MAX = 180
  const out = []
  // 先按换行/句末标点切（中英文都覆盖）
  const sentences = text.split(/(?<=[。！？!?；;\n])/)
  let buf = ''
  for (const s of sentences) {
    const seg = s.trim()
    if (!seg) continue
    if ((buf + seg).length > MAX) {
      if (buf) out.push(buf)
      // 单句超长，硬切
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

// ===== 选中文音色（优先神经/自然音） =====
function pickVoice() {
  if (!voices.length) return null
  const prefer = [
    /Microsoft.*(Xiaoxiao|Yunxi|Yunjian|Xiaoyi|Yunyang).*Online/i, // Edge 在线神经音（极佳）
    /zh-CN/i,
    /Ting-Ting|Mei-Jia|Sin-ji/i, // macOS 中文
    /Chinese/i,
  ]
  for (const re of prefer) {
    const v = voices.find(v => re.test(`${v.name} ${v.lang}`))
    if (v) return v
  }
  return voices[0]
}

// ===== 播放核心 =====
function playFrom(index) {
  if (!synth || index >= chunks.length) {
    stop()
    return
  }
  curIdx.value = index
  const u = new SpeechSynthesisUtterance(chunks[index])
  const v = pickVoice()
  if (v) {
    u.voice = v
    voiceName.value = v.name
  }
  u.lang = /[\u4e00-\u9fa5]/.test(chunks[index]) ? 'zh-CN' : 'en-US'
  u.rate = rate.value
  u.onend = () => {
    if (status.value === 'playing') playFrom(index + 1)
  }
  u.onerror = () => {
    if (status.value === 'playing') playFrom(index + 1)
  }
  synth.speak(u)
}

function play() {
  if (!supported.value) return
  // 首次或重新开始
  if (chunks.length === 0 || curIdx.value >= total.value) {
    const text = extractText()
    chunks = splitChunks(text)
    total.value = chunks.length
    curIdx.value = 0
  }
  if (chunks.length === 0) return
  status.value = 'playing'
  playFrom(curIdx.value)
}

function pause() {
  if (!synth) return
  synth.pause()
  status.value = 'paused'
}

function resume() {
  if (!synth) return
  synth.resume()
  status.value = 'playing'
}

function stop() {
  if (!synth) return
  synth.cancel()
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
  // 改语速后从当前段重新播放
  if (status.value === 'playing') {
    synth.cancel()
    playFrom(curIdx.value)
  }
}

// ===== 生命周期 =====
const progress = computed(() =>
  total.value === 0 ? 0 : Math.round(((curIdx.value) / total.value) * 100)
)

let voicesReady = false
function loadVoices() {
  if (!synth) return
  voices = synth.getVoices()
  if (voices.length && !voicesReady) {
    voicesReady = true
    const v = pickVoice()
    if (v) voiceName.value = v.name
  }
}

onMounted(async () => {
  if (!synth) { supported.value = false; return }
  supported.value = true
  loadVoices()
  // Chrome 异步加载 voices
  synth.onvoiceschanged = loadVoices
  // 页面切换时停止
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stop)
  }
})

onBeforeUnmount(() => {
  stop()
})
</script>

<template>
  <div v-if="supported && frontmatter.readAloud !== false" class="read-aloud">
    <button
      class="ra-btn"
      :class="{ 'is-playing': status === 'playing', 'is-paused': status === 'paused' }"
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
      <span class="ra-count">{{ Math.min(curIdx + 1, total) }} / {{ total }}</span>
    </div>

    <div v-if="voiceName && status !== 'idle'" class="ra-voice" :title="voiceName">
      🎙 {{ voiceName.length > 20 ? voiceName.slice(0, 20) + '…' : voiceName }}
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
.ra-btn:hover { opacity: 0.88; }
.ra-btn.is-playing {
  background: var(--vp-c-brand-dark, var(--vp-c-brand));
}
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
}

.ra-voice {
  font-size: 11px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .ra-progress { min-width: 100%; order: 3; }
  .ra-voice { order: 4; }
}
</style>

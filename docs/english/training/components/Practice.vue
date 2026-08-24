<script setup>
// 模块3 · 练习器
//  模式A 四道并行（视频1·步骤3）：眼看(EN) 耳听(TTS) 口念(计数×15) 手写(默写校验)
//  模式B 听→预测→跟读（视频2·Step3）：先盲听至能预测，解锁跟读×3-6，最后脱口而出自测
import { ref, computed, onMounted } from 'vue'
import {
  store, stats, speak, logRep, updateSentence, markRed, scenarioName,
} from './store.js'

const mode = ref('parallel') // parallel | predict
const scope = ref('fresh')   // fresh: 今日新句(未满15遍) | scenario
const scopeScenario = ref(store.scenarios[0]?.id || '')

const queue = computed(() => {
  let list = store.sentences.slice()
  if (scope.value === 'fresh') list = list.filter((s) => s.repsTotal < 15)
  else list = list.filter((s) => s.scenarioId === scopeScenario.value)
  return list
})

const idx = ref(0)
const cur = computed(() => queue.value[idx.value] || null)
const st = computed(() => stats())

// ---- 模式A：四道并行 ----
const typing = ref('')
const typingResult = ref(null) // {pass, diffs:[{ch,ok}]}
function repOnce() {
  if (!cur.value) return
  updateSentence(cur.value.id, { repsTotal: cur.value.repsTotal + 1, lastPracticed: new Date().toISOString() })
  logRep()
  // 念一遍听一遍：自动播放
  if (cur.value) speak(cur.value.en)
}
function normalize(s) {
  return s.toLowerCase().replace(/[.,!?;:'"“”’()\-\s]+/g, '')
}
function checkTyping() {
  if (!cur.value) return
  const a = normalize(typing.value)
  const b = normalize(cur.value.en)
  const diffs = []
  const n = Math.max(a.length, b.length)
  let wrong = 0
  for (let i = 0; i < n; i++) {
    const ok = a[i] === b[i]
    if (!ok) wrong++
    diffs.push({ ch: b[i] || '␣', typed: a[i] || '·', ok })
  }
  typingResult.value = { pass: wrong === 0, diffs, wrong }
  if (wrong === 0) typing.value = ''
}

// ---- 模式B：听→预测→跟读 ----
const phase = ref('listen') // listen | shadow | recall
const showAnswer = ref(false)
function listenOnce() {
  if (!cur.value) return
  updateSentence(cur.value.id, { listens: cur.value.listens + 1 })
  speak(cur.value.en)
}
function unlockPredict() {
  if (!cur.value) return
  updateSentence(cur.value.id, { predictUnlocked: true })
  phase.value = 'shadow'
  speak(cur.value.en)
}
function shadowOnce() {
  if (!cur.value) return
  updateSentence(cur.value.id, { shadowReps: cur.value.shadowReps + 1, lastPracticed: new Date().toISOString() })
  logRep()
  speak(cur.value.en)
}
function startRecall() {
  phase.value = 'recall'
  showAnswer.value = false
}
function recallOk() {
  if (cur.value && cur.value.red) markRed(cur.value.id, false)
  next()
}
function recallFail() {
  if (cur.value) markRed(cur.value.id, true) // Excel 标红：明天优先
  next()
}

function next() {
  typing.value = ''
  typingResult.value = null
  phase.value = 'listen'
  showAnswer.value = false
  if (queue.value.length) idx.value = (idx.value + 1) % queue.value.length
}
function prev() {
  typing.value = ''
  typingResult.value = null
  phase.value = 'listen'
  idx.value = (idx.value - 1 + queue.value.length) % Math.max(queue.value.length, 1)
}

onMounted(() => { if (queue.value.length === 0) scope.value = 'scenario' })
</script>

<template>
  <div class="practice">
    <!-- 顶部控制 -->
    <div class="toolbar">
      <div class="seg">
        <button :class="{ on: mode === 'parallel' }" @click="mode = 'parallel'">四道并行 ×15</button>
        <button :class="{ on: mode === 'predict' }" @click="mode = 'predict'">听→预测→跟读</button>
      </div>
      <div class="scope">
        <select v-model="scope">
          <option value="fresh">今日新句（未满15遍）</option>
          <option value="scenario">按场景</option>
        </select>
        <select v-if="scope === 'scenario'" v-model="scopeScenario">
          <option v-for="s in store.scenarios" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <span class="count" v-if="queue.length">{{ idx + 1 }} / {{ queue.length }} ｜ 今日已练 {{ st.todayReps }} 遍</span>
      </div>
    </div>

    <div v-if="!queue.length" class="empty">
      队列为空。去「语句库」用万用模板生成，或把范围切到「按场景」。
    </div>

    <div v-else-if="!cur" class="empty">没有选中的句子</div>

    <div v-else class="card">
      <div class="meta">
        <span class="tag" :class="{ red: cur.red }">{{ cur.red ? '🔴 错题' : scenarioName(cur.scenarioId) }}</span>
        <span v-if="mode === 'parallel'" class="progress">已念 {{ cur.repsTotal }}/15 遍</span>
        <span v-else class="progress">盲听 {{ cur.listens }} ｜ 跟读 {{ cur.shadowReps }}/5</span>
      </div>

      <!-- 模式A 四道并行 -->
      <template v-if="mode === 'parallel'">
        <p class="en">{{ cur.en }}</p>
        <p class="zh">{{ cur.zh }}</p>
        <div class="bar"><div :style="{ width: Math.min(100, (cur.repsTotal / 15) * 100) + '%' }" /></div>
        <div class="acts">
          <button class="big" @click="speak(cur.en)">🔊 听</button>
          <button class="big primary" @click="repOnce">👄 我念了一遍（眼·口·耳 同步）</button>
        </div>
        <details class="hand">
          <summary>✍️ 手 · 默写校验（第四道）</summary>
          <input v-model="typing" placeholder="凭记忆默写英文句子…" @keyup.enter="checkTyping" />
          <button @click="checkTyping">校验</button>
          <p v-if="typingResult" :class="typingResult.pass ? 'ok' : 'no'">
            {{ typingResult.pass ? '✅ 完全正确！' : `❌ ${typingResult.wrong} 处不同（红=原文你缺的）` }}
          </p>
          <p v-if="typingResult && !typingResult.pass" class="diff">
            <span v-for="(d, i) in typingResult.diffs" :key="i" :class="{ bad: !d.ok }">{{ d.ch }}</span>
          </p>
        </details>
      </template>

      <!-- 模式B 听→预测→跟读 -->
      <template v-else>
        <!-- 盲听阶段：不给看文字 -->
        <div v-if="phase === 'listen'" class="phase">
          <p class="phase-tip">先只听，不要跟读。听到某一遍你能<strong>预测下一句</strong>了，再解锁。顺序不能反（鹦鹉学舌无效）。</p>
          <button class="biggest" @click="listenOnce">🔊 盲听（第 {{ cur.listens + 1 }} 遍）</button>
          <button class="big primary" :disabled="cur.listens < 2" @click="unlockPredict">
            {{ cur.listens < 2 ? `至少听 ${2 - cur.listens} 遍后解锁` : '✅ 我能预测了 → 开始跟读' }}
          </button>
        </div>

        <div v-else-if="phase === 'shadow'" class="phase">
          <p class="en">{{ cur.en }}</p>
          <p class="zh">{{ cur.zh }}</p>
          <div class="bar"><div :style="{ width: Math.min(100, (cur.shadowReps / 5) * 100) + '%' }" /></div>
          <p class="phase-tip">跟读（同步或延迟都可以），嘴巴能跟着原音发出声即可。目标是第 3-6 遍时不看也能脱口而出。</p>
          <div class="acts">
            <button class="big" @click="speak(cur.en)">🔊 原音</button>
            <button class="big primary" @click="shadowOnce">🗣 我跟读了一遍（{{ cur.shadowReps }}/5）</button>
          </div>
          <button class="big" style="margin-top:10px" @click="startRecall">💪 脱口而出自测 →</button>
        </div>

        <div v-else class="phase">
          <p class="phase-tip">看中文，遮住英文，<strong>大声说出英文</strong>，然后核对。</p>
          <p class="zh big-text">{{ cur.zh }}</p>
          <button v-if="!showAnswer" class="big primary" @click="showAnswer = true">👁 显示答案</button>
          <template v-else>
            <p class="en">{{ cur.en }}</p>
            <div class="acts">
              <button class="big ok-btn" @click="recallOk">✅ 说对了（错题解除标红）</button>
              <button class="big no-btn" @click="recallFail">❌ 卡住了 → 标红，明天优先</button>
            </div>
          </template>
        </div>
      </template>

      <div class="nav">
        <button @click="prev">← 上一句</button>
        <button @click="next">下一句 →</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.seg { display: inline-flex; border: 1px solid var(--vp-c-border); border-radius: 10px; overflow: hidden; }
.seg button { border: none; border-radius: 0; margin: 0; padding: 8px 14px; background: transparent; }
.seg button.on { background: var(--vp-button-brand-bg, #345c13); color: #fff; }
.scope { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.scope select { width: auto; padding: 6px 8px; }
.count { font-size: 12px; color: var(--vp-c-text-3); }
.empty {
  text-align: center; color: var(--vp-c-text-3); padding: 40px 0;
  border: 1px dashed var(--vp-c-border); border-radius: 12px;
}
.card { border: 1px solid var(--vp-c-border); border-radius: 14px; padding: 20px; background: var(--vp-c-bg); }
.meta { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 13px; color: var(--vp-c-text-3); }
.tag.red { color: var(--vp-c-danger-1); font-weight: 700; }
.en { font-size: 22px; font-weight: 700; line-height: 1.4; margin: 6px 0; }
.zh { color: var(--vp-c-text-2); margin: 4px 0 12px; }
.big-text { font-size: 20px !important; font-weight: 600; }
.bar { height: 6px; background: var(--vp-c-divider); border-radius: 3px; overflow: hidden; margin: 10px 0; }
.bar div { height: 100%; background: var(--vp-button-brand-bg, #345c13); transition: width .3s; }
.acts { display: flex; gap: 10px; flex-wrap: wrap; }
button {
  padding: 9px 16px; border-radius: 10px; border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 14px; margin-top: 10px;
}
.big { flex: 1; min-width: 160px; padding: 14px; font-size: 15px; }
.biggest { width: 100%; padding: 26px; font-size: 20px; }
.primary { background: var(--vp-button-brand-bg, #345c13); color: #fff; border: none; }
.ok-btn { background: var(--vp-button-alt-bg, #e3e3e3); }
.no-btn { background: var(--vp-c-danger-1, #e5484d); color: #fff; border: none; }
button:disabled { opacity: .45; cursor: not-allowed; }
.phase-tip { font-size: 13px; color: var(--vp-c-text-3); margin: 6px 0 12px; }
.hand { margin-top: 16px; font-size: 14px; }
.hand summary { cursor: pointer; color: var(--vp-c-text-2); }
.hand input { width: 100%; box-sizing: border-box; margin: 10px 0 6px; padding: 8px 10px; border: 1px solid var(--vp-c-border); border-radius: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.hand .ok { color: var(--vp-c-green-1, #10b981); }
.hand .no { color: var(--vp-c-danger-1); }
.diff { line-height: 1.9; letter-spacing: .5px; }
.diff .bad { color: var(--vp-c-danger-1); background: color-mix(in srgb, var(--vp-c-danger-1) 14%, transparent); border-radius: 3px; padding: 0 1px; }
.nav { display: flex; justify-content: space-between; margin-top: 18px; }
.phase { display: grid; gap: 4px; }
</style>

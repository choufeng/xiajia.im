<script setup>
// 21 天成人英语训练营 · 主壳
// 方法论：docs/research/brain-xueba-videos/（视频1 21天四步法 × 视频2 Mikel AI 法）
import { ref, computed, onMounted } from 'vue'
import { store, refreshVoices, enVoices } from './store.js'
import { syncState, enableSync, disableSync, resumeSync } from './sync.js'
import Generator from './Generator.vue'
import Practice from './Practice.vue'
import Review from './Review.vue'

const tab = ref('generate') // generate | practice | review
const showSettings = ref(false)
const showGuide = ref(false)
const voicesReady = ref(false)

// 多端同步（配对码模式，详见 docs/research/convex-backend-feasibility.md）
const pairInput = ref('')
const STATUS_TEXT = {
  off: '未开启',
  connecting: '连接中…',
  online: '已同步',
  offline: '离线（本地可用，恢复网络后自动续传）',
  error: '异常',
}
const syncStatusText = computed(() => STATUS_TEXT[syncState.status] || syncState.status)
function startSync() {
  const ok = enableSync()
  if (ok) pairInput.value = ''
}
function joinSync() {
  const key = pairInput.value.trim()
  if (!key) return
  enableSync(key)
  pairInput.value = ''
}
async function copyPairKey() {
  try { await navigator.clipboard.writeText(syncState.key) } catch {}
}

onMounted(() => {
  refreshVoices()
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { refreshVoices(); voicesReady.value = true }
  }
  voicesReady.value = enVoices().length > 0
  if (!store.onboarded) { showGuide.value = true; store.onboarded = true }
  resumeSync() // 之前开过同步的设备自动恢复
})

const tabs = [
  { key: 'generate', label: '① 语句库', desc: '万用模板 → AI 生成' },
  { key: 'practice', label: '② 练习', desc: '四道并行 / 听→预测→跟读' },
  { key: 'review', label: '③ 复习', desc: 'D2·D7·D30 + 错题库' },
]
</script>

<template>
  <div class="app">
    <header class="head">
      <div class="title-wrap">
        <h2>🎯 21 天成人英语训练营</h2>
        <p class="sub">场景 → 语句库 → 四道并行 → 强制开口。每天 20 分钟，一个人，不需要补习班。</p>
      </div>
      <div class="head-ops">
        <button class="ghost" @click="showGuide = true">📖 方法论</button>
        <button class="ghost" @click="showSettings = true">⚙ 设置</button>
      </div>
    </header>

    <nav class="tabs">
      <button v-for="t in tabs" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">
        <span class="t-label">{{ t.label }}</span>
        <span class="t-desc">{{ t.desc }}</span>
      </button>
    </nav>

    <Generator v-if="tab === 'generate'" @practiced="tab = 'practice'" />
    <Practice v-else-if="tab === 'practice'" />
    <Review v-else />

    <!-- 设置 -->
    <div v-if="showSettings" class="mask" @click.self="showSettings = false">
      <div class="modal">
        <h3>⚙ 设置</h3>
        <label>API Base（OpenAI 兼容）
          <input v-model="store.settings.apiBase" placeholder="https://api.deepseek.com/v1" />
        </label>
        <label>API Key（仅存本机 localStorage，直连你所选服务）
          <input v-model="store.settings.apiKey" type="password" placeholder="sk-…" />
        </label>
        <label>模型
          <input v-model="store.settings.model" placeholder="deepseek-v4-flash" />
        </label>
        <label>朗读音色（视频2：你听什么音色，跟读后就输出什么口音——选定后不要常换）
          <select v-model="store.settings.voiceName">
            <option value="">（系统默认）</option>
            <option v-for="v in enVoices()" :key="v.name" :value="v.name">{{ v.name }} ({{ v.lang }})</option>
          </select>
        </label>
        <label>朗读速度 <b>{{ store.settings.rate }}x</b>
          <input v-model.number="store.settings.rate" type="range" min="0.5" max="1.2" step="0.05" />
        </label>

        <!-- 多端同步（实验性） -->
        <div class="sync-box">
          <h4>☁ 多端同步（实验性）</h4>
          <template v-if="!syncState.enabled">
            <button class="ghost wide" @click="startSync">生成配对码，开启同步</button>
            <div class="pair-row">
              <input v-model="pairInput" placeholder="或粘贴其他设备的配对码加入" />
              <button class="ghost" @click="joinSync">加入</button>
            </div>
            <p v-if="syncState.error" class="sync-err">{{ syncState.error }}</p>
            <p class="sync-tip">数据仍以本机 localStorage 为主，联网时双向同步；API Key 永不上传。</p>
          </template>
          <template v-else>
            <p class="pair-code" title="点击复制配对码，在其他设备粘贴即可加入" @click="copyPairKey">
              配对码：<code>{{ syncState.key }}</code>
            </p>
            <p class="sync-status">
              <span :class="['dot', syncState.status]"></span>
              {{ syncStatusText }} · {{ syncState.deviceCount }} 台设备
              <span v-if="syncState.error" class="sync-err">（{{ syncState.error }}）</span>
            </p>
            <button class="ghost wide" @click="disableSync">停止同步（数据保留在本机）</button>
          </template>
        </div>

        <button class="primary" @click="showSettings = false">完成</button>
      </div>
    </div>

    <!-- 方法论速查 -->
    <div v-if="showGuide" class="mask" @click.self="showGuide = false">
      <div class="modal guide">
        <h3>📖 方法论速查</h3>
        <section>
          <h4>每天 20 分钟四步（视频1 · brain 學霸 21 天法）</h4>
          <ol>
            <li><b>选定战场</b>：只选一个具体场景（如线上开会发言）。没有具体场景 = 先别学，先做决定。</li>
            <li><b>AI 建语句库</b>：万用模板只有两个变量——场景 + 你最常遇到的问题。越具体，句子越能直接用。</li>
            <li><b>四道并行</b>：眼看、口念、耳听、手写，同一句 10-15 遍。小孩要 1000 次，成人 15 次（理解式记忆）。</li>
            <li><b>AI 强制开口</b>：每天 5-10 分钟对着 AI 说话（本站对话陪练为 Phase 3，当前可配合 ChatGPT 语音）。</li>
          </ol>
        </section>
        <section>
          <h4>Excel 错题库（视频2 · Mikel）</h4>
          <p>看中文遮英文说出英文：说对跳过，卡住<b>标红</b>，标红句<b>明天优先</b>。"Mark the ones that hard, move on, come back tomorrow."</p>
        </section>
        <section>
          <h4>听→预测→跟读（顺序不能反）</h4>
          <p>先盲听至你能预测下一句，再跟读 3-6 遍直到脱口而出。不熟就跟读 = 鹦鹉学舌。</p>
        </section>
        <section>
          <h4>Week 1 全红是正常的（90% 的人死在第一周）</h4>
          <p>W1 everything is hard → W2 recall 20-30% → W3 clicking（刷牙时突然脱口而出）→ W4 basic conversation → W6 genuinely conversational。<b>卡住说不出 = 学习正在发生</b>（突触在重连）。Week 1 最大杀手是中途查词打断节奏——预习做足可免疫。</p>
        </section>
        <section>
          <h4>间隔复习（备忘录法）</h4>
          <p>每句三个打卡：第 2 天、第 7 天、第 30 天。365 句 × 可用率 ~100% > 5000 词 × 可用率 5%。</p>
        </section>
        <p class="src">完整研究见 <a href="/research/brain-xueba-videos/feasibility-plan">可行性方案</a></p>
        <button class="primary" @click="showGuide = false">开始训练</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app { max-width: 780px; margin: 0 auto; }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
h2 { margin: 0 0 4px; font-size: 22px; }
.sub { margin: 0; font-size: 13px; color: var(--vp-c-text-2); }
.head-ops { display: flex; gap: 8px; flex-shrink: 0; }
.ghost {
  padding: 6px 12px; font-size: 13px; border-radius: 8px;
  border: 1px solid var(--vp-c-border); background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer;
}
.tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
.tabs button {
  display: grid; gap: 2px; padding: 10px 8px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--vp-c-border); background: var(--vp-c-bg); color: var(--vp-c-text-1); text-align: center;
}
.tabs button.on { border-color: var(--vp-button-brand-bg, #345c13); background: color-mix(in srgb, var(--vp-button-brand-bg, #345c13) 10%, var(--vp-c-bg)); }
.t-label { font-weight: 700; font-size: 15px; }
.t-desc { font-size: 11px; color: var(--vp-c-text-3); }
.mask {
  position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 60;
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: var(--vp-c-bg); border-radius: 16px; padding: 24px; max-width: 520px; width: 100%;
  max-height: 82vh; overflow: auto; display: grid; gap: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
}
.modal h3 { margin: 0; }
.modal label { display: grid; gap: 4px; font-size: 13px; color: var(--vp-c-text-2); }
.modal input, .modal select {
  padding: 8px 10px; border: 1px solid var(--vp-c-border); border-radius: 8px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 14px;
}
.modal .primary {
  padding: 10px; border: none; border-radius: 9px; cursor: pointer;
  background: var(--vp-button-brand-bg, #345c13); color: #fff; font-size: 14px;
}
.guide section { font-size: 13.5px; line-height: 1.7; }
.guide h4 { margin: 0 0 6px; font-size: 14px; }
.guide ol, .guide p { margin: 0 0 4px; padding-left: 4px; }
.src { font-size: 12px; color: var(--vp-c-text-3); }

/* 多端同步 */
.sync-box {
  border: 1px dashed var(--vp-c-border); border-radius: 10px;
  padding: 12px; display: grid; gap: 8px; font-size: 13px;
}
.sync-box h4 { margin: 0; font-size: 13px; }
.sync-box .wide { width: 100%; }
.pair-row { display: flex; gap: 6px; }
.pair-row input { flex: 1; min-width: 0; font-size: 12px; }
.pair-code { margin: 0; cursor: pointer; word-break: break-all; }
.pair-code code { font-size: 11px; padding: 2px 6px; border-radius: 6px; background: var(--vp-c-bg-alt); border: 1px solid var(--vp-c-border); }
.sync-status { margin: 0; color: var(--vp-c-text-2); }
.sync-tip { margin: 0; font-size: 11.5px; color: var(--vp-c-text-3); }
.sync-err { margin: 0; font-size: 12px; color: var(--vp-c-danger-1, #e5484d); }
.dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  margin-right: 4px; vertical-align: middle; background: var(--vp-c-text-3);
}
.dot.online { background: var(--vp-button-brand-bg, #3c8772); }
.dot.offline, .dot.connecting { background: #e0a03c; }
.dot.error { background: var(--vp-c-danger-1, #e5484d); }
@media (max-width: 640px) {
  .tabs { grid-template-columns: 1fr; }
  .head { flex-direction: column; }
}
</style>

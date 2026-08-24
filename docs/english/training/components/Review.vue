<script setup>
// 模块6 · 复习系统（视频1 备忘录三打卡 D2/D7/D30 + 视频2 Excel 标红→明日优先）
import { ref, computed } from 'vue'
import {
  store, stats, dueReviews, MILESTONES, addDays, todayStr,
  markMilestone, markRed, removeSentence, updateSentence,
  exportJSON, importJSON, scenarioName, speak, chat, addSentence,
} from './store.js'

const tab = ref('today') // today | red | all
const st = computed(() => stats())
const { red, due } = dueReviews()

// 今日队列：标红优先
const queue = computed(() => [...red, ...due])
const curIdx = ref(0)
const cur = computed(() => queue.value[curIdx.value] || null)
const showAnswer = ref(false)

function pass() {
  if (!cur.value) return
  // 打卡最早一个未完成的里程碑
  const m = MILESTONES.find((m) => !cur.value.review[m.key])
  if (m) markMilestone(cur.value.id, m.key)
  if (cur.value.red) markRed(cur.value.id, false)
  showAnswer.value = false
  curIdx.value = Math.min(curIdx.value, Math.max(queue.value.length - 2, 0))
}
function fail() {
  if (cur.value) markRed(cur.value.id, true)
  showAnswer.value = false
}

// 变体句生成（视频2 brain學霸改良：标红句→AI 生成 5 个变体防机械）
const variantLoading = ref(false)
const variantErr = ref('')
async function makeVariants(s) {
  variantErr.value = ''
  variantLoading.value = true
  try {
    const content = await chat([
      { role: 'system', content: '你是英语口语教练。只输出 JSON。' },
      {
        role: 'user',
        content: `基于这个句子的意思，生成 5 个不同的口语表达变体（可用不同词组/句型，保持同一用途）。输出 JSON：{"sentences":[{"en":"...","zh":"..."}]}\n句子：${s.en}`,
      },
    ], { json: true })
    const m = content.trim().match(/\{[\s\S]*\}/)
    const obj = JSON.parse(m ? m[0] : content)
    const list = (obj.sentences || []).slice(0, 5)
    for (const v of list) {
      if (v.en) addSentence({ scenarioId: s.scenarioId, zh: v.zh || s.zh, en: v.en, source: 'variant' })
    }
  } catch (e) {
    variantErr.value = e.message || String(e)
  } finally {
    variantLoading.value = false
  }
}

// 管理过滤
const filterScenario = ref('all')
const allList = computed(() => {
  let list = store.sentences.slice().sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  if (filterScenario.value !== 'all') list = list.filter((s) => s.scenarioId === filterScenario.value)
  return list
})
const editing = ref(null) // id
const editZh = ref('')
const editEn = ref('')
function startEdit(s) { editing.value = s.id; editZh.value = s.zh; editEn.value = s.en }
function saveEdit(s) { updateSentence(s.id, { zh: editZh.value, en: editEn.value }); editing.value = null }

// 里程碑显示
function milestoneInfo(s) {
  return MILESTONES.map((m) => ({
    label: m.label,
    date: addDays(s.addedAt, m.days),
    done: !!s.review[m.key],
  }))
}

// 导入导出
const fileInput = ref(null)
function doExport() {
  const blob = new Blob([exportJSON()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `english-training-${todayStr()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
async function doImport(e) {
  const f = e.target.files?.[0]
  if (!f) return
  try { await importJSON(await f.text()); alert('导入成功') }
  catch (err) { alert(`导入失败：${err.message}`) }
}
</script>

<template>
  <div class="review">
    <div class="statbar">
      <span>总句数 <b>{{ st.total }}</b></span>
      <span>🔴 待攻克 <b>{{ st.red }}</b></span>
      <span>📅 今日到期 <b>{{ st.due }}</b></span>
      <span>🌱 未满15遍 <b>{{ st.fresh }}</b></span>
      <span>🔥 今日已练 <b>{{ st.todayReps }}</b> 遍</span>
    </div>

    <div class="seg">
      <button :class="{ on: tab === 'today' }" @click="tab = 'today'">今日队列（{{ queue.length }}）</button>
      <button :class="{ on: tab === 'red' }" @click="tab = 'red'">错题库（{{ red.length }}）</button>
      <button :class="{ on: tab === 'all' }" @click="tab = 'all'">全部句子</button>
    </div>

    <!-- 今日队列 -->
    <div v-if="tab === 'today'" class="card">
      <template v-if="!queue.length">
        <p class="empty">🎉 今天没有到期的复习。去「语句库」生成新句，或「练习」磨新句。</p>
      </template>
      <template v-else-if="!cur">
        <p class="empty">今日队列已清空 ✅</p>
      </template>
      <template v-else>
        <p class="tip">看中文 → 遮住英文 → <strong>大声说</strong> → 核对。（视频2 Excel 三栏法）</p>
        <p class="zh">{{ cur.zh }}</p>
        <button v-if="!showAnswer" class="primary big" @click="showAnswer = true; speak(cur.en)">👁 显示答案并朗读</button>
        <template v-else>
          <p class="en">{{ cur.en }}</p>
          <div class="acts">
            <button class="big ok-btn" @click="pass">✅ 说对了（打卡{{ red.length ? ' / 解除标红' : '' }}）</button>
            <button class="big no-btn" @click="fail">❌ 卡住 → 标红</button>
            <button class="big" :disabled="variantLoading" @click="makeVariants(cur)">
              {{ variantLoading ? '生成中…' : '🧬 生成 5 个变体句（防机械）' }}
            </button>
          </div>
        </template>
        <p v-if="variantErr" class="err">{{ variantErr }}</p>
      </template>
    </div>

    <!-- 错题库 -->
    <div v-else-if="tab === 'red'" class="list">
      <p v-if="!red.length" class="empty">没有标红句。练习/复习中说不出时会自动进入这里（明天优先练）。</p>
      <div v-for="s in red" :key="s.id" class="item red-item">
        <div class="texts">
          <p class="en">{{ s.en }}</p>
          <p class="zh">{{ s.zh }}</p>
          <p class="meta">标红 {{ s.redCount }} 次 ｜ {{ scenarioName(s.scenarioId) }}</p>
        </div>
        <div class="ops">
          <button @click="speak(s.en)">🔊</button>
          <button @click="makeVariants(s)" :disabled="variantLoading">🧬 变体</button>
          <button class="ok-btn" @click="markRed(s.id, false)">✔ 攻克</button>
        </div>
      </div>
    </div>

    <!-- 全部句子 -->
    <div v-else class="list">
      <div class="toolbar">
        <select v-model="filterScenario">
          <option value="all">全部场景</option>
          <option v-for="sc in store.scenarios" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
        </select>
        <button @click="doExport">📤 导出</button>
        <button @click="fileInput?.click()">📥 导入</button>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="doImport" />
      </div>
      <div v-for="s in allList" :key="s.id" class="item">
        <div class="texts">
          <template v-if="editing === s.id">
            <input v-model="editEn" class="en" />
            <input v-model="editZh" class="zh" />
          </template>
          <template v-else>
            <p class="en">{{ s.en }} <span v-if="s.red" class="reddot">🔴</span></p>
            <p class="zh">{{ s.zh }}</p>
            <p class="meta">
              {{ scenarioName(s.scenarioId) }} ｜ 念 {{ s.repsTotal }} 遍
              <span v-for="m in milestoneInfo(s)" :key="m.label" class="mile" :class="{ done: m.done }">
                {{ m.label }}{{ m.done ? '✔' : '' }}
              </span>
            </p>
          </template>
        </div>
        <div class="ops">
          <button @click="speak(s.en)">🔊</button>
          <template v-if="editing === s.id">
            <button class="ok-btn" @click="saveEdit(s)">存</button>
          </template>
          <template v-else>
            <button @click="startEdit(s)">✏️</button>
          </template>
          <button @click="markRed(s.id, !s.red)">{{ s.red ? '↩️取消红' : '🔴' }}</button>
          <button @click="removeSentence(s.id)">🗑</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.statbar { display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; color: var(--vp-c-text-2); margin-bottom: 14px; }
.statbar b { color: var(--vp-c-text-1); }
.seg { display: inline-flex; border: 1px solid var(--vp-c-border); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
.seg button { border: none; border-radius: 0; margin: 0; padding: 8px 14px; background: transparent; }
.seg button.on { background: var(--vp-button-brand-bg, #345c13); color: #fff; }
.card { border: 1px solid var(--vp-c-border); border-radius: 14px; padding: 22px; background: var(--vp-c-bg); }
.tip { font-size: 13px; color: var(--vp-c-text-3); }
.zh { font-size: 19px; font-weight: 600; margin: 10px 0; }
.en { font-size: 17px; font-weight: 600; margin: 6px 0; }
.reddot { font-size: 13px; }
.empty { text-align: center; color: var(--vp-c-text-3); padding: 24px 0; }
.acts { display: flex; gap: 10px; flex-wrap: wrap; }
button {
  padding: 8px 14px; border-radius: 9px; border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 13px; margin-top: 8px;
}
.big { flex: 1; min-width: 150px; padding: 13px; font-size: 14px; }
.primary { background: var(--vp-button-brand-bg, #345c13); color: #fff; border: none; }
.ok-btn { background: var(--vp-c-green-soft, #e6f6ec); }
.no-btn { background: var(--vp-c-danger-1, #e5484d); color: #fff; border: none; }
button:disabled { opacity: .5; cursor: not-allowed; }
.list { display: grid; gap: 10px; }
.toolbar { display: flex; gap: 10px; margin-bottom: 6px; }
.toolbar select { padding: 6px 8px; border: 1px solid var(--vp-c-border); border-radius: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.item { display: flex; gap: 12px; justify-content: space-between; border: 1px solid var(--vp-c-border); border-radius: 12px; padding: 12px 14px; }
.red-item { border-color: color-mix(in srgb, var(--vp-c-danger-1) 45%, var(--vp-c-border)); }
.texts { flex: 1; min-width: 0; }
.texts .zh { color: var(--vp-c-text-2); font-size: 14px; font-weight: 400; }
.texts .meta { font-size: 12px; color: var(--vp-c-text-3); margin: 4px 0 0; }
.mile { margin-left: 8px; opacity: .55; }
.mile.done { opacity: 1; color: var(--vp-c-green-1, #10b981); }
.texts input { width: 100%; box-sizing: border-box; padding: 6px 8px; margin: 2px 0; border: 1px solid var(--vp-c-border); border-radius: 7px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.texts input.en { font-weight: 600; }
.ops { display: flex; gap: 6px; align-items: flex-start; flex-shrink: 0; }
.err { color: var(--vp-c-danger-1); font-size: 13px; }
</style>

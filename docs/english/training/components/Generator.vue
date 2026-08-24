<script setup>
// 模块2 · AI 语句库生成器（视频1·步骤2 万用模板 + 视频2·口语化强调）
import { ref, computed } from 'vue'
import { store, addScenario, addSentence, chat, scenarioName } from './store.js'

const props = defineProps({ active: Boolean })
const emit = defineEmits(['practiced'])

// 表单
const scenarioMode = ref('existing')
const scenarioId = ref(store.scenarios[0]?.id || '')
const newScenarioName = ref('')
const problem = ref('')
const level = ref('中等')
const spoken = ref(true)
const count = ref(5)

const loading = ref(false)
const error = ref('')
const results = ref([]) // [{en, zh, keep:true}]

const levels = ['简单', '中等', '挑战']

const canGenerate = computed(() =>
  problem.value.trim().length >= 5 &&
  (scenarioMode.value === 'existing' ? !!scenarioId.value : newScenarioName.value.trim().length >= 2)
)

function buildPrompt() {
  const scene = scenarioMode.value === 'existing' ? scenarioName(scenarioId.value) : newScenarioName.value.trim()
  const spokenRule = spoken.value
    ? '要求全部是真实口语（spoken English），绝不要书面语或 textbook English；像母语者在真实场合脱口而出的话。'
    : '用自然、地道的表达。'
  return [
    { role: 'system', content: '你是英语口语教练，擅长为成人学习者生成马上能用的真实口语句子。只输出 JSON。' },
    {
      role: 'user',
      content:
        `我需要在「${scene}」场景里说英文。我最常遇到的问题是：${problem.value.trim()}。` +
        `请帮我生成 ${count.value} 个自然口语的英文回答，难度${level.value}。${spokenRule}` +
        `每个句子附地道中文翻译。输出 JSON：{"sentences":[{"en":"...","zh":"..."}]}`,
    },
  ]
}

async function generate() {
  error.value = ''
  results.value = []
  loading.value = true
  try {
    let content = await chat(buildPrompt(), { json: true })
    content = content.trim().replace(/^```(json)?/m, '').replace(/```$/m, '')
    const m = content.match(/\{[\s\S]*\}/)
    const obj = JSON.parse(m ? m[0] : content)
    const list = obj.sentences || obj.list || obj.data || []
    if (!Array.isArray(list) || !list.length) throw new Error('返回里没有句子')
    results.value = list.slice(0, 12).map((x) => ({ en: String(x.en || ''), zh: String(x.zh || ''), keep: true }))
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  const keep = results.value.filter((r) => r.keep && r.en.trim())
  if (!keep.length) return
  let sid = scenarioMode.value === 'existing' ? scenarioId.value : null
  if (!sid) sid = addScenario(newScenarioName.value.trim()).id
  for (const r of keep) addSentence({ scenarioId: sid, zh: r.zh, en: r.en, source: 'generated' })
  results.value = []
  problem.value = ''
  emit('practiced')
}
</script>

<template>
  <div class="gen">
    <div class="card">
      <h3>① 选定你的战场</h3>
      <div class="row">
        <label><input type="radio" value="existing" v-model="scenarioMode" /> 已有场景</label>
        <label><input type="radio" value="new" v-model="scenarioMode" /> 新建场景</label>
      </div>
      <select v-if="scenarioMode === 'existing'" v-model="scenarioId">
        <option v-for="s in store.scenarios" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <input v-else v-model="newScenarioName" placeholder="新场景名，如：家长会讨论 / 志愿者活动" />

      <h3 style="margin-top:16px">② 你最常遇到的问题（越具体，AI 给的句子越能直接用）</h3>
      <textarea
        v-model="problem" rows="3"
        placeholder="例：别人说完轮到我发言，我不知道该怎么开口……别人通常会怎么问、我通常会怎么答、我的难点是什么，都可以写进来"
      />

      <div class="row" style="margin-top:12px">
        <label>难度
          <select v-model="level"><option v-for="l in levels" :key="l">{{ l }}</option></select>
        </label>
        <label>数量
          <select v-model.number="count"><option v-for="n in [3,5,8,10]" :key="n" :value="n">{{ n }}</option></select>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="spoken" /> 真实口语（不要书面语）
        </label>
      </div>

      <button class="primary" :disabled="!canGenerate || loading" @click="generate">
        {{ loading ? '生成中…' : '⚡ 生成口语句子' }}
      </button>
      <p v-if="error" class="err">{{ error }}</p>
    </div>

    <div v-if="results.length" class="card">
      <h3>③ 勾选入库（可先编辑）</h3>
      <div v-for="(r, i) in results" :key="i" class="result">
        <label class="keep">
          <input type="checkbox" v-model="r.keep" />
        </label>
        <div class="texts">
          <input v-model="r.en" class="en" />
          <input v-model="r.zh" class="zh" />
        </div>
      </div>
      <div class="row">
        <button class="primary" @click="saveAll">📥 全部入库（{{ results.filter(r => r.keep).length }} 句）</button>
        <button @click="results = []">丢弃</button>
      </div>
      <p class="hint">入库后去「练习」开始四道并行 / 听→预测→跟读。</p>
    </div>
  </div>
</template>

<style scoped>
.gen { display: grid; gap: 16px; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
select, input, textarea {
  width: 100%; box-sizing: border-box; padding: 8px 10px; margin-top: 6px;
  border: 1px solid var(--vp-c-border); border-radius: 8px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 14px;
}
textarea { resize: vertical; }
.row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.row label { display: flex; align-items: center; gap: 6px; font-size: 14px; white-space: nowrap; }
button {
  padding: 8px 16px; border-radius: 8px; border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 14px;
}
button.primary { background: var(--vp-button-brand-bg, #345c13); color: #fff; border: none; }
button.primary:disabled { opacity: .5; cursor: not-allowed; }
button { margin-top: 14px; }
.err { color: var(--vp-c-danger-1); font-size: 13px; }
.hint { color: var(--vp-c-text-3); font-size: 12px; margin: 10px 0 0; }
.result { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
.keep { padding-top: 8px; }
.texts { flex: 1; display: grid; gap: 4px; }
.texts input { margin-top: 0; }
.texts .en { font-weight: 600; }
.texts .zh { color: var(--vp-c-text-2); font-size: 13px; }
</style>

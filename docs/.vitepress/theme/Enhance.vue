<script setup>
/**
 * 阅读增强：顶部进度条 + 滚动入场动画 + 「工程师视角」callout 标记
 * 零依赖，纯 IntersectionObserver。
 * 仅作用于 .vp-doc 文档页；首页不挂载。
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const progressEl = ref(null)
let io = null

// 命中「工程师视角」引用块 → 加 class（纯 CSS 选不到文本，故 JS 标记）
function markEngineer() {
  document.querySelectorAll('.vp-doc blockquote').forEach(bq => {
    if (bq.classList.contains('callout-engineer')) return
    const head = bq.textContent.trim().slice(0, 6)
    if (head.includes('工程师视角')) {
      bq.classList.add('callout-engineer')
    }
  })
}

// 重点元素滚入淡入上移（标题/图/代码/引用/表格）
function setupReveal() {
  const targets = document.querySelectorAll(
    '.vp-doc h2, .vp-doc h3, .vp-doc blockquote, .vp-doc img, .vp-doc div[class*="language-"], .vp-doc table'
  )
  targets.forEach(el => el.classList.add('reveal'))
  if (io) io.disconnect()
  io = new IntersectionObserver(
    entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-in')
          io.unobserve(e.target)
        }
      })
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0 }
  )
  targets.forEach(el => io.observe(el))
}

function enhance() {
  markEngineer()
  setupReveal()
}

function onScroll() {
  if (!progressEl.value) return
  const h = document.documentElement
  const total = h.scrollHeight - h.clientHeight
  progressEl.value.style.width = total > 0 ? (h.scrollTop / total) * 100 + '%' : '0%'
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  nextTick(enhance)
})

watch(() => route.path, () => nextTick(enhance))

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (io) io.disconnect()
})
</script>

<template>
  <div ref="progressEl" class="reading-progress" aria-hidden="true" />
</template>

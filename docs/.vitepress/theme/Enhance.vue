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
  injectReadingTime()
  setupLightbox()
}

// 图片点击放大（lightbox）：正文内图片点击 → 全屏遮罩
function setupLightbox() {
  document.querySelectorAll('.vp-doc img').forEach(img => {
    if (img.dataset.lb) return
    img.dataset.lb = '1'
    img.style.cursor = 'zoom-in'
    img.addEventListener('click', () => {
      const overlay = document.createElement('div')
      overlay.className = 'lb-overlay'
      overlay.innerHTML = `<img src="${img.src}" alt="${img.alt || ''}">`
      overlay.addEventListener('click', () => overlay.remove())
      document.body.appendChild(overlay)
      requestAnimationFrame(() => overlay.classList.add('lb-show'))
    })
  })
}

// 阅读时长徽章：中文字/分钟 + 英文词/分钟
function injectReadingTime() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return
  const h1 = doc.querySelector('h1')
  if (!h1 || h1.querySelector('.reading-time-badge')) return
  const text = doc.textContent || ''
  const cjk = (text.match(/[一-鿿]/g) || []).length
  const words = (text.match(/[a-zA-Z]+/g) || []).length
  if (cjk + words < 200) return // 太短不显示
  const minutes = Math.max(1, Math.round(cjk / 300 + words / 200))
  const badge = document.createElement('span')
  badge.className = 'reading-time-badge'
  badge.textContent = `· 约 ${minutes} 分钟`
  h1.appendChild(badge)
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

watch(() => route.path, () => {
  nextTick(enhance)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  if (io) io.disconnect()
})
</script>

<template>
  <div ref="progressEl" class="reading-progress" aria-hidden="true" />
</template>

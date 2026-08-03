<script setup>
/**
 * 阅读增强：顶部进度条 + 滚动入场动画 + 「工程师视角」callout 标记
 * 零依赖，纯 IntersectionObserver。
 * 文档页负责正文增强，首页负责卡片几何图案注入。
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const progressEl = ref(null)
let io = null

// 图标 SVG 生成器：统一线性语言（描边 1.8、圆角、currentColor）
const ic = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

// 左上角线性图标：白色统一描边，靠图形语义表达主题（读书=书/AI=神经网络/...）
const ICON_ART = {
  '/reading/':   ic('<path d="M12 7v13"/><path d="M4 5.5h5.5a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 5.5h-5.5A2.5 2.5 0 0 0 12 8v12a2.5 2.5 0 0 1 2.5-2.5H20z"/>'),
  '/ai/':        ic('<circle cx="12" cy="12" r="2.5"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="19.5" cy="6" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/><circle cx="19.5" cy="18" r="1.5"/><path d="M6 7l4 3.5M18 7l-4 3.5M6 17l4-3.5M18 17l-4-3.5"/>'),
  '/english/':   ic('<path d="M12 4L5 19"/><path d="M12 4l7 15"/><path d="M8.5 13h7"/>'),
  '/coding/':    ic('<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/>'),
  '/cognition/': ic('<path d="M9.5 18h5"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.8 10.6c.8.7 1.3 1.6 1.5 2.4h4.6c.2-.8.7-1.7 1.5-2.4A6 6 0 0 0 12 3z"/>'),
  '/papers/':    ic('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>'),
  '/speaking/':  ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  '/reference/': ic('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
}

// 首页卡片右下角彩色几何图案（8 种抽象图形 + 鲜艳渐变）
const CARD_ART = {
  '/reading/': `<svg viewBox="0 0 100 100" fill="none"><defs><linearGradient id="art1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><g stroke="url(#art1)" stroke-width="2.5"><circle cx="92" cy="92" r="16"/><circle cx="92" cy="92" r="30"/><circle cx="92" cy="92" r="44"/><circle cx="92" cy="92" r="58"/></g></svg>`,
  '/ai/': `<svg viewBox="0 0 100 100"><defs><linearGradient id="art2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><g fill="url(#art2)"><circle cx="68" cy="68" r="3"/><circle cx="80" cy="68" r="4"/><circle cx="92" cy="68" r="5"/><circle cx="68" cy="80" r="4"/><circle cx="80" cy="80" r="6"/><circle cx="94" cy="82" r="8"/><circle cx="68" cy="92" r="5"/><circle cx="82" cy="94" r="7"/><circle cx="96" cy="96" r="10"/></g></svg>`,
  '/english/': `<svg viewBox="0 0 100 100"><defs><linearGradient id="art3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06b6d4"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs><g stroke="url(#art3)" stroke-width="4"><line x1="50" y1="100" x2="100" y2="50"/><line x1="62" y1="100" x2="100" y2="62"/><line x1="74" y1="100" x2="100" y2="74"/><line x1="86" y1="100" x2="100" y2="86"/><line x1="38" y1="92" x2="92" y2="38"/></g></svg>`,
  '/coding/': `<svg viewBox="0 0 100 100" fill="none"><defs><linearGradient id="art4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#eab308"/></linearGradient></defs><g stroke="url(#art4)" stroke-width="2"><path d="M55 55 L80 55 L80 80 L100 80 M80 55 L100 55 M55 80 L55 100 M80 80 L100 80"/><circle cx="55" cy="55" r="4" fill="url(#art4)"/><circle cx="80" cy="80" r="4" fill="url(#art4)"/><circle cx="100" cy="100" r="5" fill="url(#art4)"/></g></svg>`,
  '/cognition/': `<svg viewBox="0 0 100 100"><defs><radialGradient id="art5"><stop offset="0" stop-color="#eab308" stop-opacity="0.9"/><stop offset="1" stop-color="#a855f7" stop-opacity="0.15"/></radialGradient></defs><circle cx="92" cy="92" r="42" fill="url(#art5)"/><g stroke="#eab308" stroke-width="2" opacity="0.7"><line x1="92" y1="92" x2="92" y2="52"/><line x1="92" y1="92" x2="68" y2="58"/><line x1="92" y1="92" x2="52" y2="74"/><line x1="92" y1="92" x2="58" y2="92"/></g></svg>`,
  '/papers/': `<svg viewBox="0 0 100 100" fill="none"><defs><linearGradient id="art6" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ef4444"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><g stroke="url(#art6)" stroke-width="2.5"><path d="M40 100 Q55 85 70 100 T100 100"/><path d="M40 86 Q55 71 70 86 T100 86"/><path d="M40 72 Q55 57 70 72 T100 72"/><path d="M40 58 Q55 43 70 58 T100 58"/></g></svg>`,
  '/speaking/': `<svg viewBox="0 0 100 100"><defs><linearGradient id="art7" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#ef4444"/></linearGradient></defs><g fill="url(#art7)"><rect x="58" y="70" width="6" height="30" rx="2"/><rect x="70" y="54" width="6" height="46" rx="2"/><rect x="82" y="38" width="6" height="62" rx="2"/><rect x="94" y="60" width="6" height="40" rx="2"/></g></svg>`,
  '/reference/': `<svg viewBox="0 0 100 100"><defs><linearGradient id="art8" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22c55e"/><stop offset="1" stop-color="#eab308"/></linearGradient></defs><g fill="url(#art8)" opacity="0.85"><rect x="58" y="58" width="18" height="18" rx="3"/><rect x="80" y="58" width="18" height="18" rx="3" opacity="0.65"/><rect x="58" y="80" width="18" height="18" rx="3" opacity="0.65"/><rect x="80" y="80" width="18" height="18" rx="3"/></g></svg>`,
}

// 首页卡片：替换左上 emoji 为线性图标 + 注入右下角几何图案
function setupCardArt() {
  document.querySelectorAll('.VPFeatures .VPFeature').forEach(card => {
    const href = card.getAttribute('href') || ''
    let key = null
    for (const k of Object.keys(CARD_ART)) {
      if (href.includes(k)) { key = k; break }
    }
    if (!key) return
    // 左上图标替换（emoji → 线性 SVG）
    const iconBox = card.querySelector('.icon')
    if (iconBox && !iconBox.dataset.replaced) {
      iconBox.innerHTML = ICON_ART[key]
      iconBox.dataset.replaced = '1'
    }
    // 右下角彩色图案（挂在 card 本体，与 box 平级，保证文字层在上）
    if (!card.querySelector('.art-pattern')) {
      const wrap = document.createElement('div')
      wrap.className = 'art-pattern'
      wrap.innerHTML = CARD_ART[key]
      card.appendChild(wrap)
    }
  })
}

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
  setupCardArt()
  setupFeynmanBox()
}

// 费曼反思框：仅 /reading/ 注入，textarea 按路由路径存 localStorage
// 对应《认知天性》「精细化 + 反思」——把「我的思考」还给读者自己产出
function setupFeynmanBox() {
  // 切页先清残留：box 是 Enhance 直接挂的游离节点，不在 Vue vdom 里，
  // Vue patch 时不会带走它，会残留在旧位置导致错位。手动清掉再重挂。
  document.querySelectorAll('.feynman-box').forEach(el => el.remove())
  if (!route.path.startsWith('/reading/')) return
  const doc = document.querySelector('.vp-doc')
  if (!doc) return
  const key = 'feynman:' + route.path
  const saved = localStorage.getItem(key) || ''
  const box = document.createElement('section')
  box.className = 'feynman-box reveal'
  box.innerHTML = `
    <h2 class="fb-title">费曼反思</h2>
    <p class="fb-hint">合上回忆——不看上面，用自己的话复述本书核心：它讲了什么？和你已知的东西有什么连接？哪里还说不清？（说不出 = 没真懂，那正是该重读的地方）</p>
    <textarea class="fb-input" placeholder="在这里写……内容只存你本地浏览器。"></textarea>
    <div class="fb-meta">已写 <span class="fb-count">0</span> 字 · 自动保存到本地</div>
  `
  doc.appendChild(box)
  const ta = box.querySelector('.fb-input')
  const count = box.querySelector('.fb-count')
  ta.value = saved
  count.textContent = String(saved.length)
  ta.addEventListener('input', () => {
    localStorage.setItem(key, ta.value)
    count.textContent = String(ta.value.length)
  })
  if (io) io.observe(box)
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

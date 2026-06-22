---
date: 2026-06-17
scene: Frontend Caching Strategy
---

# Frontend Caching Strategy

> 日期：2026-06-17 · 场景：Frontend Caching Strategy

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/polyfill" target="_blank" rel="noopener">polyfill</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=polyfill&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>垫片（补齐旧环境的新 API）</td>
      <td>Import the polyfill for browsers that lack fetch support.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">为不支持 fetch 的浏览器引入垫片。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/bundling" target="_blank" rel="noopener">bundling</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=bundling&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>打包（合并模块为可部署文件）</td>
      <td>Tree shaking reduced the bundling size by half.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">摇树优化让打包体积减半。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/snapshot" target="_blank" rel="noopener">snapshot</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=snapshot&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>快照（某时刻的完整状态拷贝）</td>
      <td>The snapshot lets us roll back the database instantly.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">快照让我们能瞬间回滚数据库。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/eviction" target="_blank" rel="noopener">eviction</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=eviction&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>淘汰（缓存满时移除旧项）</td>
      <td>Use LRU eviction to keep the cache size bounded.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">用 LRU 淘汰策略保持缓存大小有界。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/encrypt" target="_blank" rel="noopener">encrypt</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=encrypt&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>加密（转为密文保护内容）</td>
      <td>Always encrypt credentials at rest and in transit.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">凭证在静态存储和传输时都要加密。</span></td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/frontend-caching-strategy.mp3"></audio>

## 💬 Dialogue

**A**: The bundle size grew again after the upgrade.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：升级后打包体积又变大了。</span>

**B**: We need better **bundling** and code splitting.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：我们需要更好的打包和代码分割。</span>

**A**: Also add a **polyfill** only for the legacy chunk.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：另外只给旧代码块加垫片。</span>

**B**: Right. And set a clear **eviction** policy on the cache.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：对。还要给缓存定个明确的淘汰策略。</span>

**A**: Should we **encrypt** the cached user **snapshot**?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：要不要加密缓存的用户快照？</span>

**B**: Yes, especially the tokens stored in local storage.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：要，尤其是存在 local storage 里的令牌。</span>

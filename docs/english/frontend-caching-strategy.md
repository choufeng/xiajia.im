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
      <td><a href="https://dict.youdao.com/w/polyfill" target="_blank" rel="noopener">polyfill</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=polyfill&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>垫片（补齐旧环境的新 API）</td>
      <td>Import the polyfill for browsers that lack fetch support.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/bundling" target="_blank" rel="noopener">bundling</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=bundling&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>打包（合并模块为可部署文件）</td>
      <td>Tree shaking reduced the bundling size by half.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/snapshot" target="_blank" rel="noopener">snapshot</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=snapshot&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>快照（某时刻的完整状态拷贝）</td>
      <td>The snapshot lets us roll back the database instantly.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/eviction" target="_blank" rel="noopener">eviction</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=eviction&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>淘汰（缓存满时移除旧项）</td>
      <td>Use LRU eviction to keep the cache size bounded.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/encrypt" target="_blank" rel="noopener">encrypt</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=encrypt&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>加密（转为密文保护内容）</td>
      <td>Always encrypt credentials at rest and in transit.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/frontend-caching-strategy.mp3"></audio>

## 💬 Dialogue

**A**: The bundle size grew again after the upgrade.

**B**: We need better **bundling** and code splitting.

**A**: Also add a **polyfill** only for the legacy chunk.

**B**: Right. And set a clear **eviction** policy on the cache.

**A**: Should we **encrypt** the cached user **snapshot**?

**B**: Yes, especially the tokens stored in local storage.

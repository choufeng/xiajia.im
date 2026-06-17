---
date: 2026-06-17
scene: Frontend Caching Strategy
---

# Frontend Caching Strategy

> 日期：2026-06-17 · 场景：Frontend Caching Strategy

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| polyfill | 垫片（补齐旧环境的新 API） | Import the polyfill for browsers that lack fetch support. |
| bundling | 打包（合并模块为可部署文件） | Tree shaking reduced the bundling size by half. |
| snapshot | 快照（某时刻的完整状态拷贝） | The snapshot lets us roll back the database instantly. |
| eviction | 淘汰（缓存满时移除旧项） | Use LRU eviction to keep the cache size bounded. |
| encrypt | 加密（转为密文保护内容） | Always encrypt credentials at rest and in transit. |

## 🎧 Audio

<audio controls preload="none" src="/audio/frontend-caching-strategy.mp3"></audio>

## 💬 Dialogue

**A**: The bundle size grew again after the upgrade.

**B**: We need better **bundling** and code splitting.

**A**: Also add a **polyfill** only for the legacy chunk.

**B**: Right. And set a clear **eviction** policy on the cache.

**A**: Should we **encrypt** the cached user **snapshot**?

**B**: Yes, especially the tokens stored in local storage.

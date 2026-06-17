---
date: 2026-06-17
scene: Architecture Discussion
---

# Architecture Discussion

> 日期：2026-06-17 · 场景：Architecture Discussion

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| invalidate | 使失效（让缓存或旧数据作废） | Invalidate the cache after updating the record. |
| schema | 模式（数据库结构定义） | The schema migration added a new column. |
| deadlock | 死锁（互相等待资源无法继续） | A deadlock occurred between two concurrent transactions. |
| provision | 配备/开通（分配资源或基础设施） | Provision the new servers before the traffic spike. |
| extension | 扩展（附加功能模块） | Add it as an extension so users can opt in. |

## 🎧 Audio

<audio controls preload="none" src="/audio/architecture-discussion.mp3"></audio>

## 💬 Dialogue

**A**: We are debating between cache aside and write through.

**B**: With write through, we **invalidate** the stale key immediately.

**A**: But the **schema** change needs a migration plan.

**B**: Agreed. Also watch for **deadlock** on concurrent writes.

**A**: Should we **provision** more capacity first?

**B**: Yes, and build it as an **extension** point for future shards.

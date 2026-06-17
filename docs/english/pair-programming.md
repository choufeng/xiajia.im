---
date: 2026-06-17
scene: Pair Programming
---

# Pair Programming

> 日期：2026-06-17 · 场景：Pair Programming

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| commit | 提交（git 保存代码快照） | Each commit should represent one logical change. |
| boilerplate | 样板代码（重复的必要代码） | The framework reduces boilerplate for common tasks. |
| shard | 分片（按规则拆分数据到多个节点） | We shard the database by tenant to scale horizontally. |
| transaction | 事务（一组原子性操作） | Wrap the updates in a transaction to keep data consistent. |
| checksum | 校验和（检测数据完整性的值） | Verify the checksum before trusting the downloaded file. |

## 🎧 Audio

<audio controls preload="none" src="/audio/pair-programming.mp3"></audio>

## 💬 Dialogue

**A**: Want to pair on the payment module?

**B**: Sure. Let us wrap the update in a single **transaction**.

**A**: Good. Each **commit** should be small and focused.

**B**: I will remove the **boilerplate** first.

**A**: Also, should we **shard** the table by user region?

**B**: Later. First verify the **checksum** on every payload.

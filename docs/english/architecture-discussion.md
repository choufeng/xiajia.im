---
date: 2026-06-17
scene: Architecture Discussion
---

# Architecture Discussion

> 日期：2026-06-17 · 场景：Architecture Discussion

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/invalidate" target="_blank" rel="noopener">invalidate</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=invalidate&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>使失效（让缓存或旧数据作废）</td>
      <td>Invalidate the cache after updating the record.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/schema" target="_blank" rel="noopener">schema</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=schema&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>模式（数据库结构定义）</td>
      <td>The schema migration added a new column.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/deadlock" target="_blank" rel="noopener">deadlock</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=deadlock&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>死锁（互相等待资源无法继续）</td>
      <td>A deadlock occurred between two concurrent transactions.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/provision" target="_blank" rel="noopener">provision</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=provision&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>配备/开通（分配资源或基础设施）</td>
      <td>Provision the new servers before the traffic spike.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/extension" target="_blank" rel="noopener">extension</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=extension&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>扩展（附加功能模块）</td>
      <td>Add it as an extension so users can opt in.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/architecture-discussion.mp3"></audio>

## 💬 Dialogue

**A**: We are debating between cache aside and write through.

**B**: With write through, we **invalidate** the stale key immediately.

**A**: But the **schema** change needs a migration plan.

**B**: Agreed. Also watch for **deadlock** on concurrent writes.

**A**: Should we **provision** more capacity first?

**B**: Yes, and build it as an **extension** point for future shards.

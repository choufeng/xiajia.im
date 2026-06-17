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
      <td><a href="https://dict.youdao.com/w/invalidate" target="_blank" rel="noopener">invalidate</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=invalidate&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>使失效（让缓存或旧数据作废）</td>
      <td>Invalidate the cache after updating the record.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">更新记录后让缓存失效。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/schema" target="_blank" rel="noopener">schema</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=schema&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>模式（数据库结构定义）</td>
      <td>The schema migration added a new column.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">这次模式迁移加了一列。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/deadlock" target="_blank" rel="noopener">deadlock</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=deadlock&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>死锁（互相等待资源无法继续）</td>
      <td>A deadlock occurred between two concurrent transactions.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">两个并发事务之间发生了死锁。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/provision" target="_blank" rel="noopener">provision</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=provision&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>配备/开通（分配资源或基础设施）</td>
      <td>Provision the new servers before the traffic spike.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">在流量高峰前先开通新服务器。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/extension" target="_blank" rel="noopener">extension</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=extension&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>扩展（附加功能模块）</td>
      <td>Add it as an extension so users can opt in.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">把它做成扩展，让用户可选启用。</span></td>
    </tr>
  </tbody>
</table>

## 💬 Dialogue

**A**: We are debating between cache aside and write through.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我们在纠结用 cache aside 还是 write through。</span>

**B**: With write through, we **invalidate** the stale key immediately.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：用 write through 的话，我们能立刻让过期 key 失效。</span>

**A**: But the **schema** change needs a migration plan.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：但这次 schema 变更需要迁移方案。</span>

**B**: Agreed. Also watch for **deadlock** on concurrent writes.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：同意。还要注意并发写入时的死锁。</span>

**A**: Should we **provision** more capacity first?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：要不要先多备点容量？</span>

**B**: Yes, and build it as an **extension** point for future shards.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：要，而且把它做成扩展点，方便以后分片。</span>

## 🎧 Audio

<audio controls preload="none" src="/audio/architecture-discussion.mp3"></audio>

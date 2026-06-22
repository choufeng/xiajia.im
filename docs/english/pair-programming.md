---
date: 2026-06-17
scene: Pair Programming
---

# Pair Programming

> 日期：2026-06-17 · 场景：Pair Programming

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/commit" target="_blank" rel="noopener">commit</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=commit&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>提交（git 保存代码快照）</td>
      <td>Each commit should represent one logical change.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">每次提交应代表一个逻辑改动。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/boilerplate" target="_blank" rel="noopener">boilerplate</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=boilerplate&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>样板代码（重复的必要代码）</td>
      <td>The framework reduces boilerplate for common tasks.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">这个框架减少了常见任务的样板代码。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/shard" target="_blank" rel="noopener">shard</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=shard&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>分片（按规则拆分数据到多个节点）</td>
      <td>We shard the database by tenant to scale horizontally.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">我们按租户对数据库分片以横向扩展。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/transaction" target="_blank" rel="noopener">transaction</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=transaction&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>事务（一组原子性操作）</td>
      <td>Wrap the updates in a transaction to keep data consistent.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">把更新包在事务里以保持数据一致。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/checksum" target="_blank" rel="noopener">checksum</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=checksum&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>校验和（检测数据完整性的值）</td>
      <td>Verify the checksum before trusting the downloaded file.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">信任下载文件前先校验校验和。</span></td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/pair-programming.mp3"></audio>

## 💬 Dialogue

**A**: Want to pair on the payment module?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：要不要结对搞一下支付模块？</span>

**B**: Sure. Let us wrap the update in a single **transaction**.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：好啊。我们把更新包在一个事务里。</span>

**A**: Good. Each **commit** should be small and focused.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：好。每次提交都要小而专注。</span>

**B**: I will remove the **boilerplate** first.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：我先把样板代码清掉。</span>

**A**: Also, should we **shard** the table by user region?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：另外，要不要按用户地区给表分片？</span>

**B**: Later. First verify the **checksum** on every payload.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：等等。先校验每个负载的校验和。</span>

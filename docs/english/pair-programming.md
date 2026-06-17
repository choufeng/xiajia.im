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
      <td><a href="https://dict.youdao.com/w/commit" target="_blank" rel="noopener">commit</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=commit&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>提交（git 保存代码快照）</td>
      <td>Each commit should represent one logical change.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/boilerplate" target="_blank" rel="noopener">boilerplate</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=boilerplate&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>样板代码（重复的必要代码）</td>
      <td>The framework reduces boilerplate for common tasks.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/shard" target="_blank" rel="noopener">shard</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=shard&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>分片（按规则拆分数据到多个节点）</td>
      <td>We shard the database by tenant to scale horizontally.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/transaction" target="_blank" rel="noopener">transaction</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=transaction&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>事务（一组原子性操作）</td>
      <td>Wrap the updates in a transaction to keep data consistent.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/checksum" target="_blank" rel="noopener">checksum</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=checksum&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>校验和（检测数据完整性的值）</td>
      <td>Verify the checksum before trusting the downloaded file.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/pair-programming.mp3"></audio>

## 💬 Dialogue

**A**: Want to pair on the payment module?

**B**: Sure. Let us wrap the update in a single **transaction**.

**A**: Good. Each **commit** should be small and focused.

**B**: I will remove the **boilerplate** first.

**A**: Also, should we **shard** the table by user region?

**B**: Later. First verify the **checksum** on every payload.

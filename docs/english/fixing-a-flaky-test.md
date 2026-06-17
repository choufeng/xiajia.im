---
date: 2026-06-17
scene: Fixing a Flaky Test
---

# Fixing a Flaky Test

> 日期：2026-06-17 · 场景：Fixing a Flaky Test

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/replica" target="_blank" rel="noopener">replica</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=replica&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>副本（数据的同步拷贝）</td>
      <td>The read replica lags behind the primary by a few seconds.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/mitigate" target="_blank" rel="noopener">mitigate</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=mitigate&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>缓解（降低风险或影响）</td>
      <td>We added retries to mitigate transient failures.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/idempotent" target="_blank" rel="noopener">idempotent</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=idempotent&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>幂等（重复执行结果不变）</td>
      <td>Make the endpoint idempotent so retries are safe.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/flaky" target="_blank" rel="noopener">flaky</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=flaky&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>不稳定的（时而通过时而失败的测试）</td>
      <td>The flaky test keeps blocking the pipeline.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/template" target="_blank" rel="noopener">template</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=template&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>模板（可复用的代码骨架）</td>
      <td>Use the project template to scaffold a new module.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/fixing-a-flaky-test.mp3"></audio>

## 💬 Dialogue

**A**: The build failed again on the integration suite.

**B**: Same **flaky** test. It depends on the **replica** being in sync.

**A**: How do we **mitigate** the timing issue?

**B**: Make the setup **idempotent** so it can retry safely.

**A**: Good idea. Should we update the test **template** too?

**B**: Yes, add an explicit wait before the assertion.

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
      <td><a href="https://dict.youdao.com/w/replica" target="_blank" rel="noopener">replica</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=replica&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>副本（数据的同步拷贝）</td>
      <td>The read replica lags behind the primary by a few seconds.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">只读副本比主库落后几秒。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/mitigate" target="_blank" rel="noopener">mitigate</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=mitigate&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>缓解（降低风险或影响）</td>
      <td>We added retries to mitigate transient failures.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">我们加重试来缓解瞬时故障。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/idempotent" target="_blank" rel="noopener">idempotent</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=idempotent&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>幂等（重复执行结果不变）</td>
      <td>Make the endpoint idempotent so retries are safe.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">让接口幂等，这样重试才安全。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/flaky" target="_blank" rel="noopener">flaky</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=flaky&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>不稳定的（时而通过时而失败的测试）</td>
      <td>The flaky test keeps blocking the pipeline.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">这个不稳定的测试一直卡住流水线。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/template" target="_blank" rel="noopener">template</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=template&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>模板（可复用的代码骨架）</td>
      <td>Use the project template to scaffold a new module.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">用项目模板来搭建新模块。</span></td>
    </tr>
  </tbody>
</table>

## 💬 Dialogue

**A**: The build failed again on the integration suite.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：集成测试套件又挂了。</span>

**B**: Same **flaky** test. It depends on the **replica** being in sync.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：还是那个不稳定测试。它依赖副本同步。</span>

**A**: How do we **mitigate** the timing issue?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我们怎么缓解这个时序问题？</span>

**B**: Make the setup **idempotent** so it can retry safely.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：把初始化做成幂等的，这样重试就安全了。</span>

**A**: Good idea. Should we update the test **template** too?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：好主意。要不要也更新一下测试模板？</span>

**B**: Yes, add an explicit wait before the assertion.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：要，在断言前加个显式等待。</span>

## 🎧 Audio

<audio controls preload="none" src="/audio/fixing-a-flaky-test.mp3"></audio>

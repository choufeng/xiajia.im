---
date: 2026-06-17
scene: Production Rollback
---

# Production Rollback

> 日期：2026-06-17 · 场景：Production Rollback

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/rollback" target="_blank" rel="noopener">rollback</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=rollback&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>回滚（把部署/数据恢复到先前版本）</td>
      <td>We need a rollback to the previous release now.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">我们需要立刻回滚到上一个发布版本。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/fallback" target="_blank" rel="noopener">fallback</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=fallback&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>降级备用方案（主路径不可用时的兜底）</td>
      <td>Enable the fallback to the cached response path.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">启用降级到缓存响应路径。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/retry" target="_blank" rel="noopener">retry</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=retry&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>重试（失败请求再次发起）</td>
      <td>Clients are hammering the gateway in a retry storm.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">客户端在重试风暴中猛击网关。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/timeout" target="_blank" rel="noopener">timeout</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=timeout&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>超时（请求在限定时间内未得到响应）</td>
      <td>Most failures are timeout errors calling the payment gateway.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">大多数失败是调用支付网关时的超时错误。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/backoff" target="_blank" rel="noopener">backoff</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=backoff&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>退避（失败后延迟再试，常指数增长）</td>
      <td>Add an exponential backoff so clients back off gracefully.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">加上指数退避，让客户端优雅地退避。</span></td>
    </tr>
  </tbody>
</table>

## 💬 Dialogue

**A**: Paging you. Five hundred error rate just spiked right after the deploy. The dashboard is bleeding red.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：呼叫你。部署后 500 错误率突然飙升，仪表盘一片血红。</span>

**B**: I see it. Most of the failures are **timeout** errors calling the payment gateway. Latency is through the roof.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：我看到了。大多数失败是调用支付网关时的超时错误，延迟爆表。</span>

**A**: Gateway is overloaded. Clients are hammering it in a **retry** storm. We need a **rollback** to the previous release now.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：网关过载了。客户端在重试风暴中猛击它。我们需要立刻回滚到上一个发布版本。</span>

**B**: Agreed. But first let me enable the **fallback** to the cached response path so active users are not left hanging.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：同意。但先让我启用降级到缓存响应路径，别让活跃用户悬着。</span>

**A**: Good call. Cache path will absorb the load. Meanwhile I will flip traffic back to the old version.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：好主意。缓存路径能吸收负载。同时我把流量切回旧版本。</span>

**B**: Once we are stable, let us cap the retry count and add an exponential **backoff** so clients back off gracefully next time.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：稳定后，我们限制重试次数并加上指数退避，下次客户端就能优雅退避。</span>

**A**: Rollback is executing. Old pods are coming up and traffic is shifting over.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：回滚执行中。旧 Pod 正在起来，流量正在切过去。</span>

**B**: Error rate is dropping. Fallback is serving stale but valid data, and the timeout curve is flattening out.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：错误率在降。降级在提供陈旧但有效的数据，超时曲线正在趋平。</span>

## 🎧 Audio

<audio controls preload="none" src="/audio/production-rollback.mp3"></audio>

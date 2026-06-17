---
date: 2026-06-17
scene: Concurrency and Performance
---

# Concurrency and Performance

> 日期：2026-06-17 · 场景：Concurrency and Performance

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/asynchronous" target="_blank" rel="noopener">asynchronous</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=asynchronous&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>异步的；调用后不立即返回结果，靠回调或事件通知完成</td>
      <td>We refactored the payment step to be asynchronous so the API can respond without waiting for the bank.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">我们把支付步骤改成了异步，这样 API 不必等银行确认就能返回。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/callback" target="_blank" rel="noopener">callback</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=callback&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>回调；任务完成时被调用的函数</td>
      <td>Register a callback that fires when the payment gateway replies, then update the order status.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">注册一个回调，在支付网关应答时触发，再更新订单状态。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/concurrency" target="_blank" rel="noopener">concurrency</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=concurrency&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>并发；多个任务在同一时段交错或同时执行的能力</td>
      <td>Raising concurrency on the worker pool lets us handle more requests at once.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">提高 worker 池的并发度，能让我们同时处理更多请求。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/throughput" target="_blank" rel="noopener">throughput</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=throughput&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>吞吐量；单位时间内系统处理的请求数或数据量</td>
      <td>Better throughput means fewer timeouts during peak hours.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">更高的吞吐量意味着高峰时段超时更少。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/latency" target="_blank" rel="noopener">latency</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=latency&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>延迟；从发起请求到收到响应之间的时间</td>
      <td>Our average latency doubled after the holiday sale, so we are investigating the checkout flow.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">大促之后我们的平均延迟翻倍，所以正在排查结账流程。</span></td>
    </tr>
  </tbody>
</table>

## 💬 Dialogue

**A**: We have a serious **latency** problem in the checkout flow.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我们的结账流程有严重的延迟问题。</span>

**B**: Right. The numbers show our average latency doubled after the holiday sale.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：对。数据显示，大促之后我们的平均延迟翻倍了。</span>

**A**: I think the root cause is the synchronous payment calls. We should make them **asynchronous**.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我觉得根因是同步的支付调用，我们应该改成异步。</span>

**B**: Agreed. An asynchronous design would let us return a response before the bank confirms.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：同意。异步设计能让我们在银行确认之前就返回响应。</span>

**A**: We can register a **callback** that fires when the payment gateway replies.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我们可以注册一个回调，在支付网关应答时触发。</span>

**B**: Good. The callback can then update the order status in the background.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：好。回调再在后台更新订单状态。</span>

**A**: We also need to raise **concurrency** on the worker pool. Right now it is capped at ten.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：我们还得提高 worker 池的并发度，现在被限制在十个。</span>

**B**: Higher concurrency should lift our **throughput** and clear the queue faster.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：更高的并发度应该能提升吞吐量，更快清空队列。</span>

**A**: Exactly. Better throughput means fewer timeouts during peak hours.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：没错。更好的吞吐量意味着高峰时段超时更少。</span>

**B**: Let me draft the design doc and we can review it tomorrow.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：我来起草设计文档，我们明天评审。</span>

## 🎧 Audio

<audio controls preload="none" src="/audio/concurrency-and-performance.mp3"></audio>

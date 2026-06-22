---
date: 2026-06-17
scene: API Design Discussion
---

# API Design Discussion

> 日期：2026-06-17 · 场景：API Design Discussion

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/endpoint" target="_blank" rel="noopener">endpoint</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=endpoint&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>端点（API 可访问的 URL 地址）</td>
      <td>Call the user endpoint to fetch the profile.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">调用 user 端点获取个人资料。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/payload" target="_blank" rel="noopener">payload</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=payload&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>载荷（请求或响应中携带的数据）</td>
      <td>Keep the response payload as small as possible.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">让响应载荷尽可能小。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/authorization" target="_blank" rel="noopener">authorization</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=authorization&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>授权（验证是否有权限访问资源）</td>
      <td>The gateway checks authorization on every call.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">网关在每次调用时检查授权。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/cookie" target="_blank" rel="noopener">cookie</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=cookie&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>Cookie（浏览器存储的小段身份数据）</td>
      <td>Set a signed cookie after the user logs in.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">用户登录后写入一个签名 Cookie。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/deserialize" target="_blank" rel="noopener">deserialize</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=deserialize&amp;type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>反序列化（将文本数据还原为程序对象）</td>
      <td>The client can deserialize the JSON in under a millisecond.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">客户端能在 1 毫秒内反序列化这份 JSON。</span></td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/api-design-discussion.mp3"></audio>

## 💬 Dialogue

**A**: Let's finalize the API design for the new user service.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：把新用户服务的 API 设计定下来吧。</span>

**B**: Sure. I think we should expose one **endpoint** for fetching the user profile.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：好，我觉得应该暴露一个端点用来获取用户资料。</span>

**A**: Agreed. What fields should we include in the response **payload**?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：同意。响应载荷里该包含哪些字段？</span>

**B**: Keep it minimal. Just the id, email, and display name to avoid leaking sensitive data.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：保持精简。只放 id、邮箱和显示名，避免泄露敏感数据。</span>

**A**: Good call. How are we handling **authorization** on these requests?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：说得好。这些请求的授权怎么处理？</span>

**B**: We attach a signed **cookie** after login, and the gateway validates it on every call.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：登录后写入一个签名 Cookie，网关在每次调用时校验它。</span>

**A**: Nice. And when the client receives the JSON, how fast can it **deserialize** the body?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：不错。客户端收到 JSON 后，多快能反序列化请求体？</span>

**B**: It parses in under a millisecond at that size, so performance is fine.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：这个体量不到 1 毫秒就能解析完，性能没问题。</span>

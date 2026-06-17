---
date: 2026-06-17
scene: CI/CD Pipeline Setup
---

# CI/CD Pipeline Setup

> 日期：2026-06-17 · 场景：CI/CD Pipeline Setup

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/dashboard" target="_blank" rel="noopener">dashboard</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=dashboard&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>仪表盘（可视化监控面板）</td>
      <td>The dashboard shows latency and error rate in real time.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">仪表盘实时显示延迟和错误率。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/artifact" target="_blank" rel="noopener">artifact</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=artifact&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>构建产物（编译生成的可部署文件）</td>
      <td>Upload the build artifact to the registry.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">把构建产物上传到仓库。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/silent" target="_blank" rel="noopener">silent</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=silent&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>静默的（不报错也不输出）</td>
      <td>The failing step exited silently without any logs.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">失败的步骤静默退出，没有任何日志。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/scaffold" target="_blank" rel="noopener">scaffold</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=scaffold&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>脚手架（生成项目初始结构）</td>
      <td>Scaffold a new service from the official template.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">用官方模板搭建一个新服务。</span></td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/token" target="_blank" rel="noopener">token</a> <button class="word-play-btn" onclick="new Audio(this.dataset.src).play()" data-src="https://dict.youdao.com/dictvoice?audio=token&type=2" title="Play pronunciation" aria-label="Play pronunciation">🔊</button></td>
      <td>令牌（访问凭证字符串）</td>
      <td>The token expires every hour for security.<br><span style="font-size:0.85em;color:var(--vp-c-text-2)">出于安全，令牌每小时过期一次。</span></td>
    </tr>
  </tbody>
</table>

## 💬 Dialogue

**A**: The new pipeline is missing the deploy stage.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：新流水线少了部署阶段。</span>

**B**: Use the **scaffold** from the docs team as a template.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：用文档团队那个脚手架当模板。</span>

**A**: It needs an **artifact** to publish and a deploy **token**.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：它需要一个产物来发布，还要一个部署令牌。</span>

**B**: Correct. Keep the token in the secret store, not the repo.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：对。令牌放密钥库里，别放仓库。</span>

**A**: What if a step fails **silently**?
<span style="font-size:0.85em;color:var(--vp-c-text-2)">A：要是有步骤静默失败怎么办？</span>

**B**: Good catch. Add a **dashboard** so we can spot regressions.
<span style="font-size:0.85em;color:var(--vp-c-text-2)">B：问得好。加个仪表盘，这样能发现回归。</span>

## 🎧 Audio

<audio controls preload="none" src="/audio/ci-cd-pipeline-setup.mp3"></audio>

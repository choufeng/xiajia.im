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
      <td><a href="https://dict.youdao.com/w/dashboard" target="_blank" rel="noopener">dashboard</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=dashboard&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>仪表盘（可视化监控面板）</td>
      <td>The dashboard shows latency and error rate in real time.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/artifact" target="_blank" rel="noopener">artifact</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=artifact&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>构建产物（编译生成的可部署文件）</td>
      <td>Upload the build artifact to the registry.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/silent" target="_blank" rel="noopener">silent</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=silent&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>静默的（不报错也不输出）</td>
      <td>The failing step exited silently without any logs.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/scaffold" target="_blank" rel="noopener">scaffold</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=scaffold&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>脚手架（生成项目初始结构）</td>
      <td>Scaffold a new service from the official template.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/token" target="_blank" rel="noopener">token</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=token&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>令牌（访问凭证字符串）</td>
      <td>The token expires every hour for security.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/ci-cd-pipeline-setup.mp3"></audio>

## 💬 Dialogue

**A**: The new pipeline is missing the deploy stage.

**B**: Use the **scaffold** from the docs team as a template.

**A**: It needs an **artifact** to publish and a deploy **token**.

**B**: Correct. Keep the token in the secret store, not the repo.

**A**: What if a step fails **silently**?

**B**: Good catch. Add a **dashboard** so we can spot regressions.

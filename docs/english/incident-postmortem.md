---
date: 2026-06-17
scene: Incident Postmortem
---

# Incident Postmortem

> 日期：2026-06-17 · 场景：Incident Postmortem

## 📖 Vocabulary

<table>
  <thead>
    <tr><th>Word</th><th>Meaning</th><th>Example</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://dict.youdao.com/w/obfuscate" target="_blank" rel="noopener">obfuscate</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=obfuscate&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>混淆（使代码难以被逆向）</td>
      <td>We obfuscate the client code to deter tampering.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/incident" target="_blank" rel="noopener">incident</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=incident&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>事件（影响服务的重大故障）</td>
      <td>The incident was resolved within thirty minutes.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/fixture" target="_blank" rel="noopener">fixture</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=fixture&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>测试夹具（固定的测试数据/环境）</td>
      <td>Load the fixture data before running the tests.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/stacktrace" target="_blank" rel="noopener">stacktrace</a> <audio controls preload="none" src="https://translate.google.com/translate_tts?ie=UTF-8&q=stacktrace&tl=en&client=tw-ob" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>堆栈跟踪（错误调用链）</td>
      <td>The stacktrace pointed to a null reference in the handler.</td>
    </tr>
    <tr>
      <td><a href="https://dict.youdao.com/w/hash" target="_blank" rel="noopener">hash</a> <audio controls preload="none" src="https://dict.youdao.com/dictvoice?audio=hash&type=2" style="width:90px;height:24px;vertical-align:middle"></audio></td>
      <td>哈希（单向摘要函数）</td>
      <td>Store a hash of the password, never the plain text.</td>
    </tr>
  </tbody>
</table>

## 🎧 Audio

<audio controls preload="none" src="/audio/incident-postmortem.mp3"></audio>

## 💬 Dialogue

**A**: Let us write the postmortem for last night's **incident**.

**B**: The root cause was a null pointer hidden by minification.

**A**: The **stacktrace** was unreadable until we added source maps.

**B**: We should not **obfuscate** the error handler at all.

**A**: Agreed. I will add a **fixture** that reproduces the crash.

**B**: Good. Then **hash** the repro steps into the test suite.

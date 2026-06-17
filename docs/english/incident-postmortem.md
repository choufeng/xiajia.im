---
date: 2026-06-17
scene: Incident Postmortem
---

# Incident Postmortem

> 日期：2026-06-17 · 场景：Incident Postmortem

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| obfuscate | 混淆（使代码难以被逆向） | We obfuscate the client code to deter tampering. |
| incident | 事件（影响服务的重大故障） | The incident was resolved within thirty minutes. |
| fixture | 测试夹具（固定的测试数据/环境） | Load the fixture data before running the tests. |
| stacktrace | 堆栈跟踪（错误调用链） | The stacktrace pointed to a null reference in the handler. |
| hash | 哈希（单向摘要函数） | Store a hash of the password, never the plain text. |

## 🎧 Audio

<audio controls preload="none" src="/audio/incident-postmortem.mp3"></audio>

## 💬 Dialogue

**A**: Let us write the postmortem for last night's **incident**.

**B**: The root cause was a null pointer hidden by minification.

**A**: The **stacktrace** was unreadable until we added source maps.

**B**: We should not **obfuscate** the error handler at all.

**A**: Agreed. I will add a **fixture** that reproduces the crash.

**B**: Good. Then **hash** the repro steps into the test suite.

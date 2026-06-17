---
date: 2026-06-17
scene: Fixing a Flaky Test
---

# Fixing a Flaky Test

> 日期：2026-06-17 · 场景：Fixing a Flaky Test

## 📖 Vocabulary

| Word | Meaning | Example |
|------|---------|---------|
| replica | 副本（数据的同步拷贝） | The read replica lags behind the primary by a few seconds. |
| mitigate | 缓解（降低风险或影响） | We added retries to mitigate transient failures. |
| idempotent | 幂等（重复执行结果不变） | Make the endpoint idempotent so retries are safe. |
| flaky | 不稳定的（时而通过时而失败的测试） | The flaky test keeps blocking the pipeline. |
| template | 模板（可复用的代码骨架） | Use the project template to scaffold a new module. |

## 🎧 Audio

<audio controls preload="none" src="/audio/fixing-a-flaky-test.mp3"></audio>

## 💬 Dialogue

**A**: The build failed again on the integration suite.

**B**: Same **flaky** test. It depends on the **replica** being in sync.

**A**: How do we **mitigate** the timing issue?

**B**: Make the setup **idempotent** so it can retry safely.

**A**: Good idea. Should we update the test **template** too?

**B**: Yes, add an explicit wait before the assertion.

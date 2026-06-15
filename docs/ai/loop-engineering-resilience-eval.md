# Loop 的韧性与评估：让 loop 不死、不坏、可证

> 系列第九篇。前八篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop)
>
> 第七篇讲「不衰」，第八篇讲「会进化」。这篇补最后两块：**不坏**（输出质量怎么保证、怎么证）和**不死**（loop 进程/状态崩了怎么救）。它们是长期自驱动的最后两根支柱。

---

## 零、韧性与评估：被低估的两块

前八篇设计的 loop 已经相当完善，但有两个问题一直在背景里没正面解决：

| 问题 | 现状 | 后果 |
|------|------|------|
| **loop 输出对吗？** | L3 篇讲了 verifier 验证链，但**验证 ≠ 评估** | 验证是单次的（这次过没过），评估是系统的（长期质量趋势） |
| **loop 崩了怎么办？** | L3 篇讲了 escalate/kill switch，但那是 loop **内部**崩 | 进程死了、状态文件损坏、预算卡死、死锁——loop 自己救不了自己 |

这俩问题是「长期自驱动」的最后盲区：
- 没有评估，loop 「看起来在跑」但质量悄悄下降，无人知晓
- 没有韧性，一个进程崩溃/状态损坏就让整个 loop 系统停摆，无人拉起

**本篇补这两块**。加上前八篇，loop 工程才真正配得上「长期自驱动」。

---

## 第一部分：评估（Evaluation）—— 让质量可证

### 一、验证 vs 评估，别混

这是本篇最容易混的概念，先厘清。

| 维度 | 验证（Verification） | 评估（Evaluation） |
|------|----------------------|---------------------|
| 关注 | **这次**对不对 | **长期**质量趋势 |
| 时机 | 每次运行 | 定期 / 离线 |
| 粒度 | 单个改动 / 单次决策 | 聚合行为 / 系统级 |
| 通过标准 | 测试过、verifier 批准 | 与基线对比、人工抽检 |
| 失败处理 | 这次拒绝/重试 | 调整 loop / 降级 |

L3 篇的验证链（Implementer→Verifier→Reviewer→Gate）是**验证**。它保证「**这次**合并是安全的」。但它回答不了：

- 这周 ci-sweeper 合并的 20 个 PR，整体质量如何？
- 这个 loop 三个月来的首次修复成功率，是升了还是降了？
- 模型升级后，loop 的分类决策有没有系统性偏移？

这些是**评估**的问题。验证是「门卫」，评估是「审计」。loop 长期跑，两者都要。

### 二、评估的四个维度

```
                  loop 评估
                     │
    ┌────────┬───────┼────────┬────────┐
    ▼        ▼       ▼        ▼        ▼
  ①正确性  ②效率   ③安全    ④对齐
  Correct.  Effici. Safety  Alignment
  改对了吗  花得起  闯祸没   符合意图
```

每个维度有可量化指标：

| 维度 | 指标 | 怎么测 |
|------|------|--------|
| **①正确性** | 首次修复成功率、回归率（合并后又 reverted）、verifier 漏判率 | 对比 run-log + 事后人 review |
| **②效率** | avg tokens/run、tokens/成功修复、attempt 均值、duration | run-log 聚合 |
| **③安全** | denylist 触碰次数（应 0）、越权尝试、护栏拦截率 | 日志审计 |
| **④对齐** | 「治根因 vs 治症状」比例、escalate 准确率、人 override 率 | 人抽检 + 分类 |

**关键洞察**：四个维度里，②效率全自动可测，①③半自动（需部分人 review），④必须人（对齐是意图问题，机器评不了）。这呼应反衰减篇——有些事必须人。

### 三、评估的四种方法

#### 方法 1：基线回归测试（Baseline，全自动）

第七篇反衰减已讲，这里补充评估视角。给 loop 一套固定输入，看输出是否符合期望。

```yaml
# ci-sweeper-baseline.yaml
cases:
  - id: oauth-500
    input: { logs: "fixtures/oauth-500.txt" }
    expected: { classify: "compile", target: ["src/auth/"], escalate: false }
  - id: flaky-test
    input: { logs: "fixtures/flaky.txt" }
    expected: { classify: "flake", target: [], escalate: true }
score: pass_rate / total
```

**评估用法**：不只看「过没过」，看**分数趋势**。本周 92% → 下周 85% = 漂移信号。这是 Behavior Drift 的量化（反衰减篇机制 4）。

#### 方法 2：A/B 对比（半自动）

改 loop（换模型/改 skill）前后，跑同一批输入对比输出。

```
基线组（旧 skill）:  跑 100 个历史 CI 失败 → 78 个修对
实验组（新 skill）:  跑同样 100 个 → 86 个修对
                       → +8pp, skill 改进有效, 可上线
```

**关键**：用**历史** case 跑（重放），不影响生产。任何 loop 配置变更前都该跑 A/B，避免盲改。

#### 方法 3：人工抽检（Human Audit，必须）

定期随机抽 N 个 loop 输出，人逐个评分。

```markdown
## Weekly Audit — ci-sweeper (抽样 5/20)

| PR | 治根因? | 最小改动? | 越权? | 评分(1-5) |
|----|---------|-----------|-------|-----------|
| #142 | ✅ | ✅ | ❌ | 5 |
| #145 | ⚠️ 治症状 | ✅ | ❌ | 3 |
| #148 | ✅ | ⚠️ 改3文件 | ❌ | 4 |
| #150 | ❌ 误诊 | — | ❌ | 1 ← 调查 |
| #151 | ✅ | ✅ | ❌ | 5 |

均分: 3.6/5 (上周 4.1, 下降趋势 ⚠️)
```

**为什么必须人**：基线只测「期望内的」，抽检能发现**期望外的**问题（loop 学会了钻空子、verifier 共谋）。这是机器评估替代不了的。

#### 方法 4：线上反馈闭环（Live Feedback）

loop 合并后，跟踪**后续信号**：

| 后续信号 | 含义 | 反馈给 |
|----------|------|--------|
| 合并后 24h 内 reverted | 改错了 | 正确性维度降分 + Meta-Loop 归因 |
| 合并后 CI 再次同错 | 治症状不治根 | 对齐维度降分 |
| PR 被 review 拒绝 | 产出有质量问题 | 全维度降分 |
| 人工 override 决策 | loop 决策不对 | 对齐维度降分 |

**这是最有价值的评估数据**——真实后果，非模拟。loop 的「事后分数」比「当时 verifier 批准」更有信息量。

### 四、漂移检测（Drift Detection）—— 评估的核心产出

四种方法汇总，产出一个漂移检测报告：

```markdown
## Drift Report — ci-sweeper (本周 vs 4周前基线)

| 指标 | 基线 | 本周 | 偏移 | 判定 |
|------|------|------|------|------|
| 基线测试通过率 | 94% | 89% | -5pp | ⚠️ 轻微漂移 |
| 首次修复成功率 | 72% | 65% | -7pp | ⚠️ 下降 |
| avg attempt | 1.4 | 1.8 | +0.4 | ⚠️ 越来越费劲 |
| avg tokens | 165k | 210k | +27% | ⚠️ 成本上升 |
| revert 率 | 3% | 8% | +5pp | 🔴 显著恶化 |
| 分类分布偏移 | — | compile 60→48% | — | ⚠️ 决策变化 |

结论: 多项指标恶化, 怀疑 skill 过时或模型行为变化
建议: ① 人抽检 src/auth/ 相关修复 ② 考虑回滚上次 skill 改动 ③ 跑 A/B 对比当前模型 vs 上个版本
```

**漂移检测的精髓**：单指标变化可能是噪音，**多指标同向恶化**才是真信号。revert 率升 + attempt 升 + token 升，三个一起 = 系统性退化，不是偶发。

### 五、评估触发升级

评估不只是「看」，发现严重问题要**联动 loop 行为**（反衰减篇原则：阈值要联动，不只告警）：

| 评估发现 | 自动动作 |
|----------|----------|
| revert 率 > 10% | loop 强制 L3→L2 |
| 基线通过率 < 80% | loop 暂停 + 调查 |
| 均分 < 3.0（连续两周） | loop 降级 + 人全面 audit |
| 分类分布偏移 > 20% | 触发 Meta-Loop 归因 |

> 这是反衰减机制 4（Baseline）+ 机制 3（Review Gate）的评估视角落地。评估和反衰减是同一枚硬币的两面：评估**发现**衰退，反衰减**对抗**衰退。

---

## 第二部分：韧性（Resilience）—— 让 loop 不死

评估保证「跑得对」，韧性保证「**还在跑**」。loop 进程会崩、状态会损坏、预算会卡死、会死锁——loop 自己救不了自己，需要外部韧性机制。

### 六、五类故障与韧性机制

| 故障 | 症状 | 韧性机制 |
|------|------|----------|
| **进程崩溃** | runner Node 进程挂了 | 进程拉起（supervisor） |
| **状态损坏** | STATE.md 被写脏/截断 | 备份 + 校验 + 恢复 |
| **死锁** | loop 卡在某状态永不收敛 | 超时 + 看门狗 |
| **预算卡死** | day 预算用完，loop 全停 | 预算滚动 + 紧急配额 |
| **级联失败** | 一个 loop 崩连累其他 | 隔离 + 断路器 |

### 七、机制 1：进程拉起（Supervisor）

loop runner 是普通进程，会崩（OOM、未捕获异常、pi 子进程 hang）。需要外部拉起。

#### 三层拉起

```
┌─────────────────────────────────────┐
│ 层1: 进程内 try/catch + 重试          │  ← runner 自己做
│  单次 agent 调用失败 → 重试 3 次      │
├─────────────────────────────────────┤
│ 层2: supervisor 拉起进程              │  ← systemd / pm2 / launchd
│  runner 退出 → 5 秒后重启             │
├─────────────────────────────────────┤
│ 层3: 健康 watchdog                    │  ← 独立进程
│  runner 卡死(进程在但不工作) → kill + 拉 │
└─────────────────────────────────────┘
```

**层 3 最关键**：进程「在」不等于「健康」。loop 可能卡在等 intercom 回复、卡在死循环、卡在 pi hang 住——进程没退出，supervisor 不会拉。需要独立 watchdog 检测「**心跳**」。

#### 心跳机制

```typescript
// runner 每分钟写心跳
setInterval(() => {
  writeFileSync(`~/.pi/loop-control/${loopName}.heartbeat`, Date.now().toString());
}, 60_000);

// watchdog（独立进程）每 5 分钟检查
function checkHeartbeat(loopName: string) {
  const last = readHeartbeat(loopName);
  if (Date.now() - last > 5 * 60_000) {
    // 5 分钟无心跳 = 假死
    killLoopProcess(loopName);   // 杀掉
    supervisor.restart(loopName); // supervisor 会拉起
    alert(`${loopName} 假死, 已重启`);
  }
}
```

**铁律：runner 必须在主动工作时才写心跳**。不能放 `setInterval` 里不管——那样即使主逻辑卡死心跳还在跳，检测不到。正确做法：心跳写在**每个状态转移**时，卡在某状态 = 停跳 = 被检测。

### 八、机制 2：状态备份与恢复

STATE.md 是 loop 的命根子（Memory 篇）。它会被写脏（并发写）、截断（磁盘满）、损坏（进程崩在写一半）。

#### 三重保护

```
① 每次写前备份
   writeState() 前 → cp state.md state.md.bak.{timestamp}
   保留最近 N 份

② 写时原子
   写到 state.md.tmp → fsync → rename 到 state.md
   崩在中间 → .tmp 残留, state.md 仍是旧的

③ 启动校验
   loop 启动 → 校验 state.md schema
   损坏 → 回滚到 state.md.bak.{最新}
   都坏 → 从 run-log 重建（最后手段）
```

```typescript
async function safeWriteState(name: string, state: State) {
  const path = `${name}-state.md`;
  // ① 备份
  await exec(`cp ${path} ${path}.bak.${Date.now()}`);
  // ② 原子写
  const tmp = `${path}.tmp`;
  await writeFile(tmp, serialize(state));
  await exec(`fsync ${tmp}`);   // 强制刷盘
  await rename(tmp, path);      // 原子替换
  // 清理旧备份（保留最近 10 份）
  await pruneOldBackups(path, 10);
}

async function loadStateWithRecovery(name: string): Promise<State> {
  try {
    return parse(await readFile(`${name}-state.md`));
  } catch (e) {
    // 损坏 → 找最新备份
    const bak = findLatestBackup(name);
    if (bak) {
      alert(`${name} state 损坏, 回滚到 ${bak}`);
      return parse(await readFile(bak));
    }
    // 都坏 → 从 run-log 重建
    alert(`${name} state 全损, 从 run-log 重建`);
    return rebuildFromRunLog(name);
  }
}
```

### 九、机制 3：死锁检测与看门狗

loop 卡死的场景：等 intercom 回复人没答、FIX↔VERIFY 死循环（attempt 没设上限）、pi 子进程 hang。

#### 看门狗（Watchdog Timer）

每个状态有超时（L3 篇状态机契约表已列）。看门狗强制执行：

```typescript
// 每个状态入口启动看门狗
function withWatchdog<T>(state: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new WatchdogTimeout(state, timeoutMs)), timeoutMs)
    ),
  ]);
}

// 用法
try {
  const result = await withWatchdog("FIX", 300_000, () => runFixer(...));
} catch (e) {
  if (e instanceof WatchdogTimeout) {
    // 超时 → 强制转移, 不让 loop 卡死
    await escalate(`FIX 超时 300s, 可能 pi hang 或改动过大`);
    state = "ESCALATE";
  }
}
```

**铁律：超时必须转移状态，不能干等**。等 = 死锁。超时即 escalate，让 loop 收敛到 IDLE 或 ESCALATE（L3 篇状态机原则：每条路径收敛）。

#### intercom 反问的超时

双向闭环（网关篇）最易死锁：loop 反问人，人没答，loop 永远等。

```typescript
// 反问必须带超时
const answer = await pi.intercom.ask(traceId, question, { timeoutMs: 30 * 60_000 });
// 30 分钟无答 → 超时 → escalate, 不卡 loop
if (answer.timedOut) {
  await escalate("反问 30 分钟无回应, 交还给人");
}
```

### 十、机制 4：预算滚动与紧急配额

反衰减篇提过预算超限触发降级。但「降级到 L1」后 loop 还要跑（triage 不能停）。需要**预算滚动**避免「月初挥霍、月末停摆」。

```
预算策略:
  day 预算 80% 用完 → 所有 loop 降级 L1（不停）
  day 预算 100% 用完 → 只 Daily Triage 跑（最便宜）
  day 重置（午夜）→ 恢复正常

紧急配额:
  关键事件（主干红）即使超预算也跑 ci-sweeper
  但占用「紧急池」（占总预算 20%，只关键 loop 能用）
```

```typescript
function canRun(loopName: string): { allowed: boolean; level: Level } {
  const spent = budget.spentToday / budget.dailyCap;
  if (spent < 0.8) return { allowed: true, level: configuredLevel(loopName) };
  if (spent < 1.0) return { allowed: true, level: "L1" };  // 降级不停
  // 超预算: 只允许关键 loop + 用紧急池
  if (isCritical(loopName) && budget.emergencyPool > 0) {
    return { allowed: true, level: "L1" };
  }
  return { allowed: false, level: "L1" };
}
```

**设计哲学**：宁可降级慢跑，不要完全停摆。完全停 = loop 系统死 = 失去「长期自驱动」。

### 十一、机制 5：断路器（Circuit Breaker）

Multi-Loop 篇讲了 collision detection 防止 loop 互相撞。断路器防**级联失败**——一个 loop 连续失败，不应连累整个系统。

#### 三态断路器

```
① CLOSED（正常）: loop 正常运行
     │ 连续失败 N 次
     ▼
② OPEN（熔断）: loop 暂停, 直接 fail-fast, 不再尝试
     │ 等待冷却时间（如 30 分钟）
     ▼
③ HALF-OPEN（试探）: 放一个请求试, 成功 → CLOSED, 失败 → 回 OPEN
```

```typescript
class CircuitBreaker {
  private failures = 0;
  private state: "closed" | "open" | "half-open" = "closed";
  private openedAt = 0;

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.openedAt > 30 * 60_000) {
        this.state = "half-open";   // 冷却完, 试探
      } else {
        throw new CircuitOpenError();  // fail-fast, 不尝试
      }
    }
    try {
      const result = await fn();
      this.failures = 0;
      this.state = "closed";          // 成功, 恢复
      return result;
    } catch (e) {
      this.failures++;
      if (this.failures >= 5) {
        this.state = "open";          // 连续 5 次失败, 熔断
        this.openedAt = Date.now();
        alert(`${loopName} 断路器熔断, 连续 5 次失败, 暂停 30 分钟`);
      }
      throw e;
    }
  }
}
```

**断路器的价值**：loop 连续失败时，**停止尝试**比「顽强重试」更好。顽强重试 = 烧 token + 可能级联（每次失败都写脏 STATE、触发通知风暴）。熔断 → 冷却 → 试探，是更理性的恢复策略。

### 十二、韧性的度量（SLO）

把韧性量化成 SLO（Service Level Objective），定期评估：

| SLO | 目标 | 怎么测 |
|-----|------|--------|
| **可用性** | loop 月可用 > 99%（≤ 7h 停摆/月） | 运行时间 / 总时间 |
| **恢复时间 MTTR** | 崩溃到恢复 < 5 分钟 | supervisor 日志 |
| **状态持久性** | STATE 损坏导致数据丢失 = 0 | 校验 + 备份验证 |
| **假死检测率** | 假死 5 分钟内被发现 > 95% | watchdog 日志 |
| **预算遵守** | 月超预算次数 = 0 | 预算日志 |

**SLO 不达标 = 韧性不足**，必须加固对应机制。SLO 是韧性从「感觉还行」到「可证可靠」的桥梁。

---

## 十三、评估与韧性的关系

两块看似独立，实则闭环：

```
韧性保证 loop 还在跑
    ↓
评估发现 loop 跑得对不对
    ↓
评估发现衰退 → 触发反衰减 → Meta-Loop 改进
    ↓
改进后 loop 更可靠 → 韧性压力减小
    ↓
（循环）
```

- 没韧性：loop 频繁崩，评估数据断层（跑不起来没法评）
- 没评估：loop 一直跑，但质量悄悄下降无人知
- **两者齐备**：loop 既跑得住，又跑得对，且越来越对

这是「长期自驱动」的最后闭环：前八篇让 loop「会跑、会记、会协调、接得住、不衰、会进化」，本篇保证它「**跑得稳、跑得对、跑得久**」。

---

## 十四、回顾

**评估（让质量可证）：**

1. **验证 ≠ 评估**：验证是单次门卫，评估是长期审计。两者都要。
2. **四维度**：正确性、效率、安全、对齐。②全自动，①③半自动，④必须人。
3. **四方法**：基线回归（自动）、A/B 对比（半自动）、人工抽检（必须）、线上反馈闭环（最有价值）。
4. **漂移检测**：单指标噪音，多指标同向恶化才是真信号。
5. **阈值联动**：revert>10% 强制降级，评估发现要触发 loop 行为变化。

**韧性（让 loop 不死）：**

6. **五类故障**：进程崩、状态损、死锁、预算卡、级联失败。
7. **进程拉起三层**：try/catch → supervisor → 心跳 watchdog。心跳写在状态转移，不能放 setInterval。
8. **状态三重保护**：写前备份 + 原子写 + 启动校验恢复。
9. **看门狗**：每状态超时强制转移，绝不干等（等 = 死锁）。intercom 反问必带超时。
10. **预算滚动**：降级不停摆，关键 loop 有紧急池。宁可慢跑不要全停。
11. **断路器**：连续失败熔断，冷却试探，比顽强重试更理性。
12. **SLO 量化**：可用性、MTTR、状态持久性——韧性从「感觉」到「可证」。

**两者闭环：** 韧性保证还在跑，评估保证跑得对，共同支撑「长期自驱动」。

一句话收尾：**长期自驱动的 loop，不是「设好就忘」的机器，而是「跑得稳、跑得对、还会越跑越好」的生命体。评估是它的体检，韧性是它的免疫——两者缺一，再聪明的 loop 也活不过一个季度。**

---

## 参考资料

- [系列三：L3 设计](./loop-engineering-l3-design)（验证链、状态机超时、kill switch）
- [系列七：反衰减](./loop-engineering-antidegradation)（基线机制、阈值联动）
- [系列八：Meta-Loop](./loop-engineering-meta-loop)（评估数据喂给 Meta-Loop 归因）
- [系列五：Multi-Loop](./loop-engineering-multi-loop)（collision detection、聚合预算）
- [Cobus Greyling — Operating Loops（cost/logging/when to kill）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/operating-loops.md)
- [Cobus Greyling — Failure Modes](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md)
- 软件工程经典：Circuit Breaker（Martin Fowler）、Watchdog Timer、SLO/SLI（Google SRE）
- pi 能力：run-log（JSONL）· STATE.md · intercom 超时 · 独立进程隔离 · supervisor 拉起

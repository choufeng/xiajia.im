# Loop Engineering 的反衰减：对抗熵增的工程

> 系列第七篇。前六篇：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway)
>
> 前六篇本质都在回答「**怎么让 loop 跑得对**」——一次跑对、安全跑、记得住、协调好、接得住输入。但「长期自驱动」有第六篇没碰的致命问题：**loop 跑得越久，越不如第一天。** 这篇讲怎么对抗它。

---

## 零、衰减是 loop 的宿命

先建立一个反直觉的认知：**普通服务不会衰减，loop 会。**

普通服务跑的是固定代码，第一天和第三百天行为一致。loop 不一样——它跑的是「模型 + 状态 + 记忆 + skill」的组合，**这些都在变**：

| 变化源 | 后果 |
|--------|------|
| STATE.md / 记忆不断累积 | 引用过期项（State Rot） |
| loop 不断产代码，人没读 | Comprehension Debt 爆炸 |
| 人不再逐项盯，loop 自行决策 | Cognitive Surrender |
| 项目演进，旧 skill 过时 | intent debt 回潮 |
| 模型升级 / 依赖更新 | 行为漂移 |

这是 loop 的「**熵增**」——方向确定（越来越乱），速度取决于你是否主动对抗。

> 概念篇引过三个 decay 概念：Intent Debt、Comprehension Debt、Cognitive Surrender。那篇只是「介绍」，这篇讲**怎么治**。没有主动对抗机制，这三个必然累积，loop 三个月后不如第一天。

**反衰减工程的目标**：让 loop 跑第 N 天的质量，不低于第 1 天。

---

## 一、四种衰减形态

衰减不是单一现象，有四种，每种要不同的药。

```
                        loop 跑久了
                           │
       ┌─────────┬─────────┼─────────┬─────────┐
       ▼         ▼         ▼         ▼         ▼
   ① 状态腐  ② 知识腐  ③ 认知腐  ④ 行为漂
   State Rot Debt    Surrender  Drift
       │         │         │         │
   STATE 引过  loop 产代   人不再    模型/依赖
   期项       码人没读    盯        升级致偏移
```

### ① 状态腐败（State Rot）

**症状**：STATE.md 引用已合并 PR、已关闭 ticket、已删分支。loop 去操作「幽灵」。

**根因**：无 prune、不校验 ID 存活、多 loop 共写无 schema。

**Cobus 的定性**：S1→S2（无害到有害）。

### ② 知识债（Comprehension Debt）

**症状**：仓库里 30% 的代码是 loop 写的，你一行没读过。某天出事，没人看得懂。

**根因**：loop 越快，越快产出人没写过的代码，人没主动读 = 债只增不减。

**Addy Osmani 的警告**：「**Faster loops ship more code you didn't write — comprehension debt grows unless you read what the loop made.**」

### ③ 认知投降（Cognitive Surrender）

**症状**：人把 loop 设成 L3 就不管了，慢慢对它的产出失去判断力，loop 说啥是啥。

**根因**：人不再 review，把判断外包给 loop。**同样的「放手」动作，带判断设计是解药，逃避思考是催化剂。**

**这是最危险的衰减**——前两种伤代码，这种伤**人**。人一旦失去对 loop 的判断力，前三种衰减都无人发现。

### ④ 行为漂移（Behavior Drift）

**症状**：模型从 claude-sonnet 升到 claude-opus，同一个 prompt 产出变了；依赖升级让测试语义变了；skill 写于半年前，项目约定早变了。

**根因**：loop 的「模型 + skill + 依赖」三者都是会变的底座，无版本锚点。

**隐蔽性**：漂移是**渐变**的，单次运行看不出来，累积后才显形。等发现时已偏很久。

---

## 二、反衰减的四类机制

四种衰减，四类药。每类对应一个工程机制。

| 衰减 | 对抗机制 | 频率 | 触发者 |
|------|----------|------|--------|
| ① State Rot | **主动清理**（Prune） | 每 run | loop 自己 |
| ② Comprehension Debt | **强制阅读节奏**（Read Cadence） | 每周 | 人（强制） |
| ③ Cognitive Surrender | **强制 review 闸门**（Review Gate） | 定期 | 人（强制） |
| ④ Behavior Drift | **基线 + 回归**（Baseline） | 模型/依赖变更时 | CI / meta-loop |

**核心区分**：① 是 loop 自愈（自动）；②③ 是**强制人介入**（loop 不能自评自己的认知债）；④ 是工程化基线（可自动）。**②③ 永远不能交给 loop 自己**——这正是反衰减的精髓：有些衰退只能靠人，机制的作用是「逼人不可缺席」。

---

## 三、机制 1：主动清理（Prune）—— 治 State Rot

这是 loop 自愈部分，可全自动。

### 每 run 的清理检查表

```typescript
// 每个 loop 的 CLEANUP 状态（见 L3 篇）必须做
async function antiRotPrune(loopName: string) {
  const state = readState(`${loopName}-state.md`);

  for (const item of state.active) {
    // ① 校验 ID 存活: PR/issue 是否还存在
    const alive = await checkAlive(item.ref);   // GitHub API / DB 查询
    if (!alive) {
      state.archive.push({ ...item, prunedAt: now(), reason: "ref closed" });
      state.active = state.active.filter(x => x.id !== item.id);
      continue;
    }
    // ② TTL 过期: 超过 N 天未更新 → 归档
    if (daysSince(item.lastUpdate) > item.ttlDays) {
      moveToArchive(item, "ttl_expired");
    }
    // ③ 矛盾检测: 与其他 state 冲突 → 标记 inbox
    if (conflictsWithOtherLoops(item)) {
      state.inbox.push({ item, conflict: "multi-loop overlap" });
    }
  }
  // ④ History 区定期归档到 ④语义层（见 Memory 篇）
  if (state.history.length > 100) {
    archiveToSemanticMemory(state.history.splice(0, 50));
  }
  writeState(state);
}
```

### 防腐的四个硬规则

1. **每 run 必 prune**：CLEANUP 状态强制调用，不 prune 不算完成。
2. **引用必校验存活**：PR/issue/分支，用前查 API 确认还在。
3. **带 TTL**：每项有 `ttlDays`，超期自动归档（默认 30 天）。
4. **History 不堆主文件**：长尾迁到语义层，否则 STATE.md 膨胀挤爆上下文（Memory 篇原则）。

> **State Rot 是最易治的衰减**——纯工程，loop 自己能搞定。难的是后面三种。

---

## 四、机制 2：强制阅读节奏（Read Cadence）—— 治 Comprehension Debt

这个**不能自动**。机制的作用是逼人不可缺席。

### Comprehension Debt 量化

先让债**可见**，才能管理。每周生成一份「债单」：

```markdown
## Comprehension Debt Report — Week of 2026-06-10

### 本周 loop 产出（你需读的）
| 来源 | 改动 | 行数 | 你读过? |
|------|------|------|---------|
| ci-sweeper | src/auth/oauth.ts | +42 -8 | ❌ |
| dep-sweeper | package.json + lockfile | +3 -3 | ❌ |
| pr-babysitter (建议) | src/api/handlers.ts | (建议) | — |

### 累积未读
- 总未读改动: 1,247 行 (跨 18 文件)
- 最久未读: src/legacy/billing.ts (89 天, 312 行)

### 风险信号
⚠️ 未读占比 23% (>15% 阈值, 建议 L3 降级到 L2)
⚠️ src/auth/ 完全无人类接触 30 天
```

### 强制阅读闸门

```typescript
// 周报 loop（meta-loop 的一种, 见第八篇）自动生成 + 强制 review
const report = await generateDebtReport();
const unreadRatio = report.unreadLines / report.totalLoopLines;

if (unreadRatio > 0.15) {
  // 阈值触发: 不降级, 但 BLOCK loop 继续 L3
  setLoopFlag("ci-sweeper", "DEGRADE_TO_L2");
  notify(`⚠️ Comprehension Debt ${Math.round(unreadRatio*100)}% > 15%。
          CI Sweeper 已强制降级 L3→L2，直到人 review 未读改动。`);
}
```

**关键设计**：阈值不是「通知人」，而是**「强制降级 loop」**——loop 失去 L3 资格，直到人补读。这逼人不可缺席，否则 loop 自动减速。

### 阅读节奏建议

| 频率 | 动作 | 时长 |
|------|------|------|
| 每日 | 读当日 loop 产出的 diff（通勤 10 分钟） | 10min |
| 每周 | 读周报，过一遍未读清单 | 30min |
| 每月 | 深读高风险区（auth/payments/infra） | 1-2h |
| 每季 | 全面 audit，重新评估 loop 自治级别 | 半天 |

> **铁律：loop 跑多快，人就要读多快。** 跑得快但读得慢，就是在透支理解力。Cobus 的反模式 #4「L3 before L1 quality」本质就是这个——没读够就上 L3，理解债爆炸。

---

## 五、机制 3：强制 Review 闸门（Review Gate）—— 治 Cognitive Surrender

认知投降最阴险：人**感觉**一切正常，实际已失去判断力。机制不能依赖人「自觉」，必须**强制**。

### 三层强制 review

```
┌────────────────────────────────────────────────────┐
│  层1: 每次合并自动 review prompt (软强制)            │
│  loop 合并后, 在 PR/STATE 留 review checklist       │
│  人不点确认 → 下次 loop 提示「上次未 review」        │
├────────────────────────────────────────────────────┤
│  层2: 定期 review 周期 (硬强制)                      │
│  每 N 次合并 / 每 N 天 → loop 必须暂停, 等人 review  │
│  不 review 不恢复 (像 git hook 一样硬)               │
├────────────────────────────────────────────────────┤
│  层3: 自治级别重新评估 (制度强制)                    │
│  每月/季人主动 audit, 决定 loop 留在 L3 还是降级     │
│  这是制度, 不是 loop 能自动的                        │
└────────────────────────────────────────────────────┘
```

### Review Checklist（每次合并必过）

loop 合并后自动生成，人必须逐项打勾才能让 loop 继续：

```markdown
## Review Required — PR #142 merged by ci-sweeper

- [ ] 我读了完整 diff，理解每一行
- [ ] 我能向同事解释这次改动为什么对
- [ ] 测试覆盖了改动的核心路径
- [ ] 没有触碰 denylist（auth/secrets/migrations）
- [ ] 这个修复治的是根因，不是症状

[确认 review]  ← 不点 → loop 下次合并被 BLOCK
```

**设计的狠在于**：不是「建议 review」，是「**不 review loop 就停**」。把人的判断力变成 loop 继续运行的前置条件。

### 反投降的三个信号

人出现这些信号 = 已认知投降，必须强制介入：

| 信号 | 含义 | 对策 |
|------|------|------|
| 连续 N 次无脑点「确认」 | 形式化 review | 强制读 diff 才能解锁 |
| 不知道 loop 最近干了啥 | 已脱节 | 暂停 loop，强制补读 |
| loop 出事时答不出「为什么」 | 判断力丧失 | 立即降级，重新介入 |

> **Cognitive Surrender 的本质**：人把 loop 当黑盒。所有反投降机制的目标都是**让人无法把 loop 当黑盒**——强制阅读、强制 review、强制解释。

---

## 六、机制 4：基线 + 回归（Baseline）—— 治 Behavior Drift

漂移是工程问题，可自动化。

### 基线测试集

给 loop 建一套**固定输入 → 期望输出**的测试集，每次变更跑回归。

```yaml
# loop-baseline.yaml — CI Sweeper 的行为基线
cases:
  - id: oauth-500
    input:
      ci_logs: "fixtures/oauth-500.txt"
      state: "fixtures/state-empty.md"
    expected:
      triage_class: "compile"        # 应分类为编译错
      target_files: ["src/auth/"]    # 应只动 src/auth/
      must_not_touch: ["**/lock*", "**/migrations/**"]
      escalate: false                # 不应 escalate

  - id: flaky-timeout
    input:
      ci_logs: "fixtures/flaky-timeout.txt"
    expected:
      triage_class: "flake"
      target_files: []               # flake 不应改代码
      escalate: true                 # 应 escalate quarantine

  - id: dep-resolution
    input:
      ci_logs: "fixtures/dep-fail.txt"
    expected:
      triage_class: "deps"
      escalate: true                 # 依赖问题必 escalate
```

### 回归触发时机

| 触发 | 跑什么 | 不通过则 |
|------|--------|----------|
| **模型升级** | 全基线集 | 阻止升级 / 调 skill |
| **依赖升级** | 全基线集 + 实际测试 | 阻止升级 |
| **skill 修改** | 相关基线 | 阻止 merge |
| **每周** | 抽样基线（早期漂移检测） | 告警 + 调查 |
| **每次 loop 合并** | 增量基线（本次相关） | 阻止 loop 合并 |

### 漂移检测指标

不只看「过不过」，看**输出分布**的变化：

```typescript
// 每周对比输出分布
const thisWeek = collectOutputs("ci-sweeper", "2026-W24");
const baseline = loadBaseline("ci-sweeper", "2026-W20");

const drift = {
  classifyShift: distributionDiff(thisWeek.classify, baseline.classify),
  // 分类分布: compile 60%→40%? flake 10%→30%? 大幅偏移 = 漂移
  radiusGrowth: thisWeek.avgFilesPerFix - baseline.avgFilesPerFix,
  // 平均改动半径: 1.2 文件 → 3.5 文件? loop 越改越大 = 失控信号
  escalateRate: thisWeek.escalateRate - baseline.escalateRate,
  // escalate 率: 30%→5%? 可能是护栏失效（该 escalate 没 escalate）
};
if (drift.classifyShift > 0.2 || drift.radiusGrowth > 1) {
  alert("行为漂移检测: " + JSON.stringify(drift));
}
```

> **Behavior Drift 的隐蔽性在于渐变**：单次运行看不出来。基线 + 分布对比，是把渐变变成可观测的突变。

---

## 七、pi 上的反衰减实现

pi 的能力组合起来，四机制都能落地。

| 机制 | pi 载体 | 实现 |
|------|---------|------|
| **Prune** | bash tool + STATE.md | CLEANUP 状态调 `gh pr view` / `git branch` 校验存活 |
| **Read Cadence** | memory 工具 + intercom | meta-loop 用 memory 记「已读/未读」，超阈值 intercom 通知 |
| **Review Gate** | intercom + STATE flag | loop 合并后 intercom 推 review checklist，未确认设 STATE flag 阻塞 |
| **Baseline** | bash + 自定义 eval tool | 基线集作为 fixtures，CI/meta-loop 跑 `pi -p` 对比输出 |

### 关键：meta-loop 是反衰减的执行体

四机制里，Prune 是 loop 自己干，其余三个（Read Cadence / Review Gate / Baseline）**需要一个「监管 loop 的 loop」**来执行——这就是下一篇要讲的 **Meta-Loop**。

反衰减机制天然指向 meta-loop：你无法让 loop 自评认知债，但你可以**再写一个 loop 去量化它、强制人 review**。这是 loop 工程的递归性。

---

## 八、衰减仪表盘（Antidegradation Dashboard）

把四类衰减可视化，每周看一次：

| 指标 | 健康 | 警告 | 危险 |
|------|------|------|------|
| **State Rot**：过期引用数 | 0 | 1-3 | >3 |
| **Comprehension Debt**：未读占比 | <10% | 10-15% | >15%（强制降级） |
| **Review 遵守率**：已 review / 应 review | 100% | 80-99% | <80%（暂停 loop） |
| **Behavior Drift**：分类分布偏移 | <5% | 5-15% | >15%（调查） |
| **平均改动半径**：文件数/fix | <2 | 2-3 | >3（失控） |
| **Escalate 率** | 20-40% | <20% 或 >40% | <10%（护栏失效） |

**三个阈值触发自动动作**（不只告警）：
- 未读 >15% → loop 强制 L3→L2
- review 遵守 <80% → loop 暂停
- escalate 率 <10% → 怀疑护栏失效，调查

> **反衰减的核心信念**：告警没人看等于没告警。阈值必须**联动 loop 行为**（降级/暂停），不只是发通知。

---

## 九、反衰减是制度，不是代码

最后回到一个根本认知：

| 类型 | 谁负责 | 能否自动 |
|------|--------|----------|
| **State Rot** | loop 自己 | ✅ 全自动 |
| **Behavior Drift** | CI + meta-loop | ✅ 可自动 |
| **Comprehension Debt** | 人 | ❌ 只能量化，不可自愈 |
| **Cognitive Surrender** | 人 | ❌ 只能强制，不可替代 |

**四种衰减，只有两种能完全自动对抗。另两种本质是人的问题**——loop 越自治，人越容易脱节，脱节是认知投降的起点。

所以反衰减工程的真正产出，不是代码，而是**一套制度**：
- loop 自动 prune + 基线回归（代码能做的）
- 强制阅读节奏 + review 闸门（代码强制人做的）
- 定期自治级别重新评估（纯人制度）

没有这套制度，loop 跑得越久越像定时炸弹。有了它，loop 才配叫「长期自驱动」。

---

## 十、回顾

1. **衰减是 loop 独有的宿命**：普通服务不衰减，loop 因「模型+状态+记忆+skill」都在变而必然熵增。
2. **四种衰减**：State Rot（状态腐）、Comprehension Debt（知识债）、Cognitive Surrender（认知投降）、Behavior Drift（行为漂移）。
3. **State Rot 最易治**：每 run prune + 校验存活 + TTL + History 归档，全自动。
4. **Comprehension Debt 靠强制阅读**：量化未读占比，超阈值**强制降级 loop**，逼人补读。
5. **Cognitive Surrender 最危险**：靠 review 闸门，不 review loop 就停，让人无法把 loop 当黑盒。
6. **Behavior Drift 靠基线 + 回归**：固定测试集 + 输出分布对比，把渐变变可观测。
7. **反衰减天然指向 Meta-Loop**：量化债、强制 review、跑基线，需要一个监管 loop 的 loop。
8. **本质是制度不是代码**：四种里两种能自动，另两种是人的问题，机制的作用是逼人不可缺席。

一句话收尾：**反衰减的目标不是让 loop 永远不衰退——那不可能。而是让衰退发生时，要么 loop 自己修，要么人被强制叫回来。绝不允许「静默退化」。**

---

## 参考资料

- [系列一：Loop Engineering 概念](./loop-engineering)（Intent Debt / Comprehension Debt / Cognitive Surrender 的原始定义）
- [系列三：L3 设计](./loop-engineering-l3-design)（CLEANUP 状态、State Rot 防护）
- [系列四：Memory 系统](./loop-engineering-memory)（State Rot、遗忘策略、压缩）
- [Cobus Greyling — Anti-Patterns](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md)
- [Cobus Greyling — Failure Modes（State Rot）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md)
- [Cobus Greyling — Loop Design Checklist（Readiness Levels）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/loop-design-checklist.md)
- Addy Osmani：「Faster loops ship more code you didn't write — comprehension debt grows unless you read what the loop made.」

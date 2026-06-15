# Comprehension Debt 管理：loop 产代码，谁来读

> 系列第二十篇。方法论与思想分册第二篇。
>
> 前序：[概念](./loop-engineering) · [pi L1](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent](./loop-engineering-sub-agent) · [Skills](./loop-engineering-skills) · [Worktree](./loop-engineering-worktree) · [Scheduling](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup) · [Documentation](./loop-engineering-documentation) · [Intent Debt](./loop-engineering-intent-debt)
>
> 方法论分册三篇深挖 loop 工程的三个核心「债」概念。上一篇 [Intent Debt](./loop-engineering-intent-debt) 讲「loop 起步冷启动缺意图」。这篇讲第二个——**Comprehension Debt（理解债）**：loop 越跑越快，产出的代码你一行没读过，债只增不减。

---

## 零、一句话定义

先看两个定义：

> **Cobus Greyling**：「理解债是**仓库里实际存在的东西**与**你真正理解的东西**之间的差距。」

> **Addy Osmani**：「loop 产代码越快，你没写过的代码就越多，**仓库里存在的东西和你真正理解的东西之间的差距就越大**。这就是理解债。loop 越顺，债长得越快——除非你**主动去读 loop 产的东西**。」

两个定义指向同一件事，但 Addy 补了关键的动态视角：**理解债的增长速度，与 loop 的顺畅程度成正比。loop 越好，债涨得越快。**

这构成一个反直觉的悖论：

```
loop 做得好（顺、快、产出多）
        ↓
理解债增长更快（你没读过的代码更多）
        ↓
你越不了解仓库实际状态
        ↓
你越难判断 loop 下一步对不对
        ↓
loop 越好，你反而越危险
```

本文把这个悖论拆透：理解债从哪来、为什么是 loop 时代独有的新问题、怎么还、loop 产代码该怎么设计才能「可读」。

---

## 一、为什么理解债是 loop 时代独有问题

理解「为什么新」之前，先看旧时代为什么不存在。

### 人写人读时代

人写代码，有一个隐含机制保证理解债不累积：

```
你写了一段代码 → 你必然读过它（你刚写的）
                ↓
代码进入仓库时, 作者已经理解它
                ↓
接手的人 review → 读一遍
                ↓
理解债被 review 过程自然消化
```

**写代码的人，天然理解自己写的东西。** 这是人类开发的隐含保证。review 是第二道消化。理解债在这个循环里能维持动态平衡。

### Loop 写人不读时代

loop 打破了这个隐含保证：

```
loop 写了一段代码 → loop 不"理解"它（模型生成, 非有意为之）
                    ↓
代码进入仓库时, 没有任何人类读过
                    ↓
如果 loop 自主合并 (L3) → 连 review 都没有
                    ↓
理解债无人消化, 只增不减
```

**核心断裂**：代码的「作者」（loop）不承担责任，该读的人（你）又不在场。这段代码进入了你的仓库，但**仓库里没有任何一个人类真正理解它**。

这就是理解债的本质——不是「代码质量差」，而是**「代码存在，但无人理解」**。哪怕 loop 写的代码完美无 bug，只要没人读过，它就是债。

### 一个具象对比

| | 人写代码 | loop 写代码 |
|---|---------|-------------|
| 谁是作者 | 人 | 模型（无意图） |
| 作者理解吗 | ✅（刚写的） | ❌（生成而非设计） |
| 进入仓库时有人读过吗 | ✅（作者） | ❌ |
| review 消化债 | ✅（被动还债） | L1/L2 有，L3 没有 |
| 债的趋势 | 动态平衡 | 只增不减（除非主动读） |

> **关键洞察**：理解债不是「代码烂」的问题，是「**人在不在场**」的问题。loop 把人从「写-读循环」里抽掉了，债就失去了自然消化机制。

---

## 二、理解债的来源：产出速度 > 阅读速度

把理解债量化成一个公式：

```
理解债(t) = ∫[loop产出速度 - 人阅读速度] dt
```

- **loop 产出速度**：每分钟产多少行新代码（CI Sweeper 15 分钟一轮，每轮可能几十行改动）
- **人阅读速度**：每分钟能读多少行并真正理解（人读代码远慢于读自然语言）

这两者的差，**永远是正数**——因为 loop 跑得比人读得快，这是物理事实。

### 速度差的量级

```
CI Sweeper:    每 15 分钟可能产出 20-50 行改动 → 每天 96 轮 → 潜在 2000-5000 行/天
人阅读速度:    真正理解代码 ≈ 200 行/小时（不是浏览, 是理解）
                假设每天抽 30 分钟读 → 100 行/天

债的日增长:    2000 - 100 = 1900 行/天（最坏情况）
```

当然，不是每轮 CI Sweeper 都产出改动（多数 triage 空 exit）。但只要 loop 偶尔产出，且人没跟上，债就累积。

### 债累积的现实表现

Cobus 的 `why-we-killed-ci-sweeper` 故事是一个极端案例：

> CI Sweeper 跑了 4 天，48 小时烧掉 8M token，提了 11 个 PR，其中 3 个是治症状的，1 个差点破坏生产配置（在人 review 时拦住）。

这个故事里，理解债表现为：**loop 产出的 11 个 PR，团队能 review 的只有一部分，且 review 时发现 4 个有问题**。如果没 review（纯 L3），这 4 个就进了主干。

> Addy 的原话精准概括：「**你的理解会腐烂，如果你允许它。loop 产代码越快，你没写过的代码就越多，差距就越大。**」

---

## 三、债的复利：未读 → 不理解 → 错上加错

理解债最危险的不是「债本身」，而是**它会产生复利**——债会自我加速。

### 复利链条

```
① loop 产了代码 A, 人没读
        ↓
② 人不理解 A 存在/做什么
        ↓
③ loop 下一次基于「包含 A 的仓库」做改动 B
   (loop 不知道 A 是对是错, 只是基于现状继续改)
        ↓
④ 如果 A 有问题, B 可能建立在 A 的错误假设上
        ↓
⑤ 人也不理解 B (因为连 A 都没读)
        ↓
⑥ 出事时: 没人知道 A 和 B 的关系, 调试地狱
```

这就是理解债的**复利效应**：未读的代码不是静止的债，它会成为后续代码的**地基**。地基没人验过，上面的楼越多越危险。

### 复利的三个加速器

| 加速器 | 机制 | 后果 |
|--------|------|------|
| **loop 跑得快** | 产出多 → 地基多 → 债的底面积大 | 债增长是平方级而非线性 |
| **L3 无 review** | 连被动消化都没有 | 债零阻碍增长 |
| **文件交叉** | A 改了文件 X, B 基于改过的 X 再改 | 理解一个改动需要理解它依赖的所有前序改动 |

> **铁律：理解债不是静态的「欠了多少行没读」，而是动态的「未读代码正在成为未来错误的隐藏地基」。** 这就是为什么必须主动还债，而不是「等有空再读」——等的过程中，债在收复利。

---

## 四、Addy Osmani 的警告：loop 改变工作，但不删除你

Addy 的 canonical essay 里有三段话，精确描述了理解债在 loop 时代的位置。逐一展开。

### 警告一：理解会腐烂

> 「**你的理解会腐烂，如果你允许它。** loop 产代码越快，你没写过的代码就越多，仓库里存在的东西和你真正理解的东西之间的差距就越大。这就是理解债。**loop 越顺，债长得越快——除非你读 loop 产的东西。**」

关键词是「**除非**」。理解债不是 loop 的固有缺陷，而是**人的缺席**造成的。loop 没问题，问题在人不去读。Addy 把责任明确放在人这边——不是「loop 别产那么多」，而是「你得去读」。

### 警告二：loop 改变工作，不删除你

> 「**loop 改变了工作，它没有把你从工作里删除。** 而且有三个问题，loop 越好反而越尖锐，不是越容易。」

理解债就是这三个「越尖锐」的问题之一。直觉上「loop 好了 = 我轻松了」，实际上「loop 好了 = 债涨更快 = 我更要警惕」。loop 的进步不消除人的责任，而是**重新定义**它——从「写代码」变成「读代码并保持理解」。

### 警告三：ship code you confirmed works

> 「你的工作是发布**你确认过能用**的代码。」

这句话直接指向理解债的解药：**确认**。不是「loop 说好了」，而是「你确认过」。理解债的本质就是「未确认」，还债的方式就是「去确认」。

> Addy 的三段话构成完整逻辑链：理解会腐 → loop 加速腐 → 但你的工作是确认 → 所以必须主动读。这不是建议，是 loop 时代的**职业纪律**。

---

## 五、三种还债机制

理解债无法消灭（loop 永远比人快），但可以**控制在不危险的水位**。三种机制，从日常到制度。

### 机制 1：强制阅读节奏（Read Cadence）

最基础的还债方式——**定期、有节奏地读 loop 产出**。

| 频率 | 读什么 | 时长 | 目的 |
|------|--------|------|------|
| **每日** | 当天 loop 产出的 diff | 10-15 分钟 | 防债日增，保持连续理解 |
| **每周** | 周报 + 未读清单 | 30 分钟 | 补漏，发现遗漏的改动 |
| **每月** | 高风险区深读（auth/payments/infra） | 1-2 小时 | 防「关键路径无人理解」 |
| **每季** | 全面 audit + 自治级别重评 | 半天 | 战略级还债，决定 loop 去留 |

**铁律：loop 跑多快，人就要读多快。** 跑得快读得慢 = 透支理解力。每日 10 分钟是底线，不是上限。

### 机制 2：未读占比阈值 + 强制降级

反衰减篇讲过的机制，这里从理解债视角展开。

先把债**量化可见**：

```markdown
## Comprehension Debt Report — Week of 2026-06-15

### 本周 loop 产出
| 来源 | 文件 | 行数 | 你读过? |
|------|------|------|---------|
| ci-sweeper | src/auth/oauth.ts | +42 -8 | ❌ |
| dep-sweeper | package.json | +3 -3 | ❌ |
| pr-babysitter | src/api/handlers.ts | +28 -5 | ✅ |

### 累积未读
- 总未读: 1,247 行 (跨 18 文件)
- 总 loop 产出: 5,420 行
- 未读占比: 23%

### 阈值状态
⚠️ 23% > 15% 阈值 → CI Sweeper 已强制降级 L3→L2
```

**阈值联动是精髓**（反衰减篇原则：告警没人看等于没告警，阈值必须联动 loop 行为）：

```typescript
const unreadRatio = report.unreadLines / report.totalLoopLines;

if (unreadRatio > 0.15) {
  // 不只是通知, 是 BLOCK loop 继续 L3
  setLoopFlag("ci-sweeper", "DEGRADE_TO_L2");
  notify(`⚠️ 理解债 ${Math.round(unreadRatio*100)}% > 15%。
          CI Sweeper 强制降级 L3→L2。
          人 review 未读改动后, 手动恢复。`);
}
```

**为什么是 15%**：经验阈值。低于 10% 可控（日常阅读能消化），10-15% 需警惕，超 15% = 债已失控，必须强制人介入。这个数字根据团队调整，但**必须有阈值且必须联动**。

> **核心设计**：不是「建议人去读」，是「**不读 loop 就降级**」。把人的理解债变成 loop 继续运行的前置条件。

### 机制 3：高风险区定期深读

理解债不是均匀分布的。改 `docs/typo.md` 的债，远小于改 `src/auth/token.ts` 的债。

按风险分级，高风险区强制深读：

| 风险区 | 定义 | 深读频率 |
|--------|------|----------|
| **🔴 临界** | auth / payments / security / migrations / infra | 每月深读，每次 loop 改动必读 |
| **🟡 高** | 核心业务逻辑 / API 层 / 数据模型 | 每两周扫一遍 |
| **🟢 低** | docs / tests / config / 工具脚本 | 每月抽检 |

```markdown
## 高风险区追踪
- src/auth/ → 30 天无人类接触 🔴 → 强制: 下次 loop 改动必须人 review 才能 merge
- src/payments/ → 15 天无人类接触 🟡 → 提醒
- docs/ → 45 天无人类接触 🟢 → 可忽略
```

> **理解债的风险是加权的**：一行 auth 代码的债，等价于一百行文档的债。还债资源有限时，优先还高风险区。

---

## 六、Loop 产代码的可读性设计

还债不只是「人去读」，还可以从源头降低债——**让 loop 产出的代码更容易读**。

### 问题：loop 代码的常见可读性陷阱

| 陷阱 | 表现 | 后果 |
|------|------|------|
| **过度紧凑** | 一行塞三个操作，三元嵌套 | 读一行要想三分钟 |
| **无命名意图** | `handleData` / `processItem` / `temp1` | 看名字不知道做什么 |
| **缺上下文** | 魔法数字、无注释的非常规操作 | 不知为何这样写 |
| **治症状式** | 加了个 hack 让测试过，不解释根因 | 读者以为是故意的设计 |
| **风格不一致** | 和仓库既有代码风格脱节 | 增加认知负担 |

### 可读性设计原则

这些原则要写进 loop 的 skill（fixer / implementer），让产出天然可读：

**原则 1：命名表达意图**

```
❌ loop 常产出:  const result = processData(input, true)
✅ 应要求产出:   const sanitizedToken = refreshTokenSafely(rawToken, { force: true })
```

在 skill 里写明：「命名必须表达**做什么 + 为什么**，不只是**做某事**」。

**原则 2：改动附说明（commit message / PR 描述）**

```
❌ "fix: update token handling"
✅ "fix(auth): refresh token before expiry to prevent 500 on callback

Root cause: OAuth callback 500 when token expired mid-session.
Fix: proactively refresh token if expiry < 5min.
Verified: npm test auth/* all pass."
```

loop 产出的每个改动，PR 描述必须包含：**根因 + 改动思路 + 验证方式**。这不是给人看的装饰，是给**下一个读这段代码的人**（可能是另一个 loop，也可能是三个月后的你）留的地图。

**原则 3：最小改动原则**

```
❌ loop 倾向: 顺手重构了一下旁边的代码（"看起来更干净"）
✅ 应要求:    只改和 bug 相关的行，其他不动
```

最小改动不只是安全设计（L3 篇的护栏），也是**可读性设计**——改动越小，人需要读的越少，理解债增量越小。

**原则 4：拒绝治症状**

```
❌ 治症状:  catch (e) { /* ignore */ }  → 让测试过
✅ 治根因:  找到 e 为什么抛, 修源头
```

Cobus 的 anti-pattern #8「Fixing flakes with code」就是治症状的典型。治症状的代码最难读——因为它没有逻辑，只有「让报错消失」的意图。这个意图不在代码里，读者完全猜不到。

### 可读性检查清单（写进 verifier skill）

verifier 不只验测试过不过，还验可读性：

```markdown
## Verifier 可读性检查
- [ ] 命名表达意图（非 processX / handleData）
- [ ] 改动附根因说明（PR 描述有 Root cause）
- [ ] 最小改动（无顺手重构）
- [ ] 无治症状 hack（catch ignore / 盲目加 timeout）
- [ ] 风格与仓库一致
```

> **可读性是理解债的第一道防线**：代码可读，人读得快，债还得起。代码不可读，人读得慢甚至放弃，债指数增长。把可读性要求写进 skill 和 verifier，是从源头控债。

---

## 七、理解债与 Code Review 的关系

一个常见误解：「我们有 code review，理解债不是问题。」

这个误解危险。**Code review 是被动还债，不充分。**

### Review 的三个局限

| 局限 | 说明 | 后果 |
|------|------|------|
| **L3 没 review** | loop 自主合并，绕过 review | 零消化 |
| **review 质量递减** | PR 多了，review 越来越快，越来越水 | Verifier Theater（韧性篇概念） |
| **review 只看 diff** | 看 diff ≠ 理解全貌（不理解上下文） | 局部通过，全局不理解 |

Cobus 的 `why-we-killed-ci-sweeper` 案例里，review 拦住了破坏生产配置的 PR——但那是**人 review**，不是 loop review。而且「拦住」意味着已经产出了有问题的代码，review 是**事后兜底**，不是**事前理解**。

### Review vs 主动阅读

| | Code Review | 主动阅读 |
|---|------------|----------|
| 时机 | PR 提交时（被动） | 定期（主动） |
| 范围 | 单个 PR 的 diff | 跨 PR 的累积状态 |
| 目标 | 这个 PR 能不能 merge | 仓库整体我理不理解 |
| 深度 | 看改动对不对 | 理解改动之间的关联 |
| 防什么 | 单次错误 | 理解债复利 |

**review 防单次错误，主动阅读防理解债复利。** 两者互补，不可替代。只靠 review = 只防「这次错」，不防「三个月后没人懂」。

> Addy 的话在这里依然成立：「你的工作是发布你**确认**过能用的代码。」review 是确认的一种，但不是全部。**定期主动阅读是更深层的确认——确认你仍然理解自己的仓库。**

---

## 八、「谁该读」：作者责任 vs 维护者责任

理解债引出一个责任问题：loop 产出的代码，**谁有义务读**？

### 三种角色，三种责任

| 角色 | 责任 | 读什么 |
|------|------|--------|
| **loop 操作者**（设 loop 的人） | 最高责任——你设 loop 自主产代码，你就该读 | 所有 loop 产出 |
| **代码维护者**（管这块代码的人） | 次高——loop 改了你管的模块，你该知道 | 本模块的 loop 产出 |
| **PR Reviewer** | 最低但最频繁——review 是第一道消化 | 被分配的 PR |

### loop 时代的新责任矩阵

人写代码时代，作者是第一责任人（你写的你负责）。loop 时代，**作者（loop）无法承担责任**，责任转移到操作者和维护者：

```
人写代码:   作者(人) ──负全责──→ review(人) ──消化债
loop 写代码: 作者(loop) ──无法负责──→ ??? ──消化债
                                  ↑
                          责任真空！
```

填补这个真空的，是**loop 操作者**——那个决定「让 loop 跑 L3」的人。你启动了它，你就对它的产出负有阅读义务。

> **铁律：开 loop 的人，就是欠理解债的人。** 这不是技术问题，是责任归属。如果你不想读 loop 产出的代码，你就没资格开 L3。

### 团队场景的责任分配

| 场景 | 谁读 |
|------|------|
| 个人项目，自己开 loop | 自己读（全责） |
| 团队，一个人开 loop | 开的人读 + 团队定期 audit |
| 团队，多人各开各的 loop | 每人读自己的 + 高风险区交叉 review |
| Meta-Loop 管 loop | Meta-Loop 量化债 + 通知，但**人**读（Meta-Loop 不能替你理解） |

> Meta-Loop（第八篇）能**量化**理解债（算未读占比、生成债单），但它**不能替你读**。理解是人的认知活动，无法外包给 loop。Meta-Loop 的价值是「让债可见 + 逼人还」，不是「替人还」。

---

## 九、理解债的预警信号

怎么知道理解债已经失控？除了看占比数字，还有一些行为信号：

| 信号 | 含义 | 紧急度 |
|------|------|--------|
| **「这段代码谁写的？」** | 连 loop 产的你都不记得了 | 🔴 债已影响日常 |
| **出 bug 时不知从何查起** | 不理解代码结构 | 🔴 债已影响运维 |
| **不敢改某块代码** | 不理解所以怕动 | 🟡 债已影响开发效率 |
| **review 时只是点 approve** | 形式化 review（Verifier Theater） | 🟡 认知投降前兆 |
| **loop 出事时答不出「为什么」** | 判断力丧失 | 🔴 已 Cognitive Surrender |

> 最后一个信号尤其危险——它意味着理解债已经演变成 Cognitive Surrender（下一篇的主题）。理解债是「不理解代码」，认知投降是「不理解且不再试图理解」。前者还有救（去读），后者是放弃了。

---

## 十、回顾

1. **理解债 = 仓库存在 vs 你理解的差距。** 不是代码质量问题，是「**人在不在场**」的问题。
2. **loop 时代独有**：人写代码天然消化债（作者理解），loop 写代码打破这个保证。
3. **债永远正增长**：loop 产出速度 > 人阅读速度，是物理事实。
4. **债有复利**：未读代码成为后续改动地基，债平方级增长。
5. **Addy 警告**：loop 改变工作但不删除你；理解会腐除非主动读；你的工作是 ship code you confirmed works。
6. **三种还债**：强制阅读节奏（日/周/月/季）+ 未读占比阈值联动降级 + 高风险区定期深读。
7. **阈值联动是精髓**：不是建议读，是不读 loop 就降级，逼人不可缺席。
8. **可读性设计**：命名表达意图、改动附根因、最小改动、拒绝治症状——从源头降低债的增量。
9. **Code review 是被动还债**：防单次错误，不防复利。不可替代主动阅读。
10. **责任归属**：开 loop 的人就是欠债的人。Meta-Loop 量化债但不能替人读。

一句话收尾：**理解债的本质不是「代码太多」，而是「loop 写代码时你不在场」。还债的唯一方式，是让自己重新在场——去读。loop 越好，你越要读。这不是负担，是 loop 时代工程师的核心职责。**

---

## 参考资料

- [Addy Osmani — Loop Engineering canonical essay](https://addyosmani.com/blog/loop-engineering/)（理解债的三段核心论述）
- [Cobus Greyling — Concepts（Comprehension Debt 定义）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [Cobus Greyling — Anti-Patterns #4: L3 before L1 quality](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md)
- [Cobus Greyling — Stories: Why We Killed Our CI Sweeper](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/why-we-killed-ci-sweeper.md)
- [Cobus Greyling — Stories: L1→L2 Graduation](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/l1-to-l2-graduation.md)
- [系列七：反衰减](./loop-engineering-antidegradation)（理解债作为四种衰减之一）
- [系列八：Meta-Loop](./loop-engineering-meta-loop)（量化理解债的执行体）
- [系列三：L3 设计](./loop-engineering-l3-design)（最小改动原则、verifier 链）
- [系列十九：Intent Debt](./loop-engineering-intent-debt)（方法论三部曲之一，姊妹篇）

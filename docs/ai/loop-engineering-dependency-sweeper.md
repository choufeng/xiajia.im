# Dependency Sweeper 与供应链安全：最危险的 L2 loop

> 系列第十五篇。前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory 系统](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行工程](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling) · [PR Babysitter 实战](./loop-engineering-pr-babysitter)
>
> CI Sweeper 改的是你自己写的代码——坏了你知道怎么回事。Dependency Sweeper 改的是**别人写的代码**——坏了你可能完全不知道。这是供应链风险的本质，也是为什么 Cobus 把依赖升级列为**强制 human gate**。

---

## 零、依赖升级为什么是最危险的 loop

先建立一个直觉：**依赖升级的风险，不亚于直接改 auth 模块。**

Cobus Greyling 在 Safety 文档里把「Dependency upgrades」和「Security, authentication, authorization」「Payments, billing, PII」放在**同一行**——都是「Always require human」的强制 human gate。

| 普通代码改动 | 依赖升级 |
|--------------|----------|
| 改的是你的代码，你有上下文 | 改的是别人的代码，你只有 changelog |
| 可读 diff，判断有据 | diff 是 lockfile 的 hash 变化，人眼无法判断 |
| 影响范围可控（你知道改了哪） | **transitive deps** 级联，一个 bump 牵动几十个包 |
| 失败模式有限（逻辑 bug） | 失败模式包含**恶意注入**（供应链攻击） |
| 回滚简单（revert 一个 commit） | 回滚可能牵动 lockfile 重建 |

> 最讽刺的一点：依赖升级的 diff 看起来最「无害」——不就是版本号变了吗？但 `lodash 4.17.20 → 4.17.21` 这种 patch，可能修了一个原型链污染 CVE，也可能引入了一个新的。**版本号变化是人眼最看不出来的危险。**

这就是为什么本文标题叫「最危险的 L2 loop」：它的自治级别只有 L2，但风险等级堪比 L3。整个 loop 的设计核心，就是**用极保守的边界对抗「看不见的危险」**。

---

## 一、依赖升级的三个特殊性

### 特殊性 1：供应链攻击面

依赖升级是**唯一一个把外部代码引入你仓库的 loop 动作**。其他 loop（CI Sweeper、PR Babysitter）改的是你已有的代码；Dependency Sweeper 引入的是**全新的、你没审查过的代码**。

供应链攻击的典型路径：

```
攻击者发布恶意包
  ↓
你的 loop 自动升级到该版本（因为「有 CVE 修复」）
  ↓
恶意代码进 lockfile → npm ci 安装 → 执行 install hook
  ↓
密钥泄露 / 后门植入 / 挖矿脚本
```

真实案例的攻击向量（loop 必须防的）：

| 攻击类型 | 原理 | loop 对策 |
|----------|------|-----------|
| **Typosquatting** | `lodasj` 冒充 `lodash` | 只升**已存在的**包，绝不新增未知包 |
| **Account takeover** | 维护者账号被盗，发布恶意新版 | major bump 一律人审，即使「只是 patch」也查 registry 时间 |
| **Install script 注入** | `postinstall` 跑恶意脚本 | 人审任何含 install script 的包 |
| **Protestware** | 维护者主动投毒（colors.js / node-ipc 事件） | major/behavior change 一律人审 |
| **Dependency confusion** | 内部包名被外部同名包抢占 | 内部包名入 denylist，绝不从公开 registry 升 |

> **铁律**：loop 永远只升级 manifest 里**已存在**的包。新增依赖 = 引入新攻击面 = 必须 human gate。

### 特殊性 2：语义版本陷阱

semver（Semantic Versioning）承诺 patch/minor 向后兼容，但**现实远非如此**：

| semver 承诺 | 现实 |
|-------------|------|
| patch（1.2.3→1.2.4）「只修 bug」 | 可能改了行为（修的是别人依赖的 bug = 你的 feature） |
| minor（1.2.3→1.3.0）「只加功能」 | 可能 deprecate 旧 API、改默认值 |
| major（1.2.3→2.0.0）「有破坏性变更」 | 这条还算诚实——但 changelog 可能漏写 |

Cobus 的 week-one 故事印证了这点：一个 `express` patch 看起来人畜无害，但引入了 peer dependency 冲突，CI 直接挂。**patch ≠ 零风险**，semver 是承诺不是保证。

### 特殊性 3：Transitive Dependencies（传递依赖）

你只直接依赖 50 个包，但 lockfile 里有 1200 个——其中 1150 个是 transitive。升一个直接依赖，可能牵动几十个 transitive 一起变。

```
你的 package.json 直接依赖: express
express 依赖: body-parser → bytes → 3.x
升级 express 4.18 → 4.19
  ↓
bytes 可能从 3.x 跳到 3.y（transitive bump）
  ↓
某个深层依赖的行为变了，你完全不知道
```

**这是 lockfile diff 无法人眼审查的根因**——你看到的是 1200 行 hash 变化，不知道哪个行为会变。Cobus 的对策：**minimal-fix 步骤只动直接依赖的版本号，绝不手动改 transitive**，让 lockfile 自己重算。但重算后的 transitive 变化必须靠**测试**覆盖，而非人眼。

---

## 二、风险分级矩阵

Dependency Sweeper 的核心决策是：**这个升级，loop 自动做，还是交人？** 决策依据是两个维度的交叉：

### 分级矩阵

```
                    CVE 严重度
            无CVE    低危      中危       高危/紧急
         ┌────────┬────────┬────────┬────────┐
patch    │ ✅ 自动  │ ✅ 自动  │ ⚠️ 人审  │ 🚫 紧急人审 │
         ├────────┼────────┼────────┼────────┤
minor    │ ✅ 自动  │ ⚠️ 人审  │ 🚫 人审  │ 🚫 紧急人审 │
         ├────────┼────────┼────────┼────────┤
major    │ 🚫 人审  │ 🚫 人审  │ 🚫 人审  │ 🚫 紧急人审 │
         └────────┴────────┴────────┴────────┘
```

| 分级 | 含义 | loop 行为 |
|------|------|-----------|
| ✅ **自动** | 低风险 | worktree 升级 → 测试 → 通过则开 PR（不自动 merge） |
| ⚠️ **人审** | 中风险 | worktree 升级 → 测试 → 通过则开 PR + 标 `needs-review` + 通知 |
| 🚫 **人审** | 高风险 | 不自动升级，写 STATE `Waiting on Human` + 附 changelog 摘要 + CVE 链接 |
| 🚫 **紧急人审** | 紧急 | 立即通知（PagerDuty/Slack @channel）+ 不动 lockfile |

### 关键边界规则

1. **major 一律人审**——无论 CVE 与否。semver major = 破坏性变更，loop 不碰。
2. **中高危 CVE 一律人审**——即使有 patch。CVE patch 本身可能有 bug，且紧急修复容易急中出错。
3. **patch + 无 CVE = 唯一自动区**——但「自动」也只是「自动开 PR」，不是「自动 merge」。
4. **denylist 包永远人审**——`react`、`@company/core-auth` 等核心包，任何 bump 都要人批。

> **保守到什么程度？** Cobus 的建议：「Start with **patch-level only + known CVE fixes** on a single repo for 1-2 weeks. Expand to minors only after you trust the verifier. **Majors and breaking changes should stay human-gated for a long time.**」翻译：patch-only 跑两周 → 信了 verifier 再放 minor → major 长期留给人。

---

## 三、为什么 lockfile 入 denylist

Cobus 的 Safety 文档里，Auto-Merge Policy 的「Not allowed」列明确写着：

> | Not allowed |
> |-------------|
> | Dependency version bumps |
> | **Lockfile changes** |

**lockfile 入 denylist** 的原因有三层：

### 原因 1：lockfile 是供应链攻击的载体

恶意代码不是写在你代码里的，是写在 `node_modules/` 里的，而 `node_modules/` 的内容由 lockfile 决定。**谁控制 lockfile，谁控制你跑的代码。**

如果 loop 能自动改 lockfile + 自动 merge，攻击者只需让一个恶意 patch 看起来「合法」，loop 就会把恶意代码固化进你的部署。

### 原因 2：lockfile diff 无法人眼审查

```
 package-lock.json (1200 行变化)
- "node_modules/lodash": { "version": "4.17.20", "resolved": "sha512-aaa...", ... }
+ "node_modules/lodash": { "version": "4.17.21", "resolved": "sha512-bbb...", ... }
```

人能看出版本变了，但**看不出 sha512 对不对、resolved URL 有没有被劫持**。lockfile 的安全性不靠人审，靠**锁文件机制 + CI 重建验证**。

### 原因 3：lockfile 是 multi-loop 冲突的温床

多个 loop 同时改 lockfile = merge 地狱。Cobus 的 Multi-Loop 文档的铁律 1「One owner per branch」在这里格外重要——**任何时刻只有 Dependency Sweeper 能动 lockfile**。CI Sweeper 改代码时碰到 lockfile 必须 escalate（它碰不得）。

### 正确做法：lockfile 由工具生成，不由 loop 手编

```bash
# ❌ 错：loop 手动 edit lockfile（危险，不可控）
sed -i 's/4.17.20/4.17.21/' package-lock.json

# ✅ 对：loop 只改 manifest 版本号，用工具重算 lockfile
npm install lodash@4.17.21 --save    # 改 package.json + 重算 lockfile
npm ci                                # CI 用 lockfile 精确重建 node_modules
```

**loop 改 manifest（package.json 的版本号），lockfile 由 `npm install` 重算，`npm ci` 重建验证**。loop 永远不手编 lockfile 的 hash/integrity 字段。

---

## 四、L2 边界：Dependency Sweeper 的权限设计

### L2 能做什么、不能做什么

| 维度 | 能（L2） | 不能（→ 人审） |
|------|-----------|----------------|
| **版本范围** | patch（无 CVE） | major / minor（高危 CVE） |
| **动作** | worktree 升级 + 测试 + 开 PR | 自动 merge / 自动关闭 PR |
| **碰的文件** | package.json（版本号）+ 生成的 lockfile | 手编 lockfile / node_modules |
| **新增依赖** | ❌ 永远不行 | 任何 `npm install <新包>` = 人审 |
| **scope** | 直接依赖 | 手动改 transitive 版本 |
| **频率** | 每 6h 扫一次 | 连续对同一包重试 > 2 次 |

### 与 Dependabot 的分工

这是 Dependency Sweeper 最容易设计错的地方：**Dependabot 和 Sweeper 做不同的事**。

| 角色 | 做什么 | 谁触发 |
|------|--------|--------|
| **Dependabot** | 开 PR（「express 4.18→4.19」） | GitHub 自动（基于 advisory + schedule） |
| **Dependency Sweeper** | triage Dependabot PR + 补充验证 + 路由 | loop |

Cobus 的建议：

> 「Let Dependabot open the PRs. The sweeper's job becomes **triage the Dependabot PRs, apply minimal additional fixes if the bot's PR is blocked, rebase, and ping for review on risky ones**.」

**Dependabot 负责「发现 + 开 PR」，Sweeper 负责「triage + 验证 + 路由」**。不要让 Sweeper 重复开 Dependabot 已开的 PR（那是对抗，浪费）。Sweeper 的价值在 triage 这一层——判断哪个 Dependabot PR 安全可 merge、哪个需要人审、哪个需要补充修复（比如 Dependabot 的 PR 卡在测试挂，Sweeper 看看能不能补个适配性改动）。

---

## 五、必备 Skills 与 STATE

### 5.1 dependency-triage skill

````markdown
---
name: dependency-triage
description: 解析 lockfile + package.json，分组升级按风险(patch/minor/major + CVE)，产出可操作清单。
---

# Dependency Triage

## 步骤
1. `npm outdated --json` 获取过时依赖列表
2. `npm audit --json` 获取已知漏洞
3. 查 OSV API（`curl osv.dev`）补充 CVE 详情
4. 对每个包判定风险等级（见分级矩阵）
5. 产出结构化清单

## 铁律
- **只列 manifest 已存在的包**。发现 unknown 包 → 标 SUSPECT（可能 typosquatting）
- major / 中高危 CVE → 标 `needs-human`，附 changelog 摘要 + CVE 链接
- patch + 无 CVE → 标 `auto-eligible`
- 每项带: 当前版本 → 建议版本 | 风险等级 | CVE | changelog diff 摘要

## 输出格式
```yaml
- package: lodash
  current: 4.17.20
  target: 4.17.21
  bump: patch
  risk: auto-eligible
  cve: CVE-2021-23337 (high)  # 有 CVE 即使 patch 也标 needs-human
  changelog: "Fix prototype pollution in zipObjectDeep"
  triage_note: "patch + high CVE → needs-human (紧急)"
```
````

### 5.2 minimal-fix skill（依赖版）

````markdown
---
name: minimal-fix-deps
description: 对依赖升级产出最小改动。只改版本号，不碰逻辑代码。
---

# Minimal Fix (Dependencies)

## 步骤
1. `npm install <pkg>@<target> --save`（改 manifest + 重算 lockfile）
2. **绝不**手编 lockfile 的 integrity/resolved 字段
3. **绝不**改 src/ 下的代码（适配性改动 = 另一个 PR = 人审）
4. git diff 确认只动了 package.json + lockfile

## 铁律
- 只动**一个**包的版本号（不批量升）
- 如果 `npm install` 改了 src/ 文件 → 回滚，这说明有 postinstall hook 动了源码（危险信号）
- transitive 变化靠 `npm ci` 重建验证，不手动干预

## 边界
- 碰到 peer dep 冲突 → 停，标 `needs-human`（不尝试自动解冲突）
- 碰到 install script（postinstall/preinstall）→ 停，标 `needs-human`
````

### 5.3 loop-verifier skill（依赖版）

这是 week-one 故事里**翻车最狠**的地方。Cobus 的教训原文：

> 「Day 3: verifier APPROVED an `express` patch but **did not run** `npm ci` — only `npm test`, which used cached `node_modules`. CI failed on the PR with a peer dependency conflict the verifier missed.」

**verifier 必须用 CI 同款安装路径**：

````markdown
---
name: loop-verifier-deps
description: 在 worktree 里验证依赖升级不破坏构建。必须用 npm ci 重建，禁用缓存。
---

# Loop Verifier (Dependencies)

## 铁律（不可违反）
- **必须跑 `npm ci`**（删 node_modules → 按 lockfile 精确重建）
- **禁止**只跑 `npm test`（会用旧缓存，测不出 lockfile 变化的影响）
- 验证链: npm ci → npm test → npm run build → npm run lint → npm audit
- 全绿才 APPROVE，任何一步红 → REJECT + 报告哪步挂

## 为什么 npm ci 不是 npm install
- `npm install`: 可能更新 lockfile、容忍不匹配、用缓存
- `npm ci`: 严格按 lockfile、删旧 node_modules、失败即停
- CI 用的是 `npm ci`，verifier 必须一致，否则「本地过 CI 挂」
````

### 5.4 STATE 文件

```markdown
# Dependency Sweeper State

## Active (in-flight)
- lodash: 4.17.20 → 4.17.21 (CVE-2021-23337 high) | attempt: 1 | worktree: dep-sw/lodash | last: 2026-06-15
  status: needs-human (patch+high CVE)

## Auto-Eligible (patch, no CVE)
- date-fns: 3.6.0 → 3.6.1 | attempt: 1 | PR: #158 | tests: green | waiting: human merge

## Waiting on Human
- express: 4.18.2 → 4.19.2 (minor, peer-dep conflict) | attempt: 2 | last: 2026-06-14
  note: verifier npm ci failed, peer dep body-parser version conflict
- react: 18.3.1 → 19.0.0 (major) | DENYLIST | last: 2026-06-15
  note: major bump, changelog indicates removed APIs

## Pruned (this run)
- typescript: 5.4 → 5.5 (merged PR #155, 2026-06-13)
```

每 run prune 已 merged/closed 的项（反衰减篇的 State Rot 防护）。

---

## 六、与外部工具的配合

Dependency Sweeper 不是孤军奋战，它是一个**协调层**，串起多个外部数据源。

```
┌─────────────────────────────────────────────────────┐
│              Dependency Sweeper (loop)               │
│                                                     │
│  TRIAGE: 汇总多方数据源 → 统一分级                    │
└───────┬──────────┬───────────┬──────────┬───────────┘
        │          │           │          │
        ▼          ▼           ▼          ▼
   ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
   │Depend. │ │npm     │ │OSV API   │ │GitHub Sec.   │
   │abot PRs│ │audit   │ │osv.dev   │ │Advisory      │
   │(发现)  │ │(漏洞)  │ │(CVE 详情) │ │(advisory DB) │
   └────────┘ └────────┘ └──────────┘ └──────────────┘
```

| 数据源 | 提供什么 | 怎么接入（pi） |
|--------|----------|----------------|
| **Dependabot PRs** | 已开的升级 PR | `gh pr list --author "app/dependabot"` |
| **npm audit** | 已知漏洞（基于 lockfile） | `npm audit --json`（bash） |
| **OSV API** | CVE 详情 + 修复版本 | `curl -s osv.dev/v1/query`（bash） |
| **GitHub Security Advisory** | GitHub 的漏洞数据库 | `gh api /repos/{owner}/{repo}/dependabot/alerts` |

### 接入示例

```bash
# ① npm audit 拿漏洞
npm audit --json 2>/dev/null | jq '.vulnerabilities'

# ② OSV 查特定包的 CVE
curl -s -X POST "https://api.osv.dev/v1/query" \
  -H "Content-Type: application/json" \
  -d '{"package":{"name":"lodash","ecosystem":"npm"},"version":"4.17.20"}' \
  | jq '.vulns[].id'   # → ["CVE-2021-23337", "GHSA-..."]

# ③ Dependabot 已开的 PR
gh pr list --author "app/dependabot" --json number,title,headRefName --jq '.[]'
```

**关键设计**：Sweeper 把三个源的数据**合并去重**——同一个 lodash CVE，npm audit 和 OSV 和 Dependabot 可能都报。Sweeper 按 `package@version` 去重，输出统一清单。

---

## 七、pi 实现

### 7.1 完整 loop 骨架

```typescript
// dependency-sweeper.ts
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const REPO = process.env.REPO_CWD!;
const MAX_ATTEMPTS_PER_PKG = 2;
const MAX_AUTO_PRS_PER_RUN = 3;    // 防 PR spam（week-one 教训）

async function runAgent(role: string, tools: string[], prompt: string) {
  let out = "";
  const { session } = await createAgentSession({
    cwd: REPO,
    tools,
    sessionManager: SessionManager.inMemory(REPO),
  });
  session.subscribe(e => {
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta")
      out += e.assistantMessageEvent.delta;
  });
  await session.prompt(prompt);
  session.dispose();
  return out;
}

// ① TRIAGE
const triage = await runAgent("triage",
  ["read", "grep", "bash"],
  `执行 /skill:dependency-triage。
   跑 npm outdated --json + npm audit --json + 查 Dependabot PR (gh pr list --author app/dependabot)。
   按分级矩阵分类。每项标 auto-eligible / needs-human / suspect。
   输出 YAML 清单。`);

const items = parseTriageYaml(triage);

// ② 对 auto-eligible 的逐个处理
let prsOpened = 0;
for (const item of items) {
  if (prsOpened >= MAX_AUTO_PRS_PER_RUN) break;   // 防 spam

  if (item.risk === "auto-eligible") {
    // ③ worktree 隔离升级
    const wt = await createWorktree(`dep-sw/${item.package}`);
    const { session } = await createAgentSession({
      cwd: wt.path,
      tools: ["read", "bash"],    // 只需 bash 跑 npm install
      sessionManager: SessionManager.inMemory(wt.path),
    });

    const fixResult = await session.prompt(
      `执行 /skill:minimal-fix-deps。
       升级 ${item.package} 从 ${item.current} 到 ${item.target}。
       npm install ${item.package}@${item.target} --save。
       确认 git diff 只动了 package.json + lockfile。`);
    session.dispose();

    // ④ VERIFIER（独立 fresh session，必须 npm ci）
    const { session: verifySession } = await createAgentSession({
      cwd: wt.path,
      tools: ["bash"],
      sessionManager: SessionManager.inMemory(wt.path),
    });
    const verdict = await verifySession.prompt(
      `执行 /skill:loop-verifier-deps。
       必须跑: rm -rf node_modules && npm ci && npm test && npm run build && npm audit。
       全绿说 VERIFY_PASS，任何红说 VERIFY_FAIL + 哪步挂。`);
    verifySession.dispose();

    if (verdict.includes("VERIFY_PASS")) {
      // ⑤ 开 PR（不自动 merge）
      await execInWorktree(wt, `git checkout -b dep-sw/${item.package}-${item.target}`);
      await execInWorktree(wt, `git add package.json package-lock.json`);
      await execInWorktree(wt, `git commit -m "deps: ${item.package} ${item.current}→${item.target}"`);
      const prUrl = await execInWorktree(wt,
        `gh pr create --title "deps: ${item.package} ${item.current}→${item.target}" --body "auto-eligible patch, verifier green"`);
      prsOpened++;
      updateState(item, "pr-opened", prUrl);
    } else {
      updateState(item, "needs-human", "verifier failed");
    }
    await cleanupWorktree(wt);
  } else {
    // needs-human: 只更新 STATE + 通知
    updateState(item, "needs-human", item.triageNote);
    if (item.risk === "urgent") notify(`🚨 ${item.package} ${item.cve}`, item.triageNote);
  }
}
```

### 7.2 关键设计点

**① worktree 隔离**：每次升级在独立 worktree 里跑。升级挂了不影响主分支，也不影响其他升级（Multi-Loop 篇铁律 1：one owner per branch）。Worktree 篇详述了隔离模型。

**② verifier 用 npm ci 不用 npm test**：这是 week-one 故事的核心教训。`npm test` 用缓存 node_modules，测不出 lockfile 变化；`npm ci` 删旧重建，和 CI 一致。

**③ MAX_AUTO_PRS_PER_RUN**：week-one 故事里 loop 一次开了 3 个 PR 导致 reviewer fatigue。硬上限 3，多了排队下次。

**④ 只开 PR 不 merge**：L2 的边界。即使 verifier 全绿，也只开 PR 等人 merge。auto-merge 是 L3 的领域，而依赖升级永远不该 L3（见第八节）。

---

## 八、供应链特有失败模式

通用失败模式（State Rot / Token Burn / Notification Fatigue）前文讲过。这里列**供应链特有**的：

### 8.1 Typosquatting（域名抢注）

**症状**：loop 把 `lodash` 升级时，意外安装了 `lodasj`（拼写错误的恶意包）。

**根因**：minimal-fix 步骤用了通配符或模糊匹配；或 `npm install` 自动解析了不精确的版本范围时被注入。

**对策**：triage 只列 manifest 已存在的包名；minimal-fix 用精确包名（`${exactName}@${exactVersion}`）；验证 `npm ls` 输出不含未知包。

### 8.2 Major Bump 破坏（semver 信任陷阱）

**症状**：loop 把 `express` 从 4.18 升到 5.0（看着是「最新」），API 大改，全站崩。

**根因**：triage 把 major 当 minor 处理；或「升到最新」的指令太宽松。

**对策**：major 一律人审（分级矩阵铁律）；triage skill 明确拒绝 major → `needs-human`；minimal-fix skill 检测到 major bump 直接停。

### 8.3 Transitive 冲突（冰山问题）

**症状**：升 `express` patch，但它牵动了 `body-parser` 的 transitive 版本，和另一个包冲突，`npm ci` 失败。

**根因**：直接依赖只升了一个，但 transitive 树级联变化，peer dep 冲突。

**对策**：verifier 用 `npm ci`（week-one 教训）；碰到 peer dep 冲突不自动解（minimal-fix skill 标 `needs-human`）；记录 attempt，超 2 次升级。

### 8.4 Lockfile 竞赛（multi-loop 冲突）

**症状**：Dependency Sweeper 和 CI Sweeper 同时改 lockfile，merge 冲突。

**根因**：违反 Multi-Loop 篇铁律 1（one owner per branch）。

**对策**：lockfile 只归 Dependency Sweeper 管；CI Sweeper 的 denylist 含 lockfile（L3 篇 denylist 规则）；collision detection（Multi-Loop 篇）。

### 8.5 Verifier Lie（最隐蔽）

**症状**：verifier 说 APPROVED，但 CI 挂了。Cobus week-one 原话：

> 「verifier APPROVED an express patch but **did not run** npm ci — only npm test, which used cached node_modules.」

**根因**：verifier prompt 太虚（「verify the change」）；或 verifier 偷懒跳过了 `npm ci`；或用了同一个 node_modules 缓存。

**对策**（已在 5.3 verifier skill 编码）：
- verifier prompt 写死具体命令（`rm -rf node_modules && npm ci && ...`）
- verifier 是 fresh session（不复用 implementer 上下文/缓存）
- 验证链含 `npm audit`（确保升级没引入新漏洞）
- S2 严重度，一次 Lie 抵消一周的自动化收益

### 8.6 Install Script 投毒

**症状**：升级的包含 `postinstall` 脚本，`npm ci` 时执行了恶意命令。

**对策**：triage 阶段查包是否含 install scripts（`npm pkg get scripts` 或查 manifest）；含 install script 的包一律 `needs-human`；绝不自动处理。

---

## 九、成本与度量

### 成本画像（Cobus 数据）

| 场景 | Tokens/run | 说明 |
|------|------------|------|
| No-op（无升级） | ~5k | 扫完就退出 |
| Triage / scan | ~60k | npm audit + Dependabot + lockfile 扫 |
| Patch + verify (L2) | ~300k | worktree + `npm ci` + 全量测试 |

**daily cap 建议 500k**。verifier 的 `npm ci` + 全量测试是成本大头——控制 attempts/pkg（硬上限 2）。

### 成功指标

| 指标 | 目标 |
|------|------|
| 「漏洞发布 → 修复合并」中位时间 | 紧急 < 4h，普通 < 48h |
| 高/紧急 CVE 挂着 > 48h 的数量 | 趋近 0 |
| Dependabot PR 被 loop 处理（而非人手动）的比例 | > 60% |
| 「帮我升 X」的 Slack/Linear 消息 | 减少 |
| verifier 误判率 | < 2% |

> **Week-one 实测**（Cobus 故事）：11 patch PR opened，7 human merges，1 verifier false APPROVE，~800k tokens。那个 false APPROVE 浪费的人力，比一周手动 patch 还多——**这就是为什么 verifier 必须用 npm ci**。

---

## 十、回顾

1. **依赖升级是最危险的 L2**：改的是别人代码，transitive 级联，含供应链攻击面。风险等级堪比 L3。
2. **分级矩阵**：patch+无CVE = 唯一自动区；major / 中高危 CVE / denylist 包 = 一律人审。
3. **lockfile 入 denylist**：是供应链载体、人眼不可审、multi-loop 冲突温床。loop 只改 manifest，lockfile 由 `npm install` 重算。
4. **与 Dependabot 分工**：Dependabot 发现 + 开 PR，Sweeper triage + 验证 + 路由。不重复开 PR。
5. **verifier 必须用 npm ci**：这是 week-one 血泪教训。`npm test` 用缓存 = Verifier Lie（S2）。
6. **L2 边界**：只开 PR 不 merge；只动直接依赖不碰 transitive；碰 install script / peer conflict → 人审。
7. **保守到极点**：patch-only 跑两周 → 信 verifier 才放 minor → major 长期留人。依赖升级永远不上 L3。
8. **六个供应链失败模式**：typosquatting / major 破坏 / transitive 冲突 / lockfile 竞赛 / verifier lie / install script 投毒——每个都有对应护栏。

一句话收尾：**Dependency Sweeper 的设计哲学不是「让 loop 升级依赖」，而是「让 loop 把人不想做的 triage 做了，同时把人必须做的判断留给人」。它处理的不是代码，是信任——而信任，永远不该全自动。**

---

## 参考资料

- [Cobus Greyling — Dependency Sweeper pattern](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/dependency-sweeper.md)
- [Cobus Greyling — Dependency Sweeper Week One（verifier lie 真实案例）](https://github.com/cobusgreyling/loop-engineering/blob/main/stories/dependency-sweeper-week-one.md)
- [Cobus Greyling — Safety & Guardrails（denylist + human gates）](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/safety.md)
- [Cobus Greyling — Failure Mode Catalog](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/failure-modes.md)
- [OSV API — 开源漏洞数据库](https://osv.dev/)
- [npm audit 文档](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- 系列相关：[L3 设计（denylist/human gates）](./loop-engineering-l3-design) · [Multi-Loop（lockfile 竞赛）](./loop-engineering-multi-loop) · [Worktree（隔离验证）](./loop-engineering-worktree) · [反衰减（State Rot）](./loop-engineering-antidegradation)

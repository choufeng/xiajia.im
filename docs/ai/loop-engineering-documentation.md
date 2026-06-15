# Documentation Loop：让文档永远跟代码同步

> 系列第十八篇。前序：[概念](./loop-engineering) · [pi L1 落地](./loop-engineering-on-pi) · [L3 设计](./loop-engineering-l3-design) · [Memory](./loop-engineering-memory) · [Multi-Loop](./loop-engineering-multi-loop) · [网关层](./loop-engineering-gateway) · [反衰减](./loop-engineering-antidegradation) · [Meta-Loop](./loop-engineering-meta-loop) · [韧性与评估](./loop-engineering-resilience-eval) · [Sub-agent 编排](./loop-engineering-sub-agent) · [Skills 工程化](./loop-engineering-skills) · [Worktree 并行](./loop-engineering-worktree) · [Scheduling 模式](./loop-engineering-scheduling) · [PR Babysitter](./loop-engineering-pr-babysitter) · [Dependency Sweeper](./loop-engineering-dependency-sweeper) · [Issue Triage](./loop-engineering-issue-triage) · [Changelog & Cleanup](./loop-engineering-changelog-cleanup)
>
> 这一篇是**扩展模式**——Cobus 原始七模式里没有 Documentation Loop，但它是 loop 工程里最被忽视、又最适合 loop 的高价值场景。

---

## 零、文档是 loop 的天然猎场

先看一个反直觉的事实：**文档比代码更适合交给 loop。**

| 维度 | 文档场景 | 代码修复场景 |
|------|----------|--------------|
| 风险 | 低（文档错了不 crash） | 高（代码错了炸生产） |
| 人愿意做 | ❌ 最不愿（枯燥、优先级永远最低） | ✅ 愿意（有挑战） |
| 可纯 L1 | ✅ 只报告 drift，价值已足够 | 需 L2+ 才有意义 |
| 判断成本 | 低（对错显而易见） | 高（需设计判断） |
| 回报 | 高（文档准 = 团队效率↑） | 高但风险也高 |

**文档是那种「人人都知道该做、但永远没时间做」的事**。它天然适合 loop：低风险让它能从纯 L1 起步、枯燥性让人乐意外包、回报在团队层面放大。一句话——**如果你只打算上两个 loop，第一个是 Daily Triage，第二个就该是 Documentation Loop。**

### 文档的隐性税：Comprehension Debt 的放大器

Cobus 把 **Comprehension Debt（理解债）** 定义为「仓库里实际存在的东西与你真正理解的东西之间的差距」。文档是还这笔债的主力工具——但如果文档本身跟代码脱节，它不仅还不掉债，反而**制造幻觉**：

```
代码:  authenticate(token: string): Promise<User>     ← 改了签名
文档:  authenticate(token: string, retry?: boolean)   ← 没跟，还在骗人
新人读文档 → 按错的签名调 → bug → 花两小时排查 → 才发现文档在撒谎
```

**过时文档比没有文档更危险**——没有文档人会去读代码，过时文档会让人**自信地犯错**。这就是 Documentation Loop 要解决的核心问题。

---

## 一、文档漂移（Documentation Drift）

文档不是一次性产物，它是**会腐败的活体**。腐败的方式有四种：

### 漂移类型 1：签名漂移（Signature Drift）

代码的函数/方法签名变了，文档没跟。最常见的漂移。

```
代码:  function createUser(email, name, role = 'user')
文档:  createUser(email, name)  // 还少了一个参数
```

**检测方式**：解析代码的导出符号（AST/类型系统），与文档里的签名块对比。

### 漂移类型 2：链接腐烂（Link Rot）

文档里引用的内部链接失效——页面删了、路径改了、外部 URL 404 了。

```
文档:  详见 [部署指南](./docs/deploy.md)   ← deploy.md 已改名 deploy-guide.md
文档:  参考 https://api.example.com/v2      ← API 已升到 v3，旧 URL 404
```

**检测方式**：遍历 markdown 里的所有链接，批量检查 HTTP 状态 / 文件存在性。

### 漂移类型 3：示例过时（Example Rot）

文档里的代码示例不再可运行——API 改了、依赖升了、行为变了。

````markdown
文档里的示例:
```ts
import { Database } from 'mylib';
const db = new Database();          // ← 新版要求 new Database({ url })
await db.connect();                 // ← 改成了 await db.start()
```
跑一下就炸。
````

**检测方式**：提取文档里的代码块，在沙箱里实际执行，看能否通过。

### 漂移类型 4：概念漂移（Concept Drift）

架构变了、设计决策变了，但概念性文档（架构图说明、设计决策记录）还在讲旧故事。最难检测——因为不是机械 diff 能发现的。

```
代码:  已从 monolith 拆成微服务
文档:  "本系统是一个单体应用，所有模块在一个进程内..."  ← 还在讲三年前的故事
```

**检测方式**：无法全自动。只能靠 LLM 对比代码结构概要 vs 文档叙述，标记「疑似过时」交人审。

### 漂移严重度分级

| 漂移类型 | 严重度 | 检测难度 | 自动修复难度 |
|----------|--------|----------|--------------|
| 签名漂移 | 中 | 低（AST diff） | 中（L2 可自动同步） |
| 链接腐烂 | 低 | 低（批量检查） | 低（L2 可自动修路径） |
| 示例过时 | 中-高 | 中（需跑代码） | 中（L2 可重生成示例） |
| 概念漂移 | 高 | 高（需语义理解） | ❌ 必须人 |

前三类可机械检测、部分可自动修复，是 Documentation Loop 的主战场。第四类是 loop 的边界——**loop 能标记「疑似过时」，但判断和修正必须人**。

---

## 二、三类文档 Loop

Documentation Loop 不是单一 loop，是三个子模式，各有不同的检测策略和自治级别。

### 模式 A：API 文档同步（API Sync Loop）

**目标**：代码里的函数/类型/接口签名与 API 文档保持一致。

| 属性 | 值 |
|------|------|
| 检测 | AST 解析代码导出 vs 文档签名块 |
| 调度 | 每日 或 merge 后触发 |
| L1 | 报告「哪些签名变了但文档没跟」 |
| L2 | 自动更新文档里的签名块（仅签名，不改正文说明） |

**为什么 L2 也安全**：签名同步是机械映射——`代码签名变了 → 文档签名块更新`，不涉及语义判断。verifier 只需检查「文档签名 == 代码签名」即可。

### 模式 B：README / 指南更新（Guide Refresh Loop）

**目标**：README、教程、快速开始指南保持与当前代码一致。

| 属性 | 值 |
|------|------|
| 检测 | 安装步骤可跑性、命令准确性、链接有效性 |
| 调度 | 每周（频率低于 API Sync，因为指南变化慢） |
| L1 | 报告「安装命令已过时」「Quick Start 示例跑不通」「3 个链接 404」 |
| L2 | 自动修链接、更新版本号、重生成示例（需 verifier 跑通） |

**L2 边界**：自动修链接和版本号安全；重写教程正文不安全（涉及语气/风格，必须人）。

### 模式 C：代码注释同步（Comment Sync Loop）

**目标**：源码里的 JSDoc/docstring/inline 注释与实际代码行为一致。

| 属性 | 值 |
|------|------|
| 检测 | 注释提到的参数/返回值与代码签名对比 |
| 调度 | 每日（随 merge 跑） |
| L1 | 报告「函数加了参数但 JSDoc 没更新」 |
| L2 | 自动同步 JSDoc 的 `@param`/`@returns`（仅结构化标签，不改正文） |

**最微妙的漂移**：注释和文档不一样——注释在代码里，开发者改代码时「顺手」就该改注释，但现实是人改了代码就忘了注释。Comment Sync 是兜底。

### 三模式分工

```
                代码仓库
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   API 文档     README/指南    源码注释
   (docs/api/)  (README.md)   (src/**/*.ts)
       │           │           │
   API Sync    Guide Refresh  Comment Sync
   Loop (1d)   Loop (1w)      Loop (1d)
       │           │           │
   签名漂移     安装/链接/示例  @param/@returns
   自动同步     半自动         自动同步标签
```

**三个 loop 各管一片，不重叠**。这遵循 Multi-Loop 的铁律——一 owner per scope。

---

## 三、漂移检测机制

Documentation Loop 的技术核心是**怎么发现漂移**。每种漂移有不同的检测手段。

### 检测 1：签名 diff（签名漂移）

```bash
# TypeScript: 用 tsc 提取所有导出符号的签名
npx tsc --declaration --emitDeclarationOnly --outDir /tmp/sigs
# 对比当前快照 vs 上次快照
diff /tmp/sigs/last /tmp/sigs/current
```

更精细的方式是只提取**公开 API**（export 的函数/类/接口），与文档里的签名块逐一对齐：

```typescript
// runner 里跑的检测逻辑（简化）
const codeSigs = await extractSignatures("src/", { exports: "public" });
const docSigs = await parseDocSignatures("docs/api/");

const drift = [];
for (const [name, codeSig] of Object.entries(codeSigs)) {
  const docSig = docSigs[name];
  if (!docSig) {
    drift.push({ name, type: "missing_in_docs", codeSig });
  } else if (!signaturesMatch(codeSig, docSig)) {
    drift.push({ name, type: "mismatch", codeSig, docSig });
  }
}
for (const [name] of Object.entries(docSigs)) {
  if (!codeSigs[name]) {
    drift.push({ name, type: "removed_from_code" });  // 文档还在但代码删了
  }
}
```

**三种 drift 结果**：`missing_in_docs`（代码有文档没有）、`mismatch`（都有但不一致）、`removed_from_code`（文档有代码没有）。

### 检测 2：链接检查（链接腐烂）

```bash
# 遍历所有 markdown，提取链接，批量检查
grep -rn '\[.*\](.*\.md)' docs/ README.md | while read line; do
  # 解析出链接路径，检查文件是否存在
  link=$(echo "$line" | grep -oE '\]\(([^)]+)\)' | tr -d ']()')
  if [[ "$link" != http* ]] && [ ! -f "$link" ]; then
    echo "BROKEN: $line"
  fi
done

# 外部链接: 批量 HEAD 请求检查状态码
grep -rhoE 'https?://[^ )]+' docs/ | sort -u | while read url; do
  code=$(curl -sL -o /dev/null -w "%{http_code}" "$url")
  [ "$code" != "200" ] && echo "BROKEN ($code): $url"
done
```

pi 实现：给 loop `bash` + `grep` 工具，或包成 custom tool（收窄爆炸半径，见后文）。

### 检测 3：示例可运行性（示例过时）

最有价值也最贵的检测——把文档里的代码块实际跑一遍。

```typescript
// 提取文档里的 fenced code block，执行，看结果
const blocks = extractCodeBlocks("docs/guide/getting-started.md");
for (const block of blocks) {
  if (block.lang === "ts" || block.lang === "bash") {
    const result = await runInSandbox(block.code, { timeout: 10_000 });
    if (result.exitCode !== 0) {
      drift.push({ file: block.file, line: block.line, error: result.stderr });
    }
  }
}
```

**注意成本**：示例检测要实际跑代码，token 低但**计算贵**（每个 block 一个沙箱）。只对「关键文档」（Quick Start、API 入门）跑，不对每个 README 都跑。

### 检测 4：概念漂移（语义检测）

最难的检测。用 LLM 对比代码结构概要 vs 文档叙述：

```typescript
// 两步: 先抽代码概要, 再让 LLM 对比文档
const codeOverview = await runAgent("overview", ["read","grep","bash"],
  `读 src/ 目录结构, 用 5 句话概括当前架构: 模块划分、技术栈、核心数据流。`);

const docOverview = await runAgent("overview", ["read"],
  `读 docs/architecture.md, 用 5 句话概括它描述的架构。`);

const driftCheck = await runAgent("verifier", ["read"],
  `下面是代码实际架构 vs 文档描述的架构。
   找出不一致的地方(模块名对不上? 技术栈过时? 数据流描述错?)。
   只标出确定性的矛盾, 不猜测。
   --- 代码 ---\n${codeOverview}\n--- 文档 ---\n${docOverview}`);
```

**输出只能是「疑似过时」建议**，不能自动改（概念文档的修正是人的判断）。这是 Documentation Loop 的 L1 边界。

---

## 四、L1 → L2 的升级路径

Documentation Loop 天然适合分阶段——L1 的价值已经很高，L2 是锦上添花。

### L1：报告漂移（纯只读，零风险）

```
调度: 每日 09:00
tools: [read, grep, find, ls, bash]   ← 无 edit/write
输出: 漂移报告 → STATE.md + 通知
```

L1 的产出是一份「漂移清单」：

```markdown
## Documentation Drift Report — 2026-06-15

### 签名漂移 (API Sync)
- ⚠️ `createUser(email, name, role)` — docs/api/auth.md 里少 `role` 参数
- ⚠️ `Database.start()` — docs 仍写 `connect()`（已改名）
- 🔴 `parseConfig()` — docs/api/config.md 引用了已删除的函数

### 链接腐烂 (Link Check)
- 🔴 docs/guide/deploy.md → ./ci-setup.md (404)
- ⚠️ README.md → https://api.example.com/v2 (301 → v3)

### 示例过时 (Example Run)
- ❌ docs/quick-start.md:23 — `new Database()` 报错（需 `{ url }`）
- ❌ docs/api/auth.md:45 — `authenticate(token)` 缺必填参数

### 概念疑似过时（需人判断）
- ⚠️ docs/architecture.md 描述「单体应用」，但 src/ 已拆成 services/
```

**L1 的价值**：即使人手动修这份清单，也比「完全不知道文档漂移了」强十倍。漂移可见 = 可管理。

### L2：自动同步（低风险项自动修，高风险项仍 escalate）

L2 只对**机械的、可验证的**漂移自动修：

| 漂移类型 | L2 能自动修 | L2 不能自动修 |
|----------|-------------|---------------|
| 签名漂移 | ✅ 签名块同步（机械映射） | ❌ 函数行为说明（语义） |
| 链接腐烂 | ✅ 路径修正（rename 对齐） | ❌ 链接指向的内容该改成什么 |
| 示例过时 | ✅ 重生成示例（verifier 跑通才算数） | ❌ 示例的讲解文字 |
| `@param` 标签 | ✅ 补齐/更新标签 | ❌ 标签描述文字 |
| 概念漂移 | ❌ 全部 | ❌ 必须人 |

```typescript
// L2 runner — 仅对白名单漂移类型自动修
const SAFE_FIXES = ["signature_sync", "link_path_fix", "param_tag_sync"];

for (const item of drift) {
  if (!SAFE_FIXES.includes(item.type)) {
    // 不安全 → 记 STATE[Waiting]，等人
    state.waiting.push(item);
    continue;
  }
  // 安全 → worktree 里修
  await subagent({
    agent: "worker",
    task: `修复文档漂移: ${item.type} @ ${item.file}
           ${item.detail}
           只改文档/注释, 不改源码。最小改动。`,
    worktree: true,
    acceptance: {
      criteria: [
        `改动仅限 ${item.file}`,
        "不碰 src/ 下任何文件",
        "修改后签名/链接与代码一致",
      ],
      verify: [
        // 示例类: 重跑确认通过
        ...(item.type === "example_stale"
          ? [{ id: "example_runs", command: "ts-node docs/examples/check.ts" }]
          : []),
      ],
    },
  });
}
```

**L2 的铁律**：

1. **绝不改源码**。Documentation Loop 的 tools 白名单里有 `edit`/`write`，但 skill 铁律 + GATE 检查 `git diff --name-only` 确保只动 `docs/` 和注释，不碰 `src/`。
2. **示例修复必须 verifier 跑通**。光改了不算数，实际执行通过才算——防「改了更错」。
3. **概念漂移永远不自动修**。这是 loop 的硬边界。

### 什么时候从 L1 升 L2

| 信号 | 含义 |
|------|------|
| L1 漂移报告连续两周稳定（误报率 <10%） | 检测机制可靠 |
| 签名/链接类漂移占比 >60% | 这两类可自动修，值得升 L2 |
| 人手动修漂移的平均时间 <5 分钟/项 | 机械活，适合外包给 loop |
| 示例检测误报率 <5% | 检测可信，可自动重生示例 |

---

## 五、与 Post-Merge Cleanup 的分工

Post-Merge Cleanup（第十七篇）和 Documentation Loop 看起来重叠——Cleanup 也扫「documentation gaps」。但它们的职责边界清晰：

| 维度 | Post-Merge Cleanup | Documentation Loop |
|------|--------------------|--------------------|
| 触发 | merge 事件 | 定时（每日/每周） |
| 范围 | 单次 merge 的善后（删死代码、移 flag、补 TODO） | 全局文档健康度（跨所有 merge） |
| 文档动作 | 发现「这个 merge 改了 API 但没更新文档」→ 开 ticket | 实际检测+修复文档漂移 |
| 自治 | L1-L2（含非文档清理） | L1-L2（仅文档） |

**协作模式**：Cleanup 发现文档问题 → 写进 STATE → Documentation Loop 下次 run 时消费。或者反过来——Documentation Loop 发现签名漂移 → 如果是某 merge 引起的 → 记进 Cleanup 的 backlog。

> Multi-Loop 铁律：**一 owner per scope**。文档健康归 Documentation Loop，merge 善后归 Cleanup。两者通过 STATE.md 交叉引用，不抢活。

---

## 六、必备 Skills

### Skill 1：doc-sync（签名检测 + 同步）

````markdown
---
name: doc-sync
description: |
  检测代码导出签名与 API 文档的漂移。L1 报告，L2 自动同步签名块。
  Use when scanning for documentation drift.
---

# Doc Sync

## 检测步骤
1. 用 `npx tsc --declaration --emitDeclarationOnly` 提取当前代码签名
2. 读 docs/api/ 下所有签名块（格式: `### FunctionName` 下的 code block）
3. 三路对比: missing_in_docs / mismatch / removed_from_code

## L2 同步铁律
- **只改 docs/api/ 下的签名 code block**
- 不改正文说明文字（那是人的事）
- 同步后 verify: `diff <(extract_signatures src/) <(parse_doc_signatures docs/api/)` 应为空
- 绝不碰 src/ 下任何文件
````

### Skill 2：link-check（链接检测 + 修复）

````markdown
---
name: link-check
description: |
  检查所有 markdown 文档的内部/外部链接有效性。L2 可自动修路径型断链。
  Use when checking documentation link health.
---

# Link Check

## 检测步骤
1. `grep -rn '\[.*\]([^)]*)' docs/ README.md` 提取所有 markdown 链接
2. 内部链接: 检查文件是否存在 (`test -f`)
3. 外部链接: `curl -sL -o /dev/null -w "%{http_code}"` 检查 HTTP 状态
4. 分类: broken_path (文件不存在) / broken_url (HTTP≠200) / redirect (3xx)

## L2 修复铁律
- 仅修 broken_path: 尝试在仓库里找正确路径 (`find docs/ -name "*deploy*"`)
- 找到唯一匹配 → 自动修; 找到多个 → escalate 让人选
- 外部链接永不自动改 URL（不知该指向哪）
````

### Skill 3：example-runner（示例可运行性检测）

````markdown
---
name: example-runner
description: |
  提取文档里的代码示例，在沙箱里执行，报告不可运行的示例。
  Use when checking if documentation examples still work.
---

# Example Runner

## 检测步骤
1. 从 docs/ 的 fenced code block 提取可执行块（ts/bash/python）
2. 每个块在独立 sandbox 里执行（timeout 10s，内存 256M）
3. 记录 exit code + stderr

## 安全
- 示例代码可能含恶意命令 → sandbox 隔离（无网络、只读文件系统）
- 只跑标记为 `// @runnable` 的块，不跑所有块（有些是伪代码）
````

---

## 七、STATE 设计

```markdown
# Documentation Loop State

## Active Drift
- [ ] [signature] createUser: docs 少 role 参数 | since: 2026-06-14 | attempts: 0
- [ ] [link] docs/guide/deploy.md → ci-setup.md (404) | since: 2026-06-13 | attempts: 1
- [ ] [example] quick-start.md:23 报错 | since: 2026-06-15 | attempts: 0

## Waiting on Human
- [ ] [concept] architecture.md 描述单体但已拆微服务 | 需人判断
- [ ] [signature] parseConfig 已删除，docs 仍引用 | 需人确认是否保留旧 API 文档

## Today (2026-06-15)
<!-- loop 每次覆盖 -->

## History
- 2026-06-14: 5 drifts found, 3 auto-fixed (L2), 2 escalated
---
Run: 2026-06-15 09:00 | 6 drifts | 4 auto-fixed | 2 waiting | ~85k tokens
```

注意三个设计：
- **`attempts` 计数**：防 Infinite Fix Loop（L3 篇的护栏）。签名同步通常一次就成，如果 attempts > 2 还没修好，说明不是简单同步，escalate。
- **`since` 时间戳**：漂移存在越久越值得优先修（TTL 过期的进 History 归档）。
- **`[type]` 标签**：分类标签让 loop 知道该调哪个 skill。

---

## 八、pi 实现

Documentation Loop 用 pi 的积木搭建，全链路清晰。

### L1 Runner（最简版，print mode 起步）

```bash
# doc-check.sh — L1 漂移报告（最简版）
cd "$REPO_CWD"
pi -p "执行 /skill:doc-sync 和 /skill:link-check。
       扫描文档漂移和断链，产出结构化报告。
       写入 doc-loop-state.md 的 Today 段。" \
  -t read,grep,find,ls,bash \
  >> "logs/doc-$(date +%F).log" 2>&1
```

`-t` 不含 edit/write = 硬边界，L1 只能报告不能改。

### L1 Runner（SDK 版，含 verifier）

```typescript
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const REPO = process.env.REPO_CWD!;

async function runAgent(role: string, tools: string[], prompt: string) {
  let out = "";
  const { session } = await createAgentSession({
    cwd: REPO,
    tools,
    sessionManager: SessionManager.inMemory(REPO),
  });
  session.subscribe((e) => {
    if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta")
      out += e.assistantMessageEvent.delta;
  });
  await session.prompt(prompt);
  session.dispose();
  return out;
}

// ① 三类检测并行（可拆成三个 session 并发）
const [sigReport, linkReport, exampleReport] = await Promise.all([
  runAgent("sig-check", ["read","grep","find","ls","bash"],
    `执行 /skill:doc-sync。检测签名漂移，产出 missing/mismatch/removed 三类清单。`),
  runAgent("link-check", ["read","grep","find","ls","bash"],
    `执行 /skill:link-check。检查所有 markdown 链接，分类 broken_path/broken_url/redirect。`),
  runAgent("example-check", ["read","bash"],
    `执行 /skill:example-runner。提取 quick-start 和 api 入门的代码块，沙箱执行，报告失败。`),
]);

// ② Verifier: 检测报告有没有误报（verifier 防范 "Verifier Theater"）
const verdict = await runAgent("verifier", ["read","grep","bash"],
  `你是独立 verifier。抽检下面三份漂移报告，验证:
   (a) 报告的 signature 漂移是否真实存在（读代码确认）
   (b) 报告的 broken link 是否真的 broken（实际检查）
   (c) 报告的 example 错误是否可复现
   标出任何误报。输出 VERIFIED + 误报清单，或 REJECT + 理由。

   --- 签名漂移 ---\n${sigReport}
   --- 链接 ---\n${linkReport}
   --- 示例 ---\n${exampleReport}`);

// ③ 回写 STATE + 通知
await updateState("doc-loop-state.md", { active: parseDrifts(sigReport, linkReport, exampleReport) });
await notify(`📝 Doc Loop: ${parseDriftCount(sigReport, linkReport, exampleReport)} drifts (${verdict})`);
```

### L2 Runner（自动修复白名单项）

```typescript
// L2: 对安全漂移类型自动修
const state = loadState("doc-loop-state.md");
const SAFE_TYPES = ["signature_sync", "link_path_fix", "param_tag_sync"];

for (const item of state.active) {
  // 反衰减护栏: attempt 上限
  if (item.attempts >= 2) {
    state.waiting.push({ ...item, reason: "max attempts reached" });
    continue;
  }
  if (!SAFE_TYPES.includes(item.type)) {
    state.waiting.push(item);   // 不安全类型 → 人
    continue;
  }

  // L2: worktree 隔离修复
  const result = await subagent({
    agent: "worker",
    task: `修复文档漂移: ${item.type}
           文件: ${item.file}
           详情: ${item.detail}
           只改 ${item.file}，不碰 src/。最小改动。`,
    worktree: true,
    acceptance: {
      criteria: [
        `git diff --name-only 只含 ${item.file}`,
        "不触碰 src/ 下任何文件",
        item.type === "signature_sync" ? "修改后签名与代码一致" : "修改后链接可达",
      ],
      verify: [
        { id: "no_src_change", command: "git diff --name-only | grep -v '^src/' | wc -l | tr -d ' '" },
      ],
    },
  });

  if (result.passed) {
    state.history.push({ ...item, fixedAt: now() });
  } else {
    item.attempts++;
  }
}
```

### 工具白名单的关键设计

Documentation Loop 的 tools 白名单比其他 loop 复杂——L1 要只读，L2 要能改**文档但不能改源码**。

| 级别 | tools 白名单 | 防线 |
|------|-------------|------|
| **L1** | `read, grep, find, ls, bash` | 无 edit/write，物理不可改 |
| **L2** | `read, grep, find, ls, bash, edit, write` | 有 edit/write，但 GATE 检查 `git diff --name-only` 确保只动 `docs/` |

**L2 的双重防线**：tools 白名单允许 edit（否则改不了文档），但 acceptance 的 verify 里加 `git diff --name-only | grep '^src/'` 检查——如果有任何 src/ 文件被改，验收失败。这是「能力给了但用结果兜底」的设计。

### 用 custom tool 收窄 bash 爆炸半径

文档检测需要 bash（跑 tsc、curl、sandbox 执行），但全量 bash 风险大。用 SDK custom tool 包成专用工具：

```typescript
import { defineTool, Type } from "@earendil-works/pi-coding-agent";

const checkLinkTool = defineTool({
  name: "check_link",
  label: "Check Link",
  description: "检查单个链接是否可达（内部文件或外部 URL）",
  parameters: Type.Object({ url: Type.String() }),
  execute: async (_, { url }) => {
    if (url.startsWith("http")) {
      const code = await fetch(url, { method: "HEAD" }).then(r => r.status).catch(() => 0);
      return { content: [{ type: "text", text: `HTTP ${code}` }] };
    }
    const exists = existsSync(resolve(REPO, url));
    return { content: [{ type: "text", text: exists ? "OK" : "NOT FOUND" }] };
  },
});

const { session } = await createAgentSession({
  cwd: REPO,
  tools: ["read", "grep", "find", "ls", "check_link"],  // ← 无 bash，有专用工具
  customTools: [checkLinkTool],
});
```

这样 loop 能检查链接但**跑不了任意 shell 命令**——爆炸半径收窄到「检查链接」这一个动作。

---

## 九、失败模式

| 失败模式 | 症状 | 对策 |
|----------|------|------|
| **过度生成文档** | loop 往文档里塞冗余说明，越改越长 | skill 铁律「最小改动」；L2 只改签名/链接，不写正文 |
| **示例检测误报** | sandbox 环境与生产不同导致假报错 | sandbox 环境对齐项目（装对依赖）；只跑标 `@runnable` 的块 |
| **签名提取不全** | tsc 配置不对，漏提取某些 export | 定期人审提取覆盖率；对比 `grep export` 数量 |
| **循环漂移** | 签名同步了，下次又漂（因为人改了代码没改文档） | 这正是 loop 的价值——每天兜底，不是 bug |
| **改了文档引入新漂移** | L2 修签名时改错了，制造新 drift | acceptance verify + L2 独立 verifier 复查 |
| **概念漂移误判** | LLM 把「风格不同」当「概念过时」 | 概念检测只标「疑似」，必须人确认 |
| **示例代码含恶意命令** | 文档示例被执行时跑了危险操作 | sandbox 隔离（无网络、只读 FS）；只跑 `@runnable` 块 |
| **与 Post-Merge Cleanup 撞车** | 两个 loop 都想修同一文档项 | 一 owner per scope（本文第五节分工表） |

### 最阴险的失败：文档幻觉

loop 不仅检测漂移，还可能在 L2 修复时**编造签名**——模型的「自信猜测」让它写了看似合理但实际不存在的参数：

```
代码:  function parseConfig(path: string): Config
loop L2 修文档时:  parseConfig(path: string, encoding?: BufferEncoding): Config
                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 编造的!
```

**对策**：L2 的 verify 必须包含**签名一致性检查**——从代码重新提取签名，与文档里 loop 写的逐字 diff，不一致则验收失败。不能信任 loop「说同步了就同步了」。

---

## 十、回顾

1. **文档是 loop 的天然猎场**：低风险、可纯 L1、高价值、人最不愿做。
2. **过时文档比没文档更危险**——它让人自信地犯错，是 Comprehension Debt 的放大器。
3. **四种漂移**：签名（机械可检测）、链接（批量可检测）、示例（需跑代码）、概念（必须人判断）。
4. **三类 loop**：API Sync（签名，每日）、Guide Refresh（指南，每周）、Comment Sync（注释，每日）。一 owner per scope。
5. **L1 价值已足够**：漂移可见 = 可管理。L2 是锦上添花，仅对机械漂移（签名/链接/@param）自动修。
6. **L2 铁律**：绝不改源码（GATE 检查 diff 路径）；示例修复必须 verifier 跑通；概念漂移永远不自动修。
7. **与 Post-Merge Cleanup 分工**：Cleanup 管 merge 善后，Doc Loop 管全局文档健康，通过 STATE 交叉引用。
8. **anti-pattern 防范**：过度生成、示例误报、文档幻觉（编造签名）——每类都有对应护栏。
9. **custom tool 收窄 bash**：把链接检查/签名提取包成专用工具，不裸给 bash。

一句话收尾：**好的 Documentation Loop 让文档从「写了就过时的债务」变成「永远与代码同步的活资产」。漂移不可消灭，但可以被看见、被兜底、被自动修补——只要你让 loop 每天看一眼。**

---

## 参考资料

- [Cobus Greyling — Post-Merge Cleanup Loop（分工参照）](https://github.com/cobusgreyling/loop-engineering/blob/main/patterns/post-merge-cleanup.md)
- [Cobus Greyling — Concepts: Comprehension Debt](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/concepts.md)
- [Cobus Greyling — Anti-Patterns](https://github.com/cobusgreyling/loop-engineering/blob/main/docs/anti-patterns.md)
- 系列相关：[Skills 工程化](./loop-engineering-skills) · [Multi-Loop 协调](./loop-engineering-multi-loop) · [反衰减](./loop-engineering-antidegradation) · [L3 设计](./loop-engineering-l3-design)
- pi 关键 API：`createAgentSession` · `tools` 白名单 · `defineTool`（custom tool）· `SessionManager.inMemory` · `subagent({ worktree, acceptance })`

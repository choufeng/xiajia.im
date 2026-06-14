# Loop Engineering 的 pi 落地：从零搭一个 Daily Triage Loop

> 上一篇 [Loop Engineering](./loop-engineering) 讲清楚了「loop 是什么、由什么构成」。这篇回答一个更具体的问题：**在 pi 这个工具上，怎么真的搭出一个能跑的 loop？**

先说一个反直觉的事实：**pi 没有 `/loop` 命令，也没有内置调度器。**

这不是疏漏，是 pi 的设计哲学。pi 文档的 Philosophy 章节写得明明白白：

> **No sub-agents.** There's many ways to do this. Spawn pi instances via tmux, or build your own with extensions, or install a package that does it your way.

pi 刻意把 loop、sub-agent、调度都留给用户用 **SDK + 扩展 + 外部调度器** 自己组合。这恰恰呼应了 Loop Engineering 的核心命题——**「替换掉你自己作为 prompter」**：loop 本来就该是你设计、你拥有、你调度的系统，而不是某个工具内置的黑盒。

所以本文不是「教你调用 pi 的 loop 功能」，而是**「用 pi 的积木，搭一个属于你的 loop」**。

---

## 一、目标：一个 Daily Triage Loop

我们搭一个最经典、最安全的入门 loop——**Daily Triage（每日分诊）**：

| 属性 | 值 |
|------|------|
| 调度 | 每天早上 9 点 |
| 自治级别 | **L1**（只读 + 出报告，不改代码） |
| 输入 | 仓库 STATE.md、昨日 git log、src/ 下的 TODO/FIXME |
| 输出 | 一份「今日待办」报告，回写 STATE.md，推送到 Slack |
| 人工门禁 | 全程。loop 只产出报告，是否动手由人决定 |

为什么选 L1 起步？因为它**即便出错也只是产出一份给你看的报告**，不会动你的代码。上一篇讲过的分阶段落地（L1 报告 → L2 辅助修复 → L3 无人值守），这里严格守 L1。

---

## 二、架构总览

```
   ┌──────────────────────────────────────────────────────────┐
   │  调度器  (cron / croner / GitHub Actions schedule)        │
   │  每日 09:00 触发                                          │
   └────────────────────────────┬─────────────────────────────┘
                                ▼
   ┌──────────────────────────────────────────────────────────┐
   │  runner.ts  (Node 进程, 用 pi SDK)                        │
   │                                                          │
   │  ① Implementer session (只读 tools + triage skill)        │
   │     read STATE.md → 扫 git log / TODO → 产出报告          │
   │     回写 STATE.md 的 [Today] 段                           │
   │                        ▼                                  │
   │  ② Verifier session (fresh, 独立 session)                 │
   │     审报告: 未漏未闭项? 未擅改代码? → PASS/FAIL            │
   │                        ▼                                  │
   │  ③ 通知: fetch Slack/Telegram webhook (附 PASS/FAIL)       │
   └──────────────────────────────────────────────────────────┘
                                ▼
                        （人看报告，决定是否动手）
```

整套 loop 跑在 pi **之外**的 Node 进程里，通过 SDK 调起 pi agent 做实际推理。这点至关重要：**调度与编排是 loop 的职责，pi agent 是 loop 里的「手脚」。**

---

## 三、Loop Engineering 六原语 → pi 能力映射

把上一篇的六原语逐一映射到 pi，这是整篇实践的骨架。

| Loop 原语 | pi 里的载体 | 本文用到的程度 |
|-----------|-------------|----------------|
| **Automations / Scheduling** | pi 无内置调度 → 外部 cron / croner / GitHub Actions 调起 SDK 脚本或 `pi -p` | ✅ cron |
| **Worktrees** | subagent 的 `worktree: true`（L2 才需要，L1 只读不涉及） | ⏭ L2 升级时用 |
| **Skills** | pi skills（`SKILL.md`）= **intent 的持久记忆** | ✅ triage skill |
| **Plugins & Connectors** | pi extensions + intercom；通知走外部 webhook 或 extension | ✅ Slack webhook |
| **Sub-agents (maker/checker)** | 两条路：① SDK 里开第二个 fresh session ② pi 内用 subagent + acceptance | ✅ 路径①(Verifier) |
| **+ Memory / State** | `STATE.md` in repo + pi memory 工具（跨会话） | ✅ STATE.md |

可以看到：**L1 阶段，六原语里 pi 直接覆盖了三个（skill / sub-agent / memory），剩下的调度和连接器用极薄的外部代码补齐。** 这就是 pi 的「核心最小化，能力靠组合」哲学在实践中长什么样。

---

## 四、Step 1：State 文件（Memory / State 原语）

loop 跨会话没有记忆，必须读写一个持久的东西。在仓库根放一个 `STATE.md`：

```markdown
# Loop State — Daily Triage

## Active
- [ ] #142 登录页 OAuth 回调 500（待复现）

## Today (2026-06-14)
<!-- triage loop 每天覆盖这一段 -->

## Waiting on Human
- #150 需产品确认方向后再动
- #138 已提 PR，待 review
```

三个段：
- **Active**：loop 自己维护的进行中项
- **Today**：每次运行覆盖，当天快照
- **Waiting on Human**：loop 不碰，专门标记「该人介入」的项

> 这个文件是 loop 产出的**唯一最重要制品**（上一篇 Mem0 视角的原话）。它让下一次 loop 不用从零开始，也让你一眼看清 loop 的状态。

---

## 五、Step 2：Triage Skill（Skills 原语 = Intent 记忆）

skill 是「**写一次、每次读**」的意图记忆，正好对治 Loop Engineering 里的 **Intent Debt（意图债）**。在项目里建 `.pi/skills/daily-triage/SKILL.md`，pi 的 `DefaultResourceLoader` 会自动发现：

````markdown
---
name: daily-triage
description: 每日扫描仓库产出待办报告。只读，绝不修改源码。
---

# Daily Triage

## 任务
每天早上跑一次，回答「今天该关注什么」。

## 步骤
1. 读仓库根 `STATE.md`，记下 `## Active` 和 `## Waiting on Human` 里未关闭的项
2. `git log --since="1 day ago" --oneline` 看昨日合并了什么
3. `grep -rn "TODO\|FIXME" src/` 找新欠债，对比上次（看 STATE.md 历史段）
4. 产出 Markdown 报告：新出现的 / 已关闭的 / 仍阻塞的
5. 用报告覆盖 `STATE.md` 的 `## Today (日期)` 段，**保留其它段不动**

## 铁律
- **只读源码**：禁止 `edit` / `write` 任何 `src/` 下文件
- 只允许改 `STATE.md` 的 Today 段
- 报告里凡提议「改某文件」的，必须标 `[建议-需人工确认]`，不得自行执行
````

关键设计：
- **工具权限**靠 runner 的 `tools` 白名单兜底（下一步），skill 里的「铁律」是给模型的**意图约束**
- skill 让 loop 不用每次重新教「怎么分诊」——这就是「还意图债」

---

## 六、Step 3：Runner 脚本（调度原语的执行体）

这是整个 loop 的心脏。一个 Node 脚本，用 pi SDK 调起 agent。

### 为什么用 SDK 而不是 `pi -p`

pi 提供三条非交互执行路径：

| 路径 | 写法 | 适合 |
|------|------|------|
| **print mode** | `pi -p "prompt"`（shell） | 极简单次任务、shell 脚本调度 |
| **RPC mode** | `pi --mode rpc`（JSONL over stdio） | 跨语言、进程隔离 |
| **SDK** | `createAgentSession()`（TS） | 类型安全、需多 session 编排、本进程 |

我们的 loop 要跑**两个 session**（implementer + verifier）并收集输出做后续判定——SDK 最干净。print mode 适合「跑一个 prompt 出结果就完」的最简场景，文末会给等价写法。

### triage.ts

```typescript
// triage.ts — Daily Triage loop runner
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

const REPO = process.env.REPO_CWD!;
if (!REPO || !process.env.SLACK_WEBHOOK) {
  throw new Error("需要 REPO_CWD 和 SLACK_WEBHOOK 环境变量");
}

/**
 * 跑一个独立的 pi agent session，返回 assistant 文本输出。
 * - tools: 严格白名单，L1 用只读集合
 * - SessionManager.inMemory(): 不落盘，不污染交互式会话
 */
async function runAgent(role: string, tools: string[], prompt: string) {
  let out = "";
  const { session } = await createAgentSession({
    cwd: REPO,
    tools,                                  // ← 权限的硬边界
    sessionManager: SessionManager.inMemory(REPO),
    // model / authStorage 走默认（读 ~/.pi/agent/settings.json + auth.json）
  });

  session.subscribe((e) => {
    if (e.type === "message_update" &&
        e.assistantMessageEvent.type === "text_delta") {
      out += e.assistantMessageEvent.delta;
    }
  });

  await session.prompt(prompt);
  session.dispose();
  return out;
}

// ① Implementer：只读 triage。注意 tools 里没有 edit/write
const report = await runAgent(
  "triage",
  ["read", "grep", "find", "ls", "bash"],   // bash 仅用于 git log / grep
  `执行 /skill:daily-triage。读 STATE.md，扫昨日变更和 TODO，产出今日报告并回写 STATE.md 的 Today 段。绝不改 src/。`,
);

// ② Verifier：fresh session，独立判断（maker/checker 分离）
const verdict = await runAgent(
  "verifier",
  ["read"],
  `你是独立的 verifier。审下面这份 triage 报告，只回答两点：
(a) STATE.md 的 Active/Waiting 项有没有被遗漏？
(b) 报告有没有越权提议直接改代码（应一律标 [建议-需人工确认]）？
输出 PASS 或 FAIL，再加理由。

--- 报告 ---
${report}`,
);

const ok = verdict.trim().toUpperCase().startsWith("PASS");

// ③ 人工门禁：只通知，不自动 act
await fetch(process.env.SLACK_WEBHOOK!, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: `📋 Daily Triage ${ok ? "✅ PASS" : "⚠️ FAIL"}\n\n${report}\n\n--- verifier ---\n${verdict}`,
  }),
});

console.log(`done: ${ok ? "PASS" : "FAIL"}`);
```

几个要点：

1. **工具白名单是硬边界**。implementer 的 `tools` 里**没有 `edit` / `write`**——就算模型想改源码也调不到。skill 里的「铁律」是软约束，tools 白名单是硬约束，**两层都要**。
2. **`SessionManager.inMemory(REPO)`**：loop 每次跑都是干净会话，不污染你交互式 pi 的 session 树。
3. **maker/checker 物理隔离**：verifier 是**另开的一个 fresh session**，它没看过 implementer 的推理过程，只拿到最终报告——这正是「实现者不给自己打分」。
4. **bash 工具的取舍**：triage 需要 `git log`，所以给了 bash。更严格的写法是用 SDK 的 custom tool 把 `git log` 包成专用工具，收窄 bash 的爆炸半径（文末进阶提及）。

### 等价的 print mode 写法（最简版）

如果你不需要 verifier 这一步，只要「跑一下出报告」，shell + cron 就够：

```bash
# triage.sh
cd "$REPO_CWD"
pi -p "执行 /skill:daily-triage，产出今日报告并回写 STATE.md 的 Today 段。" \
  -t read,grep,find,ls,bash \
  >> "logs/$(date +%F).log" 2>&1
```

`-t` 是 tools 白名单，`-p` 是 print mode。一行 cron 搞定。**先用这个验证 skill 写得对，再加 SDK 版的 verifier。**

---

## 七、Step 4：调度器（Automations 原语）

pi 不调度，调度交给系统。三种常见选择：

| 调度器 | 写法 | 适合 |
|--------|------|------|
| **系统 crontab** | `0 9 * * * cd /repo/runner && bun run triage.ts` | 单机、长期跑 |
| **croner**（TS） | 代码内 `import { Cron } from "croner"; new Cron("0 9 * * *", () => run())` | 跨平台、配置驱动、可热重载 |
| **GitHub Actions** | `schedule: cron: "0 9 * * *"` + 跑 SDK | 仓库即 loop、免维护机器 |

crontab 示例：

```cron
# 每日 09:00 跑 triage loop
0 9 * * * REPO_CWD=/path/to/repo SLACK_WEBHOOK=https://hooks... \
  cd /path/to/runner && /usr/local/bin/bun run triage.ts \
  >> /path/to/runner/logs/$(date +\%F).log 2>&1
```

> **记忆里的经验**：定时任务首选 croner（零依赖、全运行时、配置文件驱动 + fs.watch 热重载，免改代码免重启）。需要分布式/Web UI 才上 bullmq。

---

## 八、Step 5：Verifier（Sub-agent 原语 / maker-checker）

Step 3 的代码里 verifier 是「**SDK 内再开一个 session**」。这是 pi 落地 maker/checker 的第一条路，适合**独立 Node 进程**的 loop。

第二条路是在**交互式 pi 内**用 subagent，它有更强的结构——`acceptance` 契约（pi 原生的 goal/verifier 机制）。这条留给 L2 升级。

为什么 maker/checker 是可靠性的底线？再强调一次上一篇的结论：

> **写代码的 Agent 是评判自己工作的最差人选。** 在无人值守 loop 里，verifier 是你能「走开一会儿」的唯一依仗。

---

## 九、Step 6：通知与人工门禁（Connectors 原语）

L1 loop 的终点是「**通知人，不自动 act**」。两条路：

1. **外部 webhook**（本文用法）：runner 里直接 `fetch(SLACK_WEBHOOK)`。最简，loop 进程自带。
2. **pi extension + intercom**：写个 extension 暴露 intercom 通道，外部服务（Telegram bot、Slack app）可双向与 pi 通信。适合「人能在 Slack 里回复指令，loop 收到继续跑」的闭环。

第 2 条是 pi 的特色能力——你的 Telegram bridge 可以既当 loop 的**通知出口**，又当**人工指令入口**（人在手机上回「#138 可以合并」，loop 收到后进入下一轮）。这是把 loop 从「单向广播」升级到「双向协作」的关键，但属于进阶，L1 先用 webhook 足矣。

---

## 十、进阶：升级到 L2（implementer + worktree + acceptance）

当 L1 连续一周报告质量稳定，可以升级到 **L2 辅助修复**：loop 不只报告，还能**提议补丁**，但仍需人确认才合并。

这时三个新原语登场，全部 pi 原生支持：

```typescript
// 在交互式 pi 内（有 subagent tool），或更复杂的 runner 里 spawn 子 pi
await subagent({
  agent: "worker",
  task: `修复 STATE.md 里标记的最高优 issue（仅限 src/auth/）。
         先读相关文件，提最小改动，不要重构。`,
  worktree: true,              // ← Worktree 原语：隔离工作区，不污染主分支
  acceptance: {                // ← pi 原生的 goal/verifier 契约
    criteria: [
      "改动仅限 src/auth/ 目录",
      "npm test 全绿",
      "无新增 TODO/FIXME",
    ],
    verify: [
      { id: "tests", command: "npm test" },
      { id: "lint",  command: "npm run lint" },
    ],
    stopRules: ["测试连续两轮失败则停下交还给人"],
  },
});
```

三个原语一次到位：

| 原语 | 这里怎么用 |
|------|-----------|
| **Worktrees** | `worktree: true` 给 worker 独立 git worktree，改炸了也不影响主分支 |
| **Sub-agents** | worker 是 implementer；acceptance 的 verify 是独立验证链 |
| **Memory/State** | worker 完成后仍回写 STATE.md，记录「试了什么、结果如何」 |

> **升级判定标准不是「它能不能跑」，而是「验证器能否在无人介入时拦住错误」。** acceptance 契约就是这条防线的代码化。没到这水平，就老老实实待在 L1。

---

## 十一、pi 特有的失败模式与护栏

通用失败模式（token 失控、理解债、认知投降）上一篇讲过。这里列 **pi 落地时特有的坑**：

| 失败模式 | 现象 | pi 对策 |
|----------|------|---------|
| **工具白名单漏网** | 想只读却给了 `edit`，loop 擅改源码 | runner 的 `tools` 严格收窄；L1 永远不含 `edit`/`write` |
| **session 污染** | loop 跑完，交互式 pi 的 session 树被塞进一堆 triage 记录 | `SessionManager.inMemory()`，不落盘 |
| **bash 爆炸半径** | 给了 bash 等于给了 shell，模型可能跑意外命令 | 用 SDK custom tool 把 `git log` 包成专用工具；或 `-t` 不含 bash |
| **skill 没被加载** | 模型没主动 `read` SKILL.md，自顾自干 | prompt 里显式 `/skill:daily-triage` 强制加载；或 SDK 里 `skillsOverride` 强注入 |
| **verifier 同流合污** | verifier 复用了 implementer 的 session/上下文 | 必须**独立 fresh session**（SDK）或 `context: "fresh"`（subagent） |
| **worktree 残留** | L2 worker 跑完没清理 worktree，磁盘堆满 | worker task 里写明「完成后清理 worktree」；定期 `git worktree prune` |
| **非 git 仓库 worktree 失败** | `worktree: true` 在非 git 目录直接报错 | 先确保 `git status` 干净；loop 起手加 preflight 检查 |

> 记忆里有一条反复出现的教训：**「async 不适合单文件小任务」「subagent 执行前先 `subagent({action:"list"})` 确认可用」「非 git 仓库 worktree 跳过隔离」**——这些都是踩出来的，写 loop 时提前规避。

---

## 十二、完整清单

搭一个 L1 Daily Triage loop，你需要：

```
your-repo/
├── STATE.md                      # Step 1: loop 的记忆
├── .pi/skills/daily-triage/
│   └── SKILL.md                  # Step 2: intent 记忆（triage 规则）
└── （外部）
    ~/loop-runner/
    ├── triage.ts                 # Step 3: SDK runner（implementer+verifier）
    ├── triage.sh                 # Step 3: print mode 最简版（可选）
    └── logs/                     # 调度输出
```

加一条 crontab（Step 4），loop 就转起来了。

---

## 十三、回顾：pi 上做 Loop Engineering 的心智模型

1. **pi 不内置 loop 是特性**。loop = SDK/CLI + 调度器 + skill + subagent + memory 的组合，所有权在你。
2. **L1 起步，read-only 兜底**。工具白名单不含 `edit`/`write`，是比 skill 铁律更硬的边界。
3. **skill = 还意图债**。triage 规则写一次，每次 loop 都读，不用每次重新教。
4. **maker/checker 物理隔离**。verifier 必须是 fresh session，绝不复用 implementer 上下文。
5. **STATE.md 是脊柱**。loop 跨会话的唯一记忆，也是你审查 loop 状态的窗口。
6. **升级看验证器，不看能力**。L1→L2 的门槛是「acceptance 能否无人介入拦住错误」，不是「worker 能否跑」。

最后用 pi Philosophy 的精神收尾：pi 给你的是**最小、可组合的核心**——loop 工程的全部复杂性， rightfully 属于你设计的那个系统，而不是被某个工具的内置功能藏着。**这才是「替换掉你自己作为 prompter」的真正含义。**

---

## 参考资料

- [上一篇：Loop Engineering（概念与原语）](./loop-engineering)
- [pi 官方文档 — SDK](https://pi.dev) · [GitHub: earendil-works/pi](https://github.com/earendil-works/pi)
- [pi Philosophy：为什么没有内置 loop / sub-agent](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)
- [Cobus Greyling — Loop Engineering（六原语 + 模式）](https://github.com/cobusgreyling/loop-engineering)
- pi SDK 关键 API：`createAgentSession`、`session.prompt()`、`SessionManager.inMemory()`、`tools` 白名单、`subagent({ worktree, acceptance })`

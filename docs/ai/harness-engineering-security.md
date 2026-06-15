# 沙箱、权限与安全模型：Harness 怎么不闯祸

> Harness Engineering 系列第八篇（共 10 篇）。前一篇：[7. 记忆持久化分层](./harness-engineering-memory)。本篇进入「守护面」——agent 有了手脚（[工具](./harness-engineering-tools)），就有了闯祸能力；harness 必须把它管住，否则一行 `rm -rf` 就能把代码库、甚至生产环境送走。
>
> 与 [Loop Engineering 第 9 篇（韧性与评估）](./loop-engineering-resilience-eval) 互为表里：那篇讲「loop 跑飞了怎么自愈」，本篇讲「harness 怎么从根上不让它跑飞」。安全不是 agent 的可选项，是 harness 的承重墙。

---

## 目录

1. [引言：有手脚就有闯祸能力](#引言有手脚就有闯祸能力)
2. [8.1 IRL 损坏防护：可逆与不可逆](#81-irl-损坏防护可逆与不可逆)
3. [8.2 工具权限分层](#82-工具权限分层)
4. [8.3 bash 沙箱：命令分类与隔离](#83-bash-沙箱命令分类与隔离)
5. [8.4 不可逆守卫](#84-不可逆守卫)
6. [8.5 preflight 检查](#85-preflight-检查)
7. [8.6 人在环（HITL）](#86-人在环hittl)
8. [8.7 pi 的安全实践](#87-pi-的安全实践)
9. [8.8 反模式](#88-反模式)
10. [迁移清单](#迁移清单)
11. [下一步](#下一步)

---

## 引言：有手脚就有闯祸能力

裸 LLM 只会输出 token，最坏胡说八道。套上 harness、接上 `bash` 与 `edit` 后，它能跑测试、改文件、`git push`、`curl` 付费 API。能力上升一档，**破坏半径**也上升一档。

真实事故形态很统一：

- `rm -rf .git` 清空本地仓库，带走未提交改动；
- `git push --force` 覆盖同事刚合的分支；
- 「修一下配置」直接 deploy 到生产，配置写错，服务挂了；
- 「清理无用资源」调付费云 API，账单爆了。

这些不是模型变坏，是 harness 没在「想」和「做」之间设闸。tool calling 天然分离两者（见[第 2 篇](./harness-engineering-tools)）：模型只下指令，执行权在 harness。**安全模型的全部工程，就是在执行侧设防。**

> **核心论点**：agent 有手脚就有闯祸能力；harness 必须建工具权限、命令沙箱、不可逆守卫、人在环确认。四道闸缺一不可。

---

## 8.1 IRL 损坏防护：可逆与不可逆

**定义**：IRL（in real life）损坏防护，指对「会改到代码库之外、改到不可逆状态」的操作做边界控制。判断依据是一条二分：**可逆 vs 不可逆**。

**为何**：agent 的绝大多数日常工作（读文件、写草稿、跑测试）落在「可逆」区，git 能兜底。但有一类操作一旦执行就**无法 undo**：删除唯一副本、覆盖远程历史、改动生产环境、消耗真实金钱。代价不在「会不会错」，而在「一错就没第二次机会」。harness 必须单独立规矩。

**怎么做**：画清损坏面，再定每面的闸。

```
损坏面分级
┌─────────────────────────────────────────────────────┐
│  代码库（本地）      可逆 ── git checkout / reset    │
│  代码库（远程历史）  不可逆 ── force push 覆盖他人    │
│  生产环境            不可逆 ── deploy / DB 写入       │
│  外部服务 / 付费 API 不可逆 ── 真金白银 / 不可撤调用  │
│  凭证 / 密钥         不可逆 ── 泄露即失效            │
└─────────────────────────────────────────────────────┘
```

**判定法则（工程上够用）**：

| 信号 | 判定 |
|------|------|
| 操作落到 git 已提交且可 `reset` 的区 | 可逆 |
| 操作碰远程 ref、`main`/`production`/`release/*`、force push、删分支 | 不可逆 |
| 操作走网络、改外部状态（DB、云、第三方 API） | 不可逆 |
| 操作读 `/etc`、`~/.ssh`、`.env`、凭证文件 | 高危（即使只读） |

**反模式**：把「跑通就行」当安全判据。测试绿不代表 force push 安全——只验代码逻辑，不验会不会覆盖别人。可逆性独立于正确性。

---

## 8.2 工具权限分层

**定义**：按风险等级把工具分桶，每个桶走不同放行策略。

**为何**：等权是最常见的灾难起点。若 `read` 和 `git push --force` 走同一条「一调就执行」的路径，一次幻觉或 prompt injection（见 8.8）就能推平仓库。分层不是为难 agent，是让**低风险零摩擦、高风险必须过闸**。

**怎么做（pi）**：内置工具天然落不同桶——`read`/`grep`/`find`/`ls` 只读，`edit`/`write` 改文件，`bash` 能干任何事。分层策略：

| 层 | 工具 / 操作 | 策略 | pi 落点 |
|----|------------|------|---------|
| **L0 只读** | `read` `grep` `find` `ls` | 自动放行 | 内置，无确认 |
| **L1 写文件** | `edit` `write` | 自动放行（受分支/preflight 约束） | 内置；diff 可审 |
| **L2 跑命令** | `bash`（构建、测试、安装） | 放行但带规则拦截 | 内置；无内置命令过滤 |
| **L3 不可逆** | force push / rm / deploy / 付费 API | **必须确认或硬拦** | AGENTS.md 规则 + HITL + 容器边界 |

关键认识：**pi 没有内置权限位**。L0~L3 不是 pi 的开关，是你在 harness 侧（AGENTS.md、容器、扩展、宿主策略）落进去的纪律。pi 给的是「可被约束的执行面」，不是现成权限系统——只把规则写进 prompt 是脆弱的（见 8.8）。

**反模式**：把 `bash` 当 L1 用。`bash` 横跨所有风险层（`ls` 是 L0，`rm -rf` 是 L3），一个工具一个通道等于没分层。正确做法是命令分类（8.3）。

---

## 8.3 bash 沙箱：命令分类与隔离

**定义**：bash 沙箱，指对 `bash` 执行做分类、拦截、目录与环境隔离。

**为何**：`bash` 是风险最集中的工具——它能调一切。不给它分类，L0 和 L3 混在一条管道里，分层形同虚设。

**怎么做**：三层手段，从软到硬。

**第一层：命令分类（软拦截，在工具 handler 里）**。按命令前缀/关键词分流：

```ts
// 伪代码：bash handler 的前置分类
function classify(cmd: string): Level {
  if (/^(ls|cat|grep|find|git status|git diff|git log)\b/.test(cmd)) return 'L0';  // 只读
  if (/^(npm test|pytest|make|tsc|cargo build)\b/.test(cmd))       return 'L2';  // 构建测试
  if (/\brm\s+-rf?\b/.test(cmd))                                     return 'L3';  // 不可逆
  if (/git\s+push\s+(-f|--force)/.test(cmd))                         return 'L3';
  if (/^(deploy|kubectl|terraform apply|ssh\s+prod)/.test(cmd))     return 'L3';
  return 'L2';  // 未知默认按需确认
}
```

**第二层：危险命令拦截（路径与目录限制）**。无论哪层，硬性禁止越界：

```sh
# 硬拦规则（示例）
- 禁止操作工作目录之外：rm /、rm ~、rm /etc
- 禁止碰凭证：cat ~/.ssh/*、cat .env、env | grep -i key
- 禁止改 git 远程历史：git push --force 到受保护分支
- 限制工作目录：bash 的 cwd 锁在 repo 根，禁止 cd ..
```

**第三层：进程级隔离（硬边界，pi 的真实做法）**。前两层是「劝」，模型可被 prompt injection 绕过。真正可信的边界在操作系统。pi 在这点上态度明确——**它没有内置沙箱，这是有意为之**：

> Pi does not include a built-in sandbox … Real isolation needs to come from the operating system or a virtualization/container boundary.

pi 把隔离外包给 OS 层，给出三条路径：

| 路径 | 隔离对象 | 适用 | 要点 |
|------|---------|------|------|
| **OpenShell** | 整个 pi 进程 | 策略化沙箱（FS/进程/网络/凭证） | 经 gateway，可远程 K8s；推理凭证留网关侧 |
| **Gondolin** | 内置工具 + `!` 命令 | 宿主 pi + 本地 micro-VM | cwd 挂载到 `/workspace` 写穿回宿主；扩展覆盖 read/write/edit/bash 等 |
| **Plain Docker** | 整个 pi 进程 | 最简本地隔离 | `docker run -v "$PWD:/workspace"`；bind-mount 仍写宿主 |

```sh
# Docker：最简隔离（pi 官方示例精简）
docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

**反模式**：相信「进程内沙箱」。用正则拦命令、try/catch 包执行，都能被 `$(echo cm0gLXJm)|base64 -d` 绕过。沙箱要么是 OS 边界（容器/VM），要么没有。pi 选择不假装，把决定权交给你。

---

## 8.4 不可逆守卫

**定义**：不可逆守卫，指对 8.1 判定为不可逆的操作，强制走「人在环确认」或「硬拦截」。

**为何**：可逆操作错了有 undo，不可逆操作错了没有。对后者，唯一保护是执行前有人点头，或干脆禁掉。

**怎么做（pi）**：四类必守操作，对应四道闸。

| 不可逆操作 | 守卫 | pi 落点 |
|-----------|------|---------|
| `git push --force` / 删远程分支 | 硬拦受保护分支 + HITL 确认 | AGENTS.md 分支规则 + 容器只读远程 |
| `rm -rf` / 删唯一副本 | 命令分类拦 + 容器 FS 边界 | bash 分类（伪代码）+ Docker/Gondolin |
| 生产 deploy / DB 写入 | 禁止 agent 环境持有 prod 凭证 | 凭证隔离（见下） |
| 付费 API / 真金白银调用 | 预算上限 + HITL 确认 | 短期凭证 + 审计日志 |

核心纪律——**凭证隔离**：别让 agent 进程同时持有「能写代码」和「能 deploy 生产」的钥匙。生产凭证只活在受控流水线里，agent 触不到。这比任何 prompt 规则都硬。

**反模式**：图省事发「全权」token——能 push 任意仓库、deploy 任意环境、调任意付费 API 的凭证，等于把整个不可逆面交给一次幻觉。

---

## 8.5 preflight 检查

**定义**：preflight，指执行改写类操作（首次改文件/提交/deploy）前跑一组前置检查。

**为何**：很多事故不是「模型干了坏事」，是「它在错的分支、错的状态下干了看起来对的事」——在 `main` 直接提交、在脏工作区 rebase、在依赖没装好的环境「修」一个不存在的 bug。preflight 把这些前提在动手前验明。

**怎么做**：一组最小前置检查（可写进 AGENTS.md，或脚本化成自定义工具）：

```sh
# preflight 检查清单（伪代码 / 可脚本化）
git branch --show-current      # 不在 main，否则先建分支
git status --porcelain         # 工作区是否干净 / 有无他人改动
git log origin/main..HEAD      # 本地领先多少，是否该先 pull
[ -d node_modules ] || npm ci  # 依赖是否就位
npm test --silent              # 基线测试是否通过（改之前是绿的）
```

本仓库 AGENTS.md 已把最关键一条写成强制规则：

> **禁止在 main 分支直接提交**：所有修改必须在新建分支上。首次改文件前必须先查分支（`git branch --show-current`）。

这正是 preflight 的落地——**不靠模型自觉，靠 harness 在流程里强制**。

**反模式**：跳过 preflight「直接开干」，结果在 `main` 留串提交，或在本来红的仓库里把「修 bug」变成「引入新 bug」。基线测试改前必须绿——这是后续归因的前提。

---

## 8.6 人在环（HITL）

**定义**：人在环（HITL），指 harness 在关键节点暂停，把决定权交还给人，拿到明确信号后才继续。

**为何**：模型不能为不可逆决策负全责。它不知道这条 force push 是不是踩了同事分支，不知道这个 deploy 是不是维护窗口——这些信息只在人脑里。HITL 是把「社会上下文」注入决策的唯一通道。

**怎么做**：三件事。

**1. ask_user 确认原语**。通用 harness 提供 `ask_user`（或等价）工具，让模型遇不可逆操作时主动发问，harness 暂停等回答：

```ts
// 伪代码：模型侧发起确认
await ask_user({
  action: 'git push --force origin feat/x',
  reason: 'rebase 后需要覆盖远程分支',
  reversible: false,
});
// harness 暂停，状态面板同步显示，人确认后才执行
```

**2. 状态面板同步**。agent 在干啥、卡在哪、等谁确认，实时反映在 UI/日志里，不黑盒（[可观测性](./harness-engineering-observability) 安全面）。

**3. 异常上报**。命令非零退出、测试转红、被守卫拦截——这些异常必须**作为上下文回灌**（见[第 2 篇](./harness-engineering-tools)），而非吞掉。否则模型盲目重试，把可逆错拖成不可逆。

**何时打断人**：任何 L3 操作、任何模型不确定该不该继续的时刻、任何越界命令。

**反模式**：`--yes` 一路放行无人值守，等于蒙眼交方向盘。无人值守必须配容器边界 + 预算上限 + 审计，且只许碰可逆面。

---

## 8.7 pi 的安全实践

把前几节的抽象落回 pi，它的安全模型有几个值得点明的取舍。

**1. Project Trust——资源加载闸，不是沙箱。** 首次进入项目目录会问「是否信任」，决定存进 `~/.pi/agent/trust.json`。信任才加载 `.pi/settings.json`、`.pi/extensions`、`.pi/SYSTEM.md` 等项目资源。

> 注意：project trust **只挡资源加载**，防 clone 仓库悄悄改你的 pi 配置/扩展，**不限制模型调什么工具**。把 trust 当沙箱是误解——它挡不住 `bash rm -rf`。

**2. 非交互模式的风险。** `-p`/`--mode json`/`--mode rpc` 不弹 trust 提示。无已存决策时 `defaultProjectTrust: "ask"` 直接跳过受保护资源；用 `--approve`/`-a`、`--no-approve`/`-na` 覆盖。无人值守想清楚。

**3. 上下文规则（AGENTS.md）。** `AGENTS.md`/`CLAUDE.md` 不受 trust 影响、每轮注入。本仓库「禁止 main 提交」「改前查分支」就是这层硬纪律——规矩写进上下文，模型每步都看见。

**4. 错误即上下文。** 工具的非零退出、校验失败，pi 作为 tool_result 回灌，模型据此修正——错误不是崩溃，是信号。

**5. 真隔离交给 OS。** 面对不可信仓库、不盯的生成代码、无人值守自动化，pi 建议直接进容器。OpenShell/Gondolin/Docker 三选一，挂最小路径、短期凭证、按需断网。

```
pi 安全层级（从软到硬）
AGENTS.md 上下文规则     ← 每轮注入，约束行为（软）
   ↓
Project Trust            ← 挡资源加载，不挡工具（中）
   ↓
HITL 确认 + preflight    ← 不可逆操作暂停（中）
   ↓
OS / 容器边界            ← 唯一可信隔离（硬）
```

**一句话**：pi 不假装有沙箱——软约束做实，硬隔离（容器）交给你。

---

## 8.8 反模式

| 反模式 | 症状 | 根因 | 对策 |
|--------|------|------|------|
| **全工具等权** | `bash` 和 `read` 同通道，一次幻觉推平仓库 | 不分层 | 按风险分桶（8.2），`bash` 单独分类（8.3） |
| **无沙箱裸跑生产凭证** | agent 直连 prod，误 deploy | 图省事发全权 token | 凭证隔离 + 容器边界 |
| **push 不确认** | force push 覆盖同事分支 | 远程操作无守卫 | 受保护分支 + HITL（8.4） |
| **规则只靠 prompt** | 模型被注入或遗忘，规则失效 | 纯软约束不可信 | 规则进上下文 + 硬边界兜底 |
| **跳过 preflight** | 在 `main` 提交、在脏区 rebase | 「直接开干」 | 改前强制查分支/状态/基线测试（8.5） |
| **进程内伪沙箱** | 正则拦命令被绕过 | 误以为能拦住 | 隔离交给 OS（容器/VM） |
| **无人值守放行 L3** | 无人盯跑不可逆操作 | `--yes` 一路通 | 无人值守只碰可逆面 + 审计 |

**最危险的一条**：安全规则只写进 system prompt 就当完事。prompt 是软的，prompt injection 是真实风险——仓库注释、文档、构建产物都能注入指令。任何不可逆的闸都必须有 prompt 之外的硬兜底（容器、凭证隔离、宿主策略）。软约束管「平时别犯错」，硬约束管「真要犯也犯不了大祸」。

---

## 迁移清单

| 安全能力 | pi | Claude Code | Cursor | Aider | 通用 harness 实现 |
|---------|----|-------------|--------|-------|------------------|
| **工具权限分层** | 无内置开关，靠上下文规则 + 扩展 | 权限模式（ask/auto）+ deny 规则 | 手动 approve/run 模式 | 只读/编辑/commit 分离 | 按风险分桶 + 每桶策略 |
| **bash 沙箱** | 无内置，OS/容器（OpenShell/Gondolin/Docker） | 内置命令权限审批 | 终端命令需确认 | 受限于 git 工作流 | 命令分类 + 容器边界 |
| **不可逆守卫** | AGENTS.md 规则 + HITL + 凭证隔离 | permission rules（deny force push 等） | 手动 gate | git commit 为天然断点 | L3 操作强制确认或硬拦 |
| **preflight** | 上下文纪律（查分支/状态）+ 可脚本化 | hooks（PreToolUse） | 无原生 | git 状态隐式前置 | 改前检查脚本 + 工具 |
| **HITL 确认** | 交互 trust prompt + `--approve`/`-na` | 原生权限提示 | UI 确认 | 每次提交确认 | `ask_user` 工具 + 状态同步 |
| **prompt injection 防护** | 明确「不假装」，靠容器 | 文档化信任边界 | 隐含用户把关 | 受限工具面 | 不信仓库内容 + 硬边界 |
| **凭证隔离** | 短期凭证 + 不挂宿主 `~/.pi` | 按需 key 注入 | IDE 钥匙串 | 本地 git 凭证 | 最小凭证 + 短期 token |

**一句话**：Claude Code 在「内置权限规则 + hooks」上最现成；pi 选择「不假装有沙箱 + 明确交给你容器」的诚实路线；自建 harness 至少要凑齐**工具分层 + 不可逆守卫 + HITL + 一种 OS 级隔离**这四件，缺一件就有闯祸口子。

---

## 下一步

安全模型让 agent「闯不了大祸」，但你还得**看见它干了什么**——哪轮调了哪个工具、花了多少 token、为何做了那个决定。这是守护面另一半：可观测性与可调试性。

> 本文是 Harness Engineering 系列第 8 篇 / 共 10 篇。
> 上一篇：[7. 记忆持久化分层](./harness-engineering-memory)
> 下一篇：[9. 可观测性与可调试性](./harness-engineering-observability) —— tracing/metrics/logging、session replay、token 计量。
>
> 与 [Loop Engineering 第 9 篇（韧性与评估）](./loop-engineering-resilience-eval) 呼应：那篇管「loop 跑飞后怎么自愈与评估」，本篇管「harness 怎么从架构上不让它跑飞」。一个治已病，一个治未病。

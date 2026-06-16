# React 进阶系列总纲

> 本页是 React 进阶系列的总索引。系列不走「从安装到上手」的入门路线——那类教程网上太多。本系列假设你写过 React，但想真正**理解它**：为什么这样设计、渲染到底怎么发生、Hooks 的心智模型、何时该用什么。

---

## 这系列讲什么

React 有两个反直觉的特点，让很多人写了几年仍停留在「能跑就行」：

1. **声明式**：你描述「界面应该是什么样」，不描述「怎么改」。这要求你放弃命令式（jQuery 时代）的肌肉记忆。
2. **状态驱动渲染**：你改 `state`，React 帮你算出 DOM 差异。你**永远不该直接操作 DOM**——但多数人没想清楚「永远」的边界在哪。

抓住这两点，React 的其余部分（Hooks、性能优化、状态管理、并发特性）都是顺理成章的推论。本系列的目标：**把 React 从「黑盒魔法」变成「可推理的系统」。**

---

## 为什么又写一套 React 教程

站内已有一份旧的 [React 学习记录](./react)（作者早期笔记，Class 时代）。它有价值——记录了初学路径——但内容停留在 React 16，且有些代码已过时甚至有误。

本系列是**现代视角的重写与深化**：Hooks 优先、函数式优先、TypeScript 优先。和站内的 [函数式编程](./functional)、[函数式思维](./functional-thinking) 一脉相承——React 本质上就是函数式 UI 编程。

---

## 系列地图（8 篇）

| # | 篇 | 文件 | 解决问题 |
|---|----|------|----------|
| 0 | **总纲** | 本文 | 定边界、给地图 |
| 1 | [设计哲学：为什么是声明式](./react-philosophy) | `react-philosophy` | 命令式 vs 声明式、状态驱动、React 的心智底座 |
| 2 | [JSX 与元素：编译时发生了什么](./react-jsx) | `react-jsx` | JSX→createElement→虚拟 DOM 树，元素是对象 |
| 3 | [渲染与 Reconciliation：状态如何变成 DOM](./react-reconciliation) | `react-reconciliation` | render 触发条件、diff 算法、key 的本质 |
| 4 | [Hooks 心智模型（一）：状态与 useState/useReducer](./react-hooks-state) | `react-hooks-state` | 状态更新、批处理、何时用 reducer |
| 5 | [Hooks 心智模型（二）：副作用与 useEffect 的三个真相](./react-hooks-effects) | `react-hooks-effects` | 副作用、依赖数组、cleanup、常见陷阱 |
| 6 | [Hooks 心智模型（三）：记忆化与自定义 Hooks](./react-memoization) | `react-memoization` | useMemo/useCallback、何时不该用、自定义 Hook 抽象 |
| 7 | [状态管理选型：从 useState 到 Zustand/Redux](./react-state-management) | `react-state-management` | Context 陷阱、prop drilling、何时上状态库 |
| 8 | [性能优化与并发特性](./react-performance-concurrent) | `react-performance-concurrent` | memo、虚拟列表、React 18 并发、Suspense、startTransition |

**分册速览**：

- **第一册 心智底座（1-2）**：声明式 + JSX，React 的世界观。
- **第二册 渲染机制（3）**：Reconciliation，理解了这层，性能问题不再神秘。
- **第三册 Hooks 深度（4-6）**：Hooks 是 React 的现代核心，三篇拆透。
- **第四册 工程化（7-8）**：状态管理与性能，把 React 用到生产级。

---

## 阅读顺序

```
[JS/TS 基础] → [函数式思维](./functional-thinking)
                    │
                    ▼
           1.设计哲学 → 2.JSX → 3.渲染
                                │
            ┌───────────────────┼───────────────────┐
            ▼                                       ▼
      4.useState/useReducer → 5.useEffect → 6.记忆化
            │                                       │
            └───────────────────┬───────────────────┘
                                ▼
                  7.状态管理 → 8.性能与并发
```

- **新手补课**：从第 1 篇顺序读到第 8 篇。
- **老手查漏**：卡在哪读哪——渲染慢读 3，useEffect 抓狂读 5，状态管理纠结读 7。
- **面试复习**：重点 3（Reconciliation）、5（useEffect）、8（并发特性）。

---

## 约定

| 约定 | 说明 |
|------|------|
| **版本** | React 18+，Hooks 优先，几乎不写 Class（仅在讲历史演进时提及）。 |
| **语言** | TypeScript。所有示例带类型。 |
| **函数式优先** | 组件即纯函数 `(props) => UI`。呼应站内函数式编程系列。 |
| **代码** | 可运行的最小示例，不堆业务代码。 |
| **不做什么** | 不搬运官方文档（[react.dev](https://react.dev) 已是最好的文档），而是讲清「为什么」和「什么时候用」。 |

---

> 下一篇：[1. 设计哲学：为什么是声明式](./react-philosophy) —— 放下命令式的肌肉记忆，理解 React 真正的运行模型。

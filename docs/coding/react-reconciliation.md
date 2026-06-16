# 渲染与 Reconciliation：状态如何变成 DOM

> 你写 `setState`，界面就变了——中间发生了什么？为什么有时「改了 state 却没重新渲染」，有时「state 没变却渲染了」？这一篇拆透 React 把状态变成 DOM的那台机器。

---

## 目录

1. [引言：setState 之后到底发生了什么](#引言)
2. [一次渲染的两个阶段](#_3-1-一次渲染的两个阶段)
3. [什么触发重新渲染](#_3-2-什么触发重新渲染)
4. [Reconciliation 的三假设](#_3-3-reconciliation-的三假设)
5. [key 的本质](#_3-4-key-的本质)
6. [为什么 render 必须纯](#_3-5-为什么-render-必须纯)
7. [渲染 ≠ 更新 DOM](#_3-6-渲染-不等于-更新-dom)
8. [小结](#小结)
9. [下一步](#下一步)

## 引言

`count` 从 0 变到 1，屏幕上的数字就跳了一下。看似理所当然，但 React 在这背后做了一件极不平凡的事：它没有直接改 DOM，而是**重新调用了你的组件函数，算出一棵新的元素树，再拿这棵新树跟旧树对比，只把差异的部分打到 DOM 上**。

这个过程叫 **Reconciliation（协调/调和）**。理解它是分水岭：

- 不懂的人，把 React 当魔法，性能问题来了只会乱加 `memo`。
- 懂的人，看一眼组件树就能推理出「谁会渲染、谁不会、为什么」。

这一篇讲清两件事：**一次渲染的两个阶段**，以及 **diff 算法的三个假设**。这是后续所有性能优化（`memo`、`useMemo`、并发特性）的地基。理解之前，先纠正一个普遍误解："render" 这个词被滥用太久了——它既指 React 调用你的组件函数，又指浏览器把界面画到屏幕。本文里我们严格区分，render 只指前者那场纯计算。

## 3.1 一次渲染的两个阶段

React 把「渲染」拆成两段，职责完全不同：

```
 setState
    │
    ▼
┌──────────── render 阶段（可中断 / 可重试，必须纯）────────────┐
│ 调用组件函数 → 生成新 React 元素树 → 与旧树做 diff            │
│ 产出：「需要应用的变更列表」（尚未碰 DOM）                    │
└────────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────── commit 阶段（同步，不可中断）────────────────────┐
│ 把变更应用到 DOM → 赋值 ref → 跑 useLayoutEffect → 调度 useEffect │
└────────────────────────────────────────────────────────────┘
    │
    ▼
 浏览器绘制
```

| 阶段 | 干什么 | 能不能中断 | 能不能有副作用 |
|------|--------|-----------|----------------|
| **render** | 调函数、建树、diff（纯计算） | 能（并发模式可暂停/重试） | **绝对不能** |
| **commit** | 改 DOM、跑副作用 | 不能（必须一气呵成） | 可以（副作用都在这） |

关键认知：**render 阶段不碰 DOM**。它只是「算账」——算出当前这棵 UI 树长什么样，跟上次差在哪。真正动 DOM 是 commit 阶段的事。所以你在组件函数体里直接操作 DOM，等于在「算账」环节改了「实物」，账就乱了。

为什么要切两段？因为 **计算和副作用必须解耦**。计算可以丢掉重来，副作用（发请求、改 DOM、写日志）一旦执行就收不回来。把不可逆的操作关在 commit 阶段、且只跑一次，React 才能放心地在 render 阶段做并发调度——想停就停，想重算就重算，绝不留下烂摊子。这也是 commit 阶段又细分为「修改 DOM → `useLayoutEffect`/ref 赋值（同步、阻塞绘制）→ `useEffect`（异步、绘制后）」三步的原因：DOM 变更必须原子完成，而那些「不那么紧急」的副作用可以延后到浏览器画完一帧再跑。

顺带一个开发期陷阱：React 的 `<StrictMode>` 会**故意把每个组件函数调用两次**，就是在帮你暴露 render 阶段里的不纯——如果双调用产生了副作用重复或数据错乱，说明你把不该放的东西放进函数体了。

## 3.2 什么触发重新渲染

只有三种情况会让 React 重新调用一个组件函数：

1. **自身的 state 变了**——`setState` / `dispatch` / `useState` 的 setter 被调用且值确实不同。
2. **父组件重新渲染了**——不管传给子的 props 变没变，子默认都会跟着渲染。
3. **订阅的 Context 值变了**——消费该 Context 的所有组件重渲染。

这三条里，第 1、3 条符合直觉，第 2 条最反直觉，也是性能问题的头号根源，必须刻进脑子：

> **父组件渲染时，所有子组件默认都会重新渲染，即使传下去的 props 一个字都没变。**

```tsx
function Parent() {
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
      {/* count 与 Child 无关，但每次点按钮 Child 都会重新渲染 */}
      <Child title="固定的" />
    </>
  );
}

function Child({ title }: { title: string }) {
  console.log('Child 渲染了'); // 每次点按钮都会打印
  return <div>{title}</div>;
}
```

React 默认「宁可多渲染，不能漏渲染」——它不知道 `Child` 用没用 `count`，保险起见全刷一遍。这是 React 用正确性换性能的取舍。后面 [React.memo](./react-memoization) 会讲怎么告诉 React「props 没变就别刷」。

补充 Context 的坑：Context 的消费组件在**值变化**时重渲染，而这个「变化」用的是引用相等判断。所以若你把一个新建的对象/函数作为 `Provider value` 传下去（每次渲染都是新引用），所有消费组件都会被误判为「Context 变了」而刷新。这就是为什么 Context 的 value 常常要配合 `useMemo` 稳定——详见后续状态管理篇。

## 3.3 Reconciliation 的三假设

拿到新旧两棵元素树，怎么找差异？通用树的精确 diff 是 O(n³) 的复杂度——要考虑节点改名、插入、删除、移动各种组合，节点一多就炸，没法用。React 用三个假设把它压到线性 O(n)，这正是它能高效处理大规模 UI 的根本原因：

**假设一：不同类型，直接销毁重建。**

`<div>` 变成 `<span>`，或 `<Counter>` 变成 `<TextInput>`，React 不复用、不迁移任何东西——把旧的连同它的 DOM 节点、state、子树**全部拆掉**，从零建一棵新的。

```tsx
{isEditing ? <input /> : <p>{text}</p>}
// 在两者间切换：input 的内部状态（光标、选中）不会保留给 p，
// 因为 type 不同，旧的整个销毁。
```

**假设二：同类型，保留 DOM 节点，只更新属性。**

`<div className="a">` → `<div className="b">`，同一个 DOM 节点，React 只改 `className`，不动子节点。对自定义组件 `<Counter>` → `<Counter>`，React 保留组件实例（state 不丢），把新 props 传进去，触发该组件自身的 render，再递归对它的子树重复这套流程。

这条假设也是「同位置同类型 = 同一个东西」的体现。一个常见误用：想用「把组件 key 改一下」来重置 state，其实更直白的方式是改组件**类型**——但日常最常用的还是改 key（见下一节）。

**假设三：列表项靠 `key` 识别身份。**

同层的兄弟节点是一组列表时，React 靠 `key` 判断「这一项还是原来那一项吗」。key 相同 → 复用、更新；key 没了 → 销毁；key 新出现 → 新建。

## 3.4 key 的本质

很多人把 `key` 当成「给列表加的必填项」，随便填个下标交差。但 key 的真实角色是：**React 识别列表项身份的唯一凭证。**

- `key` 变 = 身份变 = 这一项被当成「全新组件」→ state 重置、DOM 可能重建。
- `key` 不变 = 还是「同一项」→ state 保留、只更新内容。

用数组下标 `index` 当 key 是经典翻车现场：

```tsx
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: '吃饭' },
    { id: 2, text: '睡觉' },
  ]);
  // 在头部插入一条
  const prepend = () => setTodos([{ id: 3, text: '写代码' }, ...todos]);

  return (
    <ul>
      {todos.map((t, index) => (
        // ❌ 用 index 当 key
        <li key={index}>
          <input /> {/* 受控外的输入框 */}
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}
```

头部插入后，位置 0 还是 key=0，位置 1 还是 key=1。React 认为「身份没变」，于是**保留两个 `<input>` 节点不动，只换文字**——结果用户在第 0 行输入框敲的字，留在了「写代码」那行上，而它本该跟着「吃饭」走。这就是下标 key 导致的输入错位 bug。

用稳定的业务 id 当 key 即可根除此类问题：

```tsx
{todos.map(t => (
  <li key={t.id}>  {/* ✅ 身份跟随数据本身 */}
    <input />
    <span>{t.text}</span>
  </li>
))}
```

一句话：**key 应该来自数据本身，且在列表生命周期内稳定唯一。** 临时数据没 id 就造一个（如 `crypto.randomUUID()`），别用 index。

另一个极端也别踩：**不要用 `Math.random()` 或 `Date.now()` 当 key**。每次 render 都生成新随机数，React 会认为「每一项都是全新的」，于是把整个列表销毁重建——state 全丢，性能崩坏。稳定是 key 的灵魂：同一项数据在多次渲染间，key 必须不变；不同项之间，key 必须不同。

## 3.5 为什么 render 必须纯

render 阶段会被 React 暂停、丢弃、重来——并发模式下尤其频繁。所以组件函数体必须是**纯函数**：同样的 props + state，必须算出同样的 UI，且不能在运行过程中改外部世界。

```tsx
// ❌ render 里有副作用：每次都可能多算一次计数
let renderCount = 0;
function Bad() {
  renderCount++;                 // 改全局
  fetch('/api/log');             // 发请求
  document.title = 'hi';         // 直接碰 DOM
  return <div>{renderCount}</div>;
}
```

这段代码的恐怖之处：你以为它跑一次，实际可能跑两三次（中断重试），请求就多发了，全局变量就脏了。正确做法是把副作用统统塞进 `useEffect`：

```tsx
function Good() {
  useEffect(() => {
    fetch('/api/log');
    document.title = 'hi';
  }, []);
  return <div>ok</div>;
}
```

`useEffect` 在 **commit 阶段之后**执行，保证每个渲染周期只跑一次副作用。这呼应了站内 [函数式思维](./functional-thinking)：纯函数负责「算」，副作用隔离在边界。React 的组件 = UI 的纯函数，`useEffect` = 那道副作用边界。

判断「能不能放进 render」有一条简单判据：**这一步会不会影响下一次 render 的输入，或留下肉眼可见的痕迹？** 如果会，它就是副作用，进 `useEffect` 或事件处理函数；如果只是根据 props/state 算出一个值（哪怕过程复杂），那就是纯计算，放心放函数体里。读取 `Date.now()`、`Math.random()`、全局可变变量也都算不纯——它们让同样的输入得出不同输出，会破坏 React 的可预测性。

| 放在哪 | 能不能碰副作用 | 原因 |
|--------|----------------|------|
| 组件函数体 | ❌ | render 阶段可中断重试，副作用会重复/错乱 |
| `useEffect` / 事件处理函数 | ✅ | 在 commit 之后或用户交互时跑，确定执行 |

## 3.6 渲染 ≠ 更新 DOM

最后一个常被忽略的事实：**组件被「渲染」不等于 DOM 真的被改了。** React 会做 **bailout（退出优化）**，跳过那些「渲染了但结果一样」的提交：

- `setState(同值)`：用 `Object.is` 判断，若新 state 与旧的全等，React 直接放弃这次渲染，连子组件都不刷。
- `React.memo` 包裹的子组件：props 浅比较没变 → 跳过这次渲染。

```tsx
const MemoChild = React.memo(function Child({ title }: { title: string }) {
  return <div>{title}</div>;
});
// 父渲染但传给 MemoChild 的 title 没变 → MemoChild 不渲染、不提交
```

所以「组件渲染了」和「DOM 更新了」是两件事。前者是 render 阶段被触发，后者是 commit 阶段真改了 DOM。React 的优化目标，就是让前者尽量少发生、或发生后让后者尽量少动。理解这层区别，你才能读懂 React DevTools Profiler 里「render 时间」和「commit 时间」两栏分别意味着什么。

还要区分两个动作：**「重新渲染」**（render 阶段调用组件函数）和 **「重新提交」**（commit 阶段把 diff 写到 DOM）。一个组件可能被 render 了好几次，但只要算出来的树和上次一致，就一次 commit 都不会发生。优化 `useMemo`/`useCallback` 的本质，正是让传给子组件的 props 引用稳定，从而触发子的 bailout，拦住这个 "被 render"。这把钥匙，将在记忆化篇正式交给你。

## 小结

- 一次渲染分两段：**render（纯计算，可中断）** 和 **commit（改 DOM，跑副作用，不可中断）**。
- 触发重渲染只有三类：**自身 state 变、父组件渲染、Context 变**。父渲染会无条件拖上所有子——这是性能问题的主战场。
- diff 三假设：**异类型销毁重建、同类型复用更新属性、列表靠 key 识身份**。
- **key 是身份凭证**，不是装饰品；用稳定的业务 id，绝不用 index。
- render 必须纯——副作用一律进 `useEffect`，因为 render 阶段可被重试。
- 渲染 ≠ 更新 DOM：React 会用 `Object.is` 和 `memo` 做 bailout，跳过无意义的提交。

带着这套认知去开 React DevTools 的 Profiler，火焰图里每一个色块、每一次「为什么这个组件渲染了」，都能被你推理清楚。性能优化不再是玄学，而是一门可测、可证、可重复的工程。

## 下一步

下一篇我们钻进 Hooks 的内部模型，把 `setState` 之后到底怎么排队、怎么批处理、`useReducer` 何时更合适彻底讲透——[Hooks 心智模型（一）：状态与 useState/useReducer](./react-hooks-state)。

> 本文是 React 进阶系列**第 3 篇 / 共 8 篇**。← 上一篇：[JSX 与元素：编译时发生了什么](./react-jsx) ｜ → 下一篇：[Hooks 心智模型（一）：状态与 useState/useReducer](./react-hooks-state)

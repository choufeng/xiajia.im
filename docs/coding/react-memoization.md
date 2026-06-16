# Hooks 心智模型（三）：记忆化与自定义 Hooks

> `useMemo` / `useCallback` 是 React 里被过度使用的特性。很多人当成「默认开更快」的开关，给每个变量、每个函数都裹一层。结果项目没变快，反而多出一堆维护负担。「以防万一加 `useMemo`」是常见的性能反直觉——本篇讲清记忆化真正解决的问题，以及为什么大多数时候你根本不需要它。

---

## 目录

1. [引言](#引言)
2. [6.1 记忆化到底做什么](#61-记忆化到底做什么)
3. [6.2 为什么不能盲目加](#62-为什么不能盲目加)
4. [6.3 何时该用 useMemo/useCallback](#63-何时该用-usememousecallback)
5. [6.4 何时该用 React.memo](#64-何时该用-reactmemo)
6. [6.5 自定义 Hook：复用逻辑的正道](#65-自定义-hook复用逻辑的正道)
7. [6.6 自定义 Hook 的设计原则](#66-自定义-hook-的设计原则)
8. [6.7 反模式](#67-反模式)
9. [小结](#小结)
10. [下一步](#下一步)

## 引言

记忆化（memoization）在 React 语境里，指的是用 `useMemo`、`useCallback`、`React.memo` 这三件套让组件「记住」上次计算的结果或引用，避免重复劳动。直觉上，「记住」听起来总是好事——既然能省一次计算，为什么不省？

问题在于：**记住本身也要花钱**。React 得开辟一块缓存存上次的值，每次渲染再把新旧依赖数组逐项比较，决定要不要复用。如果省下的计算很便宜，或下游根本不在意引用变没变，这层缓存就是净亏损——你花在比较依赖上的时间，比直接重算还多。

更深的误区是把 `useCallback` 当成「让函数更快」。它从来不是为速度而生，而是为**保持引用稳定**——让依赖这个函数的下游 memo 或 Hook 不会因为引用变化而失效。理解这一点，你才能判断哪里该加、哪里纯属浪费。

本篇前半拆记忆化：它做什么、何时该用、何时是负担。后半讲自定义 Hook——React 复用有状态逻辑的唯一正道，它是记忆化之外的另一种「记住」，也是把组件拆薄的利器。

## 6.1 记忆化到底做什么

**是什么**：`useMemo` 缓存**计算结果**，`useCallback` 缓存**函数引用**。

```tsx
const sorted = useMemo(() => items.slice().sort(compare), [items, compare]);
const handleClick = useCallback(() => doSomething(id), [id]);
```

`useMemo(() => fn, deps)` 返回 `fn` 的执行结果；`useCallback(fn, deps)` 返回 `fn` 本身（不执行）。两者的关系其实是糖：

```tsx
// useCallback 等价于 useMemo 包装一个返回函数的函数
const handleClick = useCallback(() => doSomething(id), [id]);
const handleClick2 = useMemo(() => () => doSomething(id), [id]); // 一回事
```

**为什么需要**：函数组件每次渲染都重新执行，函数体里的变量、函数、对象**全是新创建的**。看这段：

```tsx
function List({ items }: { items: string[] }) {
  const sorted = items.slice().sort(); // 每次渲染都重新排序
  const handler = () => console.log('clicked'); // 每次渲染都是新函数
  return <ul>{sorted.map((s, i) => <li key={i} onClick={handler}>{s}</li>)}</ul>;
}
```

父组件任何一次渲染都会让 `List` 重渲染，`sorted` 重排一遍，`handler` 是个新引用。多数情况下这毫无问题——排序快、子组件不在意。但当 `sorted` 是万元素列表的复杂排序，或 `handler` 传给了一个被 `React.memo` 包裹的子组件时，这种「每次都新」就成了性能负担。

关键澄清：**记忆化的核心收益不是「让组件跑得更快」，而是「保持引用稳定，让下游的 memo 和 Hook 依赖不失效」**。`useMemo` 顺带省了昂贵计算，但这只是副产品；它真正解决的是「下游要不要重做」的连锁反应。

## 6.2 为什么不能盲目加

**为什么**：记忆本身有成本。每次渲染，React 都要做两件事：

1. 存一份上次的值和依赖数组到 fiber 节点上（内存开销）。
2. 把新依赖和旧依赖逐项做 `Object.is` 比较（CPU 开销）。

只有当「跳过的重计算成本」**大于**「记忆成本」时，记忆化才赚。否则净亏。

一个心智模型，把它当公式记：

```
记忆化净收益 = 跳过的重计算成本 - 记忆成本(存缓存 + 比较依赖)
```

- `跳过的重计算` 很贵（万元素排序、复杂序列化）→ 收益为正。
- `跳过的重计算` 很便宜（一次属性访问、一次小数运算）→ 收益为负，记了反而更慢。

**反例**——把记忆化当默认开：

```tsx
// ❌ 全是廉价计算，记忆化净亏
const name = useMemo(() => `${first} ${last}`, [first, last]);
const isReady = useMemo(() => status === 'ready', [status]);
const handleClick = useCallback(() => setCount(c => c + 1), [setCount]); // setState 永远稳定，不必 memo
```

字符串拼接、布尔判断，重算比比较依赖还快。`setCount` 是 React 保证稳定的引用，包 `useCallback` 纯属多此一举。这种代码在不少项目里成片出现——多数是从「性能优化最佳实践」类文章照搬的模板，没想过它在便宜计算上是负担。

另一层成本是**可读性**。每多一层 `useMemo`，读代码的人就得多想一层「这个缓存什么时候失效」。滥用记忆化会让组件逻辑像缠成一团的线，调试时反而更难。性能优化先有证据（Profiler 测出来真的慢），再动手，别凭直觉提前优化。

## 6.3 何时该用 useMemo/useCallback

三条硬标准，**满足任一才考虑加**，否则不加：

**1. 作为其他 Hook 的依赖**

```tsx
const data = useMemo(() => fetchData(filter), [filter]);
useEffect(() => {
  log(data); // data 引用稳定，effect 不会反复跑
}, [data]);
```

不 memo 的话 `data` 每次是新数组，effect 每次渲染都触发——逻辑上错了，不只是性能问题。

**2. 传给已 memo 的子组件**

```tsx
const MemoizedChild = React.memo(Child);
function Parent() {
  const onClick = useCallback(() => action(id), [id]); // ✅ 引用稳定，保住 memo
  return <MemoizedChild onClick={onClick} />;
}
```

子组件用 `React.memo` 是为了 props 没变就跳过渲染。若 `onClick` 每次是新函数，浅比较判到「变了」，memo 失效，白 memo 了。这条和 6.4 的 `React.memo` 是配对的——**单边 memo 没意义**。

**3. 真正昂贵的计算**

大列表排序、复杂序列化、大型矩阵运算这类，重算成本远高于记忆成本。怎么界定「昂贵」？**别凭感觉，用 Profiler 测**。经验值：处理上千元素的数组、或单次计算超过几毫秒，值得 memo；几十个元素的 map/filter，不值得。

补充两条容易漏的。其一，**`useCallback` 的依赖要写全**，和 `useEffect` 同理。漏依赖会闭包锁旧值，制造难查的 bug。开启 `eslint-plugin-react-hooks` 的 `exhaustive-deps` 规则会帮你抓。其二，**记忆化解决不了「下游没 memo」的问题**——你费力稳定了 `onClick`，但子组件没用 `React.memo`，照样每次重渲染，前面的努力全部落空。

## 6.4 何时该用 React.memo

**是什么**：`React.memo(Component)` 包一层，让组件在 **props 浅比较未变**时跳过重渲染。

```tsx
const ExpensiveList = React.memo(function List({ items, onSelect }: Props) {
  // items、onSelect 引用没变时，父组件渲染不会触发这里重渲染
  return <ul>{items.map(i => <li key={i.id} onClick={() => onSelect(i.id)}>{i.label}</li>)}</ul>;
});
```

**什么时候用**——同时满足：

- 组件是**纯展示**，渲染结果完全由 props 决定。
- 组件**重渲染昂贵**（子树大、计算多），且**经常**因父组件无关状态变化被白白重渲染。
- props 频繁保持不变（引用稳定）。

注意第三条是关键：`memo` 默认浅比较，**props 里嵌套对象或函数若每次新建，memo 立刻失效**。

```tsx
// ❌ 父组件这么写，子组件的 memo 形同虚设
function Parent() {
  return <MemoizedChild config={{ theme: 'dark' }} onClick={() => {}} />;
  // config 每次新对象，onClick 每次新函数 → 浅比较判「变了」→ 每次都重渲染
}
```

要让 memo 真正生效，父组件得配合：`config` 用 `useMemo` 或提到组件外、`onClick` 用 `useCallback`。这正是 6.3 第 2 条的由来——**memo 和 useCallback/useMemo 是一套组合拳，单边用无效**。

何时**不该**用 memo：

- 组件本身很轻，重渲染不疼（一个按钮、一行文字）。
- props 几乎每次都变，memo 基本不命中，只多了比较开销。
- 子组件数量少，没有「大量兄弟组件无谓重渲染」的问题。

`memo` 还接受第二个参数做**自定义比较**：`React.memo(C, (prev, next) => ...)`，返回 `true` 表示「视为相等、跳过渲染」。默认浅比较多数够用；只有 props 嵌套较深且你确知语义时才上自定义比较。但要警惕——自定义比较本身也是每次渲染都要跑的开销，写不好反而更慢，且容易引入「该更新却没更新」的 bug。

盲目包 memo 是另一种「以防万一」。先用 Profiler 确认某子树真在不必要地重渲染，再针对性 memo。React 18 后，DOM 更新本身已很高效，多数组件 memo 带来的收益有限。

## 6.5 自定义 Hook：复用逻辑的正道

**是什么**：自定义 Hook 是以 `use` 开头的函数，内部调用其他 Hook，把**有状态逻辑**抽成可复用的单元。

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(v => !v), []);
  return [on, toggle] as const;
}
```

**为什么是正道**：React Class 时代，复用有状态逻辑靠高阶组件（HOC）或渲染属性（render props）。两者都把复用塞进组件树结构，结果就是层层嵌套。

对比一段「窗口尺寸监听」逻辑的三种复用方式：

```tsx
// render props：逻辑塞在 prop 里，缩进一层
<WindowSize>{size => <MyComp size={size} />}</WindowSize>

// HOC：套一层函数，props 来源被遮蔽，调试难
withWindowSize(MyComp);

// 自定义 Hook：平铺，逻辑与结构分离
function MyComp() {
  const size = useWindowSize();
  return <div>{size.width}</div>;
}
```

Hook 的优势：

| 维度 | HOC | render props | 自定义 Hook |
|------|-----|--------------|-------------|
| 嵌套 | 层层套，包装地狱 | JSX 里缩进 | 平铺，无嵌套 |
| props 来源 | 被遮蔽，难追踪 | 显式但啰嗦 | 显式，一个函数调用 |
| 组合 | HOC 叠 HOC 冲突多 | 嵌套加加深 | 普通函数组合 |
| TS 类型 | 多套一层泛型难写 | 较直观 | 最直观 |

典型场景：`useFetch`（数据请求）、`useLocalStorage`（持久化）、`useDebounce`（防抖）、`useMediaQuery`（响应式）。凡是「一段带状态的逻辑要在多个组件复用」，就抽成 Hook。**自定义 Hook 是 React 复用有状态逻辑的唯一推荐抽象**——因为它不和组件树结构耦合，能像普通函数一样自由组合。

## 6.6 自定义 Hook 的设计原则

**1. 单一职责**。一个 Hook 干一件事。`useFetch` 就管请求，别顺手管防抖；`useDebounce` 就管防抖，别夹带请求逻辑。职责单一才能组合——`const data = useFetch(useDebounce(query))` 这种链式才可能。

**2. 返回值设计**。三种风格，按场景选：

```tsx
// 值：单一结果，简单
function useNow() { ...; return now; }

// 元组：返回多个值且位置固定，调用方按需解构
const [value, toggle, setValue] = useToggle(); // as const 保类型

// 对象：返回多个值且经常只取部分，或字段会扩展
const { data, loading, error, refetch } = useFetch(url);
```

经验：两个值且语义固定 → 元组；三个以上或常部分取用 → 对象。

**3. 依赖透传**。Hook 内部用到的外部值，做成参数透传，别闭包捕获。

```tsx
// ❌ 闭包锁住 query，外部变化不响应
function useFetchBad() {
  const data = useMemo(() => fetch(query), []); // query 被定格
}

// ✅ query 作参数 + 依赖
function useFetch(query: string) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(query).then(setData);
  }, [query]); // query 变就重取
  return { data };
}
```

**4. 可组合**。Hook 里能调 Hook——这是 Hooks 规则允许的，也是组合的基础。`useFetch` 内部可以调 `useState`、`useEffect`、`useCallback`，多个小 Hook 能拼成大 Hook：

```tsx
function useUserPosts(userId: string) {
  const user = useUser(userId);     // 调用自定义 Hook
  const posts = usePosts(userId);   // 再调一个
  return { user, posts };
}
```

**5. 副作用要暴露清理**。Hook 内部注册了订阅、定时器、监听器，**必须**通过 `useEffect` 的返回值提供清理函数，调用方无需关心。

```tsx
function useWindowSize() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const handler = () => setSize({ w: innerWidth, h: innerHeight });
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler); // ✅ 清理
  }, []);
  return size;
}
```

隐藏清理会让内存泄漏无处可查。这是自定义 Hook 的契约——内部副作用对调用方透明，但资源必须释放干净。

## 6.7 反模式

**1. 万物皆 useMemo**——6.2 已述。便宜计算裹 memo 净亏，还降低可读性。删掉比留着好。

**2. 记忆化原始值**。

```tsx
const count = useMemo(() => a + b, [a, b]); // ❌ a+b 是原始值，比较它比比较依赖还快
```

原始值（数字、字符串、布尔）本就是按值比较，根本不存在「引用不稳定」问题。memo 它们毫无意义。

**3. 不需要时包 React.memo**——6.4 已述。组件很轻或 props 频繁变化时，memo 不命中，白增比较开销。

**4. 自定义 Hook 塞副作用却不暴露清理**——6.6 已述。订阅、定时器泄漏是隐形 bug 源。

**5. 用自定义 Hook 跨组件共享状态实例**。Hook 复用**逻辑**，不复用**状态**。

```tsx
// ❌ 两个组件各自调 useCount，各有各的 count，不共享
function A() { const [c] = useCount(); }
function B() { const [c] = useCount(); } // B 的 c 和 A 无关
```

要跨组件共享同一份状态，得用 Context 或状态库（见第 7 篇），不是 Hook。Hook 只是「逻辑模板」，每次调用生成独立的状态插槽。

**6. 把派生数据塞进 useState 再 memo**。`const [total] = useState(items.length)` 本就错（派生值不该当状态）。正确写法是渲染时直接算 `const total = items.length`；若真昂贵，用 `useMemo(() => items.reduce(...), [items])` 缓存，而非状态化。

## 小结

记忆化是工具，不是默认配置。记住三条：

1. **记忆化收益 = 跳过的重计算成本 - 记忆成本**。便宜计算或下游不 memo，净亏。
2. **useCallback/useMemo 的真实价值是保持引用稳定**，让下游的 memo 和 Hook 依赖不失效。让组件「更快」只是顺带。
3. **React.memo 和 useCallback/useMemo 是组合拳，单边用无效**——props 引用不稳，memo 形同虚设。

性能优化的顺序永远是：**先测量（Profiler）再优化**。确认某处真的慢、真的在不必要地重渲染，才上记忆化。盲目包裹只会让代码更难读、bug 更难查，性能却没变。

自定义 Hook 是另一条线：React 复用有状态逻辑的唯一推荐抽象。单一职责、依赖透传、副作用清理干净，多个小 Hook 拼成大逻辑。它不共享状态实例，只共享逻辑——跨组件共享状态得靠 Context 或状态库。

掌握这两块，你的 React 代码就跨过了「能用」到「该用」的坎：知道哪里该 memo、哪里该抽 Hook，而不是照模板堆砌。下一篇进入状态管理，看 prop drilling 何时该停、Context 何时不够、什么时候上 Zustand/Redux。

## 下一步

> React 进阶系列 · 第 6 篇 / 共 8 篇

下一篇：[状态管理选型：从 useState 到 Zustand/Redux](./react-state-management) —— Context 陷阱、prop drilling、何时上状态库。

上一篇：[Hooks 心智模型（二）：副作用与 useEffect 的三个真相](./react-hooks-effects) —— 副作用、依赖数组、cleanup，以及那些让你抓狂的陷阱。

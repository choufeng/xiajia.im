# 性能优化与并发特性

> React 慢，往往不是 React 本身慢，而是「不该渲染的组件渲染了」「单次渲染干的事太多」。这一篇先把性能问题拆成可测量的两类，再交给你 React 18 用来对付「重渲染阻塞主线程」的新工具箱——并发特性。

---

## 目录

1. [引言：性能问题大多是「渲染太多」](#引言)
2. [优化前先测量](#_8-1-优化前先测量)
3. [减少不必要的渲染](#_8-2-减少不必要的渲染)
4. [key 与列表性能](#_8-3-key-与列表性能)
5. [React 18 并发特性是什么](#_8-4-react-18-并发特性是什么)
6. [useTransition / startTransition](#_8-5-usetransition--starttransition)
7. [useDeferredValue](#_8-6-usedeferredvalue)
8. [Suspense 与数据获取](#_8-7-suspense-与数据获取)
9. [StrictMode 是朋友不是敌人](#_8-8-strictmode-是朋友不是敌人)
10. [小结](#小结)
11. [下一步：系列总结](#下一步)

## 引言

先破除「React 性能差」的迷思。真实项目里的卡顿，几乎都归到两类：

1. **不该渲染的渲染了**——父组件 state 一变，一群与它无关的子组件跟着重渲染（这正是第 3 篇讲的「父渲染拖子」）。
2. **单次渲染太重**——几千行的列表、昂贵的同步计算、一次拉一大坨数据，把主线程占死，输入和动画就卡了。

第一类靠 `React.memo` + 组件拆分 + 状态下沉 + 合理 `key` 解决；第二类靠虚拟列表 + React 18 的并发特性解决。但所有这些，都得先回答一个问题：**到底哪里慢？** 不看证据的优化，全是猜。

## 8.1 优化前先测量

**唯一可信源是 React DevTools Profiler。** 它记录每一次 render 与 commit，给你火焰图、耗时、以及「这个组件为什么渲染了」的诱因链。

**为什么必须测量**：直觉常常骗你。看起来复杂的那个图表组件，可能只渲染 5ms；真正吃时间的是顶上那个被全树消费的 Context。对着猜的瓶颈下手，等于在没病的地方动刀。

**怎么做**：

1. 开 Profiler，点录制，做一次你觉得卡的真实操作（输入、滚动、点筛选）。
2. 火焰图里找**最宽的色块**——宽度就是这次 render 的耗时。
3. 点开看它的「Why did this render?」：props 变了？父渲染带上的？Context 值变了？这直接对应第 3 篇那三条触发条件。
4. 优先修宽色块，别在窄色块上浪费功夫。

| 判断 | 行动 |
|------|------|
| 色块窄但数量爆炸 | 减少渲染次数（memo / 状态下沉） |
| 色块少但单个极宽 | 减轻单次渲染（虚拟列表 / 并发 / 拆计算） |

**坑**：开发构建的 Profiler 有自身开销，绝对耗时偏高，只看相对比例。要测真实性能，用生产 profiling 构建。

## 8.2 减少不必要的渲染

**是什么**：让「props 没变就跳过子组件渲染」成为可能。核心手段三个——`React.memo`、拆分粒度、状态下沉。

**`React.memo`**（呼应第 6 篇）：包住组件，父渲染时对 props 做浅比较，全等则整个子树跳过。

```tsx
const ExpensiveItem = React.memo(function Item({ data }: { data: Item }) {
  return <div>{data.name}</div>;
});
```

**坑**：memo 只挡「props 浅比较没变」。若你每次渲染都传一个**新建的对象/函数**给子组件（如 `onClick={() => ...}` 或 `style={{ color: 'red' }}`），引用每次都变，memo 直接失效。要让 memo 真正生效，往往得配合 `useCallback`/`useMemo` 稳住那些引用。**先测量再上 memo**——它有比较成本，无脑加反而拖慢。

**拆分粒度**：把「频繁变化的部分」和「稳定部分」拆成不同组件。一个会动的数字别把整张静态表都拖着重渲染。

**状态下沉（state colocation）**——最被低估的手段。第 7 篇讲过「别全堆顶」，这里换个角度：**把 state 放到真正需要它的那个叶子组件里，别放在共同祖先。**

```tsx
// ❌ 顶上放搜索词：输入一字，整个 Dashboard 都重渲染
function Dashboard() {
  const [q, setQ] = useState('');
  return (
    <>
      <SearchBar value={q} onChange={setQ} />
      <BigTable query={q} />
      <SidePanel /> {/* 跟搜索无关，却被迫重渲染 */}
    </>
  );
}

// ✅ 把搜索状态下沉到「搜索框 + 结果」这对组合里
function Dashboard() {
  return (
    <>
      <SearchSection />
      <SidePanel /> {/* 现在彻底不受搜索影响 */}
    </>
  );
}
function SearchSection() {
  const [q, setQ] = useState('');
  return <><SearchBar value={q} onChange={setQ} /><Results query={q} /></>;
}
```

状态下沉的收益常比 memo 大得多——它从根上掐断了「无关组件被拖累」，而不是事后补救。

## 8.3 key 与列表性能

**稳定 key**（详见第 3 篇）：列表项身份靠 key 识别。用稳定的业务 id，绝不用 `index`，更不用 `Math.random()`。错 key 既是 bug 源（输入错位），也制造无谓的销毁重建，拖垮性能。

**万级数据上虚拟列表**。原生 `<div>` 渲染一万个节点，光建 DOM 就能让主线程冻结。虚拟列表的思路：**只渲染可视区那几十行**，滚动时复用 DOM 节点、动态换内容。

```
全部 10000 条
├── 只挂载可视区 ~20 行的 DOM
├── 上下各预留几行缓冲
└── 其余用占位高度撑出滚动条
```

主流库：`react-window`（轻量、API 稳定）、`@tanstack/react-virtual`（更灵活、支持动态高度）。

```tsx
import { FixedSizeList } from 'react-window';

function BigList({ items }: { items: Item[] }) {
  return (
    <FixedSizeList height={600} itemCount={items.length} itemSize={40} width="100%">
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </FixedSizeList>
  );
}
```

**坑**：虚拟列表的行高必须能事先算出（固定高度用 `FixedSizeList`，动态高度用 `VariableSizeList` 或 react-virtual 的 measure）。行高拿不准，滚动会跳。它也让 `position: sticky`、内嵌表单焦点等变复杂——是「以复杂度换性能」的取舍。

## 8.4 React 18 并发特性是什么

前面解决的是「渲染太多」。但有些渲染**单次就很重**，又没法省——比如搜索时实时过滤上万条数据。React 17 之前，渲染一旦开始就**同步走完**，期间主线程被占死，用户的输入、动画一帧都挤不进来，于是出现「打字卡顿」。

React 18 的并发特性（Concurrent Features）改变了这点：

- **渲染可中断**——render 阶段算到一半，若有更高优先级的更新到来（比如输入框值），React 可以暂停当前渲染。
- **可重试**——被中断的渲染不会丢，稍后用最新数据重新开始。
- **可优先级排序**——用户输入 = 高优先级；由它派生的重活 = 低优先级 transition。

```
用户输入 'r' (高优先级) ─┐
正在做的过滤渲染 (低)  ─┤── 被 'r' 打断
                       ▼
          立即提交输入(输入框有响应)
                       │
                       ▼ 用 'r' 后的最新值重新开始过滤
```

**关键认知**：并发不是「让渲染变快」，而是「让重活不再阻塞响应」。它买的是**响应性**，不是吞吐量。没有「重渲染阻塞主线程」这个问题，你根本不需要它。

## 8.5 useTransition / startTransition

**是什么**：`useTransition` 返回 `[isPending, startTransition]`。把你**自己触发的昂贵 setState** 包进 `startTransition`，这次更新就被标记成低优先级、可中断的 transition。

**为什么**：经典的「边输边筛」场景。输入值要立刻响应（否则打字卡），但过滤结果可以慢半拍。把「过滤结果」的更新标成 transition，输入就能抢占它。

```tsx
function Search() {
  const [q, setQ] = useState('');              // 高优先级：输入框立即响应
  const [results, setResults] = useState([]);  // 低优先级：结果可延迟
  const [isPending, startTransition] = useTransition();

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQ(v);                                   // 立即更新
    startTransition(() => {
      setResults(expensiveFilter(v));          // 这个 setState 被标记为可中断
    });
  };

  return (
    <>
      <input value={q} onChange={onChange} />
      {isPending && <span>筛选中…</span>}
      <ResultList items={results} />
    </>
  );
}
```

`isPending` 让你能显示加载态——transition 进行中但 UI 已切换的感觉，体验比纯卡顿好得多。

**坑**：

- `startTransition` 包的是**触发 setState 的同步代码**，不是 Promise 的 `.then`。它是告诉 React「这次 state 更新降级」，不是异步等待。
- transition 更新仍可能被中断重试，所以过渡里渲染的组件**仍必须纯**（第 3 篇的死规矩）。
- 别把什么都塞进 transition：只有「能接受延迟、且确实阻塞了输入」的重更新才值得。滥用只会无谓增加重试开销。

## 8.6 useDeferredValue

**是什么**：`useDeferredValue(value)` 返回这个值的一个**延迟版本**。当真实值快速变化时，延迟值会「按节奏」跟随，让读它的重渲染自然降级。

**什么时候用 useDeferredValue 而非 useTransition**：取决于**你握不握着那个 setter**。

| | 你拥有触发更新的 setter | 你只收到一个值（来自 props / Context / 第三方库） |
|------|------|------|
| 用 | `useTransition` + `startTransition` | `useDeferredValue` |

```tsx
function ResultList({ query }: { query: string }) {
  // query 来自父组件，这里改不了它。用 deferredValue 降级重渲染。
  const deferredQuery = useDeferredValue(query);
  const heavy = useMemo(() => filterHuge(deferredQuery), [deferredQuery]);
  return <ul>{heavy.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

父组件照常快速更新 `query`（输入框跟手），而昂贵的 `ResultList` 拿到的是延迟值，自降为 transition，不打断输入。两者底层是同一套并发机制，只是入口不同。

## 8.7 Suspense 与数据获取

**是什么**：`<Suspense fallback={...}>` 包住一个会「挂起」的子组件。子组件在数据没好时 throw 一个 promise，Suspense 接住，先渲染 `fallback`；promise resolve 后，React 自动重渲染，填回真正内容。

```tsx
<Suspense fallback={<Spinner />}>
  <UserProfile id={id} />  {/* 内部用 React Query 的 suspense 模式取数 */}
</Suspense>
```

**怎么配合数据层**：直接手写「throw promise」很繁琐，实际多交给数据库。**React Query** 开启 `suspense: true`，或 Next.js 的服务端取数，都能让组件「以同步代码的风格写、异步等待交给 Suspense」。

```tsx
// React Query + Suspense：useSuspenseQuery 取不到数据时自动挂起
function UserProfile({ id }: { id: string }) {
  const { data } = useSuspenseQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
  });
  return <div>{data.name}</div>;  // 到这里 data 一定已就绪
}
```

**Suspense 的真正威力是嵌套**。多个 Suspense 边界可分层，里层组件各自等待，外层不必等全部完成。这催生了**流式 SSR**：服务端用 `renderToReadableStream`（取代 React 17 的 `renderToString`）边算边把已就绪的 HTML 发给浏览器，未就绪的部分先用 fallback 占位、数据到位再通过同一个流「补」下去。用户看到首屏的时间，由「等所有数据」缩短为「等关键路径」。

**坑**：Suspense 边界的粒度要权衡——太粗（套整个页面）等于回到「等全部」；太细则 fallback 闪烁。常见做法：路由级 + 列表/详情级分层。另外，Suspense 下的组件一旦挂起，其父组件那次渲染会被丢弃重来，所以**别在挂起路径上做不可逆副作用**。

## 8.8 StrictMode 是朋友不是敌人

`<StrictMode>` 在**开发模式**下故意把每个组件的 render、每个 effect 的 setup+cleanup **各调用两次**。这吓退了不少人，以为代码出 bug 了。

**为什么这么做**：它是「副作用探测器」。render 被双调用 → 若你的渲染不纯（改全局、发请求、碰 DOM），立即现形；effect 的 setup 跑两遍再 cleanup 两遍 → 若你忘了写 cleanup（没取消订阅、没清定时器），第二次就会暴露残留。

```tsx
useEffect(() => {
  const t = setInterval(tick, 1000);
  return () => clearInterval(t);  // 有 cleanup，双调用也安全
}, []);
```

**生产构建完全没有双调用**，零开销。所以：**别关 StrictMode，去修它暴露出来的副作用。** 那些副作用在并发模式下本就会因「render 可中断重试」而重复执行——StrictMode 只是提前在开发期帮你抓出来。

## 小结

- **先测量再优化**：React DevTools Profiler 是唯一可信源，找最宽色块，看「为什么渲染」。
- **减少渲染**：`React.memo`（props 没变跳过）+ 状态下沉（把 state 放到需要的叶子，别堆顶）+ 拆分粒度。状态下沉收益常大过 memo。
- **列表性能**：稳定 key（业务 id）打底；万级数据上虚拟列表，只渲染可视区。
- **React 18 并发**：渲染可中断、可重试、可优先级排序。它买的是**响应性**——让重更新不阻塞输入。
- **useTransition / startTransition**：你握着 setter 时，把昂贵更新标记为可中断 transition。
- **useDeferredValue**：你只收到一个值（props/Context）时，延迟它的传播。
- **Suspense**：声明「等数据时显示 fallback」，配合 React Query；支持嵌套与流式 SSR。
- **StrictMode**：开发期双调用，专抓不纯渲染和漏写的 cleanup，生产无影响——别关它。

性能优化没有银弹，只有「测量 → 定位 → 用对工具 → 再测量」的工程循环。

## 下一步

走到这里，八篇 React 进阶之旅画上句号。回顾这条脉络：

| 篇 | 主题 | 一句话内核 |
|----|------|-----------|
| 1 | 设计哲学 | 声明式 + 状态驱动，React 的世界观 |
| 2 | JSX | JSX 编译成元素树，元素是不可变对象 |
| 3 | 渲染与 Reconciliation | render（纯、可中断）/ commit 两阶段，diff 三假设，key 即身份 |
| 4 | useState / useReducer | 状态更新的排队与批处理，reducer 收敛复杂逻辑 |
| 5 | useEffect | 副作用边界，依赖数组，cleanup 是必须 |
| 6 | 记忆化与自定义 Hooks | useMemo/useCallback 的「何时不该用」比何时用更重要 |
| 7 | 状态管理 | Context 陷阱、prop drilling、何时上 Zustand/Redux |
| 8 | 性能与并发 | 先测量；减少渲染；并发特性对付「重渲染阻塞主线程」 |

这条线的底层始终是第 1 篇那句话：**组件是 `(props, state) => UI` 的纯函数**。渲染机制（3）是地基，Hooks（4-6）是肌肉，状态管理（7）和性能（8）是把它用到生产级的工程化。抓住纯函数这根主线，所有 API 都只是它的推论。

**后续路径**：

1. **读源码**：从 [React 仓库](https://github.com/facebook/react) 的 `packages/react-reconciner` 进去，对照第 3 篇的 render/commit 两阶段看调度器怎么中断与恢复——这是把并发特性从「会用」变「真懂」的关键一步。
2. **做项目**：挑一个有真实数据量和交互复杂度的场景（看板、表格筛选、聊天流），把第 8 篇的 Profiler → memo → 虚拟列表 → useTransition 完整走一遍。纸上谈兵学不会性能优化。
3. **跟生态**：React Server Components（RSC）正在重塑「组件在哪渲染」的边界，Next.js App Router 是当前最完整的落地。读懂 RSC 需要你把本系列的「元素是对象」「render/commit」「Suspense」都吃透——你现在已经具备了。
4. **贡献回去**：给 React、Zustand、React Query、TanStack Virtual 提 issue 与 PR，是检验「真懂」的试金石。

React 不会停在 18。但「声明式、状态驱动、纯函数渲染」这套内核十几年没变，未来也不会轻易变。你掌握的不是某版 API 的用法，而是这套推理系统——这才是进阶的意义。

> 本文是 React 进阶系列**第 8 篇 / 共 8 篇·系列终篇**。← 上一篇：[状态管理选型：从 useState 到 Zustand/Redux](./react-state-management) ｜ 系列起点：[总纲](./react-series) → [第 1 篇：设计哲学](./react-philosophy)

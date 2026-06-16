# 状态管理选型：从 useState 到 Zustand/Redux

> 状态管理没有银弹。把所有状态塞进 Redux 是新手病；把所有状态 prop drill 到底是另一种。本篇不讲哪个库最好，而是给你一把尺子：按状态的**归属**（谁的状态）与**消费范围**（谁要读它）来选型。局部状态 `useState`、跨多层共享用 `Context`、高频全局更新用 Zustand/Jotai、大型团队求规范用 Redux Toolkit。

---

## 目录

1. [引言](#引言)
2. [7.1 状态的分类](#71-状态的分类)
3. [7.2 useState/props：默认选择](#72-usestateprops默认选择)
4. [7.3 Context 的真相](#73-context-的真相)
5. [7.4 何时上状态库](#74-何时上状态库)
6. [7.5 Zustand：轻量 hooks 风格](#75-zustand轻量-hooks-风格)
7. [7.6 Redux Toolkit：重但规范](#76-redux-toolkit重但规范)
8. [7.7 Jotai：原子化细粒度](#77-jotai原子化细粒度)
9. [7.8 服务端状态 ≠ 客户端状态](#78-服务端状态--客户端状态)
10. [7.9 选型矩阵](#79-选型矩阵)
11. [小结](#小结)
12. [下一步](#下一步)

## 引言

状态管理教程最容易写成一个「库的安装指南」。但真正的难点从来不是「怎么用 Zustand」，而是「**这份数据，该放哪**」。新手常见两个极端：

- **重度患者**：学了 Redux，什么都往里塞。表单输入、本地开关、临时 loading 全进全局 store，store 变成杂物间，组件为了一个按钮状态要连四层 reducer。
- **轻度患者**：信奉「少即是多」，全部 `useState`，然后 prop drill——状态从顶层组件一层层传到叶子，中间五个组件只做搬运工，改一个字段要动五处文件。

两个极端同病：**没想清楚状态归谁、谁要用**。本篇的思路是先分类，再按类别选工具。先记住一张心智图：

```
状态按「归属 + 消费范围」四象限分类：

              消费范围窄                  消费范围宽
           ┌─────────────────────┬──────────────────────┐
  更新低频  │ 局部状态 useState    │ 共享状态 Context      │
           │ (输入框、开关)        │ (主题、语言、当前用户) │
           ├─────────────────────┼──────────────────────┤
  更新高频  │ 局部状态 useState    │ 全局状态 Zustand/Jotai│
           │ (拖拽、动画)          │ (购物车、实时计数)     │
           └─────────────────────┴──────────────────────┘

  服务端状态另算 → React Query / SWR（不在 store 里）
```

下面逐层拆开。

## 7.1 状态的分类

**是什么**：动手选型前，先把状态按「数据来源 + 谁消费」分三类。

1. **局部状态**——只在一个组件内有意义，离开就失效。表单输入值、下拉开关、tab 选中、拖拽中间态。
2. **共享状态**——多个组件都要读，且跨了多层。当前登录用户、主题、语言、购物车。
3. **服务端状态**——从后端拉来的数据，带缓存语义。用户列表、订单详情、配置。

**为什么重要**：这三类的最优解**不一样**。把它们混在一起塞进同一个 store，是大多数「状态管理灾难」的源头。

| 状态类型 | 特征 | 典型 | 默认解法 |
|----------|------|------|----------|
| 局部 | 单组件、随组件销毁 | 输入框值 | `useState` / `useReducer` |
| 共享 | 跨多层、低频变 | 主题、用户 | `Context` |
| 全局高频 | 跨多层、高频变 | 购物车、实时计数 | Zustand / Jotai |
| 服务端 | 来自 API、需缓存 | 列表、详情 | React Query / SWR |

**怎么做**：拿到一个状态，先问三个问题：

1. 它是哪个组件的？（归属）→ 能放局部就放局部。
2. 还有谁要读它？（消费范围）→ 只有自己 → `useState`；跨多层 → 往下看。
3. 它来自服务器吗？（来源）→ 是 → 服务端状态方案，别手动塞 store。

**坑**：把「服务端状态」当「客户端状态」管。从 API 拿到用户列表，存进 Redux，再手动写 loading/error/reload 逻辑——这是上一代 Redux 应用的通病。正确做法见 7.8。

## 7.2 useState/props：默认选择

**是什么**：能用 `useState` / `useReducer` 解决的，**别上库**。状态需要从父传子，就用 props 传。

**为什么**：库是**有成本**的——多一个依赖、多一套心智、多一层调试。Context 和状态库都该是「被 prop drilling 逼出来的」，不是开局就装。

**prop drilling**：属性从顶层组件逐层透传到目标组件，中间组件只是搬运。

```tsx
// 顶层有 user，三层下面的 Header 要用，中间 Layout 只是搬运
function App() {
  const [user, setUser] = useState<User | null>(null);
  return <Layout user={user} setUser={setUser} />;
}

function Layout({ user, setUser }: Props) {
  // Layout 自己不用 user，只是传下去
  return <Sidebar user={user} setUser={setUser} />;
}

function Sidebar({ user, setUser }: Props) {
  return <Header user={user} setUser={setUser} />; // 终于到消费者
}
```

**什么时候 prop drilling 可接受**：透传**不超过 3 层**、中间组件本来就要处理这些 props。这时候上 Context 反而是过度设计。

**什么时候该停止 prop drilling**：

- 透传超过 3 层，且中间组件**完全用不到**这些值。
- 同一个状态被 5+ 组件消费，props 接口越加越长。
- 改一个字段要动 4 个文件的接口签名。

达到这些信号，再看 Context。

**坑**：为了「避免 prop drilling」滥用 Context，结果把高频变化的局部状态塞进全局，引发全局重渲染（7.3）。

## 7.3 Context 的真相

**是什么**：`Context` 让你跳过中间组件，直接把值传给任意后代消费者（`useContext`）。它解决 prop drilling，**不是状态管理库**——它只是个「依赖注入」。

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Layout />
    </ThemeContext.Provider>
  );
}

function Button() {
  const theme = useContext(ThemeContext); // 跳过 Layout，直接拿
  return <button className={theme}>click</button>;
}
```

**为什么重要——核心陷阱**：Context 的值变化，会让**所有消费它的组件重渲染**，没有精细订阅。

```tsx
// ❌ 致命模式：把高频变化状态塞进 Context
const AppContext = createContext<{ user: User; cart: CartItem[]; tick: number }>(
  { user: {} as User, cart: [], tick: 0 }
);

function UserName() {
  const { user } = useContext(AppContext); // 只要 tick 变，这里也重渲染
  return <span>{user.name}</span>;
}
```

只要 `AppContext` 的 `value` 对象引用变（哪怕只是 `tick` 变），所有 `useContext(AppContext)` 的组件**全部重渲染**——哪怕它们只用 `user`。Context 没有 selector，无法只订阅切片。

**怎么做——Context 适合放什么**：**低频变化的全局数据**。

| 适合 Context | 不适合 Context |
|--------------|----------------|
| 主题、暗色模式 | 购物车（频繁加删） |
| 当前语言/i18n | 实时计数器（每秒变） |
| 当前登录用户 | 表单输入值 |
| 路由信息 | 动画/拖拽状态 |
| Feature flags | 大量组件订阅不同切片 |

**坑**：

1. **`value` 每次都是新对象** → 所有消费者每次 Provider 渲染都重渲染。解药：用 `useMemo` 包 value，或拆成多个 Context。
2. **用它装高频状态** → 性能崩。改用 Zustand/Jotai。

**怎么缓解**：把一个大 Context 按变化频率拆成多个小 Context（user 一个、theme 一个），或对 Provider 的 `value` 用 `useMemo` 稳定引用。但这些都是补丁——若状态本来就高频，根因解法是换状态库。

**口诀**：Context 是「**广播**」，状态库是「**订阅**」。广播给所有人听，订阅只给关心的人发。

## 7.4 何时上状态库

满足下面**任意一条**，就该考虑上状态库（Zustand/Jotai/Redux）：

1. **高频更新**——状态每秒/每帧变化（实时计数、拖拽、动画），Context 的全局重渲染扛不住。
2. **多组件订阅同一状态的不同切片**——10 个组件读同一个 store，但各读各的字段，改 A 字段不该让读 B 字段的组件重渲染。
3. **需要中间件**——持久化（localStorage）、devtools 时间旅行、异步 action。
4. **状态需要在组件树外访问**——比如在工具函数、路由守卫里读写状态。

状态库的**共同杀手锏**是 **selector + 精细订阅**：组件只订阅自己关心的切片，store 里别的部分变了，它不重渲染。这是 Context 做不到的。

**反过来的坑**：也别为了「显得专业」而过早引入状态库。一个只有三屏的小应用，硬上 Redux，等于给自己发配样板代码苦役。状态库是**被复杂度逼出来的**，不是开局就装的标配。判断标准简单粗暴：当你用 `useState` + props 已经写得难受、Context 又把渲染拖慢，这时上库就是顺理成章。

下面三个主流方案，按「轻 → 重」排：

## 7.5 Zustand：轻量 hooks 风格

**是什么**：Zustand（德语「状态」）是最轻量的状态库。一个 store 是个普通函数，组件用 hook 订阅，**selector 精细订阅**避免无谓重渲染。

**为什么**：API 极简，没有 Provider 包裹、没有 reducer 样板、没有 action type 字符串。store 在组件树外，单文件定义。

**怎么做**：

```tsx
import { create } from 'zustand';

interface BearStore {
  bears: number;
  addBear: () => void;
  reset: () => void;
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  addBear: () => set((s) => ({ bears: s.bears + 1 })),
  reset: () => set({ bears: 0 }),
}));

// 组件订阅：用 selector 只拿需要的切片
function BearCounter() {
  const bears = useBearStore((s) => s.bears); // 只订 bears
  return <h1>{bears} 只熊</h1>;
}

function Controls() {
  const addBear = useBearStore((s) => s.addBear); // 只订 action
  return <button onClick={addBear}>加一只</button>;
}
```

`bears` 变化时，`BearCounter` 重渲染，但 `Controls` 不会——它订阅的是 `addBear`（函数引用稳定）。这就是精细订阅。

**selector 选对象的坑**：

```tsx
// ❌ 每次返回新对象引用 → 永远不相等 → 每次都重渲染
const { bears, bees } = useBearStore((s) => ({ bears: s.bears, bees: s.bees }));

// ✅ 用 shallow 比较或各自单独订阅
import { shallow } from 'zustand/shallow';
const { bears, bees } = useBearStore(
  (s) => ({ bears: s.bears, bees: s.bees }),
  shallow
);
```

**何时选 Zustand**：中小项目、想要「Context 的简单 + 状态库的精细订阅」、不喜欢 Redux 的样板。**默认推荐**。

## 7.6 Redux Toolkit：重但规范

**是什么**：Redux Toolkit（RTK）是 Redux 官方推荐的写法，用 `createSlice` 干掉了旧 Redux 的 action type / reducer 样板。单 store，所有状态集中，变更走不可变 reducer。

**为什么**：Redux 重——概念多（store/reducer/dispatch/selector/middleware）、样板多。但它的**规范性强**：强约束、单一数据源、时间旅行 devtools 强大、生态成熟。大团队、多人协作、需要严格可预测性时，这种「重」反而是资产。

**怎么做**：

```tsx
import { createSlice, configureStore } from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';

const counterSlice = createSlice({
  name: 'counter',
  initialState: { value: 0 },
  reducers: {
    // RTK 用 Immer，可以直接「写」不可变更新
    increment: (state) => { state.value += 1; },
    add: (state, action: PayloadAction<number>) => { state.value += action.payload; },
  },
});

const store = configureStore({
  reducer: { counter: counterSlice.reducer },
});

function Counter() {
  const value = useSelector((s: RootState) => s.counter.value);
  const dispatch = useDispatch();
  return <button onClick={() => dispatch(counterSlice.actions.increment())}>{value}</button>;
}
```

**何时选 RTK**：

- 团队大、人杂，需要**统一规范**和强约束（Redux 的规则能挡住乱写）。
- 复杂的**服务端状态**——这时直接用 **RTK Query**（RTK 自带的数据获取层），别手写。
- 团队已有 Redux 沉淀，迁移成本 > 收益。

**坑**：新项目无脑上 Redux。现代中小项目，Redux 的样板和心智成本往往不划算——Zustand 够用。Redux 是「**规范换复杂度**」的交易，只在规范价值大于复杂度成本时成交。

## 7.7 Jotai：原子化细粒度

**是什么**：Jotai 走**原子化（atomic）**路线——状态拆成最小粒度的 atom，组件订阅 atom，atom 变化只通知订阅者。和 Redux「单 store」相反，Jotai 是「无数个 atom」。

**怎么做**：

```tsx
import { atom, useAtom } from 'jotai';

const priceAtom = atom(100);
const qtyAtom = atom(2);
// 派生 atom：依赖其他 atom，自动更新
const totalAtom = atom((get) => get(priceAtom) * get(qtyAtom));

function Total() {
  const [total] = useAtom(totalAtom);
  return <span>合计 {total}</span>;
}
```

**Jotai vs Zustand（selector 模式）**：

| 维度 | Zustand | Jotai |
|------|---------|-------|
| 心智 | 单 store + selector | 无数 atom |
| 派生状态 | selector 函数 | derived atom（一等公民） |
| 订阅粒度 | selector 返回值 | atom 本身 |
| 适合 | 集中管理的业务状态 | 细粒度、依赖关系复杂的状态 |

**何时选 Jotai**：状态天然是**细粒度且互相依赖**的（表单字段联动、表格单元格、图编辑器节点）。atom 组合派生比 selector 写起来更顺。状态相对独立、想集中管，用 Zustand。

## 7.8 服务端状态 ≠ 客户端状态

**是什么**：从 API 来的数据是**服务端状态**，它和本地 `useState` 的客户端状态本质不同，不该塞进 Redux/Zustand 手动管。

**为什么重要**：服务端状态自带一堆客户端状态没有的语义——缓存、失效、重新获取、乐观更新、后台刷新、分页、去重、loading/error。手写这些是地狱，而 React Query / SWR 专门干这个。

```
客户端状态：你拥有它、你改它、它在内存里。  → useState / Zustand
服务端状态：服务器拥有它、你只是缓存它。    → React Query / SWR
```

**怎么做**：

```tsx
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
  });
  if (isLoading) return <p>加载中…</p>;
  if (error) return <p>出错</p>;
  return <ul>{data.map((u: User) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

React Query 自动处理缓存、去重、重试、失效（mutation 后 `invalidateQueries` 刷新）。你**不需要**把 `users` 存进 Redux 再手写 `fetchUsersRequest/Success/Failure` 三个 action——那是 2018 年的写法。

**坑**：

1. **把 API 数据塞进 Zustand 手动同步**——loading/error/缓存全手写，最后重写一个残缺的 React Query。能免则免。
2. **混合存放**——客户端 UI 状态放 Zustand，服务端数据放 React Query，各司其职，别混。

## 7.9 选型矩阵

按场景查表：

| 场景 | 推荐方案 | 理由 |
|------|----------|------|
| 单组件内的输入框、开关 | `useState` | 局部，最简 |
| 父子两三层传值 | props | 别上库 |
| 全局主题、语言、当前用户 | `Context` | 低频、广播即可 |
| 购物车、实时计数、高频全局 | **Zustand** | selector 精细订阅 |
| 大团队、强规范、复杂业务 | **Redux Toolkit** | 规范换复杂度 |
| 细粒度、强依赖派生状态 | **Jotai** | atom 组合 |
| API 数据、缓存、分页 | **React Query / SWR** | 服务端状态专用 |
| 表单状态（多字段联动） | React Hook Form / Jotai | 别用 useState 堆 |
| URL 可分享的状态 | 路由 query / searchParams | URL 即状态 |

**决策流**：

```
拿到一个状态
   │
   ├─ 来自服务器？ ──是──→ React Query / SWR（别塞 store）
   │
   ├─ 只一个组件用？──是──→ useState
   │
   ├─ 跨层共享 + 低频？──是──→ Context
   │
   ├─ 跨层共享 + 高频？──是──→ Zustand（默认）/ Jotai（细粒度）
   │
   └─ 大团队要规范？ ──是──→ Redux Toolkit
```

## 小结

状态管理没有银弹，但有方法。核心是**按归属和消费范围选型**：

1. **先分类**——局部、共享、服务端三类，别混。服务端状态用 React Query，根本不该进 store。
2. **默认 useState**——能用局部状态解决就别上库，prop drilling 3 层内可接受。
3. **Context 是广播不是订阅**——适合低频全局（主题、用户），高频变化塞进去必崩。
4. **状态库的杀手锏是 selector 精细订阅**——Zustand 轻、Jotai 细、Redux 重但规范。

一句话决策：**局部用 useState，共享低频用 Context，共享高频用 Zustand，大团队用 Redux Toolkit，服务端数据用 React Query**。别为了用库而用库，也别为了显得克制而 prop drill 到死。工具服务于问题，不是问题迁就工具。

## 下一步

> React 进阶系列 · 第 7 篇 / 共 8 篇

下一篇：[性能优化与并发特性](./react-performance-concurrent) —— memo、虚拟列表、React 18 并发渲染、Suspense、startTransition，把 React 用到生产级。

上一篇：[Hooks 心智模型（三）：记忆化与自定义 Hooks](./react-memoization) —— useMemo/useCallback 该不该用、何时是过度优化、自定义 Hook 的抽象边界。

# Hooks 心智模型（二）：副作用与 useEffect 的三个真相

> useEffect 是 React 里最被误用的 Hook，没有之一。面试官爱问它（因为它坑多，能筛人），生产事故里也常见它的身影（内存泄漏、死循环、竞态覆盖）。绝大多数误解的根源只有一个：把 Class 时代的生命周期思维硬套在它身上。抓住三个真相——它不是生命周期、依赖数组是契约不是建议、cleanup 与 effect 是一对——就能避过 90% 的坑。

---

## 目录

1. [引言](#引言)
2. [5.1 真相一：useEffect 不是生命周期](#51-真相一useeffect-不是生命周期)
3. [5.2 真相二：依赖数组是契约](#52-真相二依赖数组是契约)
4. [5.3 真相三：cleanup 与 effect 是一对](#53-真相三cleanup-与-effect-是一对)
5. [5.4 三个高频陷阱](#54-三个高频陷阱)
6. [5.5 useEffect vs useLayoutEffect](#55-useeffect-vs-uselayouteffect)
7. [5.6 何时不用 useEffect](#56-何时不用-useeffect)
8. [小结](#小结)
9. [下一步](#下一步)

## 引言

上一篇讲完 useState/useReducer，你能让组件记住状态了。但真实组件不可能只算 UI——它要发请求、订阅事件、操作 DOM、读写定时器。这些动作有一个共同点：**它们属于外部世界，会或早或晚地影响渲染之外的东西**。React 把这类动作统称「副作用（side effect）」。

问题来了：函数组件的渲染本身应该是纯的——给相同 props/state，返回相同 UI。你在渲染函数体里直接发请求？那每次渲染都发一次，且渲染可能被中断重来（React 18 并发模式），副作用重复执行、顺序混乱。React 的解法是 `useEffect`：把副作用关进一个笼子，**在渲染安全地提交到 DOM 之后**再跑。

但 useEffect 的 API 极简——一个回调、一个依赖数组、一个返回的清理函数——简到让人以为它就是 `componentDidMount + componentDidUpdate + componentWillUnmount` 的合体。这正是所有误解的起点。下面用三个真相，把它从「生命周期钩子」纠正回它本来的样子。

## 5.1 真相一：useEffect 不是生命周期

**是什么**：useEffect 表达的是「**同步副作用与当前的 React 状态**」，不是「组件挂载后」「更新后」「卸载前」这些时间点。

**为什么**：Class 时代，React 给你三个分散的生命周期——`componentDidMount`（挂载后跑一次）、`componentDidUpdate`（每次更新后跑）、`componentWillUnmount`（卸载前跑）。它们逼你把逻辑拆成三份，还要手动在 `DidUpdate` 里对比 `prevProps` 与 `this.props` 判断「这次到底该不该重跑」。

useEffect 推翻这套心智。它只有一句话：**「每当渲染结果被提交到 DOM 之后，把外部世界与这次渲染所用的 props/state 重新对齐。」** 挂载、更新对它没有本质区别——都是「又一次渲染被提交了」。

```
渲染流程:
  render(纯函数) → commit(DOM 已变更) → effect(同步外部世界)
                                          ↑
                              这里才是 useEffect 跑的时机
```

**心智转变**：不要再问「这段代码该放 `componentDidMount` 还是 `componentDidUpdate`？」，而要问「**这个副作用依赖哪些数据？数据变了就该重新同步。**」一次订阅、一次请求、一次定时器——本质上都是「让外部世界与某份 props/state 保持一致」。

**为什么叫 effect**：函数式里，effect 指「纯函数计算返回值之外、对世界的额外影响」。React 希望组件 `(props, state) => UI` 是可预测的纯映射，所以把所有 effect 集中到 `useEffect` 里，与渲染本体隔离。这与站内[函数式思维](./functional-thinking)的主张一致：纯的核心，副作用推到边界。

**怎么做**：把 effect 当成「一份针对当前 props/state 的同步指令」，而不是「某个时间点的回调」。下面的代码，无论首次挂载还是 `userId` 变化后更新，行为完全一致——都是「用当前 userId 去拉用户数据」：

```tsx
function UserCard({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]); // userId 变了就重新同步

  return <div>{user?.name ?? '加载中'}</div>;
}
```

你不必写「挂载时拉一次、userId 变了再拉一次」两套逻辑——一份 effect 配正确的依赖，覆盖全部情况。这就是「不是生命周期」的实战含义。

**为什么必须在 commit 之后跑**：React 18 的并发渲染允许一次渲染被打断、丢弃重来（响应更高优先级的更新）。如果副作用在 render 函数体里执行，被打断的渲染已经「污染」了世界（请求发出、订阅建立），却不会有对应的渲染结果。把 effect 推迟到 commit 之后——此时 DOM 已确定落地——才能保证「每跑一次 effect，都对应一次真实生效的渲染」。这也是为什么 effect 永远不该写在渲染函数体里。

## 5.2 真相二：依赖数组是契约

**是什么**：useEffect 的第二个参数（依赖数组）不是性能优化，而是**一份契约**——你向 React 声明「这个 effect 依赖了哪些值」。

**三种形态**：

| 写法 | 含义 | 何时跑 |
|------|------|--------|
| 省略数组 | 毡子式同步 | 每次渲染提交后都跑 |
| 空数组 `[]` | 仅与首次渲染同步 | 仅 mount 跑一次 |
| `[a, b]` | 与 a、b 同步 | mount 一次 + a/b 变化时 |

**为什么是契约而非建议**：很多人把依赖数组当「调优开关」——「我只想要 mount 时跑，所以写 `[]`」。但如果你 effect 里用了 `userId` 却写 `[]`，你就在**对 React 撒谎**：你声称「这个 effect 不依赖任何东西」，实际上它读了 `userId`。

撒谎的代价是 **stale closure（过时闭包）**——effect 里捕获的是首次渲染的 `userId`，之后 `userId` 怎么变，effect 都不会重跑，你永远拿到旧值。

```tsx
function Bad({ userId }: { userId: number }) {
  const [data, setData] = useState<string>('');

  useEffect(() => {
    // ❌ 谎报依赖：声明 []，却用了 userId
    fetchData(userId).then(setData);
  }, []); // userId 变了也不重跑 → data 永远是首次的 userId 数据

  return <div>{data}</div>;
}
```

**怎么做**：把依赖数组当成「effect 体内读取的每个响应式值（props、state、由它们派生的值）都该列进来」的清单。`eslint-plugin-react-hooks` 的 `exhaustive-deps` 规则会自动帮你查漏——**必须开启，且别无脑加 `eslint-disable`**。被它警告时，先想清楚为什么，而不是关掉警告。

**StrictMode 的提醒**：开发模式下，React 18 的 `<StrictMode>` 会对每个 effect **跑两次**（mount 时执行 setup → 立刻 cleanup → 再 setup）。这是故意的——逼你写出正确的 cleanup（见 5.3）。如果你的 effect 在 StrictMode 下表现异常（订阅重复、数据拉两次），说明你的 cleanup 写得不对，这正是 bug 的早期信号。生产构建里 StrictMode 不产生双调用。

## 5.3 真相三：cleanup 与 effect 是一对

**是什么**：useEffect 回调返回的那个函数（cleanup），与 effect 本身是**配对**的——setup 做的事，cleanup 负责「拆掉」。

**何时执行**：

```
mount:    setup
update:   prev cleanup → new setup
update:   prev cleanup → new setup
          ...
unmount:  last cleanup
```

具体说，cleanup 在两个时机跑：**①下一次 effect 执行之前**（清理上一轮的副作用），**②组件卸载时**（清理最后一轮）。注意是「下一次 effect 之前」而非「effect 之后立刻」——这让每轮 effect 都面对一个干净的起点。

**为什么必须成对**：effect 在每次依赖变化后都会重跑。如果上一轮开了订阅、定时器、网络请求却没清理，它们会**累积**：订阅重复触发、定时器越来越多、已卸载组件还在 `setState`（报「Can't perform a React state update on an unmounted component」警告）。cleanup 就是为了让副作用「不留痕迹地重启」。

**怎么做**——订阅 + cleanup 的标准范式：

```tsx
function ChatRoom({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const conn = createConnection(roomId);
    conn.on('message', (m: string) => setMessages(prev => [...prev, m]));
    conn.connect();

    // setup 返回 cleanup：断开这条连接
    return () => {
      conn.disconnect();
    };
  }, [roomId]); // roomId 变 → 先断旧连接，再建新连接

  return <ul>{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>;
}
```

心智模型：把 effect 想成「连接 / 断开」的对称操作。setup 建立，cleanup 撤销。若 effect 改了全局变量、加了事件监听、开了定时器，cleanup 就该把它恢复原状。**没有 cleanup 的 effect，往往意味着资源泄漏。** 一个自检办法：在 `<StrictMode>` 下打开页面，若发现订阅事件触发两次、数据被拉两遍，几乎可以断定是 cleanup 缺失或写错——生产环境里这会演变成真实的内存泄漏。

## 5.4 三个高频陷阱

**陷阱一：依赖里放对象/函数 → 死循环**

每次渲染，组件内新建的对象 `{}` 和函数 `() => {}` 都是**新引用**。把它列进依赖数组，React 判定「依赖变了」，effect 重跑；effect 里若又触发渲染，循环往复。

```tsx
function Buggy({ options }: { options: object }) {
  const [data, setData] = useState(null);

  // ❌ options 每次渲染若都是新对象 → effect 每次都跑
  useEffect(() => {
    fetchData(options).then(setData);
  }, [options]);

  return null;
}
```

**解法**：用 `useMemo`/`useCallback` 稳定引用（下一篇细讲），或把不会变的依赖移出依赖数组（提到组件外、或用 ref）。判断标准：这个值真的会变吗？会变才进数组。

**陷阱二：effect 里无条件 setState → 无限渲染**

```tsx
function Buggy() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(c => c + 1); // ❌ 每次 effect 都改 state → 触发渲染 → 再跑 effect → 死循环
  });

  return <div>{count}</div>;
}
```

effect 改 state → 重渲染 → 提交后 effect 再跑 → 再改 state……浏览器卡死。**effect 里 setState 必须是有条件的**（依赖某个真正会变的外部触发），而不是「每次都改」。若发现这条规律，先问自己：这个状态变更的真正触发源是什么？多半它该在事件 handler 里，而不是 effect 里（见 5.6）。

**陷阱三：竞态（旧请求覆盖新）**

快速切换 `userId` 时，前一次请求还没返回，新请求已发出。若旧请求**晚到**，它的结果会覆盖新的——页面显示陈旧用户。

```tsx
function Buggy({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser(userId).then(setUser); // ❌ 旧请求晚到会覆盖新
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

**解法**：用 cleanup 里的 `ignore` 标志位，丢弃过期结果：

```tsx
useEffect(() => {
  let ignore = false;
  fetchUser(userId).then(u => {
    if (!ignore) setUser(u); // ✅ 只有最新一轮才会写入
  });
  return () => { ignore = true; }; // 切换前把上一轮标记为过期
}, [userId]);
```

切换 userId 时，cleanup 先把上一轮的 `ignore` 置 `true`，那一轮的 Promise 即便后来 resolve 也写不进去。这是处理「fetch 竞态」最经典、最低成本的模式；更复杂场景可上 AbortController 真正取消请求。

## 5.5 useEffect vs useLayoutEffect

**区别**：

| 维度 | useEffect | useLayoutEffect |
|------|-----------|-----------------|
| 执行时机 | 异步，浏览器绘制**之后** | 同步，DOM 变更后、绘制**之前** |
| 是否阻塞绘制 | 否 | 是 |
| 适用场景 | 绝大多数副作用 | 需要读 DOM 尺寸、避免视觉闪烁 |

**为什么有区别**：useEffect 的回调被推迟到绘制后，用户先看到新画面，再跑副作用——流畅。但有些操作必须在用户看到之前完成：比如读元素尺寸后立刻调整布局、初始化要精确位置的 tooltip。若用 useEffect，用户会瞥见「未调整 → 调整后」的闪烁。useLayoutEffect 把它卡在「DOM 改完、屏幕刷新前」同步跑完，避免闪屏。

**怎么做**：**默认用 useEffect**。仅当你读到 DOM 测量结果、并基于它立即改样式（会肉眼可见地闪一下）时，才换 useLayoutEffect。它的同步特性会阻塞绘制，滥用导致页面掉帧。

**SSR 的坑**：服务端渲染时没有 DOM，`useLayoutEffect` 会打印警告（它无法在服务端执行）。若组件同时跑在服务端，社区常见做法是封装一个 `useIsomorphicLayoutEffect`——服务端用 `useEffect`、客户端用 `useLayoutEffect`——规避该警告。

## 5.6 何时不用 useEffect

useEffect 是逃生通道，不是万能胶水。以下两种场景，新人最爱往 effect 里塞，却都是错用。

**场景一：从 props/state 派生数据，别用 effect + state**。

```tsx
function Buggy({ items }: { items: Item[] }) {
  const [filtered, setFiltered] = useState<Item[]>([]);

  // ❌ 多余：items 变后 effect 跑，多一次渲染
  useEffect(() => {
    setFiltered(items.filter(i => i.active));
  }, [items]);

  return <List data={filtered} />;
}
```

这会多一轮渲染（先渲染旧 filtered → effect 跑 → setState → 再渲染）。**派生数据应在渲染时直接算**：

```tsx
function Good({ items }: { items: Item[] }) {
  const filtered = items.filter(i => i.active); // ✅ 每次渲染自然拿到最新值
  return <List data={filtered} />;
}
```

**原则**：能从 props/state 算出来的值，就别当 state 存——直接在渲染里计算。useState 只存「需要记住、且无法从其它值推出」的数据。

**场景二：用户触发的逻辑放事件 handler，不放 effect**。

```tsx
function Buggy({ userId }: { userId: number }) {
  const [data, setData] = useState(null);

  // ❌ 「点了按钮就提交」——但你监听的是 userId 变化，错位
  useEffect(() => {
    submitForm(userId);
  }, [userId]);
}
```

「点击按钮提交表单」是**响应事件**，不是「响应 userId 变化」。混用会导致：父组件因别的原因重传 userId，表单莫名其妙被提交。

**区分**：**响应事件 → 写在事件 handler（onClick 等）；响应状态变化（真正需要同步外部世界）→ 写在 effect。** 二者不要错位。判断很简单：这个动作的触发源是「用户的某个操作」还是「数据变成了某值」？前者进 handler，后者才进 effect。

## 小结

useEffect 的本质只有一句：**在渲染安全提交到 DOM 之后，把外部世界与当前的 props/state 同步。** 三个真相串起来就是它的全部：

1. **不是生命周期**——mount/update/unmount 是它运行时机的表象，本质是「又一次渲染被提交，外部世界要重新对齐」。换掉 Class 三段式思维。
2. **依赖数组是契约**——它声明 effect 依赖什么。撒谎（漏依赖）换来 stale closure；老老实实列全，靠 `exhaustive-deps` 规则兜底。
3. **cleanup 与 effect 是一对**——setup 建立、cleanup 撤销，让副作用能干净地重启、不留泄漏。StrictMode 双调用正是来逼你写对它。

记住：effect 只为「同步外部世界」而存在。派生数据用计算、响应用户操作用 handler——别什么都往 effect 里塞。相比 Class 时代三个分散、需手动 diff 的生命周期，useEffect 用「一份同步指令 + 一份依赖契约 + 一对 setup/cleanup」把副作用逻辑收拢成可推理的结构，这正是它真正的价值。抓住这三点，useEffect 就从「抓狂源」变成「可控工具」。

## 下一步

> React 进阶系列 · 第 5 篇 / 共 8 篇

下一篇：[Hooks 心智模型（三）：记忆化与自定义 Hooks](./react-memoization) —— useMemo/useCallback 解决什么问题、何时不该用，以及如何把 Hook 逻辑抽成可复用单元。

上一篇：[Hooks 心智模型（一）：状态与 useState/useReducer](./react-hooks-state) —— 状态快照、不可变更新、批处理与 useReducer。

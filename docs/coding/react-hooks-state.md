# Hooks 心智模型（一）：状态与 useState/useReducer

> 函数组件本来是无状态的纯函数——给什么 props，渲染什么 UI。Hooks 让它能「记住」跨渲染的东西。但 Hooks 不是魔法，它是一组有严格规则的「钩子」。理解状态更新的心智模型（不可变、函数式更新、批处理），你才能避开铺天盖地的 setState 陷阱。

---

## 目录

1. [引言](#引言)
2. [4.1 Hooks 的两条铁律](#41-hooks-的两条铁律)
3. [4.2 useState 心智模型](#42-usestate-心智模型)
4. [4.3 不可变更新](#43-不可变更新)
5. [4.4 函数式更新](#44-函数式更新)
6. [4.5 批处理 Batching](#45-批处理-batching)
7. [4.6 lazy initial state](#46-lazy-initial-state)
8. [4.7 何时升级为 useReducer](#47-何时升级为-usereducer)
9. [4.8 坑汇总](#48-坑汇总)
10. [小结](#小结)
11. [下一步](#下一步)

## 引言

React 16.8 之前，函数组件只能读 props、返回 JSX，记不住任何东西。要状态？回去写 Class——`this.state`、`this.setState`、生命周期方法 `componentDidMount` 一整套。Class 的问题不在繁琐，而在**状态逻辑难以复用**：要复用一段「窗口尺寸监听」逻辑，得用渲染属性（render props）或高阶组件（HOC），层层嵌套，形成「包装地狱」。

Hooks 的设计目标就是把 Class 能做的事——状态、副作用、记忆化——搬进函数组件，同时让逻辑能像普通函数一样组合复用。它改变了这点：

```tsx
function Counter() {
  const [count, setCount] = useState(0); // 组件「记住」了 count
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

`useState` 让函数组件在多次渲染之间保留一个值。但每次渲染，函数都是**重新执行**的——那 `count` 凭什么能「记住」上次的值？这正是理解 Hooks 的钥匙：状态不在函数变量里，而在 React 替你保管的外部存储里，Hook 只是个「钩子」，把那个值钩进来。本文先建立心智模型，再拆解 useState / useReducer 的用法与陷阱。

## 4.1 Hooks 的两条铁律

**是什么**：使用任何 Hook 必须遵守两条不可破坏的规则。

1. **只在顶层调用**——不能放进 `if`、循环、嵌套函数里。
2. **只在 React 函数组件或自定义 Hook 里调**——别在普通函数、事件回调里调。

**为什么**：React 靠**调用顺序**定位每个 Hook 对应的状态插槽。它内部维护一个链表，第 1 次调 `useState` 对应 slot 0，第 2 次对应 slot 1……一旦你把 Hook 放进条件分支：

```tsx
function Profile({ isAdmin }: { isAdmin: boolean }) {
  const [name, setName] = useState('');
  if (isAdmin) {
    // ❌ 条件调用：isAdmin 为 false 时这次 Hook 消失，后续 Hook 错位
    const [role, setRole] = useState('user');
  }
  const [age, setAge] = useState(0);
  return null;
}
```

当 `isAdmin` 翻转，Hook 调用数量改变，链表顺序错乱，React 把 `age` 的值读成了 `role` 的，状态彻底串台。`eslint-plugin-react-hooks` 的 `rules-of-hooks` 规则就是防这个的——**务必开启**。

第二条规则的推论：自定义 Hook 必须以 `use` 开头（如 `useWindowSize`），这是给 linter 和人看的约定——以 `use` 开头的函数被当作 Hook 检查，组件里调它也合规。反过来，普通工具函数不要以 `use` 开头，避免误导。

**怎么做**：把可能改变 Hook 数量的逻辑挪到 Hook 内部、而不是决定「调不调」。比如想根据 `isAdmin` 决定要不要状态，应写两个组件或用条件设初值，而非条件调用 Hook。

## 4.2 useState 心智模型

**是什么**：`const [state, setState] = useState(init)`。`state` 是**某次渲染的快照**，不是「实时最新值的引用」。

**为什么重要**：很多人把 `state` 当成普通变量，以为改完立刻是最新的。错。`state` 在**本次渲染期间是固定的**——它拍下了渲染那一刻的值。

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1); // count 这里是 0
    setCount(count + 1); // count 还是 0（本次渲染的快照）
    setCount(count + 1); // count 仍是 0
    // 三次都基于同一个旧快照 → count 最终变成 1，不是 3
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

你以为点一次涨 3，实际只涨 1。因为三次 `setCount(count + 1)` 读到的 `count` 全是本次渲染拍下的 `0`。**这是 useState 最反直觉的一点**，下一节的函数式更新就是解药。

换个角度理解：React 渲染像「拍一张照片」。函数体执行时，`count` 是这张照片里的值，整张照片拍完之前不会变。事件处理器是在「这张照片里」定义的，它看到的 `count` 就是拍照那一刻的值。多次 `setCount(count+1)` 都在拿同一张旧照片，自然都算出 1。

心智模型图：

```
渲染 N:  state=0 (快照)
           │  setCount(0+1) setCount(0+1) setCount(0+1)
           ▼  全部基于快照 0
         合并 → pending state = 1
           ▼
渲染 N+1: state=1 (新快照)
```

## 4.3 不可变更新

**是什么**：setState 必须传**新值或新引用**，不能原地 mutate。

**为什么**：React 用 `Object.is(prev, next)` 判断状态变没变。直接改对象属性，引用不变，React 认为没变，**不重渲染**。

```tsx
function Form() {
  const [user, setUser] = useState({ name: 'xia', age: 28 });

  function wrong() {
    user.age += 1;       // ❌ 引用没变，React 不触发渲染
    setUser(user);
  }

  function right() {
    setUser({ ...user, age: user.age + 1 }); // ✅ 新对象，新引用
  }

  return <button onClick={right}>{user.age}</button>;
}
```

**怎么做**——按数据类型：

| 类型 | ❌ 错误（原地改） | ✅ 正确（返回新的） |
|------|------------------|--------------------|
| 对象 | `obj.key = v` | `{ ...obj, key: v }` |
| 数组添加 | `arr.push(x)` | `[...arr, x]` / `arr.concat(x)` |
| 数组删除 | `arr.splice(i,1)` | `arr.filter((_, idx) => idx !== i)` |
| 数组改项 | `arr[i] = x` | `arr.map((it, idx) => idx === i ? x : it)` |

核心原则与站内[函数式思维](./functional-thinking)一致：**不修改，只生成新数据**。这是 React 与函数式编程的天然连接点。

**嵌套对象的坑**：展开是浅拷贝，只复制一层。深层嵌套要逐层展开。

```tsx
const [state, setState] = useState({ user: { address: { city: '北京' } } });

// ❌ 只展开顶层：user/address 仍是旧引用，深层没动
setState({ ...state, user: state.user });

// ✅ 逐层展开，每一层都是新引用
setState({
  ...state,
  user: { ...state.user, address: { ...state.user.address, city: '上海' } },
});
```

深层结构频繁更新很痛，这是为什么复杂状态适合上 useReducer 或状态库（见本系列第 7 篇）。别用 `JSON.parse(JSON.stringify())` 深拷贝当常规手段——性能差且丢类型。

## 4.4 函数式更新

**是什么**：`setState(prev => next)`，让 React 把**最新的**状态喂给你。

**什么时候必须用**：新状态依赖旧状态时——比如计数器累加、基于上一项追加。

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(c => c + 1); // c 是最新值
    setCount(c => c + 1);
    setCount(c => c + 1);
    // ✅ 三次都基于上一次结果 → count 变成 3
  }

  return <button onClick={handleClick}>{count}</button>;
}
```

对比 4.2 的错误写法，**函数式更新是「我依赖最新状态」的明确信号**。经验法则：看到 `setState(state + x)` 这种依赖当前值的写法，就该问一句——「要不要换成函数式更新？」。

**什么时候不必用**：新状态与旧状态无关时，直接传值更清晰。比如开关 `setEnabled(!enabled)` 其实依赖旧值，应改函数式；而 `setName('xia')` 与旧值无关，直接传。判断标准简单——**问自己「我要算的是 next，还是要设一个固定值」**，前者用函数式，后者不用。

唯一注意：函数式更新里的参数才是可靠的旧值，返回值是全新状态，**别在里头搞副作用**（发请求、改全局变量）。它该是纯函数，给定 prev 返回 next，否则破坏可预测性，也让并发模式下 React 的可中断渲染出问题。

## 4.5 批处理（Batching）

**是什么**：同一事件内的多次 setState，React 会**合并成一次重渲染**。

**为什么**：点一次按钮触发 5 个 setState，若每次都重渲染，页面卡死。批处理把它们攒齐，算出最终状态，只渲染一次。

```
事件开始
  setState(a) ┐
  setState(b) ├─ 攒齐，不渲染
  setState(c) ┘
事件结束 → 一次重渲染
```

**React 18 自动批处理**：以前只有 React 事件内（如 onClick）才批；18 起**事件外也批**——Promise、setTimeout、原生事件回调里的多次 setState 同样合并。这修复了 17 时代「异步回调里 setState 不批」的老坑。

```tsx
async function handleFetch() {
  const data = await api();
  setUsers(data.users);      // ┐
  setLoading(false);         // ├─ React 18 合并成一次渲染
  setError(null);            // ┘
}
```

一个常被问的问题：「我怎么知道哪些 setState 会被批？」答案是：**你不用知道**。React 18 默认全部批，你只需按直觉写代码，性能交给框架。这也是为什么 4.2 里三次 `setCount(count+1)` 看似「立刻执行」却只渲染一次——批处理把它们合在一轮。

少数情况你需要「立刻刷」：读取刚设的 DOM 尺寸、同步触发第三方库。这时用 `flushSync(fn)` 强制在该点冲刷渲染、跳出批处理。但这是逃生口，别常用——它是性能反模式。

推论：**不要假设 setState 后下一行就能读到新 state**——此刻重渲染还没发生，state 还是旧的。这也解释了 4.8 的「setState 后立刻读 state 是旧的」坑。

## 4.6 lazy initial state

**是什么**：`useState` 接受一个**初始化函数**，只在首次渲染执行一次。

**为什么需要**：传值时 `useState(makeInitial())`，`makeInitial()` **每次渲染都会执行**（因为函数参数先求值），哪怕结果被丢弃，浪费算力。

```tsx
function expensiveInit(): State {
  // 读 localStorage、解析大 JSON……
  return parseHuge();
}

// ❌ 每次渲染都跑 expensiveInit，即便只用首次结果
const [state, setState] = useState(expensiveInit());

// ✅ 惰性初始化：只在首次渲染调用
const [state, setState] = useState(() => expensiveInit());
```

**何时用**：初始值需要昂贵计算（解析 JSON、深拷贝、读存储）时。简单常量（`0`、`''`）直接传值即可，别无脑套函数。

一个常见误用：把派生数据塞进 useState。比如 `const [total] = useState(items.length)` 是错的——items 变了 total 不会跟着变。派生值不该当状态存，应在渲染时直接算 `const total = items.length`，每次渲染自然拿到最新值。状态只存「需要记住、且无法从 props/其他 state 推出的」数据。

## 4.7 何时升级为 useReducer

**是什么**：`useReducer(reducer, initial)` 把状态变更集中成 `(state, action) => state` 的纯函数。

**什么时候该升级**——满足任一条就考虑：

- 多个状态字段**联动**（改一个连带改另一个）
- 下一个状态依赖**复杂规则**
- 状态变更点散落在多处，难追踪

对比：一个表单多字段用 useState，每个字段一个 setState，逻辑碎一地；用 useReducer 集中管理。

```tsx
// useState 写法：字段一多就乱
function Form() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  // 提交时要联动改 errors + submitting……散落各处
}
```

```tsx
// useReducer 重构：状态变更集中、可预测
type State = {
  username: string;
  password: string;
  errors: { username?: string; password?: string };
  submitting: boolean;
};
type Action =
  | { type: 'set'; field: 'username' | 'password'; value: string }
  | { type: 'submit' }
  | { type: 'done'; errors: State['errors'] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return { ...state, [action.field]: action.value };
    case 'submit':
      return { ...state, submitting: true };
    case 'done':
      return { ...state, submitting: false, errors: action.errors };
    default:
      return state;
  }
}

function Form() {
  const [state, dispatch] = useReducer(reducer, {
    username: '', password: '', errors: {}, submitting: false,
  });
  // dispatch({ type: 'submit' }) 一眼看清发生了什么
}
```

对比表：

| 维度 | useState | useReducer |
|------|----------|------------|
| 适用 | 独立、简单的状态 | 联动、规则复杂的状态 |
| 变更点 | 分散在各处 | 集中在 reducer |
| 可测试 | 难 | reducer 是纯函数，易测 |
| 心智成本 | 低 | 略高，但状态复杂时反而更清晰 |

经验：**两三个字段、无联动 → useState；超过这规模或字段相互影响 → useReducer**。

reducer 还有个隐藏优势：它是纯函数，输入 `(state, action)` 输出 `newState`，可以脱离 React 单独测试——`expect(reducer(init, {type:'submit'})).toEqual(...)`。状态越复杂，这个可测试性越值钱。

## 4.8 坑汇总

**1. 闭包陷阱**——事件处理器拿到的是**渲染那一刻**的 state。函数组件每次渲染都生成新函数，捕获当时的 state；定时器、订阅等若引用了旧函数，就拿不到最新值。

```tsx
function Timer() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1); // ❌ count 永远是 0（闭包捕获的旧值）
    }, 1000);
    return () => clearInterval(id);
  }, []); // 空依赖，count 被定格为 0
}
```

为什么：`[]` 让 effect 只跑一次，里面的回调闭包锁死了首次渲染的 `count=0`，永远加成 1。解药：用函数式更新 `setCount(c => c + 1)`，不依赖闭包里的旧值——React 会把最新 count 喂进来。useEffect 的依赖数组是下一篇的主题，这里先记住「闭包会捕获旧 state」。

**2. setState 后立刻读 state 是旧的**——批处理还没渲染，state 没更新。

```tsx
const [n, setN] = useState(0);
function click() {
  setN(5);
  console.log(n); // 0，不是 5
}
```

要新值：用函数式更新，或把后续逻辑挪到 `useEffect` 里监听 `n`。

**3. 直接 mutate state 不渲染**——见 4.3，必须传新引用。

**4. 依赖闭包变量而非函数式更新**——4.4 的连续三次只生效一次。

## 小结

Hooks 的本质：**一组让函数组件在渲染间「记住」东西的钩子，靠调用顺序定位状态插槽**。掌握它，抓住三点心智模型：

1. **state 是渲染快照**，不是实时变量——依赖旧值时用函数式更新。这是理解全部 React 状态问题的总钥匙。
2. **状态必须不可变**——传新引用才触发渲染，与函数式思维一脉相承，数组对象都按不可变习惯写。
3. **批处理合并渲染**——别在 setState 后立即读新值，多次 setState 同一事件内只渲染一次。

useState 适合简单独立状态；状态联动复杂时，useReducer 把变更集中成可预测的纯函数。记住一个测试：如果某个组件里 useState 超过四五个、且 setState 调用点散落在多个函数、状态间还互相牵扯——就是上 useReducer 的信号。

掌握这四点，你就拿到了状态更新的直觉：快照、不可变、函数式、批处理。下一篇进入副作用——useEffect 的三个真相。

## 下一步

> React 进阶系列 · 第 4 篇 / 共 8 篇

下一篇：[Hooks 心智模型（二）：副作用与 useEffect 的三个真相](./react-hooks-effects) —— 副作用、依赖数组、cleanup，以及那些让你抓狂的陷阱。

上一篇：[渲染与 Reconciliation：状态如何变成 DOM](./react-reconciliation) —— 渲染触发条件、diff 算法、key 的本质。

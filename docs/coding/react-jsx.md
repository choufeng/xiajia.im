# JSX 与元素：编译时发生了什么

> 写了几年 React，`return <div/>` 已是肌肉记忆。但这行代码在运行时到底变成了什么？这一篇把 JSX 的魔法拆开：它不是 HTML、不是模板字符串，而是 `React.createElement` 的语法糖，最终产出一棵由「普通对象」组成的树。看懂这棵树，props、children、key 的设计就都有了根据。

---

## 目录

1. [引言](#引言)
2. [2.1 JSX 是语法糖](#2-1-jsx-是语法糖)
3. [2.2 元素是普通对象](#2-2-元素是普通对象)
4. [2.3 组件是返回元素的函数](#2-3-组件是返回元素的函数)
5. [2.4 props 与 children](#2-4-props-与-children)
6. [2.5 大写与小写](#2-5-大写与小写)
7. [2.6 表达式嵌入](#2-6-表达式嵌入)
8. [2.7 条件渲染的三种写法](#2-7-条件渲染的三种写法)
9. [2.8 列表与 key 的本质](#2-8-列表与-key-的本质)
10. [小结](#小结)
11. [下一步](#下一步)

---

## 引言

React 程序员天天写 JSX，却常把它当「HTML 写进 JS」。这个心智模型有两个隐藏成本：一是遇到编译报错看不懂，二是无法解释 props、key、Fragment 到底为什么这么设计。

真相是：**JSX 是一种编译时语法糖**。浏览器从不认识 `<div>`——它只认识 JavaScript。你在 `.tsx` 里写的标签，在交给运行时之前，已被 Babel/SWC 翻译成普通函数调用。理解这一步翻译，是理解 React 一切后续机制（渲染、diff、Hooks）的前提。

本篇回答一个问题：**`<div className="x">hi</div>` 经过编译、经过运行，最终在内存里是什么？** 一旦看清这步翻译，你会获得一项能力：拿到任何 JSX，都能在脑中把它还原成函数调用和对象结构。从此报错信息、性能问题、Hooks 行为，都不再是黑盒。

---

## 2.1 JSX 是语法糖

先看一段再普通不过的 JSX：

```tsx
const el = <h1 className="title">Hello</h1>
```

**经典 JSX 转换**（React 16 及之前，`runtime: 'classic'`）会把它编译成：

```tsx
const el = React.createElement(
  'h1',
  { className: 'title' },
  'Hello'
)
```

`React.createElement(type, props, ...children)`：第一个参数是标签类型，第二个是属性对象，之后的所有参数都是子节点。

**新 JSX 转换**（React 17+ 引入，`runtime: 'automatic'`，`react/jsx-runtime`）编译产物变了：

```tsx
import { jsx as _jsx } from 'react/jsx-runtime'

const el = _jsx('h1', { className: 'title', children: 'Hello' })
```

差别有三，值得记牢：

1. **不再需要 `import React from 'react'`**。编译器自动注入对 `react/jsx-runtime` 的导入。
2. **children 不再是尾随参数，而是 props 上的一个字段**。`_jsx(type, props)` 只有两个参数。
3. 当子节点是「编译期已知的静态数组」时，编译器用 `_jsxs`（注意末尾的 `s`）代替 `_jsx`，提示 React 这是静态结构，可省去一些运行时合并开销。

`jsx-runtime` 只导出 `jsx`、`jsxs`、`Fragment` 三个东西。`React.createElement` 在 React 18 依然可用、依然存在——新转换只是换了一条更精简的路径。

一张图概括整条链路：

```
  JSX 源码              编译器 (Babel/SWC)            运行时内存
─────────────         ────────────────────         ────────────────
<div id="a">          _jsx('div',                  { type: 'div',
  <span>hi</span>       { id: 'a',                    props: { id:'a',
</div>                    children:                     children:[
                            _jsx('span',                 { type:'span',
                              {children:'hi'}) })          ... } ] } }
```

源码里的「标签」，到运行时就是一个函数调用、一个返回的对象。**没有 DOM，没有 HTML 解析**。

---

## 2.2 元素是普通对象

上一步的函数调用，返回的是一个 `ReactElement` 对象。把它打印出来：

```tsx
const el = <div className="box" id="x">hi</div>
console.log(el)
```

你看到的结构大致是这样：

```tsx
{
  $$typeof: Symbol.for('react.element'),
  type: 'div',
  props: { className: 'box', id: 'x', children: 'hi' },
  key: null,
  ref: null,
  _owner: FiberNode { ... },   // 谁创建了它，仅开发可见
}
```

几个关键认知：

- **它是普通 JS 对象**，不是 DOM 节点。`document.createElement` 到这里一次都没调用。
- **`type` 决定它是什么**：字符串 `'div'` 表示宿主标签；若是组件，`type` 就会是那个函数/类本身。
- **`key` 与 `ref` 是特殊字段**：你写在 JSX 上，但它们不会出现在 `props` 里——React 在创建元素时把它们单独抽走了，组件内部读不到 `props.key`。
- **`$$typeof` 是安全戳**：用 `Symbol` 标记，防止用户从接口注入伪造的元素对象（Symbol 无法跨网络序列化）。
- **它在开发环境被 `Object.freeze` 冻结**：元素是不可变的描述，创建后不该改。想变？重新创建一个新元素，交给 React 去算差异。

一句话：**元素是「这个 UI 长什么样」的轻量描述，是蓝图，不是房子**。蓝图很便宜，React 可以放心地丢弃旧蓝图、画新蓝图——这正是状态驱动渲染得以成立的前提：每次 `setState` 产生一棵全新的、只读的元素树，React 只负责比对两份蓝图、算出最小改动。这和站内 [函数式编程](./functional) 讲的「不可变数据」是同一个道理：不改旧值，产新值。

还要分清三个词，新人极易混淆：**元素**是上面的普通对象；**组件**是产出元素的函数；**实例**是类组件被渲染后那个带 `this` 的对象（函数组件没有实例）。本系列基本不写类组件，所以「实例」可以暂时忘掉。

---

## 2.3 组件是返回元素的函数

组件就是函数，调用它，拿到元素：

```tsx
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>
}

function App() {
  return (
    <div className="app">
      <Greeting name="Jon" />
    </div>
  )
}

const tree = App()
```

`App()` 返回的是这样一个元素（伪代码）：

```tsx
{
  type: 'div',
  props: {
    className: 'app',
    children: {
      type: Greeting,            // 注意：type 是函数本身
      props: { name: 'Jon' },
      key: null,
    }
  }
}
```

这里的重点：**`<Greeting name="Jon" />` 创建的元素，其 `type` 字段存的是 `Greeting` 这个函数引用，而并非函数的执行结果**。React 在渲染时才会拿着 `type` 去调用 `Greeting({ name: 'Jon' })`，得到子元素，递归往下。

所以元素树是一棵「惰性」的树：里面混着两类节点——

- `type` 为字符串 → 宿主节点（`div`、`span`），最终对应真实 DOM。
- `type` 为函数/类 → 组件节点，是个「待执行的占位」，React 按需展开。

调用 `App()` 只是把最外层展开了一层。完整展开成全为宿主节点的树，是渲染阶段的事。

**为什么要惰性、不全量展开？** 因为渲染是要算钱（CPU、DOM 操作）的。把「描述 UI 结构」和「真正构建 DOM」拆成两段，组件树就能以元素的形式被缓存、被比对、被记忆化（`memo` 比的就是元素）。如果一开始就把整棵树跑平成 DOM，React 就退化成了一个普通命令式框架。这种「描述与执行分离」，正是声明式的根基。

---

## 2.4 props 与 children

`props` 就是一个普通对象，把 JSX 上写的属性原样收进来。其中 `children` 是一个特殊的 prop——标签之间的内容：

```tsx
<Card title="Hi">
  <Avatar />
  <p>正文</p>
</Card>
```

在 `Card` 内部，`props.children` 是一个含两个元素的数组；`props.title` 是 `'Hi'`。

`children` 可以是任意类型，且并非每种都会渲染出来。这张表必须背熟：

| `children` 的值 | 渲染结果 | 说明 |
|---|---|---|
| 字符串 `'hi'` | 文本节点 `hi` | |
| 数字 `42` | 文本节点 `42` | |
| 元素 `<X/>` | 渲染该元素 | |
| 元素数组 `[<a/>,<b/>]` | 逐个渲染 | 列表需带 `key` |
| `null` / `undefined` | **跳过** | 不占位 |
| `true` / `false` | **跳过** | 条件渲染的基石 |
| `0` | **渲染出 `0`** | ⚠️ 经典坑 |
| 空串 `''` | 渲染空 | 占一个空文本节点 |

记住这条分界线：**`null`、`undefined`、`true`、`false` 被忽略；`0`、`NaN`、空串会被渲染**。后半句的 `0` 是无数 bug 的源头，下一节就会撞上。

---

## 2.5 大写与小写

JSX 标签首字母的大小写，决定 `type` 字段塞什么：

| 写法 | `type` 的值 | 含义 |
|---|---|---|
| `<div>` | 字符串 `'div'` | 宿主标签 / HTML 元素 |
| `<Foo />` | 变量 `Foo` | 组件（函数或类引用） |
| `<myComp />` | 字符串 `'mymyComp'`... 即 `'myComp'` | 被当成未知 HTML 标签 |

**最常见的新手错误**：把组件写成小写开头。

```tsx
// ❌ 不会渲染，控制台可能警告 unknown element
function myComponent() { return <p>hi</p> }
return <myComponent />

// ✅ 必须大写
function MyComponent() { return <p>hi</p> }
return <MyComponent />
```

衍生规则：

- **动态组件要先用大写变量接住**。直接 `<{Comp}/>` 不合法；正确做法：
  ```tsx
  const Tag = props.as       // props.as 是个组件函数
  return <Tag />
  ```
- **点表示法天然合法**：`<Form.Input />`、`<UI.Button />`，编译器知道 `.` 左侧是对象、右侧是它的属性，按组件处理，无需大写。

---

## 2.6 表达式嵌入

JSX 里的 `{}` 是「把任意 JavaScript 表达式求值并插入」的开关。它接受**表达式**（有返回值的式子），不接受**语句**：

```tsx
<div>{ 1 + 1 }</div>            // ✅ 表达式
<div>{ user.name }</div>        // ✅ 表达式
<div>{ items.map(i => <li key={i.id}>{i.text}</li>) }</div>  // ✅ 表达式
<div className={ isActive ? 'on' : 'off' } />                // ✅ 属性里也能用
<div { ...rest } />             // ✅ spread 属性
```

下面这些**不合法**，因为它们是语句：

```tsx
<div>{ if (ok) { return <X/> } }</div>     // ❌ if 是语句
<div>{ for (const i of list) <li/> }</div>  // ❌ for 是语句
```

绕过办法，按优先级：

1. **抽成变量或函数**——最推荐，可读性最好。
2. **三元** `cond ? <A/> : <B/>`——二选一。
3. **`&&`**——显示或什么都不显示。
4. **IIFE** `{(() => { ... })()}`——能用，但说明逻辑该抽函数了，慎用。

还有一个常被忽略的点：**`{}` 里求值发生在每次渲染**。表达式不是「编译期常量」，而是组件每次执行时重新计算。所以 `{ format(user) }` 每次渲染都会调一次 `format`——它必须是纯函数，不能在里面搞副作用（发请求、改全局变量）。要副作用，那是 `useEffect` 的事。

原则：**JSX 里只放「值」，把控制流留在 JSX 外面**。

---

## 2.7 条件渲染的三种写法

实际开发就这三种模式，各有适用场景：

```tsx
// 1️⃣ if 提前 return —— 分支复杂、多行、或要算中间变量
function Greeting({ user }: Props) {
  if (!user) return <LoginPrompt />
  const name = format(user)
  return <h1>Hi, {name}</h1>
}

// 2️⃣ 三元 —— 非此即彼，内联
{ isLoggedIn ? <Logout /> : <Login /> }

// 3️⃣ && —— 满足才显示
{ hasError && <ErrorBanner /> }
```

| 写法 | 适用 | 风险 |
|---|---|---|
| `if` return | 复杂分支、提前退出 | 无 |
| 三元 `? :` | 二选一 | 嵌套三层以上可读性崩 |
| `&&` | 单向显示 | ⚠️ 左操作数为 `0` 时坑 |

**`&&` 的坑**，务必记住：`&&` 返回的是左操作数（当它为 falsy 时），不是布尔值。

```tsx
{ count && <Badge count={count} /> }
//        count 为 0 时：
//        0 && <Badge/>  → 求值结果是 0
//        而 0 会渲染成文本 "0"  ❌ 页面冒出一个孤零零的 0
```

因为「`0` 会被渲染」（见 2.4 那张表）。修复三选一：

```tsx
{ count > 0 && <Badge count={count} /> }   // 让判断本身返回布尔
{ !!count && <Badge count={count} /> }     // 强制转布尔
{ count ? <Badge count={count} /> : null } // 干脆用三元
```

**凡是计数、长度参与 `&&`，先问一句：它会是 0 吗？**

---

## 2.8 列表与 key 的本质

渲染列表就是 `map` 返回一个元素数组：

```tsx
<ul>
  { items.map(item => (
    <li key={item.id}>{item.label}</li>
  )) }
</ul>
```

`map` 本身没什么特别——它返回的数组成了父元素的 `children`。真正要理解的是 **`key`**。

**key 是给 Reconciliation（协调）用的身份标识，不是给人看的**。它的作用是：当列表在下一次渲染里被打乱、增删时，让 React 能把「上次那个 `<li>`」和「这次某个 `<li>`」正确对上号，从而复用已有的 DOM 和组件状态，而不是推倒重建。

理解 key 的四条铁律：

1. **必须唯一，但只在兄弟间唯一**。两个不同列表里复用同一个 key 完全没问题。
2. **稳定**。理想情况下用数据的真实 ID，不要用 `Math.random()` 或运行期生成——那样每次渲染 key 都变，等于没有 key。
3. **组件读不到它**。`key` 被抽走了，`props.key` 是 `undefined`。要传数据就另起一个 prop（如 `item.id` 同时作为 `id` 传下去）。
4. **位置要正确**。放在数组直接返回的那个元素上，而不是它内部套的子元素。

**为什么不用数组 `index` 当 key？** 这是最常见的反模式，也是面试高频题。

```tsx
{ items.map((item, index) => <Row key={index} data={item} />) }
```

只要列表只是「整体替换」、永不增删乱序，用 index 勉强能跑。一旦发生**头部插入、中间删除、拖拽排序**，index 没变但数据变了——React 按 index 对号入座，会把 A 组件的状态续到 B 数据上，导致**输入框串值、动画错乱、状态泄漏**，而且 diff 效率更差。

举个具体场景：列表是三个待办 `[a, b, c]`，你在头部插入 `x` 变成 `[x, a, b, c]`。用 index 当 key，React 认为「位置 0 还是那个组件」——于是原来显示 `a` 的那行（可能正填着输入）现在要显示 `x`，状态全乱了套。换成稳定 id，React 一眼看出 `x` 是新来的、`a/b/c` 只是下移，DOM 正确复用。

记住这句口诀：**key 是「身份」，index 是「位置」**。身份变了才该重建；拿位置当身份，等于逼 React 认错人。

> key 的完整机制——它如何介入 diff、为何影响性能与状态——会在下一篇 [Reconciliation](./react-reconciliation) 里彻底讲透。

---

## 小结

把这一篇压缩成一句话：**JSX 是描述 UI 的轻量 DSL，编译后产出一棵由普通不可变对象构成的元素树**。

带走的几条认知：

- JSX = `createElement` / `_jsx` 的语法糖；运行时里根本没有「标签」，只有函数调用。
- 元素 = `{ type, props, key, ref, $$typeof }` 的普通对象，是蓝图而非 DOM，创建后不可变。
- 组件 = 返回元素的函数；`<Comp/>` 产出的元素，`type` 字段存的是函数本身，渲染时才被调用。
- props 是普通对象；`children` 是特殊 prop；`null`/`false` 跳过、`0` 渲染。
- 大写=组件、小写=宿主标签；动态组件先赋给大写变量。
- 条件渲染三件套，`&&` 当心 `0`；列表 `key` 是给 diff 用的身份标识，别用 index。

一旦把「JSX → 对象树」这条链路看透，你会发现 React 后面所有的设计——diff、Hooks 的重渲染、`memo` 的比对——都在围绕这棵对象树打转。它就是 React 的地基。

---

## 下一步

到这里你只看到了「元素树被造出来」。但它怎么变成屏幕上的 DOM？状态更新后，新树和旧树怎么比较、怎么最小化改动？那是 Reconciliation 的事。

> **下一篇：[渲染与 Reconciliation：状态如何变成 DOM](./react-reconciliation)** —— render 的触发条件、diff 算法、`key` 到底怎么影响结果。

系列进度：**第 2 篇 / 共 8 篇**　·　[← 上一篇：设计哲学：为什么是声明式](./react-philosophy)

# SolidJS 使用指南

> 一个纯反应式的 UI 库，不使用 Virtual DOM，性能接近原生 JavaScript。

## 什么是 SolidJS

SolidJS 是一个用于构建用户界面的声明式 JavaScript 库。它的核心设计理念是**纯反应式**——从底层开始就以反应式系统为核心构建，而非像 React 那样通过 hooks 在函数式组件之上模拟反应式行为。

关键特点：

- **不使用 Virtual DOM**：将 JSX 编译为真实 DOM 节点，通过细粒度反应系统更新
- **组件只运行一次**：与 React 每次状态变化都重新执行组件不同，Solid 组件只运行一次来设置视图
- **自动依赖追踪**：访问反应式状态时自动建立订阅关系，无需手动声明依赖数组
- **小巧且极快**：在 [JS Framework Benchmark](https://krausest.github.io/js-framework-benchmark/current.html) 中性能几乎与手写原生 JS 无差别
- **现代框架特性**：JSX、Fragments、Context、Portals、Suspense、流式 SSR、渐进式水合等

## 与 React 的核心区别

| 特性 | React | Solid |
|------|-------|-------|
| 更新机制 | Virtual DOM diff | 细粒度反应式，直接更新真实 DOM |
| 组件执行 | 每次状态变化重新执行 | 只执行一次 |
| 状态管理 | `useState` + hooks | `createSignal`（反应式 getter/setter） |
| 依赖数组 | `useEffect` 需要手动声明 | `createEffect` 自动追踪 |
| JSX 中的值 | `{value}` | `{value()}`（需调用 getter） |
| 性能 | 优秀 | 接近原生 JS |

理解这些差异是掌握 Solid 的第一步——**Solid 的思维方式是反应式的，而不是渲染式的**。

## 快速开始

### 创建新项目

```bash
# TypeScript 模板（推荐）
npx degit solidjs/templates/ts my-app
cd my-app
npm install
npm run dev
```

项目基于 Vite 构建，开箱即用。

### 安装到现有项目

```bash
npm install solid-js
npm install -D babel-preset-solid
```

tsconfig.json 配置：

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

## 核心概念

### 1. 组件——普通函数，只运行一次

```tsx
import { createSignal } from "solid-js";
import { render } from "solid-js/web";

function Counter() {
  const [count, setCount] = createSignal(0);

  // 这行日志只打印一次！
  console.log("组件只运行一次");

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count()}
    </button>
  );
}

render(Counter, document.getElementById("app")!);
```

当点击按钮时，只有 `{count()}` 这个文本节点会被更新，整个组件函数不会重新执行。

### 2. Signals——反应式状态

Signals 是 Solid 状态管理的基石：

```tsx
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);
//       ^ getter      ^ setter

// 读取值——必须调用
console.log(count()); // 0

// 更新值
setCount(5);
setCount((prev) => prev + 1); // 函数式更新
```

**关键规则**：在 Solid 中，signal 是一个函数。读取值时调用 `count()`，而不是直接访问 `count`。

### 3. Memos——派生状态

用于计算依赖其他 signal 的值，自动缓存：

```tsx
import { createSignal, createMemo } from "solid-js";

const [count, setCount] = createSignal(0);
const doubled = createMemo(() => count() * 2);

console.log(doubled()); // 0，当 count 变化时自动重新计算
```

### 4. Effects——处理副作用

```tsx
import { createSignal, createEffect } from "solid-js";

const [count, setCount] = createSignal(0);

createEffect(() => {
  // 自动追踪 count，count 变化时重新运行
  console.log("Count is:", count());
});

// 初始化运行一次，之后仅在 count 变化时运行
```

**注意**：Effect 中应避免设置 signal，否则可能导致无限循环。计算派生值应使用 `createMemo`。

### 5. 控制流组件

Solid 提供专用的控制流组件，比 JSX 中的 `&&` 或 `.map()` 更高效：

```tsx
import { Show, For, Switch, Match, Index } from "solid-js";

// 条件渲染
<Show when={isLoggedIn()} fallback={<LoginButton />}>
  <UserProfile />
</Show>

// 列表渲染
<For each={items()}>{(item) => <li>{item.name}</li>}</For>

// 多路分支
<Switch fallback={<Default />}>
  <Match when={status() === "loading"}><Spinner /></Match>
  <Match when={status() === "error"}><Error /></Match>
  <Match when={status() === "success"}><Content /></Match>
</Switch>
```

### 6. 生命周期

```tsx
import { onMount, onCleanup } from "solid-js";

function Component() {
  onMount(() => {
    // 组件挂载后执行一次
    const timer = setInterval(() => console.log("tick"), 1000);
  });

  onCleanup(() => {
    // 组件卸载时清理
    clearInterval(timer);
  });

  return <div>Hello</div>;
}
```

### 7. Context——跨组件状态共享

```tsx
import { createContext, useContext, createSignal } from "solid-js";

const ThemeContext = createContext();

function ThemeProvider(props) {
  const [theme, setTheme] = createSignal("light");

  return (
    <ThemeContext.Provider value={[theme, setTheme]}>
      {props.children}
    </ThemeContext.Provider>
  );
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("Missing ThemeProvider");
  return ctx;
}

function ThemedButton() {
  const [theme, setTheme] = useTheme();
  return (
    <button onClick={() => setTheme(theme() === "light" ? "dark" : "light")}>
      Current: {theme()}
    </button>
  );
}
```

### 8. Stores——复杂嵌套状态

对于对象和数组等复杂状态，使用 `createStore`：

```tsx
import { createStore } from "solid-js/store";

const [store, setStore] = createStore({
  users: [
    { id: 1, name: "Alice", active: true },
    { id: 2, name: "Bob", active: false },
  ],
});

// 路径语法——精确更新
setStore("users", 0, "name", "Alice2");

// 批量更新
setStore("users", [0, 1], "active", true);

// 条件过滤更新
setStore("users", (user) => user.name.startsWith("A"), "active", false);

// 范围更新
setStore("users", { from: 0, to: store.users.length - 1 }, "active", true);

// produce——可变风格操作
import { produce } from "solid-js/store";
setStore("users", 0, produce((user) => {
  user.name = "Alice3";
  user.active = true;
}));
```

## 完整示例：Todo 应用

```tsx
import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoApp() {
  const [todos, setTodos] = createStore<Todo[]>([]);
  const [input, setInput] = createSignal("");
  let nextId = 1;

  const addTodo = () => {
    if (!input().trim()) return;
    setTodos(todos.length, {
      id: nextId++,
      text: input(),
      done: false,
    });
    setInput("");
  };

  const toggleTodo = (id: number) => {
    setTodos((todo) => todo.id === id, "done", (done) => !done);
  };

  const removeTodo = (id: number) => {
    setTodos((todos) => todos.filter((t) => t.id !== id));
  };

  const remaining = () => todos.filter((t) => !t.done).length;

  return (
    <div>
      <h1>Todos</h1>

      <div>
        <input
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>

      <ul>
        <For each={todos}>
          {(todo) => (
            <li>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
              />
              <span
                style={{
                  "text-decoration": todo.done ? "line-through" : "none",
                }}
              >
                {todo.text}
              </span>
              <button onClick={() => removeTodo(todo.id)}>✕</button>
            </li>
          )}
        </For>
      </ul>

      <Show when={remaining() > 0}>
        <p>{remaining()} item(s) remaining</p>
      </Show>
    </div>
  );
}

render(TodoApp, document.getElementById("app")!);
```

## Suspense 和数据获取

Solid 内置 Suspense 支持，配合 `createResource` 处理异步数据：

```tsx
import { createResource, Suspense } from "solid-js";

async function fetchUser(id: number) {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

function UserProfile(props: { id: number }) {
  const [user] = createResource(() => props.id, fetchUser);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div>
        <h2>{user()?.name}</h2>
        <p>{user()?.email}</p>
      </div>
    </Suspense>
  );
}
```

## 样式处理

### Class 和 Style

```tsx
// 动态 class
<div class={isActive() ? "active" : ""} />

// classList（更优雅的条件 class）
<div classList={{ active: isActive(), hidden: isHidden() }} />

// 动态 style
<div style={{ color: themeColor(), "font-size": size() + "px" }} />
```

### CSS 方案兼容性

Solid 兼容所有主流 CSS 方案：CSS Modules、Tailwind CSS、Sass、LESS、UnoCSS 等。

## 生态系统

| 工具 | 说明 |
|------|------|
| **Solid Router** | 官方路由库 `@solidjs/router` |
| **SolidStart** | 全栈框架（类似 Next.js）`@solidjs/start` |
| **Solid Primitives** | 社区原语集合 `solid-primitives` |
| **Kobalte** | 无头 UI 组件库 `@kobalte/core` |
| **Playground** | 在线编辑器 playground.solidjs.com |

## 关键注意事项

1. **组件只运行一次**——Solid 的组件不会因状态变化而重新渲染
2. **Signal 是函数**——读取值必须调用 `signal()`，不是 `signal`
3. **JSX 中调用 signal**——`<div>{count()}</div>` 而非 `<div>{count}</div>`
4. **无需依赖数组**——`createEffect` 自动追踪依赖，告别 `useEffect` 的闭包陷阱
5. **Effect 中不设置 signal**——计算派生值用 `createMemo`
6. **Store 用于复杂对象**——嵌套状态使用 `createStore`，而非多个独立 signals
7. **用控制流组件**——`<Show>`、`<For>` 等比 JSX 的 `&&` 和 `.map()` 更高效
8. **浏览器支持**——最近 2 年的现代浏览器，支持 Node.js LTS / Deno / Cloudflare Workers

## 相关链接

- 官网：[solidjs.com](https://www.solidjs.com)
- GitHub：[solidjs/solid](https://github.com/solidjs/solid)
- 文档：[docs.solidjs.com](https://docs.solidjs.com)
- Playground：[playground.solidjs.com](https://playground.solidjs.com)

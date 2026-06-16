# 函数式基础深化

> 深入理解函数式编程的核心概念：一等公民、柯里化、组合、引用透明。

## 一等函数

函数在 JS 中是**一等公民**：
- 可作为变量存储
- 可作为参数传递
- 可作为返回值
- 可在运行时构造

```ts
// 函数作为值
const greet = (name: string) => `Hello, ${name}`;

// 函数作为参数
const map = <T, U>(fn: (x: T) => U, xs: T[]): U[] => xs.map(fn);

// 函数作为返回值
const createAdder = (n: number) => (x: number) => x + n;
```

**关键区别**：高阶函数 ≠ 函数是对象。高阶函数强调"操作函数"的能力，而非函数作为数据容器的性质。

## 柯里化（Currying）

将多参数函数转换为单参数的嵌套函数：

```ts
// 多参数版本
const add = (a: number, b: number) => a + b;

// 柯里化版本
const addCurried = (a: number) => (b: number) => a + b;

// 部分应用
const addFive = addCurried(5);
addFive(3); // 8
```

**为什么要柯里化？**

1. **复用**：通过部分应用，生成专用函数
2. **组合**：单参数函数天然可组合
3. **管道**：`pipe(f, g)(x) = g(f(x))` 要求函数单参数

```ts
// Ramda 的柯里化
const R = require('ramda');

const multiply = (a: number, b: number) => a * b;
const triple = R.multiply(3); // 等价于 multiply(3)(x)
triple(4); // 12
```

## 函数组合

### 基础组合

```ts
const compose = <T, U, V>(f: (x: U) => V, g: (x: T) => U) => (x: T): V => f(g(x));

// 字符串去空转大写
const trimAndUpper = compose((s: string) => s.toUpperCase(), (s: string) => s.trim());
trimAndUpper('  hello  '); // "HELLO"
```

### 管道（Pipe）

```ts
const pipe = <T>(...fns: Array<(x: any) => any>) => (x: T): any =>
  fns.reduce((acc, fn) => fn(acc), x);

// 数据流清晰：从左到右
const processData = pipe(
  (x: number) => x * 2,
  (x: number) => x + 1,
  (x: number) => String(x)
);

processData(3); // "7"
```

### 组合律

`(f ∘ g) ∘ h = f ∘ (g ∘ h)`

```ts
const f = (x: number) => x + 1;
const g = (x: number) => x * 2;
const h = (x: number) => x - 3;

// 等价
const left = compose(f, compose(g, h));
const right = compose(compose(f, g), h);

left(5) === right(5); // true
```

**为什么重要**：可重构、可推理、可测试。

## 引用透明性

表达式可用其求值结果替换，不影响程序行为。

```ts
// 引用透明
const double = (x: number) => x * 2;
const result = double(5) + double(5);
// 可替换为 const result = 10 + 10;

// 非引用透明
let count = 0;
const increment = () => ++count;
increment() + increment(); // 结果依赖执行顺序
```

**推论**：
- 纯函数必定引用透明
- 引用透明的代码易理解、易优化、易缓存

## 惰性求值

只在需要时才计算值。

```ts
// 原生 JS 不支持惰性，用函数模拟
const lazy = <T>(fn: () => T) => {
  let cached: T | undefined;
  return () => {
    if (cached === undefined) cached = fn();
    return cached;
  };
};

const expensiveComputation = lazy(() => {
  console.log('Computing...');
  return 42;
});

expensiveComputation(); // "Computing..."
expensiveComputation(); // 无输出，返回缓存
```

**应用场景**：
- 无限数据流处理
- 昂贵的初始化
- 按需加载

## Point-free 风格

不显式声明参数的函数写法。

```ts
// 普通
const getNames = (users: Array<{ name: string }>) => users.map(u => u.name);

// Point-free
const getNames = R.map(R.prop('name'));

// 组合天然 point-free
const process = pipe(
  R.filter(R.propEq('active', true)),
  R.map(R.prop('name')),
  R.join(', ')
);
```

**优点**：简洁、强调"数据流"而非"具体操作"

**缺点**：过度使用可读性差，需适度。

## 下一步

- [纯函数与副作用](./pure-functions) —— 副作用的识别与隔离
- [不可变数据结构](./immutability) —— 实战不可变数据操作
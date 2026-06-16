# 函数式编程思维

> **系列阅读指南** —— 转变思维是掌握函数式编程的第一步。

## 核心思维清单

### 转变思维

1. **多从结果着眼，少纠结具体的实现**

```ts
// ❌ 纠结循环过程
const result = [];
for (let i = 0; i < items.length; i++) {
  if (items[i].active) result.push(items[i].name);
}

// ✅ 关注结果（筛选 + 变换）
const result = items.filter(i => i.active).map(i => i.name);
```

2. **高阶函数消除了摩擦**

```ts
// ❌ 手动循环，易出错
const doubled = [];
for (const x of numbers) {
  doubled.push(x * 2);
}

// ✅ 高阶函数，声明式
const doubled = numbers.map(x => x * 2);
```

3. **不要增加无畏的摩擦**

```ts
// ❌ 过度抽象
const withLogging = fn => x => {
  console.log('Calling with', x);
  return fn(x);
};

const result = withLogging(R.toUpper)('hello');

// ✅ 直接声明
const result = pipe(console.log, R.toUpper)('hello');
```

4. **需要根据筛选条件来产生一个子集合的时候用 filter**

```ts
const activeUsers = users.filter(u => u.active);
const adults = users.filter(u => u.age >= 18);
```

5. **需要就地变换一个集合的时候，用 map**

```ts
const names = users.map(u => u.name);
const upperNames = names.map(R.toUpper);
```

6. **需要把集合分成一小块一小块来处理的时候用 reduce**

```ts
const byRole = users.reduce((acc, user) => {
  acc[user.role] = acc[user.role] || [];
  acc[user.role].push(user);
  return acc;
}, {});
```

### 权责让渡

7. **迭代让位于高阶函数**

```ts
// ❌ 手动迭代
const sum = arr => {
  let total = 0;
  for (const x of arr) total += x;
  return total;
};

// ✅ 高阶函数
const sum = arr => arr.reduce((acc, x) => acc + x, 0);
```

8. **理解掌握的抽象层次永远要比日常使用的抽象层次更深一层**

```ts
// 理解 map/filter/reduce 的实现原理
// 理解柯里化的本质
// 理解 Effect 系统的副作用隔离机制
```

9. **让语言去管理状态，抓住上下文，而非状态**

```ts
// ❌ 追踪状态变化
let count = 0;
const increment = () => count++;

// ✅ 上下文传递
const increment = (n: number) => n + 1;
const count = [0, 1, 2].map(increment); // [1, 2, 3]
```

10. **利用递归，把状态的管理责任推给运行时**

```ts
// ❌ 手动管理状态
const flatten = (arr: any[]): any[] => {
  const result = [];
  const process = (items) => {
    for (const item of items) {
      if (Array.isArray(item)) {
        process(item);
      } else {
        result.push(item);
      }
    }
  };
  process(arr);
  return result;
};

// ✅ 递归（运行时管理栈）
const flatten = (arr: any[]): any[] =>
  arr.reduce((acc, item) =>
    acc.concat(Array.isArray(item) ? flatten(item) : item),
    []
  );
```

### 用巧不用蛮

11. **确保所有的记忆函数：没有副作用，不依赖任何外部信息**

```ts
// ❌ 有副作用
let callCount = 0;
const factorial = (n: number): number => {
  callCount++;
  return n <= 1 ? 1 : n * factorial(n - 1);
};

// ✅ 纯函数
const factorial = (n: number): number =>
  n <= 1 ? 1 : n * factorial(n - 1);
```

12. **用语言设计者实现的机制效率更高**

```ts
// ❌ 手动优化
const unique = (arr: any[]) => {
  const result = [];
  for (const item of arr) {
    if (!result.includes(item)) result.push(item);
  }
  return result;
};

// ✅ 内置机制
const unique = (arr: any[]) => [...new Set(arr)];
```

### 演化的语言

13. **用少量的数据结构搭配大量的操作**

```ts
// 少量数据结构
// - 数组（List）
// - 对象（Map/Record）
// - 元组（Tuple）

// 大量操作
// - map/filter/reduce
// - compose/pipe
// - lens/optics
```

## 思维转变阶段

### 阶段 1：理解
- 理解纯函数 vs 副作用
- 理解不可变数据结构
- 理解函数组合

### 阶段 2：应用
- 在代码中使用 map/filter/reduce
- 使用 Ramda.js 等工具库
- 重构副作用代码

### 阶段 3：内化
- 自动识别函数式重构机会
- 设计函数式 API
- 构建 AI Agent 的函数式架构

### 阶段 4：超越
- 函数式 + AI 融合
- Prompt 作为函数
- Agent 状态迁移

## 常见误区

| 误区 | 真相 |
|---|---|
| 函数式 = 不可变 | 不可变是手段，可预测才是目标 |
| 函数式 = 无循环 | 有递归、迭代器 |
| 函数式 = 性能差 | Ramda/immer 优化下性能不差 |
| 函数式 = 学术派 | React/Redux/RxJS 都是函数式 |
| 函数式 = 只适合算法 | 也适合业务逻辑 |

## 阅读建议

- **零基础**：先读本篇，再按顺序阅读系列 1-10
- **有基础**：跳过 1-3，重点读 4-7（组合、Ramda、Effect）
- **AI 开发者**：直接读 10（AI 时代融合），再回溯基础

---

**下一篇：** [函数式基础深化](./functional-essentials)
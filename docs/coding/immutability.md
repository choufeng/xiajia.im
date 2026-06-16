# 不可变数据结构

> 不可变性是防止"状态突增"和"难以调试"的物理约束。

## 为什么需要不可变性？

### 1. 追踪状态变化

```ts
// 可变：追踪状态变化困难
let user = { name: 'Alice', age: 30 };
user.age = 31; // 谁改的？何时改的？
user.name = 'Bob'; // 又是谁？

// 不可变：状态显式传递
const user = { name: 'Alice', age: 30 };
const user31 = { ...user, age: 31 }; // 明确创建新状态
const user31Bob = { ...user31, name: 'Bob' };
```

### 2. 并发安全

```ts
// 可变：并发修改导致竞态
let counter = 0;
const increment = () => counter++;

// 两个线程同时执行 increment → counter 可能只增加 1

// 不可变：每次操作创建新值，无共享可变状态
const increment = (n: number) => n + 1;

const counter1 = increment(0);
const counter2 = increment(0); // 独立，无竞态
```

### 3. 撤销/重做（时间旅行）

```ts
// 可变：需要额外维护历史
const history = [];
let state = { x: 0 };
history.push(state);
state.x = 1;
history.push(state);

// 不可变：历史自然存在
const state0 = { x: 0 };
const state1 = { ...state0, x: 1 };
const state2 = { ...state1, x: 2 };

const history = [state0, state1, state2];
```

### 4. React 性能优化

```ts
// 不可变 → 简单引用比较即可判断变化
const User = memo(({ user }) => (
  <div>{user.name}</div>
));

// 可变 → 需深度比较（昂贵）
const User = memo(({ user }) => (
  <div>{user.name}</div>
), deepEqual); // 失去性能优势
```

## 原生 JS 的浅不可变

### Object.freeze

```ts
const user = Object.freeze({ name: 'Alice', age: 30 });
user.age = 31; // 严格模式报错，非严格模式静默失败

// 但只冻结一层
const user = Object.freeze({
  name: 'Alice',
  address: { city: 'Tokyo' }
});

user.address.city = 'Kyoto'; // 仍然可变！
```

### 展开运算符 {...}

```ts
const user = { name: 'Alice', age: 30 };
const updated = { ...user, age: 31 }; // 新对象

// 但嵌套对象仍是引用
const user = {
  name: 'Alice',
  address: { city: 'Tokyo' }
};

const updated = { ...user, age: 31 };
updated.address.city = 'Kyoto'; // 影响原对象！
```

### 常用模式

```ts
// 更新嵌套对象
const user = {
  name: 'Alice',
  address: { city: 'Tokyo', country: 'Japan' }
};

const updated = {
  ...user,
  address: { ...user.address, city: 'Kyoto' }
};

// 更新数组元素
const items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
const updated = items.map(item =>
  item.id === 2 ? { ...item, name: 'B Updated' } : item
);

// 添加/删除数组元素
const list = [1, 2, 3];
const added = [...list, 4];
const removed = list.filter(x => x !== 2);
```

## 深度不可变工具

### immer

```ts
import { produce } from 'immer';

const user = {
  name: 'Alice',
  address: { city: 'Tokyo' }
};

const updated = produce(user, draft => {
  draft.address.city = 'Kyoto'; // 像可变语法
});

// user 未改变，updated 是新对象
```

### Ramda

```ts
import * as R from 'ramda';

const user = {
  name: 'Alice',
  address: { city: 'Tokyo', country: 'Japan' }
};

const updated = R.assocPath(['address', 'city'], 'Kyoto', user);
```

### 自定义 deepImmutable

```ts
const deepImmutable = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return Object.freeze(obj.map(deepImmutable)) as any;
  }

  return Object.freeze(
    Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, deepImmutable(v)])
    )
  );
};

const user = deepImmutable({
  name: 'Alice',
  address: { city: 'Tokyo' }
});

user.address.city = 'Kyoto'; // 报错
```

## 不可变数据结构库

### Immutable.js

```ts
import { Map, List } from 'immutable';

const map1 = Map({ a: 1, b: 2 });
const map2 = map1.set('b', 3); // 新对象
map1.get('b'); // 2

const list1 = List([1, 2, 3]);
const list2 = list1.push(4); // 新对象
list1.size; // 3
```

**优点**：
- 深度不可变
- 结构共享（性能优化）
- 丰富的 API

**缺点**：
- 与原生类型不互通
- 学习成本

### Immer（推荐）

```ts
// "可变式"语法 + 不可变结果
const state = {
  users: [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ]
};

const nextState = produce(state, draft => {
  draft.users.push({ id: 3, name: 'Charlie' });
  draft.users[0].name = 'Alice Updated';
});
```

## 函数式 Iron Law 应用

> 可测试性 → 无状态或显式状态传递

```ts
// ❌ 违反：隐式可变状态
let cache = new Map();
const fetchWithCache = async (url: string) => {
  if (cache.has(url)) return cache.get(url);
  const data = await fetch(url);
  cache.set(url, data); // 副作用
  return data;
};

// ✅ 遵守：显式状态传递
const fetchWithCache = (
  cache: Map<string, any>,
  url: string
): [Promise<any>, Map<string, any>] => {
  if (cache.has(url)) return [Promise.resolve(cache.get(url)), cache];
  const dataPromise = fetch(url).then(r => r.json());
  const newCache = new Map(cache).set(url, dataPromise);
  return [dataPromise, newCache];
};
```

## 性能考虑

### 结构共享

```ts
// 大对象部分更新时，只复制修改路径
const bigObj = { /* 10MB 数据 */ };
const updated = { ...bigObj, tiny: 'new' };

// 理论上应该高效，但 JS 展开运算符会浅复制整个对象
// 实际性能取决于 JS 引擎优化

// 使用 immer 的结构共享
import { produce } from 'immer';
const updated = produce(bigObj, draft => {
  draft.tiny = 'new';
}); // 只修改部分，共享其余
```

### 基准测试

```ts
// 小对象：展开足够快
const small = { a: 1, b: 2 };
console.time('spread');
for (let i = 0; i < 100000; i++) {
  const copy = { ...small, b: 3 };
}
console.timeEnd('spread'); // ~10ms

// 大对象：immer 更优
const big = { /* 大对象 */ };
console.time('immer');
for (let i = 0; i < 1000; i++) {
  const copy = produce(big, draft => {
    draft.x = i;
  });
}
console.timeEnd('immer'); // ~20ms
```

## 下一步

- [高阶函数与组合](./higher-order) —— 函数组合的基础工具
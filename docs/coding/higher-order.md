# 高阶函数与组合

> 函数的"乐高积木"范式 —— 小函数通过组合构建复杂系统。

## 高阶函数定义

接受或返回函数的函数。

```ts
// 接受函数
const map = <T, U>(fn: (x: T) => U, xs: T[]): U[] => xs.map(fn);

// 返回函数
const add = (n: number) => (x: number) => x + n;

// 同时接受和返回
const compose = <T, U, V>(f: (x: U) => V, g: (x: T) => U) =>
  (x: T): V => f(g(x));
```

## 常用高阶函数

### map：变换

```ts
const numbers = [1, 2, 3, 4];

// 乘以 2
const doubled = numbers.map(x => x * 2); // [2, 4, 6, 8]

// 提取属性
const users = [{ name: 'Alice' }, { name: 'Bob' }];
const names = users.map(u => u.name); // ['Alice', 'Bob']
```

### filter：筛选

```ts
const numbers = [1, 2, 3, 4, 5];

// 偶数
const evens = numbers.filter(x => x % 2 === 0); // [2, 4]

// 活跃用户
const activeUsers = users.filter(u => u.active);
```

### reduce：归约

```ts
const numbers = [1, 2, 3, 4];

// 求和
const sum = numbers.reduce((acc, x) => acc + x, 0); // 10

// 分组
const users = [
  { name: 'Alice', role: 'dev' },
  { name: 'Bob', role: 'dev' },
  { name: 'Charlie', role: 'designer' }
];

const byRole = users.reduce((acc, user) => {
  acc[user.role] = acc[user.role] || [];
  acc[user.role].push(user.name);
  return acc;
}, {} as Record<string, string[]>);

// { dev: ['Alice', 'Bob'], designer: ['Charlie'] }
```

### find：查找

```ts
const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];

const user2 = users.find(u => u.id === 2); // { id: 2, name: 'Bob' }
```

### some/every：断言

```ts
const numbers = [1, 2, 3, 4];

const hasEven = numbers.some(x => x % 2 === 0); // true
const allPositive = numbers.every(x => x > 0); // true
```

## 函数组合

### 基础 compose

```ts
const compose = <T>(...fns: Array<(x: any) => any>) =>
  (x: T): any => fns.reduceRight((acc, fn) => fn(acc), x);

const trim = (s: string) => s.trim();
const upper = (s: string) => s.toUpperCase();
const exclaim = (s: string) => `${s}!`;

const shout = compose(exclaim, upper, trim);
shout('  hello  '); // "HELLO!"
```

### pipe（数据流向更清晰）

```ts
const pipe = <T>(...fns: Array<(x: any) => any>) =>
  (x: T): any => fns.reduce((acc, fn) => fn(acc), x);

const shout = pipe(trim, upper, exclaim);
shout('  hello  '); // "HELLO!"

// 优势：从左到右，符合阅读顺序
```

### 组合律

```ts
const f = (x: number) => x + 1;
const g = (x: number) => x * 2;
const h = (x: number) => x - 3;

// (f ∘ g) ∘ h = f ∘ (g ∘ h)
const left = compose(f, compose(g, h));
const right = compose(compose(f, g), h);

left(5) === right(5); // true
```

### 恒等律

```ts
const identity = <T>(x: T): T => x;

// identity ∘ f = f
compose(identity, f)(5) === f(5); // true

// f ∘ identity = f
compose(f, identity)(5) === f(5); // true
```

## 组合实战

### 数据管道

```ts
type User = {
  name: string;
  age: number;
  active: boolean;
};

const filterActive = (users: User[]) =>
  users.filter(u => u.active);

const mapNames = (users: User[]) =>
  users.map(u => u.name);

const sortNames = (names: string[]) =>
  names.sort((a, b) => a.localeCompare(b));

const processUsers = pipe(
  filterActive,
  mapNames,
  sortNames
);

const users = [
  { name: 'Bob', age: 30, active: true },
  { name: 'Alice', age: 25, active: true },
  { name: 'Charlie', age: 35, active: false }
];

processUsers(users); // ['Alice', 'Bob']
```

### 验证链

```ts
type ValidationResult<T> =
  | { success: true; value: T }
  | { success: false; error: string };

const validateEmail = (email: string): ValidationResult<string> => {
  return email.includes('@')
    ? { success: true, value: email }
    : { success: false, error: 'Invalid email' };
};

const validateAge = (age: number): ValidationResult<number> => {
  return age >= 18
    ? { success: true, value: age }
    : { success: false, error: 'Must be 18+' };
};

const combine = <T, U, R>(
  fn: (a: T, b: U) => R
) => (a: ValidationResult<T>, b: ValidationResult<U>): ValidationResult<R> => {
  if (!a.success) return a;
  if (!b.success) return b;
  return { success: true, value: fn(a.value, b.value) };
};

const validateUser = pipe(
  ({ email, age }: { email: string; age: number }) =>
    [validateEmail(email), validateAge(age)] as const,
  ([emailResult, ageResult]) =>
    combine((e, a) => ({ email: e, age: a }))(emailResult, ageResult)
);

validateUser({ email: 'test@example.com', age: 20 });
// { success: true, value: { email: 'test@example.com', age: 20 } }
```

## 柯里化与部分应用

### 手动柯里化

```ts
const curry = <T extends (...args: any[]) => any>(fn: T) => {
  return (arg: Parameters<T>[0]) => {
    if (typeof fn !== 'function' || fn.length <= 1) {
      return fn(arg);
    }
    return curry(fn.bind(null, arg) as any) as any;
  };
};

const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add);

curriedAdd(1)(2)(3); // 6
curriedAdd(1, 2)(3); // 6
```

### Ramda 自动柯里化

```ts
import * as R from 'ramda';

const map = R.map;
const multiply = R.multiply;
const filter = R.filter;

const tripleAll = map(multiply(3));
const evens = filter(R.modulo(R.__, 2));

tripleAll([1, 2, 3]); // [3, 6, 9]
evens([1, 2, 3, 4]); // [2, 4]
```

## 组合 vs 继承

```ts
// 继承：类层级深、难以复用
class Animal { name: string; constructor(name) { this.name = name; } }
class Dog extends Animal { bark() { return `${this.name} barks`; } }
class Bird extends Animal { fly() { return `${this.name} flies`; } }

// 组合：小函数自由组合
const createNamed = (name: string) => ({ name });
const withBark = (animal: any) => ({
  ...animal,
  bark: () => `${animal.name} barks`
});
const withFly = (animal: any) => ({
  ...animal,
  fly: () => `${animal.name} flies`
});

const dog = pipe(createNamed, withBark)('Buddy');
const bird = pipe(createNamed, withFly)('Tweety');
```

## 下一步

- [Ramda.js 实战](./ramda-practical) —— 用函数式库解决实际问题
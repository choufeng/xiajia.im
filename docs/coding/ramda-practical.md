# Ramda.js 实战

> 工具库函数式编程：用 Ramda 提升 50% 代码简洁度。

## 为什么用 Ramda？

- **自动柯里化**：所有函数天然支持部分应用
- **数据优先**：数据放最后，便于组合
- **不可变**：所有操作返回新数据
- **TypeScript 友好**：完整类型定义

## 安装

```bash
npm install ramda @types/ramda
```

## 核心操作

### 对象操作

```ts
import * as R from 'ramda';

const user = { name: 'Alice', age: 30, active: true };

// 获取属性
R.prop('name', user); // 'Alice'
R.propOr('Unknown', 'email', user); // 'Unknown'

// 设置/更新属性
const updated = R.assoc('age', 31, user); // { name: 'Alice', age: 31, active: true }

// 删除属性
const withoutAge = R.dissoc('age', user); // { name: 'Alice', active: true }

// 挑选/排除属性
const picked = R.pick(['name', 'age'], user);
// { name: 'Alice', age: 30 }

const omitted = R.omit(['active'], user);
// { name: 'Alice', age: 30 }
```

### 数组操作

```ts
const numbers = [1, 2, 3, 4, 5];

// 基础
R.filter(R.gt(R.__, 2), numbers); // [3, 4, 5]
R.map(R.multiply(2), numbers); // [2, 4, 6, 8, 10]
R.reduce(R.add, 0, numbers); // 15

// 实用
R.uniq([1, 2, 2, 3]); // [1, 2, 3]
R.difference([1, 2, 3], [2, 4]); // [1, 3]
R.intersection([1, 2, 3], [2, 3, 4]); // [2, 3]
R.sort((a, b) => a - b, [3, 1, 2]); // [1, 2, 3]
R.groupBy(R.prop('role'), [
  { name: 'Alice', role: 'dev' },
  { name: 'Bob', role: 'designer' }
]);
// { dev: [{ name: 'Alice', role: 'dev' }], designer: [{ name: 'Bob', role: 'designer' }] }
```

### 函数工具

```ts
// 比较函数
R.gt(2, 1); // true
R.lt(1, 2); // true
R.eq(1, 1); // true
R.modulo(R.__, 2)(4); // 0

// 逻辑
R.all(R.gt(R.__, 0), [1, 2, 3]); // true
R.any(R.equals(2), [1, 2, 3]); // true
R.none(R.equals(4), [1, 2, 3]); // true

// 补足
const isEven = n => n % 2 === 0;
const isOdd = R.complement(isEven);
isOdd(3); // true
```

### 组合

```ts
// compose（从右到左）
const shout = R.compose(R.toUpper, R.trim);
shout('  hello  '); // 'HELLO'

// pipe（从左到右）
const process = R.pipe(R.trim, R.toLower, R.replace(/ /g, '-'));
process('Hello World'); // 'hello-world'

// applySpec：并行计算多个属性
const getUser = (id: number) => ({ id, name: `User ${id}`, email: `user${id}@example.com` });

const enrich = R.applySpec({
  id: R.prop('id'),
  displayName: R.pipe(R.prop('name'), R.toUpper),
  domain: R.pipe(R.prop('email'), R.split('@'), R.nth(1))
});

enrich(getUser(1));
// { id: 1, displayName: 'USER 1', domain: 'example.com' }
```

## 实战案例

### 1. 表单验证

```ts
type ValidationResult = { valid: boolean; errors: string[] };

const validateEmail = (email: string): boolean =>
  email.includes('@');

const validateMinLength = (min: number) => (s: string): boolean =>
  s.length >= min;

const combineValidations = (...validators: Array<(s: string) => boolean>) =>
  (s: string): ValidationResult => {
    const errors = validators
      .map(v => v(s))
      .map((valid, i) => !valid ? `Validation ${i + 1} failed` : null)
      .filter(Boolean) as string[];
    return { valid: errors.length === 0, errors };
  };

const validateName = combineValidations(
  validateMinLength(2),
  R.test(/^[A-Za-z]+$/) // 只含字母
);

validateName('Alice'); // { valid: true, errors: [] }
validateName('A1'); // { valid: false, errors: ['Validation 2 failed'] }
```

### 2. 数据转换

```ts
type RawUser = {
  id: number;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string; // ISO string
};

type User = {
  id: number;
  fullName: string;
  active: boolean;
  joinedAt: Date;
};

const toUser = (raw: RawUser): User => ({
  id: raw.id,
  fullName: R.join(' ', [raw.firstName, raw.lastName]),
  active: raw.isActive,
  joinedAt: new Date(raw.createdAt)
});

const processUsers = R.map(toUser);

const rawUsers = [
  { id: 1, firstName: 'Alice', lastName: 'Smith', isActive: true, createdAt: '2024-01-01' },
  { id: 2, firstName: 'Bob', lastName: 'Jones', isActive: false, createdAt: '2024-02-01' }
];

processUsers(rawUsers);
// [
//   { id: 1, fullName: 'Alice Smith', active: true, joinedAt: 2024-01-01T00:00:00.000Z },
//   { id: 2, fullName: 'Bob Jones', active: false, joinedAt: 2024-02-01T00:00:00.000Z }
// ]
```

### 3. 搜索过滤

```ts
type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
};

const searchProducts = (query: string, category?: string, maxPrice?: number) =>
  (products: Product[]): Product[] =>
    R.pipe(
      R.filter(R.prop('inStock')),
      category ? R.filter(R.propEq('category', category)) : R.identity,
      maxPrice ? R.filter(p => p.price <= maxPrice) : R.identity,
      query ? R.filter(p => R.includes(R.toLower(query), R.toLower(p.name))) : R.identity
    )(products);

const products = [
  { id: 1, name: 'Laptop', category: 'Electronics', price: 1000, inStock: true },
  { id: 2, name: 'Book', category: 'Books', price: 20, inStock: true },
  { id: 3, name: 'Phone', category: 'Electronics', price: 500, inStock: false }
];

searchProducts('phone', 'Electronics', 600)(products); // []
searchProducts('', 'Electronics', 600)(products); // [{ id: 1, name: 'Laptop', ... }]
```

### 4. React 状态更新

```ts
type State = {
  users: User[];
  loading: boolean;
  error: string | null;
};

const updateUsers = R.assoc('users');
const setLoading = R.assoc('loading');
const setError = R.assoc('error');

const handleFetchSuccess = (users: User[]) => (state: State) =>
  R.pipe(
    setLoading(false),
    setError(null),
    updateUsers(users)
  )(state);

const handleFetchError = (error: string) => (state: State) =>
  R.pipe(
    setLoading(false),
    setError(error)
  )(state);

// React reducer
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'FETCH_SUCCESS':
      return handleFetchSuccess(action.users)(state);
    case 'FETCH_ERROR':
      return handleFetchError(action.error)(state);
    default:
      return state;
  }
};
```

### 5. API 数据流

```ts
type ApiResponse = {
  data: { id: number; attributes: any }[];
  meta: { total: number };
};

const extractData = R.prop('data');
const extractAttributes = R.map(R.prop('attributes'));
const extractMeta = R.prop('meta');
const extractTotal = R.prop('total');

const normalizeResponse = R.applySpec({
  items: R.pipe(extractData, extractAttributes),
  total: R.pipe(extractMeta, extractTotal)
});

const response = {
  data: [
    { id: 1, attributes: { name: 'Item 1' } },
    { id: 2, attributes: { name: 'Item 2' } }
  ],
  meta: { total: 2 }
};

normalizeResponse(response);
// { items: [{ name: 'Item 1' }, { name: 'Item 2' }], total: 2 }
```

## 性能优化

### 避免重复计算

```ts
const expensiveComputation = (n: number) => {
  // 假设计算昂贵
  return n * 2;
};

// ❌ 每次都计算
const process = R.map(R.pipe(expensiveComputation, R.add(1)));

// ✅ 缓存结果
const memoizedExpensive = R.memoize(expensiveComputation);
const processOptimized = R.map(R.pipe(memoizedExpensive, R.add(1)));
```

### 使用 R.evolve

```ts
const user = { name: 'Alice', age: 30, address: { city: 'Tokyo' } };

// 更新多个属性
const updated = R.evolve({
  age: R.inc,
  address: R.evolve({ city: R.toLower })
})(user);

// { name: 'Alice', age: 31, address: { city: 'tokyo' } }
```

## 下一步

- [Effect 系统](./effect-system) —— 副作用的类型化处理
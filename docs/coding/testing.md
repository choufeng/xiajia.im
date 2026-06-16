# 函数式测试

> 纯函数测试 = 输入断言，无需 mock/setup/teardown。

## 纯函数测试哲学

```ts
// 纯函数：测试即文档
const add = (a: number, b: number) => a + b;

test('add sums two numbers', () => {
  expect(add(2, 3)).toBe(5);
  expect(add(-1, 1)).toBe(0);
  expect(add(0, 0)).toBe(0);
});
```

**vs 副作用测试**：

```ts
// 副作用测试：需 mock、setup、teardown
const processOrder = async (order: Order) => {
  const tax = calculateTax(order);
  const taxed = { ...order, tax };
  await db.save(taxed);
  return taxed;
};

test('processOrder saves with tax', async () => {
  // mock db
  const mockSave = jest.fn().mockResolvedValue({});
  (db as any).save = mockSave;

  // setup
  const order = { id: 1, total: 100 };

  // execute
  const result = await processOrder(order);

  // assert
  expect(mockSave).toHaveBeenCalled();
  expect(result.tax).toBe(10);

  // teardown (handled by jest.restoreAllMocks)
});
```

## 测试分类

### 1. 单元测试（纯函数）

```ts
import * as R from 'ramda';

const calculateTotal = (items: Array<{ price: number; qty: number }>) =>
  R.pipe(
    R.map(R.multiply(R.__, R.__)), // 需要 zip
    R.sum
  )(items.map(i => [i.price, i.qty]));

// 简化版本
const calculateTotal = (items: Array<{ price: number; qty: number }>) =>
  items.reduce((acc, item) => acc + item.price * item.qty, 0);

test('calculateTotal sums item totals', () => {
  expect(calculateTotal([
    { price: 10, qty: 2 },
    { price: 5, qty: 3 }
  ])).toBe(35);

  expect(calculateTotal([])).toBe(0);

  expect(calculateTotal([
    { price: 0, qty: 5 }
  ])).toBe(0);
});
```

### 2. 集成测试（Effect）

```ts
type Effect<A> = { _tag: 'Effect'; perform: () => Promise<A> };

const testEffect = async <A>(
  eff: Effect<A>,
  mock: {
    perform: () => Promise<A>;
    expect: (result: A) => void;
  }
) => {
  const result = await eff.perform();
  mock.expect(result);
};

const fetchUser = (id: number): Effect<User> =>
  effect(async () => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  });

test('fetchUser returns user', async () => {
  await testEffect(fetchUser(1), {
    perform: async () => ({ id: 1, name: 'Alice' }),
    expect: (user) => {
      expect(user.name).toBe('Alice');
    }
  });
});
```

### 3. Reducer 测试（状态迁移）

```ts
type CounterState = { count: number };
type CounterAction = { type: 'INCREMENT' } | { type: 'DECREMENT' };

const counterReducer = (
  state: CounterState,
  action: CounterAction
): CounterState => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    default:
      return state;
  }
};

test('counterReducer updates count', () => {
  const state = { count: 0 };

  expect(counterReducer(state, { type: 'INCREMENT' }))
    .toEqual({ count: 1 });

  expect(counterReducer(state, { type: 'DECREMENT' }))
    .toEqual({ count: -1 });

  expect(counterReducer({ count: 5 }, { type: 'DECREMENT' }))
    .toEqual({ count: 4 });
});
```

## 属性测试（Property-based Testing）

```ts
import * as fc from 'fast-check';

// 定理：add 是可交换的
test('add is commutative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => {
      return add(a, b) === add(b, a);
    })
  );
});

// 定理：add 有零元
test('add has zero element', () => {
  fc.assert(
    fc.property(fc.integer(), (n) => {
      return add(n, 0) === n && add(0, n) === n;
    })
  );
});

// 定理：add 是可结合的
test('add is associative', () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
      return add(add(a, b), c) === add(a, add(b, c));
    })
  );
});
```

## Golden Master Testing

```ts
// 保存"正确"输出作为参考
const goldenMaster = (input: string): string => {
  // 旧实现，视为正确
  return input.toUpperCase();
};

// 新实现
const newImplementation = (input: string): string => {
  return input.toUpperCase();
};

test('newImplementation matches golden master', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      return newImplementation(input) === goldenMaster(input);
    })
  );
});
```

## 测试覆盖率

### 分支覆盖率

```ts
const parseStatus = (code: number): 'success' | 'error' | 'unknown' => {
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400) return 'error';
  return 'unknown';
};

test('parseStatus handles all cases', () => {
  expect(parseStatus(200)).toBe('success');
  expect(parseStatus(299)).toBe('success');
  expect(parseStatus(400)).toBe('error');
  expect(parseStatus(500)).toBe('error');
  expect(parseStatus(100)).toBe('unknown');
  expect(parseStatus(300)).toBe('unknown');
});
```

### Edge Cases

```ts
const divide = (a: number, b: number): number | null => {
  if (b === 0) return null;
  return a / b;
};

test('divide handles edge cases', () => {
  expect(divide(10, 2)).toBe(5);
  expect(divide(-10, 2)).toBe(-5);
  expect(divide(10, -2)).toBe(-5);
  expect(divide(0, 5)).toBe(0);
  expect(divide(0, -1)).toBe(0);
  expect(divide(Infinity, 1)).toBe(Infinity);
  expect(divide(10, 0)).toBeNull();
  expect(divide(NaN, 1)).toBeNaN();
});
```

## 快照测试

```ts
const formatUser = (user: User): string => {
  return `Name: ${user.name}, Email: ${user.email}`;
};

test('formatUser snapshot', () => {
  const user = { name: 'Alice', email: 'alice@example.com' };
  expect(formatUser(user)).toMatchSnapshot();
});

// 后续修改时， Jest 会对比快照
// 修改快照：`jest -u` 或 `expect(formatUser(user)).toMatchInlineSnapshot()`
```

## 测试工具

### Vitest

```ts
import { describe, it, expect } from 'vitest';

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

### fast-check

```ts
import * as fc from 'fast-check';

it('reverse(reverse(array)) === array', () => {
  fc.assert(
    fc.property(fc.array(fc.anything()), (arr) => {
      return R.reverse(R.reverse(arr)).toEqual(arr);
    })
  );
});
```

## 下一步

- [TypeScript 类型系统](./fp-in-typescript) —— 用类型强制函数式约束
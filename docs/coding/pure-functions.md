# 纯函数与副作用

> 副作用是程序的"必要之恶"，但需要识别、隔离、可控。

## 纯函数定义

给定相同输入，永远返回相同输出，且不依赖、不改变外部状态。

```ts
// 纯函数
const add = (a: number, b: number) => a + b;

// 非纯函数
let count = 0;
const increment = () => ++count; // 依赖外部状态

// 非纯函数
const randomId = () => Math.random(); // 不确定输出
```

## 纯函数的好处

### 1. 可测试性

```ts
// 纯函数：无需 mock，断言即可
const sum = (a: number, b: number) => a + b;
assert(sum(2, 3) === 5);

// 非纯函数：需 mock 依赖
const getUserName = (id: number) => fetch(`/api/users/${id}`);
// 测试需 mock fetch
```

### 2. 可缓存性

```ts
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  }) as T;
};

const expensivePure = memoize((n: number) => {
  // 假设计算昂贵
  return n * 2;
});
```

### 3. 并发安全

```ts
// 纯函数：无共享状态，可并发执行
const processItems = (items: number[]) => {
  return items.map(item => processItem(item)); // processItem 纯函数
};

// 非纯函数：需锁、队列
const processItemsUnsafe = (items: number[]) => {
  return items.map(item => {
    globalCounter++; // 并发竞态
    return item * 2;
  });
};
```

## 副作用的分类

### 常见副作用

| 类型 | 示例 | 危险性 |
|---|---|---|
| I/O | 读写文件、网络请求 | 高（不可预测） |
| 状态突变 | 修改全局变量、对象属性 | 高（破坏引用透明） |
| 异常 | throw、Error | 中（影响控制流） |
| 时间 | setTimeout、Date.now() | 中（不确定输出） |
| DOM 操作 | element.innerText = 'x' | 高（外部依赖） |

### 副作用并非"邪恶"

```ts
// 业务逻辑：纯函数
const calculateTax = (price: number, rate: number) => price * rate;

// 副作用：保存到数据库（必须存在）
const saveOrder = (order: Order) => db.orders.insert(order);

// 组合：业务纯 + I/O 隔离
const processOrder = (raw: RawOrder) => {
  const order = validate(raw); // 纯
  const taxed = applyTax(order); // 纯
  return saveOrder(taxed); // 副作用
};
```

## 副作用隔离模式

### 1. 副作用放最后

```ts
// ❌ 副副作用穿插
const processUser = (user: User) => {
  log('Processing...'); // 副作用
  const validated = validate(user); // 纯
  emailUser(validated); // 副作用
  const enriched = enrich(validated); // 纯
  saveUser(enriched); // 副作用
};

// ✅ 副作用最后
const processUser = (user: User) => {
  const result = pipe(
    validate,
    enrich,
    saveUser
  )(user);
  log('Processing complete'); // 副作用最后
  return result;
};
```

### 2. 依赖注入

```ts
// ❌ 硬编码依赖
const sendEmail = (to: string, body: string) => {
  smtp.send(to, body); // 硬编码 smtp
};

// ✅ 注入依赖
const sendEmail = (send: (to: string, body: string) => void) =>
  (to: string, body: string) => send(to, body);

// 测试时注入 mock
const sendEmailMock = jest.fn();
const mockSend = sendEmail(sendEmailMock);
mockSend('test@example.com', 'hi');
expect(sendEmailMock).toHaveBeenCalled();
```

### 3. Effect 类型（预告）

```ts
// 将副作用包装为值，推迟执行
type Effect<A> = {
  _tag: 'Effect';
  perform: () => Promise<A>;
};

const log = (msg: string): Effect<void> => ({
  _tag: 'Effect',
  perform: () => {
    console.log(msg);
    return Promise.resolve();
  }
});

// 纯函数描述副作用
const process = (data: string) => {
  return pipe(
    validate(data),
    format,
    (formatted) => [log(`Processed: ${formatted}`), formatted] as const
  );
};

// 执行层
const effects = process('data');
effects[0].perform(); // 延迟到此处执行
```

详细见 [Effect 系统](./effect-system)。

## 函数式 Iron Law 应用

> 可验证性 → Side Effect 分离

```ts
// ❌ 违反 Iron Law：副作用未标记
const processRequest = async (req: Request) => {
  const data = await req.json(); // I/O
  const result = calculate(data); // 纯
  await db.save(result); // I/O
  return result;
};

// ✅ 遵守 Iron Law：标记 side-effect
const processRequest = async (req: Request): Promise<Result> => {
  // --- side-effect start ---
  const data = await req.json();
  // --- side-effect end ---

  const result = calculate(data); // 纯

  // --- side-effect start ---
  await db.save(result);
  // --- side-effect end ---

  return result;
};
```

## 副作用检测清单

- [ ] 函数是否依赖全局状态？
- [ ] 函数是否修改参数对象？
- [ ] 函数是否抛出异常（非可预测）？
- [ ] 函数是否执行 I/O？
- [ ] 相同输入是否总是产生相同输出？

## 下一步

- [不可变数据结构](./immutability) —— 避免状态突变的实用模式
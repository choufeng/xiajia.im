# Effect 系统

> 将副作用变为纯值，实现"可组合的副作用"。

## 问题的本质

```ts
// 纯函数：给定输入，返回输出
const add = (a: number, b: number) => a + b;

// 副作用：需要时才执行
const log = (msg: string) => console.log(msg);

// 混合：难以测试、难以组合
const process = (data: string) => {
  log('Processing...'); // 副作用
  const result = data.toUpperCase(); // 纯
  log(`Result: ${result}`); // 副作用
  return result;
};
```

**Effect 系统的解决方案**：将副作用包装为值，推迟执行。

## Effect 类型基础

```ts
type Effect<A> = {
  _tag: 'Effect';
  perform: () => Promise<A>;
};

// 创建 Effect
const effect = <A>(fn: () => Promise<A>): Effect<A> => ({
  _tag: 'Effect',
  perform: fn
});

// 执行 Effect
const runEffect = async <A>(eff: Effect<A>): Promise<A> => eff.perform();

// 例子
const logEffect = (msg: string): Effect<void> =>
  effect(async () => {
    console.log(msg);
  });

const fetchEffect = (url: string): Effect<string> =>
  effect(async () => {
    const res = await fetch(url);
    return res.text();
  });
```

## Effect 组合

### map：变换 Effect 的结果

```ts
const map = <A, B>(fn: (a: A) => B, eff: Effect<A>): Effect<B> =>
  effect(async () => {
    const a = await eff.perform();
    return fn(a);
  });

// 使用
const upperLog = (msg: string) => map(R.toUpper, logEffect(msg));
runEffect(upperLog('hello')); // "HELLO"
```

### flatMap：链式 Effect

```ts
const flatMap = <A, B>(fn: (a: A) => Effect<B>, eff: Effect<A>): Effect<B> =>
  effect(async () => {
    const a = await eff.perform();
    return (await fn(a)).perform();
  });

// 使用
const fetchAndLog = (url: string) =>
  flatMap(logEffect, fetchEffect(url));

runEffect(fetchAndLog('https://example.com'));
// 执行 fetch，然后 log 结果
```

### pipe：Effect 管道

```ts
const pipeEffect = <T>(...effects: Array<(x: any) => Effect<any>>) =>
  (x: T): Effect<any> =>
    effects.reduce(
      (accEffect, fn) => flatMap(fn, accEffect),
      effect(() => Promise.resolve(x))
    );

// 使用
const processData = (data: string) =>
  pipeEffect(
    (s: string) => map(R.toUpper, effect(() => Promise.resolve(s))),
    (s: string) => map(s => s + '!', effect(() => Promise.resolve(s))),
    (s: string) => logEffect(s)
  )(data);

runEffect(processData('hello')); // "HELLO!"
```

## 实战：Effect 优先级队列

```ts
type Priority = 'high' | 'medium' | 'low';

type Task<A> = {
  effect: Effect<A>;
  priority: Priority;
};

const taskQueue: Task<any>[] = [];

const addTask = <A>(priority: Priority, eff: Effect<A>): void => {
  taskQueue.push({ effect: eff, priority });
};

const processQueue = async (): Promise<void> => {
  const priorityOrder: Priority[] = ['high', 'medium', 'low'];
  const sorted = R.sort(
    (a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
    taskQueue
  );

  for (const task of sorted) {
    await runEffect(task.effect);
  }
  taskQueue.length = 0;
};

// 使用
addTask('medium', logEffect('Medium task'));
addTask('high', logEffect('High task'));
addTask('low', logEffect('Low task'));

await processQueue();
// High task
// Medium task
// Low task
```

## 函数式 Iron Law 应用

> 可复现性 → Effect 延迟执行，控制副作用时机

```ts
// ❌ 违反：副作用立即执行
const processRequest = async (req: Request) => {
  const data = await req.json(); // 副作用执行
  const result = calculate(data);
  await db.save(result); // 副作用执行
  return result;
};

// ✅ 遵守：副作用包装为 Effect
const processRequest = (req: Request): Effect<Result> =>
  flatMap(
    (data) => flatMap(
      (result) => effect(() => db.save(result)),
      effect(() => Promise.resolve(calculate(data)))
    ),
    effect(() => req.json())
  );

// 执行层控制副作用
const result = await runEffect(processRequest(req));
```

## Effect 系统 vs Promise

| 特性 | Promise | Effect |
|---|---|---|
| 延迟执行 | ❌ 立即创建 | ✅ 延迟到 runEffect |
| 可组合 | ✅ then/chain | ✅ flatMap |
| 类型安全 | ✅ | ✅ |
| 可取消 | ❌ | ✅（需实现） |
| 可重试 | ⚠️ 手动实现 | ✅（包装） |
| 可追踪 | ❌ | ✅（Effect 可调试） |

## 实用 Effect

### retryEffect

```ts
const retryEffect = <A>(
  eff: Effect<A>,
  maxRetries: number = 3
): Effect<A> =>
  effect(async () => {
    let lastError: Error | undefined;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await eff.perform();
      } catch (error) {
        lastError = error as Error;
        await new Promise(resolve => setTimeout(resolve, 1000 * i));
      }
    }
    throw lastError;
  });
```

### timeoutEffect

```ts
const timeoutEffect = <A>(
  eff: Effect<A>,
  ms: number
): Effect<A> =>
  effect(async () => {
    const result = await Promise.race([
      eff.perform(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
    return result as A;
  });
```

### cacheEffect

```ts
const cacheEffect = <A>(
  key: string,
  eff: Effect<A>,
  cache: Map<string, A>
): Effect<A> =>
  effect(async () => {
    if (cache.has(key)) return cache.get(key)!;
    const result = await eff.perform();
    cache.set(key, result);
    return result;
  });
```

## 下一步

- [函数式状态管理](./state-management) —— 状态的纯函数描述
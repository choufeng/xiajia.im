# TypeScript 类型系统与函数式编程

> 类型系统是编译期的"纯函数"，确保函数式契约。

## 基础类型

### 基本类型

```ts
const add = (a: number, b: number): number => a + b;
const greet = (name: string): string => `Hello, ${name}`;
const isActive = (flag: boolean): boolean => flag;
```

### 联合类型

```ts
type Status = 'loading' | 'success' | 'error';

const renderStatus = (status: Status): string => {
  switch (status) {
    case 'loading':
      return 'Loading...';
    case 'success':
      return 'Success!';
    case 'error':
      return 'Error!';
  }
};
```

### 字面量类型

```ts
type Theme = 'light' | 'dark';
const theme: Theme = 'light';

const toggleTheme = (current: Theme): Theme =>
  current === 'light' ? 'dark' : 'light';
```

## 泛型

### 基础泛型

```ts
const identity = <T>(x: T): T => x;
identity(5); // 5
identity('hello'); // 'hello'
```

### 约束泛型

```ts
const length = <T extends { length: number }>(x: T): number => x.length;
length('hello'); // 5
length([1, 2, 3]); // 3
// length(5); // ❌ Error
```

### 泛型约束

```ts
interface HasId {
  id: number;
}

const findById = <T extends HasId>(
  items: T[],
  id: number
): T | undefined => {
  return items.find(item => item.id === id);
};

const users = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' }
];

findById(users, 1); // { id: 1, name: 'Alice' }
```

## 高级类型

### 条件类型

```ts
type NonNullable<T> = T extends null | undefined ? never : T;
type NonNullString = NonNullable<string | null>; // string

type IsArray<T> = T extends any[] ? true : false;
type CheckNumberArray = IsArray<number[]>; // true
type CheckStringArray = IsArray<string>; // false
```

### 映射类型

```ts
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Partial<T> = {
  [K in keyof T]?: T[K];
};

type User = {
  name: string;
  age: number;
};

type ReadonlyUser = Readonly<User>;
// { readonly name: string; readonly age: number }

type PartialUser = Partial<User>;
// { name?: string; age?: number }
```

### 工具类型

```ts
// Partial：可选
type UpdateUser = Partial<User>;

// Required：必选
type RequiredUser = Required<PartialUser>;

// Pick：挑选
type UserName = Pick<User, 'name'>;
// { name: string }

// Omit：排除
type UserWithoutAge = Omit<User, 'age'>;
// { name: string }

// Record：键值对
type UserMap = Record<number, User>;
// { [key: number]: User }
```

## 类型推导

### 自动推导

```ts
const add = (a: number, b: number) => a + b; // 自动推导返回 number
const result: number = add(2, 3); // 显式注解可省略

const pipe = <T>(...fns: Array<(x: any) => any>) =>
  (x: T): any => fns.reduce((acc, fn) => fn(acc), x);
```

### 类型守卫

```ts
const isString = (x: unknown): x is string =>
  typeof x === 'string';

const process = (x: unknown): number => {
  if (isString(x)) {
    return x.length; // x 被推导为 string
  }
  return 0;
};
```

### 判别联合

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'square'; side: number };

const area = (shape: Shape): number => {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2;
    case 'square':
      return shape.side ** 2;
  }
};

const circle: Shape = { kind: 'circle', radius: 5 };
const square: Shape = { kind: 'square', side: 4 };
```

## 函数式类型模式

### Option（Maybe）类型

```ts
type Option<T> = Some<T> | None;

interface Some<T> {
  _tag: 'Some';
  value: T;
}

interface None {
  _tag: 'None';
}

const some = <T>(value: T): Option<T> => ({ _tag: 'Some', value });
const none = (): Option<any> => ({ _tag: 'None' });

const map = <T, U>(fn: (x: T) => U, opt: Option<T>): Option<U> =>
  opt._tag === 'Some' ? some(fn(opt.value)) : none();

// 使用
const result = map(x => x * 2, some(5)); // Some(10)
const empty = map(x => x * 2, none()); // None
```

### Result（Either）类型

```ts
type Result<T, E> = Success<T> | Failure<E>;

interface Success<T> {
  _tag: 'Success';
  value: T;
}

interface Failure<E> {
  _tag: 'Failure';
  error: E;
}

const success = <T>(value: T): Result<T, any> => ({ _tag: 'Success', value });
const failure = <E>(error: E): Result<any, E> => ({ _tag: 'Failure', error });

const parseJSON = (str: string): Result<any, Error> => {
  try {
    return success(JSON.parse(str));
  } catch (error) {
    return failure(error as Error);
  }
};

// 使用
const result = parseJSON('{"key": "value"}');
if (result._tag === 'Success') {
  console.log(result.value); // type guard 推导
}
```

## 函数式 Iron Law 应用

> 可验证性 → 类型强制纯函数

```ts
// ❌ 违反：未标记副作用
const fetchUser = async (id: number) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
};

// ✅ 遵守：Effect 类型标记副作用
type Effect<A> = { _tag: 'Effect'; perform: () => Promise<A> };

const fetchUser = (id: number): Effect<User> => ({
  _tag: 'Effect',
  perform: async () => {
    const res = await fetch(`/api/users/${id}`);
    return res.json();
  }
});

// TypeScript 确保副作用被显式处理
const process = (id: number): Effect<string> => {
  return {
    _tag: 'Effect',
    perform: async () => {
      const user = await fetchUser(id).perform();
      return `User: ${user.name}`;
    }
  };
};
```

## 类型体操示例

### DeepPartial

```ts
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

type DeepUser = DeepPartial<{
  name: string;
  address: {
    city: string;
    country: string;
  }
}>;
// {
//   name?: string;
//   address?: {
//     city?: string;
//     country?: string;
//   };
// }
```

### PromiseValue

```ts
type PromiseValue<T> = T extends Promise<infer U> ? U : never;

type User = { name: string };
type GetUser = Promise<User>;
type UserPromiseValue = PromiseValue<GetUser>; // User
```

### FunctionArgs

```ts
type FunctionArgs<T> = T extends (...args: infer A) => any ? A : never;

const add = (a: number, b: number): number => a + b;
type AddArgs = FunctionArgs<typeof add>; // [number, number]
```

## 下一步

- [AI 时代的函数式融合](./fp-in-ai-era) —— Prompt 作为函数、Agent 的函数式设计
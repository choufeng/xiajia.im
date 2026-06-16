# 函数式状态管理

> 状态是数据随时间的"快照流"，而非可变容器。

## 状态的本质

```ts
// ❌ 可变状态：隐式、难以追踪
let count = 0;
const increment = () => count++;

// ✅ 状态快照流：显式、可回溯
type State = { count: number };
type Event = { type: 'INCREMENT' } | { type: 'DECREMENT' };

const reduce = (state: State, event: Event): State => {
  switch (event.type) {
    case 'INCREMENT':
      return { ...state, count: state.count + 1 };
    case 'DECREMENT':
      return { ...state, count: state.count - 1 };
  }
};

const events: Event[] = [];
const states = [initialState];

const dispatch = (event: Event) => {
  events.push(event);
  states.push(reduce(states[states.length - 1], event));
};
```

## Reducer 模式

```ts
type State = { value: number; history: number[] };

type Action =
  | { type: 'ADD'; payload: number }
  | { type: 'SUBTRACT'; payload: number }
  | { type: 'UNDO' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD':
      return {
        value: state.value + action.payload,
        history: [...state.history, state.value]
      };
    case 'SUBTRACT':
      return {
        value: state.value - action.payload,
        history: [...state.history, state.value]
      };
    case 'UNDO':
      const previous = state.history[state.history.length - 1];
      return {
        value: previous ?? 0,
        history: state.history.slice(0, -1)
      };
    default:
      return state;
  }
};

const state: State = { value: 0, history: [] };
const actions: Action[] = [
  { type: 'ADD', payload: 5 },
  { type: 'SUBTRACT', payload: 2 },
  { type: 'UNDO' }
];

const finalState = actions.reduce(reducer, state);
// { value: 5, history: [] }
```

## Lens：数据访问器

```ts
import * as R from 'ramda';

type User = {
  name: string;
  address: {
    city: string;
    country: string;
  };
};

// 创建 lens
const addressLens = R.lensProp('address');
const cityLens = R.lensPath(['address', 'city']);

// 获取
const user: User = {
  name: 'Alice',
  address: { city: 'Tokyo', country: 'Japan' }
};

R.view(cityLens, user); // 'Tokyo'

// 设置
const updated = R.set(cityLens, 'Kyoto', user);
// { name: 'Alice', address: { city: 'Kyoto', country: 'Japan' } }

// 转换
const upperCity = R.over(cityLens, R.toUpper, user);
// { name: 'Alice', address: { city: 'TOKYO', country: 'Japan' } }
```

## State Machine（状态机）

```ts
type State = 'idle' | 'loading' | 'success' | 'error';

type Event =
  | { type: 'FETCH' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR' }
  | { type: 'RETRY' };

type Transition = {
  from: State;
  event: Event;
  to: State;
};

const transitions: Transition[] = [
  { from: 'idle', event: { type: 'FETCH' }, to: 'loading' },
  { from: 'loading', event: { type: 'SUCCESS' }, to: 'success' },
  { from: 'loading', event: { type: 'ERROR' }, to: 'error' },
  { from: 'error', event: { type: 'RETRY' }, to: 'loading' },
  { from: 'success', event: { type: 'FETCH' }, to: 'loading' }
];

const transition = (currentState: State, event: Event): State => {
  const rule = transitions.find(
    t => t.from === currentState && t.event.type === event.type
  );
  return rule?.to ?? currentState;
};

// 使用
let state: State = 'idle';
state = transition(state, { type: 'FETCH' }); // 'loading'
state = transition(state, { type: 'SUCCESS' }); // 'success'
state = transition(state, { type: 'FETCH' }); // 'loading'
```

## React useReducer

```ts
type CounterState = { count: number };

type CounterAction =
  | { type: 'INCREMENT' }
  | { type: 'DECREMENT' }
  | { type: 'RESET' };

const counterReducer = (
  state: CounterState,
  action: CounterAction
): CounterState => {
  switch (action.type) {
    case 'INCREMENT':
      return { count: state.count + 1 };
    case 'DECREMENT':
      return { count: state.count - 1 };
    case 'RESET':
      return { count: 0 };
    default:
      return state;
  }
};

const Counter = () => {
  const [state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={() => dispatch({ type: 'INCREMENT' })}>+</button>
      <button onClick={() => dispatch({ type: 'DECREMENT' })}>-</button>
      <button onClick={() => dispatch({ type: 'RESET' })}>Reset</button>
    </div>
  );
};
```

## Zustand（现代状态管理）

```ts
import { create } from 'zustand';

type CounterStore = {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
};

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 })
}));

// 组件中使用
const Counter = () => {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
};
```

## 函数式 Iron Law 应用

> 可复现性 → Reducer 纯函数，状态迁移可预测

```ts
// ❌ 违反：副作用在 reducer 中
const reducer = (state: State, action: Action) => {
  if (action.type === 'FETCH') {
    fetch('/api/data').then(res => console.log(res)); // 副作用
    return { ...state, loading: true };
  }
  return state;
};

// ✅ 遵守：reducer 纯函数，副作用在外部
const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, data: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

// 副作用在 side effect 中处理
useEffect(() => {
  const fetchData = async () => {
    dispatch({ type: 'FETCH_START' });
    try {
      const data = await fetch('/api/data');
      dispatch({ type: 'FETCH_SUCCESS', payload: data });
    } catch (error) {
      dispatch({ type: 'FETCH_ERROR', payload: error });
    }
  };
  fetchData();
}, []);
```

## 下一步

- [函数式测试](./testing) —— 纯函数的测试哲学
# AI 时代的函数式融合

> Prompt 是函数，Agent 是 Compose，LLM 是 HOF。

## 核心洞察

| 函数式概念 | AI/LLM 对应 |
|---|---|
| 纯函数 | Prompt 模板 + 输入 → 固定输出 |
| 高阶函数 | Prompt 模板接受其他 Prompt 作为参数 |
| 函数组合 | Chain of Thought：Prompt 链 |
| 副作用隔离 | Tool Call（函数调用） |
| Reducer | Agent 状态迁移 |
| Effect 系统 | LLM 异步响应 |

## Prompt 作为函数

### 纯 Prompt 函数

```ts
type Prompt<A, B> = (input: A) => B;

const summarizePrompt = (text: string): string => `
请总结以下文本：

${text}

输出：
`;

const callLLM = async (prompt: string): Promise<string> => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
};

const summarize = async (text: string): Promise<string> => {
  const prompt = summarizePrompt(text);
  return callLLM(prompt);
};

// 纯函数：给定输入，返回输出（依赖 LLM 的确定性）
```

### 高阶 Prompt

```ts
// Prompt 接受其他 Prompt 作为参数
const withContext = (
  contextPrompt: Prompt<string, string>,
  mainPrompt: Prompt<string, string>
): Prompt<string, string> =>
  (input) => {
    const context = contextPrompt(input);
    const main = mainPrompt(input);
    return `${context}\n\n${main}`;
  };

// 使用
const contextPrompt = (topic: string) => `
背景：${topic} 是当前热门技术领域。
`;

const explainPrompt = (topic: string) => `
解释 ${topic} 的核心概念。
`;

const explainWithContext = withContext(contextPrompt, explainPrompt);

explainWithContext('React');
// 生成带背景的完整 Prompt
```

### Prompt 组合

```ts
// compose：Prompt 链（Chain of Thought）
const composePrompts = <A, B, C>(
  p2: Prompt<B, C>,
  p1: Prompt<A, B>
): Prompt<A, C> =>
  async (input: A) => {
    const output1 = await callLLM(p1(input));
    return callLLM(p2(output1));
  };

// 使用：先摘要，再提问
const summaryPrompt = (text: string) => `摘要：\n${text}\n\n摘要：`;
const questionPrompt = (summary: string) => `基于摘要提问：${summary}`;

const summaryThenQuestion = composePrompts(questionPrompt, summaryPrompt);

// pipe：Prompt 管道
const pipePrompts = <T>(...prompts: Array<(x: any) => string>) =>
  async (input: T): Promise<string> => {
    let acc = input as any;
    for (const prompt of prompts) {
      const promptStr = prompt(acc);
      acc = await callLLM(promptStr);
    }
    return acc;
  };
```

## Agent 的函数式设计

### Agent 纯函数

```ts
type Tool = {
  name: string;
  execute: (args: any) => Promise<any>;
};

type AgentState = {
  messages: Array<{ role: string; content: string }>;
  tools: Tool[];
  result?: any;
};

type AgentAction =
  | { type: 'TOOL_CALL'; tool: Tool; args: any }
  | { type: 'LLM_RESPONSE'; response: string }
  | { type: 'COMPLETE'; result: any };

const agentReducer = (
  state: AgentState,
  action: AgentAction
): AgentState => {
  switch (action.type) {
    case 'TOOL_CALL':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', content: `Calling ${action.tool.name}` }
        ]
      };
    case 'LLM_RESPONSE':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'assistant', content: action.response }
        ]
      };
    case 'COMPLETE':
      return {
        ...state,
        result: action.result,
        messages: [
          ...state.messages,
          { role: 'assistant', content: `Complete: ${action.result}` }
        ]
      };
    default:
      return state;
  }
};
```

### Tool 调用作为副作用

```ts
// Effect 类型包装 Tool 调用
type ToolEffect<A> = {
  _tag: 'ToolEffect';
  tool: Tool;
  args: any;
  perform: () => Promise<A>;
};

const createToolEffect = <A>(
  tool: Tool,
  args: any
): ToolEffect<A> => ({
  _tag: 'ToolEffect',
  tool,
  args,
  perform: async () => await tool.execute(args)
});

// Agent 决定调用哪个 Tool（纯函数描述）
const decideTool = (
  state: AgentState
): ToolEffect<any> | null => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) return null;

  const needsTool = lastMessage.content.includes('search');
  if (needsTool) {
    return createToolEffect(
      { name: 'search', execute: async (q: string) => `Result: ${q}` },
      { query: 'example' }
    );
  }

  return null;
};

// 执行层：运行 ToolEffect
const runTool = async (effect: ToolEffect<any>): Promise<any> => {
  return effect.perform();
};
```

### Agent Compose

```ts
// 复合多个 Agent
const composeAgents = (
  ...agents: Array<(state: AgentState) => AgentState>
) =>
  (state: AgentState): AgentState =>
    agents.reduce((acc, agent) => agent(acc), state);

// 使用
const researchAgent = (state: AgentState) => {
  const toolEffect = decideTool(state);
  if (toolEffect) {
    return agentReducer(state, { type: 'TOOL_CALL', ...toolEffect });
  }
  return state;
};

const writingAgent = (state: AgentState) => {
  return agentReducer(state, {
    type: 'LLM_RESPONSE',
    response: 'Draft completed'
  });
};

const reviewAgent = (state: AgentState) => {
  return agentReducer(state, {
    type: 'COMPLETE',
    result: 'Final result'
  });
};

const pipeline = composeAgents(researchAgent, writingAgent, reviewAgent);
```

## 函数式 Iron Law 在 Agent 中的应用

> 可复现性 → Agent 状态迁移显式，Tool 调用隔离

```ts
// ❌ 违反：隐式状态、副作用混入
class Agent {
  private state: any = {};

  async process(input: string) {
    this.state = { input };
    const result = await this.callTool(); // 副副作用
    this.state.result = result;
    return result;
  }
}

// ✅ 遵守：显式状态、Effect 隔离
type Agent<A> = {
  initialState: A;
  reducer: (state: A, action: AgentAction) => A;
  effects: Array<(state: A) => ToolEffect<any> | null>;
};

const createAgent = <A>(spec: Agent<A>) => {
  return {
    run: async (input: any): Promise<A> => {
      let state = spec.initialState;
      const action = { type: 'START', payload: input };
      state = spec.reducer(state, action as any);

      while (true) {
        const effect = spec.effects.reduce(
          (acc, fn) => acc ?? fn(state),
          null as ToolEffect<any> | null
        );

        if (!effect) break;

        const result = await effect.perform();
        state = spec.reducer(state, {
          type: 'TOOL_RESULT',
          payload: result
        } as any);
      }

      return state;
    }
  };
};
```

## Prompt 模板库

### 基础模板

```ts
const createTemplate = (parts: TemplateStringsArray) =>
  (values: Record<string, string>): string => {
    let result = parts[0];
    for (let i = 0; i < values.length; i++) {
      result += Object.values(values)[i] + parts[i + 1];
    }
    return result;
  };

const summaryTemplate = createTemplate`
请总结以下关于 ${'topic'} 的内容：

${'content'}

输出简洁摘要。
`;

// 使用
summaryTemplate({
  topic: 'React',
  content: 'React 是 UI 库...'
});
```

### Ramda 风格 Prompt 组合

```ts
import * as R from 'ramda';

const promptMap = <T, U>(
  fn: (t: T) => string,
  promptFn: Prompt<string, string>
): Prompt<T, string> =>
  async (input: T) => promptFn(fn(input));

const promptCompose = <A, B, C>(
  p2: Prompt<B, C>,
  p1: Prompt<A, B>
): Prompt<A, C> =>
  async (input: A) => {
    const output1 = await p1(input);
    return p2(output1);
  };

// 使用
const topics = ['React', 'Vue', 'SolidJS'];
const summaryPrompts = topics.map(topic =>
  promptMap(
    () => topic,
    summarizePrompt
  )
);

const allSummaries = Promise.all(summaryPrompts.map(p => p()));
```

## RAG 的函数式视角

```ts
// 纯函数：检索
const retrieve = (query: string, docs: Document[]): Document[] =>
  docs.filter(doc =>
    doc.content.toLowerCase().includes(query.toLowerCase())
  );

// 纯函数：生成
const generate = (query: string, context: Document[]): string => {
  const contextStr = context.map(d => d.content).join('\n\n');
  return `
基于以下内容回答问题：

${contextStr}

问题：${query}
`;
};

// 组合：RAG Pipeline
const ragPipeline = (query: string, docs: Document[]): Prompt<string, string> =>
  composePrompts(
    generate,
    (q) => retrieve(q, docs)
  )(query);

// 使用
const docs = [
  { id: 1, content: 'React 是 UI 库' },
  { id: 2, content: 'Vue 也是 UI 库' }
];

const ragPrompt = ragPipeline('React vs Vue 对比', docs);
```

## 实践：函数式 Agent 框架

```ts
// 简化的 Agent 框架
type Tool<T, R> = {
  name: string;
  execute: (args: T) => Promise<R>;
};

type Agent<T, R> = {
  tools: Tool<T, R>[];
  decide: (input: string) => Promise<{ tool: Tool<T, R>; args: T } | null>;
  execute: (tool: Tool<T, R>, args: T) => Promise<R>;
};

const createAgent = <T, R>(
  tools: Tool<T, R>[],
  decide: Agent<T, R>['decide']
): Agent<T, R> => ({
  tools,
  decide,
  execute: async (tool, args) => await tool.execute(args)
});

// 使用
const searchTool: Tool<{ query: string }, string> = {
  name: 'search',
  execute: async ({ query }) => `Result for: ${query}`
};

const agent = createAgent([searchTool], async (input) => {
  if (input.includes('search')) {
    return { tool: searchTool, args: { query: input } };
  }
  return null;
});

// 运行
const decision = await agent.decide('search for React');
if (decision) {
  const result = await agent.execute(decision.tool, decision.args);
  console.log(result);
}
```

## 总结：AI 时代的函数式优势

1. **可组合性**：Prompt、Tool、Agent 都是可组合单元
2. **可测试性**：Prompt 输出可测试（通过 mock LLM）
3. **可复现性**：状态显式、副作用隔离
4. **可扩展性**：高阶 Prompt、函数组合扩展能力

**Iron Law 在 AI 中的地位**：
- 纯函数 → Prompt 模板
- 副作用标记 → Tool 调用
- 可复现性 → Agent 状态迁移

---

**系列完结**。从基础到实战，从工具到类型，从测试到 AI 融合。函数式编程的思维，适用于每个时代。
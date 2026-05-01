# Prompt 工程

> 简单理解可以是搜索时代的**关键词**，会是每个要跟上时代融入 AI 交互的必备技能。

Prompt 门槛低，但上限非常高。

## Prompt 的典型构成

| 要素 | 说明 | 示例 |
|------|------|------|
| **角色** | 给 AI 定义一个最匹配任务的角色 | 「你是一位软件工程师」「你是一位小学老师」 |
| **指示** | 对任务进行描述 | 「请帮我写一个排序算法」 |
| **上下文** | 给出与任务相关的其它背景信息 | 尤其在多轮交互中 |
| **例子** | 必要时给出举例 | one-shot / few-shot learning |
| **输入** | 任务的输入信息 | 在提示词中明确标识出输入 |
| **输出** | 输出的格式描述 | JSON、XML 等 |

## Prompt 调优

### 高质量 Prompt 的标准

> **具体，丰富，少歧义**

调优训练在日常中就是**完整说明事情的能力**的训练。

### 关键技巧

**大模型对 prompt 开头和结尾的内容更敏感**

**「给例子」很常用，效果特别好**

**一切问题先尝试用 prompt 解决，往往有四两拨千斤的效果**

> 向大模型发送的内容，只在推理，无关训练。

## 思维链 (Chain of Thought)

有人在提问时以 "Let's think step by step" 开头，发现 AI 把问题拆分为多步骤推导会让结果更精准。

这个过程相当于让 AI 形成了丰富的"上文"，从而提升了"下文"的质量。针对计算和逻辑推理比较有效。

## 自洽性 (Self-Consistency)

一种对抗"幻觉"的手段：多次演算，得到最多次出现的值。

## 思维树 (Tree of Thoughts)

在思维链的每一步采样多个分支。

## 防止 Prompt 攻击

| 攻击类型 | 描述 |
|---------|------|
| 奶奶漏洞 | 套路 AI，绕过安全限制 |
| Prompt 注入攻击 | 改变既定设定 |

### 防范措施

- **Prompt 注入分类器**：做输入内容识别安检拦截层
- **输入防御**：在输入中锁死回答范围
- **Moderation API**：违规过滤

## Prompt 总结

1. 别急着上代码，先尝试用 prompt 解决，往往有四两拨千斤的效果
2. 但别迷信 prompt，合理组合传统方法提升确定性，减少幻觉
3. 定义角色、给例子是最常用的技巧
4. 用好思维链，让复杂逻辑/计算问题结果更准确
5. 防御 prompt 攻击非常重要

## 实用工具

| 工具 | 地址 |
|------|------|
| GPTs | https://chat.openai.com/gpts/discovery |
| Coze | https://www.coze.com/ |
| Prompt Tune | https://gitee.com/taliux/prompt-tune |

### 额外资源

- [泄露的高级 GPTs prompt](https://github.com/linexjlin/GPTs)
- [PromptBase](https://promptbase.com/)
- [Awesome ChatGPT Prompts](https://github.com/f/awesome-chatgpt-prompts)
- [LangChain Hub](https://smith.langchain.com/hub)

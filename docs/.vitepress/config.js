import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'XiaJia.IM',
  description: 'Code, Music, Life',
  lastUpdated: true,
  ignoreDeadLinks: true,
  base: '/',

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'author', content: 'Jon.Xia' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: '首页', link: '/' },
      {
        text: 'AI',
        link: '/ai/index',
        activeMatch: '^/ai/',
      },
      { text: '编程笔记', link: '/coding/react' },
      { text: '工具参考', link: '/reference/ramda' },
      { text: '读书笔记', link: '/reading/index' },
      { text: '说话', link: '/speaking/index' },
      { text: '关于', link: '/about' },
      { text: 'Learning English', link: '/english/' },
      { text: 'PI 教程', link: '/pi-tutorials/index' },
    ],

    sidebar: {
      // AI 专区 — 未来重点发展方向
      '/ai/': [
        {
          text: 'AI 基础',
          items: [
            { text: '总览', link: '/ai/index' },
            { text: 'LLM 基础', link: '/ai/llm-basics' },
            { text: 'Prompt 工程', link: '/ai/prompt' },
            { text: 'AI时代的精准沟通', link: '/ai/ai-communication' },
            { text: 'GWT 需求描述法', link: '/ai/gwt-requirements' },
            { text: '技术架构', link: '/ai/architecture' },
            { text: '应用场景', link: '/ai/applications' },
          ],
        },
        {
          text: 'Agent 工程',
          items: [
            { text: 'GenericAgent 深度分析', link: '/ai/generic-agent' },
            { text: 'Skill Graph 改造方案', link: '/ai/skill-graph-constitution' },
            { text: 'Skill Graph 创建指南', link: '/ai/skill-graph-guide' },
          ],
        },
        {
          text: 'Harness Engineering 系列（10 篇）',
          collapsed: true,
          items: [
            { text: '系列总纲', link: '/ai/harness-engineering-series' },
            { text: '1. Harness 是什么', link: '/ai/harness-engineering' },
            { text: '2. 工具系统与工具总线', link: '/ai/harness-engineering-tools' },
            { text: '3. 上下文工程与 Token 预算', link: '/ai/harness-engineering-context' },
            { text: '4. 会话与运行时生命周期', link: '/ai/harness-engineering-runtime' },
            { text: '5. 子代理调度容器', link: '/ai/harness-engineering-subagents' },
            { text: '6. 扩展与技能加载机制', link: '/ai/harness-engineering-extensions' },
            { text: '7. 记忆持久化分层', link: '/ai/harness-engineering-memory' },
            { text: '8. 沙箱、权限与安全模型', link: '/ai/harness-engineering-security' },
            { text: '9. 可观测性与可调试性', link: '/ai/harness-engineering-observability' },
            { text: '10. 协议层与分发', link: '/ai/harness-engineering-protocols-distribution' },
          ],
        },
        {
          text: 'Loop Engineering 系列（25 篇）',
          collapsed: true,
          items: [
            { text: '系列总纲', link: '/ai/loop-engineering-series' },
            { text: '1. 概念', link: '/ai/loop-engineering' },
            { text: '2. pi L1 落地', link: '/ai/loop-engineering-on-pi' },
            { text: '3. L3 设计方案', link: '/ai/loop-engineering-l3-design' },
            { text: '4. Memory 系统', link: '/ai/loop-engineering-memory' },
            { text: '5. Multi-Loop 协调', link: '/ai/loop-engineering-multi-loop' },
            { text: '6. 网关层', link: '/ai/loop-engineering-gateway' },
            { text: '7. 反衰减', link: '/ai/loop-engineering-antidegradation' },
            { text: '8. Meta-Loop 自我演进', link: '/ai/loop-engineering-meta-loop' },
            { text: '9. 韧性与评估', link: '/ai/loop-engineering-resilience-eval' },
            { text: '10. Sub-agent 编排', link: '/ai/loop-engineering-sub-agent' },
            { text: '11. Skills 工程化', link: '/ai/loop-engineering-skills' },
            { text: '12. Worktree 并行', link: '/ai/loop-engineering-worktree' },
            { text: '13. Scheduling 模式', link: '/ai/loop-engineering-scheduling' },
            { text: '14. PR Babysitter', link: '/ai/loop-engineering-pr-babysitter' },
            { text: '15. Dependency Sweeper', link: '/ai/loop-engineering-dependency-sweeper' },
            { text: '16. Issue Triage', link: '/ai/loop-engineering-issue-triage' },
            { text: '17. Changelog & Cleanup', link: '/ai/loop-engineering-changelog-cleanup' },
            { text: '18. Documentation Loop', link: '/ai/loop-engineering-documentation' },
            { text: '19. Intent Debt', link: '/ai/loop-engineering-intent-debt' },
            { text: '20. Comprehension Debt', link: '/ai/loop-engineering-comprehension-debt' },
            { text: '21. Cognitive Surrender', link: '/ai/loop-engineering-cognitive-surrender' },
            { text: '22. 可观测性深度', link: '/ai/loop-engineering-observability' },
            { text: '23. 成本工程', link: '/ai/loop-engineering-cost-engineering' },
            { text: '24. 跨工具对比', link: '/ai/loop-engineering-tool-comparison' },
            { text: '25. 团队引入路线图', link: '/ai/loop-engineering-team-adoption' },
          ],
        },
      ],

      // 读书笔记
      '/reading/': [
        {
          text: '读书笔记',
          items: [
            { text: '总览', link: '/reading/index' },
            { text: '《高效能人士的七个习惯》', link: '/reading/seven-habits' },
            { text: '《富有的习惯》', link: '/reading/rich-habits' },
            { text: '《深度工作》', link: '/reading/deep-work' },
            { text: '《思考，快与慢》', link: '/reading/thinking-fast-slow' },
            { text: '《金钱心理学》', link: '/reading/psychology-of-money' },
            { text: '《非暴力沟通》', link: '/reading/nonviolent-communication' },
            { text: '《认知天性》', link: '/reading/make-it-stick' },
            { text: '《活出生命的意义》', link: '/reading/mans-search-for-meaning' },
            { text: '《原子习惯》', link: '/reading/atomic-habits' },
          ],
        },
      ],

      // 编程笔记
      '/coding/': [
        {
          text: '前端框架',
          items: [
            { text: 'React.js', link: '/coding/react' },
            { text: 'Vue.js', link: '/coding/vue' },
            { text: 'HarmonyOS', link: '/coding/harmony-os' },
            { text: 'OpenTUI', link: '/coding/opentui' },
            { text: 'SolidJS', link: '/coding/solid-js' },
          ],
        },
        {
          text: 'React 进阶系列（8 篇）',
          collapsed: true,
          items: [
            { text: '系列总纲', link: '/coding/react-series' },
            { text: '1. 设计哲学：为什么是声明式', link: '/coding/react-philosophy' },
            { text: '2. JSX 与元素', link: '/coding/react-jsx' },
            { text: '3. 渲染与 Reconciliation', link: '/coding/react-reconciliation' },
            { text: '4. Hooks（一）：状态', link: '/coding/react-hooks-state' },
            { text: '5. Hooks（二）：useEffect', link: '/coding/react-hooks-effects' },
            { text: '6. Hooks（三）：记忆化', link: '/coding/react-memoization' },
            { text: '7. 状态管理选型', link: '/coding/react-state-management' },
            { text: '8. 性能与并发特性', link: '/coding/react-performance-concurrent' },
          ],
        },
        {
          text: '函数式编程系列（10 篇）',
          collapsed: true,
          items: [
            { text: '0. 函数式思维（阅读指南）', link: '/coding/functional-intro' },
            { text: '1. 函数式基础深化', link: '/coding/functional-essentials' },
            { text: '2. 纯函数与副作用', link: '/coding/pure-functions' },
            { text: '3. 不可变数据结构', link: '/coding/immutability' },
            { text: '4. 高阶函数与组合', link: '/coding/higher-order' },
            { text: '5. Ramda.js 实战', link: '/coding/ramda-practical' },
            { text: '6. Effect 系统', link: '/coding/effect-system' },
            { text: '7. 函数式状态管理', link: '/coding/state-management' },
            { text: '8. 函数式测试', link: '/coding/testing' },
            { text: '9. TypeScript 类型系统', link: '/coding/fp-in-typescript' },
            { text: '10. AI 时代的函数式融合', link: '/coding/fp-in-ai-era' },
          ],
        },
        {
          text: '函数式编程',
          items: [
            { text: '函数式编程', link: '/coding/functional' },
            { text: '函数式思维', link: '/coding/functional-thinking' },
          ],
        },
        {
          text: '学习与实践',
          items: [
            { text: 'Effective JavaScript', link: '/coding/effective-js' },
            { text: 'Learn More Study Less', link: '/coding/learn-more' },
          ],
        },
      ],

      // PI 教程
      '/pi-tutorials/': [
        {
          text: '快速上手',
          items: [
            { text: '教程总览', link: '/pi-tutorials/index' },
            { text: '1. 安装与首次对话', link: '/pi-tutorials/01-quick-start' },
          ],
        },
        {
          text: '日常工作流',
          items: [
            { text: '2. 会话管理与分支', link: '/pi-tutorials/02-daily-workflow' },
            { text: '3. 设置与上下文文件', link: '/pi-tutorials/03-settings-context' },
          ],
        },
        {
          text: '深度定制',
          items: [
            { text: '4. 扩展与技能开发', link: '/pi-tutorials/04-extensions-skills' },
            { text: '5. SDK 集成与包分享', link: '/pi-tutorials/05-sdk-packages' },
          ],
        },
      ],

      // 工具参考
      '/reference/': [
        {
          text: '工具库',
          items: [
            { text: 'Ramda.js', link: '/reference/ramda' },
            { text: 'Date-fns', link: '/reference/date-fns' },
          ],
        },
        {
          text: '开发与部署',
          items: [
            { text: 'TypeORM', link: '/reference/typeorm' },
            { text: 'Cypress.js', link: '/reference/cypress' },
            { text: '算法笔记', link: '/reference/algorithms' },
          ],
        },
        {
          text: '运维 & 杂项',
          items: [
            { text: 'Serverless', link: '/reference/serverless' },
            { text: '内网穿透 (FRP)', link: '/reference/frp' },
            { text: 'SS 部署', link: '/reference/ss' },
            { text: 'NPM 权限', link: '/reference/npm-global' },
            { text: '单元测试', link: '/reference/unit-test' },
          ],
        },
        {
          text: '其他',
          items: [
            { text: 'GIMP 使用', link: '/reference/gimp' },
            { text: '域名售卖', link: '/reference/domains' },
            { text: '资源链接', link: '/reference/links' },
            { text: '简化听书笔记', link: '/reference/jianhua' },
            { text: '杂记', link: '/reference/somethings' },
          ],
        },
      ],

      // 说话练习
      '/speaking/': [
        {
          text: '每日练习',
          items: [
            { text: '栏目说明', link: '/speaking/index' },
            { text: 'Day 1 · 先练什么', link: '/speaking/01-day1-what-first' },
          ],
        },
      ],

      // Learning English
      '/english/': [
        {
          text: 'Daily Vocabulary',
          items: [
            { text: 'Code Review Discussion', link: '/english/code-review-discussion' },
            { text: 'Online Meeting Follow-ups', link: '/english/online-meeting-follow-ups' },
            { text: 'Debugging a Production Incident', link: '/english/debugging-production-incident' },
            { text: 'Database Performance Tuning', link: '/english/database-performance-tuning' },
            { text: 'Fixing a Flaky Test', link: '/english/fixing-a-flaky-test' },
            { text: 'Security Review', link: '/english/security-review' },
            { text: 'Pair Programming', link: '/english/pair-programming' },
            { text: 'CI/CD Pipeline Setup', link: '/english/ci-cd-pipeline-setup' },
            { text: 'Architecture Discussion', link: '/english/architecture-discussion' },
            { text: 'Incident Postmortem', link: '/english/incident-postmortem' },
            { text: 'Frontend Caching Strategy', link: '/english/frontend-caching-strategy' },
            { text: 'Daily Standup Sync', link: '/english/daily-standup-sync' },
            { text: 'Production Rollback', link: '/english/production-rollback' },
            { text: 'API Design Discussion', link: '/english/api-design-discussion' },
            { text: 'Concurrency and Performance', link: '/english/concurrency-and-performance' },
            { text: 'Migration and Deprecation', link: '/english/migration-and-deprecation' },
            { text: 'Polite Interruptions', link: '/english/polite-interruptions' },
            { text: 'Diplomatic Disagreement', link: '/english/diplomatic-disagreement' },
            { text: 'Buying Time', link: '/english/buying-time' },
            { text: 'Summarizing & Action Items', link: '/english/summarizing-action-items' },
            { text: 'Inviting Quiet Voices', link: '/english/inviting-quiet-voices' },
            { text: 'Keeping Discussion on Track', link: '/english/keeping-on-track' },
            { text: 'Small Talk & Openers', link: '/english/small-talk-openers' },
            { text: 'Admitting You Don\'t Know', link: '/english/admitting-you-dont-know' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                displayDetails: '显示详细列表',
                footer: {
                  navigateText: '切换',
                  selectText: '选择',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },

    socialLinks: [],

    footer: {
      message: 'Released under the ISC License.',
      copyright: 'Copyright © 2015-present Jon.Xia',
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
  },

  markdown: {
    lineNumbers: false,
  },

  vite: {
    build: {
      target: 'esnext',
    },
  },
})

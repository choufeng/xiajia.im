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
      { text: '关于', link: '/about' },
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
            { text: '技术架构', link: '/ai/architecture' },
            { text: '应用场景', link: '/ai/applications' },
          ],
        },
        {
          text: 'Agent 工程',
          items: [
            { text: 'Skill Graph 改造方案', link: '/ai/skill-graph-constitution' },
            { text: 'Skill Graph 创建指南', link: '/ai/skill-graph-guide' },
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

    socialLinks: [
      { icon: 'github', link: 'https://github.com/choufeng/xiajia.im' },
    ],

    editLink: {
      pattern: 'https://github.com/choufeng/xiajia.im/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

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
})

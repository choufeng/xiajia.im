import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import ReadAloud from './ReadAloud.vue'
import Enhance from './Enhance.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // Enhance 全站挂载（进度条 fixed + 首页卡片图案注入需全站执行）
      'layout-top': () => h(Enhance),
      'doc-before': () => h(ReadAloud),
    })
  },
}

import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import ReadAloud from './ReadAloud.vue'
import Enhance from './Enhance.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'doc-before': () => [h(ReadAloud), h(Enhance)],
    })
  },
}

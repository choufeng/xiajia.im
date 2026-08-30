---
title: 21 天成人英语训练营
aside: false
outline: false
---

<script setup>
import TrainingApp from './components/TrainingApp.vue'
</script>

<TrainingApp />

<div class="method-notes">

## 这套工具从哪来

本页不是又一个背单词应用。它把两个视频的研究成果直接产品化：

- **[Harvard研究：成人 Learn English 天生比8歲小孩快3倍｜21天成人路線練習法](https://www.youtube.com/watch?v=gFcbzDFco4c)**（brain 學霸）——1978 年 Catherine Snow 实验证明成人每小时学习效率远胜儿童；成人三优势（显性学习力 / 策略优势 / 目的性动机）+ 每日 20 分钟四步法：**选定战场 → AI 建语句库 → 四道并行×15 → AI 强制开口**。作者亲测 21 天口说快 53%、卡顿 -70%。
- **[西班牙 polyglot 用 AI 學 12 語言，我試了他的絕招](https://www.youtube.com/watch?v=_j_Sbp_6Os4)**（同频道拆解 Mikel Telleria）——**语言岛**（把真实生活录下来翻成口语句子库）+ **TTS 音频健身房** + **听→预测→跟读**（顺序不能反）+ **Excel 错题库标红法** + **预习加速器**（理解率 10% → 90%）。90% 的人死在第一周——Week 1 全红是正常的，那正是学习在发生。

完整研究（全文逐字稿 + 方法论整理 + 可行性方案）见 [研究档案](/research/brain-xueba-videos/feasibility-plan)。

## 使用顺序

1. **语句库**：选一个你最怕/最近要用的场景，把具体问题填进万用模板，AI 生成 5 句真实口语，勾选入库；
2. **练习**：新句走「听→预测→跟读」，然后「四道并行」念满 15 遍（眼看/口念/耳听/手写默写）；
3. **复习**：每天打开看「今日队列」——标红错题优先，然后是 D2 / D7 / D30 到期句。卡住就标红，明天它还会回来。

数据默认存在你浏览器本地（localStorage），可用「全部句子 → 导出/导入」备份；需要多台设备同步练习进度时，可在「⚙ 设置」开启**多端同步**（实验性，基于 [Convex](https://convex.dev)，配对码加入，详见[可行性分析](/research/convex-backend-feasibility)）。API Key 只存本机、直连你填的服务，**永不上传**。

</div>

<style scoped>
.method-notes {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-border);
  font-size: 14px;
  line-height: 1.8;
}
</style>

# HarmonyOS  APP 开发学习

##  基础

harmonyOS APP 开发使用ArkTS语言， ArkTS 是TypeScript的超集， 所以有前端开发经验特别是 ts 开发经验的话，会很容易上手。

在 TS 的基础上， ArkTS 增加了 分布式开发范式、并行和并发能力增强、类型系统增强等方面的语言特性。

### 装饰器

#### @Component 
用于声明一个类为一个自定义组件

#### @Entry
声明为页面入口。一个页面只能有一个@Entry

#### @State
声明组件内部状态值，值的改变会触发 UI 更新。 

#### @Link
实现和父组件的@state变量进行双向数据绑定。任何一方的变化都会反映给另一方

### UI描述

位于build()中，以声明式描述界面结构。

### 自定义组件生命周期

- 自定义组件创建
- aboutToAppear()
- aboutToDisappear()
- 自定义组件销毁

### 页面入口组件生命周期

- 页面入口组件创建
- aboutToAppear()
- onPageShow() 显示时
- onBackPress() 返回时 默认false, 为 true 时需要自己控制逻辑
- onPageHide() 隐藏时
- aboutToDisappear()
- 页面入口组件创建

### 笔记

通过$操作符绑定传递state

TitleComponent({isRefresh: $isSwitchData})



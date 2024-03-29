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

## UIAbility内页跳转和数据传递

### 路由

```
  import router from '@lhos.router';

  // Mode 1
  router.pushUrl({
    url: 'pages/Second',
    params: {
      src: 'params from last page',
    }
  }, router.RouterMode.Single)

  // mode 2
  router.replaceUrl({
    url: 'pages/Second',
    params: {
      src: 'params from last page',
    }
  }, router.RouterMode.Single)

```

#### 路由历单例模式与多例模式
router.RouterMode.Single and router.RouterMode.Standard

在单实例模式下：如果目标页面的url在页面栈中已经存在同url页面，离栈顶最近同url页面会被移动到栈顶，替换当前页面，并销毁被替换的当前页面，移动后的页面为新建页，页面栈的元素数量会减1；如果目标页面的url在页面栈中不存在同url页面，按多实例模式跳转，页面栈的元素数量不变。

#### 路由数据获取
```
  @state src: string = (router.getParams))() as Record<string, string>)['src];
```

#### 路由返回

```
  router.back();

  router.back({
    url: 'pages/Index',
  });
```
##### 路由返回前的对话框
```
router.enableBackPageAlert({
  message: "Are you sure back without save?"
})
```

##### 路由返回带入参数
```
  router.back({
    url: 'pages/Index',
    params: {
      src: 'Second传来的数据'
    }
  })
```
调用router.back()方法，不会新建页面，返回的是原来的页面，在原来页面中@State声明的变量不会重复声明，以及也不会触发页面的aboutToAppear()生命周期回调，因此无法直接在变量声明以及页面的aboutToAppear()生命周期回调中接收和解析router.back()传递过来的自定义参数。

## UIAbility生命周期
- UIAbility Start
- Create
- WindowStageCreate
- Forgeround
- Background
- WindowStageDestroy
- Destroy
- UIAbility End

### Create状态
在 UIAbility 实例创建时触发， 系统会调用 onCreate 回调。
```
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';

export default class EntryAbility extends UIAbility {
    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam) {
        // 应用初始化
        // ...
    }
    // ...
}
```
### WindowStage
UIAbility实例创建完成之后，在进入Foreground之前，系统会创建一个WindowStage。每一个UIAbility实例都对应持有一个WindowStage实例。

WindowStage为本地窗口管理器，用于管理窗口相关的内容，例如与界面相关的获焦/失焦、可见/不可见。

可以在onWindowStageCreate回调中，设置UI页面加载、设置WindowStage的事件订阅。

在onWindowStageCreate(windowStage)中通过loadContent接口设置应用要加载的页面

### Foreground和Background状态

分别在UIAbility切换至前台或者切换至后台时触发。

分别对应于onForeground回调和onBackground回调。

```
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';

export default class EntryAbility extends UIAbility {
    // ...

    onForeground() {
        // 申请系统需要的资源，或者重新申请在onBackground中释放的资源
        // ...
    }

    onBackground() {
        // 释放UI页面不可见时无用的资源，或者在此回调中执行较为耗时的操作
        // 例如状态保存等
        // ...
    }
}
```

### onWindowStageDestroy

```
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';

export default class EntryAbility extends UIAbility {
    // ...

    onWindowStageDestroy() {
        // 释放UI页面资源
        // ...
    }
}
```

### Destroy

```
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';

export default class EntryAbility extends UIAbility {
    // ...

    onDestroy() {
        // 系统资源的释放、数据的保存等
        // ...
    }
}
```

## UIAbility的启动模式
UIAbility当前支持singleton（单实例模式）、multiton（多实例模式）和specified（指定实例模式）3种启动模式。

### 单例模式
该UIAbility配置为单实例模式，再次调用startAbility()方法启动该UIAbility实例。由于启动的还是原来的UIAbility实例，并未重新创建一个新的UIAbility实例，此时只会进入该UIAbility的onNewWant()回调，不会进入其onCreate()和onWindowStageCreate()生命周期回调。

```
// module.json5
{
   "module": {
     // ...
     "abilities": [
       {
         "launchType": "singleton",
         // ...
       }
     ]
  }
}
```

### 多例模式
multiton启动模式为多实例模式，每次调用startAbility()方法时，都会在应用进程中创建一个新的该类型UIAbility实例。即在最近任务列表中可以看到有多个该类型的UIAbility实例。

### specified（指定实例模式）
specified启动模式为指定实例模式，针对一些特殊场景使用（例如文档应用中每次新建文档希望都能新建一个文档实例，重复打开一个已保存的文档希望打开的都是同一个文档实例）。

据指定的Key来识别响应请求的UIAbility实例。在EntryAbility中，调用startAbility()方法时，可以在want参数中增加一个自定义参数，例如instanceKey，以此来区分不同的UIAbility实例。

```
// 在启动指定实例模式的UIAbility时，给每一个UIAbility实例配置一个独立的Key标识
// 例如在文档使用场景中，可以用文档路径作为Key标识
import common from '@ohos.app.ability.common';
import Want from '@ohos.app.ability.Want';
import { BusinessError } from '@ohos.base';

function getInstance() {
  return 'key';
}

let context:common.UIAbilityContext = ...; // context为调用方UIAbility的UIAbilityContext
let want: Want = {
  deviceId: '', // deviceId为空表示本设备
  bundleName: 'com.example.myapplication',
  abilityName: 'SpecifiedAbility',
  moduleName: 'specified', // moduleName非必选
  parameters: { // 自定义信息
    instanceKey: getInstance(),
  },
}

context.startAbility(want).then(() => {
  console.info('Succeeded in starting ability.');
}).catch((err: BusinessError) => {
  console.error(`Failed to start ability. Code is ${err.code}, message is ${err.message}`);
})
```
由于SpecifiedAbility的启动模式被配置为指定实例启动模式，因此在SpecifiedAbility启动之前，会先进入对应的AbilityStage的onAcceptWant()生命周期回调中，以获取该UIAbility实例的Key值。然后系统会自动匹配，如果存在与该UIAbility实例匹配的Key，则会启动与之绑定的UIAbility实例，并进入该UIAbility实例的onNewWant()回调函数；否则会创建一个新的UIAbility实例，并进入该UIAbility实例的onCreate()回调函数和onWindowStageCreate()回调函数。
示例代码中，通过实现onAcceptWant()生命周期回调函数，解析传入的want参数，获取自定义参数instanceKey。业务逻辑会根据这个参数返回一个字符串Key，用于标识当前UIAbility实例。如果返回的Key已经对应一个已启动的UIAbility实例，系统会将该UIAbility实例拉回前台并获焦，而不会创建新的实例。如果返回的Key没有对应已启动的UIAbility实例，则系统会创建新的UIAbility实例并启动。

```
import AbilityStage from '@ohos.app.ability.AbilityStage';
import Want from '@ohos.app.ability.Want';

export default class MyAbilityStage extends AbilityStage {
  onAcceptWant(want: Want): string {
    // 在被调用方的AbilityStage中，针对启动模式为specified的UIAbility返回一个UIAbility实例对应的一个Key值
    // 当前示例指的是module1 Module的SpecifiedAbility
    if (want.abilityName === 'SpecifiedAbility') {
      // 返回的字符串Key标识为自定义拼接的字符串内容
      if (want.parameters) {
        return `SpecifiedAbilityInstance_${want.parameters.instanceKey}`;
      }
    }

    return '';
  }
}
```





# 组件
[API文档](https://developer.harmonyos.com/cn/docs/documentation/doc-references/js-apis-overview-0000001056361791)

## 基础组件
[传送门](https://developer.huawei.com/consumer/cn/training/course/slightMooc/C101667360160710997)

- Text
- Image
- TextInput
- Button
- LoadingProgress

### 引用资源类型
定义在entry/src/main/resources下的资源配置
```
// string.json
{
  "string": [
    {
      "name": "login_text",
      "value": "登录"
    }
  ]
} 

// how to use it 

Button($r('app.string.login_text))

```
## 容器组件

[传送门](https://developer.huawei.com/consumer/cn/training/course/slightMooc/C101667360160710997)

- [Column](https://developer.harmonyos.com/cn/docs/documentation/doc-references/ts-container-column-0000001333641085)
- [Row](https://developer.harmonyos.com/cn/docs/documentation/doc-references/ts-container-row-0000001281480714)

## List & ListItem & ForEach

入参: 
- space, 
- initialIndex, 
- scroller

## Grid * GridItem

入参:
- scroller

属性:
- columnsTemplate '1fr 2fr 1fr'
- rowsTemplate
- columnsGap
- rowsGap

### 滚动式布局
不设定.columnsTemplate 同时设定height即可

## 组件状态

@Prop 同步父组件状态

@Link 配合@Watch感知父组件状态变化实现

```
  // 子组件
  @Link @Watch('onClickIndexChanged') clickIndex:number;

  onClickIndexChanged(){}
```
#### 双向绑定 $ + Link
通过$操作符绑定双向传递state 

TitleComponent({isRefresh: $isSwitchData})


## Video
[传送门](https://developer.huawei.com/consumer/cn/training/course/slightMooc/C101680765314766141)
@provide
@Consume 

## 模态弹窗

- AlertDialog
- DatePickerDialog
- TextPickerDialog

- 自定义弹窗
@CustomDialog

## 动画

为组件增加动画
```ts
Image()
  .animation({
    duration: 1000,
    tempo: 1.0
  })
```

## 网络获取数据
### Web View
Web组件实现, WebControlle实现控制和交互

### Http请求

```
import http from '@ohos.net.http'

let httpRequest = http.createHttp()

httpRequest.on('headerReceive', (header) => {
 //...
})

let promise = httpRequest.request(url, {
  extraData: {},
  connectTimeout: 60000,
  readTimeout: 60000,
  header: {
    'Content-Type': 'application/json',
  }
});

promise.then(value => {
  // value.responseCode
  // value.result
  // value.header
  // value.cookies
})

```

请求某个权限是在module.json5中添加

## 存储数据

首选项存储，key-value形式
[传送门](https://developer.huawei.com/consumer/cn/training/course/slightMooc/C101667367018821971)
```
import dataPreferences from '@ohos.data.preferences';

// 在 entryAbility的onCreate获取实例

onCreate(want, launchParam) {
  PreferencesUtil.createFontPreferences(this.context);
}
// 非完整代码，看传送门
```
保存数据 put
获取数据 get
持久化数据 flush
删除数据 delete



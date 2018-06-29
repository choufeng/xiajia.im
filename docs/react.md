# React 学习记录

## 简介

目前主流的3大前端框架有`Angular`，`React`, `Vue`。 Angular更像是一个平台，大而全，Vue则简单移动，适用于快速开发，目前在工作共使用Vue1年多，甚是喜欢，但也希望在编程能力上有所提升。基于目前正在朝函数式编程的思想走，研究React是一个非常好的选择。

React是一个采用声明式，高校且灵活的构建UI的框架。

## 开始

> 本文代码使用`ES6`规范编写

### 安装

React 拥有自己的脚手架:

```
npm i -g create-react-app

create-react-app your-app

```

### 运行

```
cd your-app
npm start

```
正常情况下即可在浏览器访问： http://localhost:3000

> 如果你的3000端口处于被占用状态，会询问你是否改用其他端口，3001


### 初始结构

在创建完成的项目下初始目录结构如下


- .gitignore
- node_modules
- package.json
- public
  - favicon.ico
  - index.html
  - manifest.json
- README.md
- src
  - App.css
  - App.js
  - App.test.js
  - index.css
  - index.js
  - logo.svg
  - registerServiceWorker.js

## 继续

### JSX简介

```

class People extends React.Component {
  render() {
    return (
      <div className="people-class">
        <h1>Hello {this.props.name}</h1>
        <ul>
          <li>age: 35</li>
          <li>gerder: man</li>
          <li>address: Guangzhou, Guangdong, China</li>
        </ul>
      </div>
    );
  }
}

```

这个一个React Component的基本结构, 其中有html标签，又不完全是。这就是React特有的结构，稍后慢慢解构。

1. 通过render返回想要渲染的内容描述， React自动将其渲染到浏览器。
2. 这个component 接受一个名为props的参数, 并通过render方法返回了嵌套结构的内容。

这就是JSX语法。 JSX中允许你用任意的JavaScript表达式，他是在一对大括号中的内容。一个render就是一个React元素， 你可以把元素保存到变量中或者作为参数传递。

### 在JSX中使用表达式

```
function formatName (user) {
  return `${user.firstName} ${user.lastName}`
}

const user = {
  firstName: 'Jon',
  lastName: 'Xia'
}

const element = (
  <h1>Hello {formatName(user)}</h1>
)

ReactDOM.render(
  element,
  document.getElementById('root')
)

```

### JSX本身也是一种表达式

JSX在编译之后被转化为JavaScript对象存在，所以可以这样：

```
function getString (user) {
  if (user) {
    return <h1>Hello, {formatName(user)}</h1>
  }
  return <h1>Hello, You</h1>
}
```

### JSX属性

用引号来定义字符串值的属性
```
const element = <div tabindex="0"></div>
```

用大括号来定义JavaScript表达式的属性

```
const element = <img src={user.avatarUrl}></img>
```

### JSX嵌套 

```
const element = (
  <div>
    <h1>Hello</h1>
    <h2>You</h2>
  </div>
)
```
## 元素渲染

> 元素是构成React应用的最小单位

```
const element = <h1>Hello, World</h1>
```

### 将元素渲染到DOM中

在html页面中添加一个`id="root"`的`<div>`

```
<div id="root"></div>

```
div中的内容都将由Rect DOM管理，所以我们将其称之为 "root"节点

一般只定义一个根节点。

要将React元素渲染到根节点中，我们通过把它们传递给ReactDOM.render()来渲染到页面上

```
const element = <h1>Hello, World</h1>
ReactDOM.render(
  element,
  document.getElementById('root')
)
```

### 更新元素渲染

React 元素是`immutable`不可变的， 党员素被创建后，无法改变其内容或属性。（函数式编程的不可变性）

```
function tick () {
  const element = (
    <div>
      <h1>Hello, World</h1>
      <h2>It is {new Date().toLocaleTimeString()}.</h2>
    </div>
  )
  ReactDOM.render(
    element,
    document.getElementById('root')
  )
}

setInterval(tick, 1000)
```
**React 只会更新必要的部分**

React DOM 首先会比较元素内容先后的不同， 而在渲染过程中只会更新改变了的部分。

## 组件 & Props

> 组件将UI拆分成独立的、可复用的部分， 这样就只需要专注每一个单独的部件。

> 组件从概念上看就像函数， 接收任意的输入值， 返回一个需要在页面上展示的React元素。

### 函数定义/类定义组件

```
function Welecome (props) {
  return <h1>Hello, {props.name}</h1>
}
```
他接收一个props对象并返回一个React元素， 所以称之为函数定义组件，因为它就是一个JavaScript函数。

**使用 ES6 Class 定义一个组件**
class Welcome extends React.Component {
  render () {
    return <h1>Hello, {this.props.name}</h1>
  }
}


### 组件渲染
 
自定义组件

```
const element = <Welcome name="Jon" />

```
 
> 组件名称必须大写字母开头。

### 组合组件
 
在组件中引用其他组件，这就可以让我们用同一组件来抽象出任意层次的细节。
 
```
function Welecome (props) {
  return <h1>Hello, {props.name}</h1>
}

function App () {
  return (
    <div>
      <Welcome name="Jon" />
      <Welcome name="Jack" />
      <welcome name="Chou" />
    </div>
  )
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
}

```
 
通常一个新的React一用程序顶部是一个App组件。但是如果要讲React集成到现有的应用程序中，则可以从下而上使用像Button这样的小组件开始，组件运用到视图层顶部。
 
### 提取组件
 
```
function Comment (props) {
  return (
    <div className="Comment">
      <div className="UserInfo">
        <img className="Avatar" src={props.author.avatarUrl} />
        <div className="UserInfo-name">
           {props.author.name}
        </div>
      </div>
      <div className="Comment-text">
        {props.text}
      </div>
      <div className="Content-date">
        {formatDate(props.date)}
      </div>
    </div>
  )
}
```
 
上面 的组件由于嵌套，变得难以被修改， 可复用的部分也难以被复用。 所以让我们从其中提取出一些小组件。
 
Avatar 组件

```
function Avatar (props) {
  return (
    <img className="Avatar" src={props.user.avatarUrl} />
  )
}

```
我们建议从组件自身的角度来命名props
 
依次 再提取 UserInfo, commont, 最终得到这样

```
function Comment (props) {
  return (
    <div className="Comment">
      <Avatar user={props.author} />
      <UserInfo user={props.author} />
     </div>
     <Comment content={props} />
   )
 }
 
 ```
 
### Props只读性

组件不能修改自己的props， 这是函数式编程中“纯函数”的概念。

```
// Right
function sum (a, b)  {
  return a + b
}

// Wrong
function withdrat (a, b) {
  a = a + b
  return a
}
```

React是非常灵活的，但是有一个严格的规则：

**所有的React组件必须像纯函数一样使用props**


## State & 生命周期

State（状态）与属性十分相似， 但state是私有的，只受控于当前组件。


### 使用类封装组件

通过类允许我们使用诸如局部状态，生命周期钩子等特性。 

```
class Clock extends React.Component {
  render () {
    return (
      <div>
        <h1>Hello, World</h1>
        <h2> It is {this.props.date.toLocaleTimeString()}</h2>
      </div>
    )
  }
}

 ```

### 为类添加局部状态

```
class Clock extends React.Component {
  constructor (props) {
    super (props)
    this.state = {date: new Date()}
  }

  render () {
    return (
      <div>
        <h1>Hello, World</h1>
        <h2> It is {this.state.date.toLocaleTimeString()}</h2>
      </div>
    )
  }
}
 
ReactDOM.render(
  <Clock />,
  document.getElementById('root)
)
```
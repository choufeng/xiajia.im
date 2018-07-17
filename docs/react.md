# React 学习记录

## 简介

目前主流的3大前端框架有`Angular`，`React`, `Vue`。 Angular更像是一个平台，大而全，Vue则简单移动，适用于快速开发，目前在工作共使用Vue1年多，甚是喜欢，但也希望在编程能力上有所提升。基于目前正在朝函数式编程的思想走，研究React是一个非常好的选择。

React是一个采用声明式，高校且灵活的构建UI的框架。

[TOC]

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

### 深入JSX

!> **本质上RSX只是`React.createElement`的语法糖**

如果没有子代码， 可以自闭和

```
<God />
```
### 指定React元素类型

大写开头的JSX标签表示一个React组件， 编译为同名变量

!> **React必须声明**

```
import CustomButton from './CustomButton'

function show () {
  return <CustomButton />
}
```
### 点表示法

可以使用JSX中的点表示React组件. 在JSX中使用组件

```
import React from 'react'
const MyCom = {
  DatePicker: function DatePicker(props) {
    return <div>oooooo</div>
  }
}

function BlueDaePicker () {
  return <MyCom.DatePicker />
}

### 首字母大写

元素类型以小写字母开头， 表示一个内置的组件
应该以大写开头命名组件。


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

```
class Welcome extends React.Component {
  render () {
    return <h1>Hello, {this.props.name}</h1>
  }
}
```

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
// Correct
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
### 添加生命周期方法

在组件第一次加载时，成为`挂载`
在组件生成的DOM被移除的事后，称为`卸载`

我们可以在组件类上什么特殊的方法，当组件挂载或者卸载的事后运行

```
class Clock extends React.Component{
  constructor (props) {
    super(props)
    this.state = {date: new Date()}
  }

  componentDidMount () {
    this.timerID = serInterval(
      () => this.tick(), 1000
    )
  }
  componentWillUnmount() {
    clearInterval(this.timerID)
  }

  render () {
    return (
      <div>
        <h1>Hello, World</h1>
        <h2>It is {this.state.date.toLocaleTimeString()}</h2>
      </div>
    )
  }
}
```
!> **如果你不在render()中使用某些东西，他就不应该在状态中**

上面代码的调用顺序：
1. 当 `<Clock />` 被传递给ReactDOM.render()时， React调用Clock组件的构造函数， 设定初始化`state`
2. 然后调用 `render`方法， 了解屏幕上应该显示什么内容，并渲染输出。
3. 当 `Clock`的输出插入到DOM中时， 调用`componentDidMount() ` 在其中设定一个计时器，每秒调用一次`tick()`
4. 每秒掉哟那该 `tick()`时， 组件通过使用包含当前时间的对象调用 `setState()`来更新UI， 通过调用 setState(), React知道状态一件改变，再次调用`render()`方法来确定屏幕上要显示什么。 这次， render中的 this.state.date是不同的，所以渲染输出了更新的时间，更新了DOM
5. 一旦组件被移除， `componentWillUnmount()` 将被执行。


### 正确的使用状态

```
// Wrong
this.state.comment = 'Hello'

// Correct
this.setstate({comment: 'Hello'})

```

### 更新可能是异步的

React会将多个setState()调用合并成一个调用来提高性能。

因为 `this.props` 和 `this.state`可能是异步更新的， 所以不应该依靠他们的值来计算下一个状态。应对state的异步更新合并，使用另一个接受一个函数作为参数的setState。

```
// Wrong
this.setState({
  counter: this.state.counter + this.props.increment
})

//Correct
this.setState((prevState, props) => {
  counter: prevState.counter + props.increment
})
```

### 状态更新合并

当调用`setState()`时， React会把你提供的对象合并到当前状态

```
constructor (props) {
  super (props)
  this.state = {
    post: [],
    comments: []
  }
}
componentDidMount () {
  fetchPosts().then(res => {
    this.setState({
      posts: res.data
    })
  })

  fetchComments().then(res ={
    this.setState({
      comments: res.data
    })
  })
}
```
这里的合并是浅合并， 即 执行 `this.setState({comments})`事完整保留了 `this.satate.posts`同时只是替换了`this.state.comments`

### 数据的自顶下下流动

任何组件都不知道其他组件的状态情况，也不关心其他组件是被定义为一个函数还是一个类。 

这就是状态是局部特性。除了拥有并设置它的组件外， 其他组件不可访问。

组件可以选择将其状态作为属性传递给子组件


```
<h2> It is <this.state.date.toLocaleTimeString()></h2>

// or

<FormattedDate date={this.state.date} />

function FormattedDate (props) {
  return <h2>It is {props.date.toLocaleTimeString()}
}

```

这就是 `自顶向下`的`单项数据流`。 任何状态始终由某些特定组件所有，并影响着组件树下方的组件。

### State 与 不可变对象

1. State类型是不可变类型 （数字， 字符串， 布尔值， null, undefined）

直接赋值即可

```
this.setState({
  count: 2
})
```

2. State类型是数组

```
// 方法1, 使用preState, concat创建新数组
this.setState(preState => ({
  books: preState.books.concat(['new one'])
}))

// 方法2， ES6 spread syntax
this.setState(preState => ({
  books: [...preState.books, 'new one']
}))

this.setState(preState => ({
  books: preState.books.slice(1, 3)
}))

this.setState(preState => ({
  books: preState.books.filter(i => i !== 'Angular')
}))

// 方法3, Ramda
this.setState(preState => ({
  books: R.append('new one')(preState)
}))

```

!> **不要使用push, pop,shift, unshift, splice等`非纯函数`方法修改数组类型的State， 因为这些方法是在元数组基础上修改的， 而concat, slice, filter`纯函数`回返回一个新数组。**

3. State类型是普通对象(不包含字符串和数组)

```
  //1. 使用Object.assgin
  this.setState(preState => ({
    person: Object.assign({}, preState.person, {name: 'Jon})
  }))

  //2. 使用对象扩展语法
  this.setState(preState => ({
    person: {...preState.person, name: 'Jon'}
  }))

  //3. Ramda
  this.setState(preState => ({
    person: R.assoc('name', 'Jon', preState)
  }))
```

## 事件处理

!> **React事件绑定采用小驼峰命名法**

!> **如果采用JSX语法需要传入一个函数作为事件处理函数， 而不是一个字符串**

!> **不能使用`return false`来阻止默认行为, 而是必须明确使用`preventDefault`**

```
<button onClick={activeClick}>
Click
</button>

function activeClick (e) {
  e.preventDefault()
}
```

** 使用`属性初始化器（transform-class-properties）`可以简化`this`问题， 页可以在回调函数中使用箭头函数处理**

```
class LoginngButton extends React.Component {
  handleClick () {
    console.log(this)
  }

  render () {
    return (
      <button onClick={(e) => this.handleClick(e)}>
        Click
      </button>
    )
  }
}
```
### 向事件处理程序传递参数

通常我们会传递如id来确定要处理哪一行数据，传递参数的方法如下：

```
<button onClick={(e) => this.deleteRow(id, e)}> Delete </button>
<button onClick={this.deleteRow.bind(this, id)}> Delete </button>
```

通过箭头函数， e需要被显示传递， 使用bind方式则可以把事件对象一件更多的参数隐式传递。

## 条件渲染
React的条件渲染和JavaScript中的一致

```
function UserGreeting (props) {
  return <h1>Hello Jon</h1>
}

function GuestGreeting (props) {
  return <h1>Hello, Guest</h1>
}

function Greeting (props) {
  const isLoggedIn = props.isLoggedIn
  if (isLoggedIn) {
    return <UserGreeting />
  } else {
    return <GuestGreetting />
  }
}

ReactDOM.render(
  <Greeting isLoggedIn={false}>,
  docuemnt.getElementById('root')
)
```

### 元素变量

可以用变量来存储元素。 可以有条件的渲染组件的一部分，输出其他部分。

```
function LoginButton (props) {
  return (
    <button onClick={props.onClick}>Login</button>
  )
}

function logoutButton (props) {
  return (
    <button onClick={props.onClick}> Logout </button>
  )
}

class LoginControl extends React.Component {
  constructo (props) {
    super(props)
    this.handleLoginClick = this.handleLoginClick.bind(this)
    this.handleLogoutClick = this.handleLogoutClick.bind(this)
    this.state = {isLoggedIn: false}
  }

  handleLoginClick () {
    this.setState({isLoggedIn: true})
  }k

  handleLogoutClick () {
    this.setState({isLoggedIn: false})
  }

  render () {
    const isLoggedIn = this.state.isLoggedIn

    let button = null
    if (isLoggedIn) {
      button = <logoutButton onClick={this.handleLogoutClick} />
    } else {
      button = <loginButton onClick={this.handleLoginClick} />
    }
  }

  return (
    <div>
      <Greeting isLoggedIn={isLoggedIn} />
      {button}
    </div>
  )
}
```

### 与运算符 &&

```
function Box (props) {
  return (
    <div>
      <h1>Hello</h1>
      {
        isLoginedIn && 
          <h2> Jon </h2>
      }
  )
}
```

### 三目运算

```
function Box (props) {
  const isLoggedIn = false
  return (
    <div> Your are {isLoggedIn ? 'users' : 'guest} </div>
    <div> {isLoggedIn ? (
      <logoutButton />
    ) : (
      <loginButton />
    )}
  )
}
```

### 阻止组件渲染

在极少数情况下，我们希望隐藏组件，即使它被其他组件渲染。 `render`方法反回null

```
function WarningBanner (props) {
  if (!props.warn) {
    return null
  }
}

class Page extends React.Component {
  constructo (props) {
    super(props)
    this.state = {showWarning: true}
    this.handleToggleClick = this.handleToggleClick.bind(this)
  }

  handleToggleClick () {
    this.setState(prevState => ({
      showWarning: !prevState.showWarning
    }))
  }

  render () {
    return (
      <div>
        <WarningBanner warn={this.state.showWarning} />
        <button onClick={this.handleToggleClick}>
          {this.state.showWarning ? 'Hide' : 'Show'}
        </button>
      </div>
    )
  }

  ReactDOM.render(
    <Page />,
    document.getelementById('root')
  )
}
```

## 列表 & keys

列表的渲染通过 map()

```
const n = [1 ,2, 3, 4, 5, 6]
const listItems = n.map(i => <li>{i}</li>)

ReactDOM.render(
  <ul>{listItems}</ul>
)
```

### 基础列表组件

```
function NumberList (props) {
  const n = props.n
  const listItems = n.map(i => <li key={i.toStrin()}>{i}</li>)
  return (
    <ul>{listItems}</ul>
  )
}

const n = [1, 2, 3, 4, 5]
ReactDOM.render(
  <NumberList n={n} />,
  docuement.getElementById('root')
)
```
### Keys

上面的代码中有一个key， 它用来识别元素发生变化的情况进行。key应该是唯一的。 一般不建议用列表的顺序赋予key

```
const listItems = n.map(item, index) => <li key={index}>{item}</li>
```
### 用keys提取组件

Key值在它和它的兄弟节点对比是有意义， 例如提取一个ListItems组件， 要确保key保存在<ListItem />上， 而不是放到ListItem中的li元素

```
// wrong
function Listitem (props) {
  return (
    // 这里错了
    <li key={i}>{li}</li>
  )
}

const listItems = n.map(i => <listItem value={i}>)

return (
  <ul>
    {listItems}
  </ul>
)

// Correct

function List (props) {
  return <li>{props.i}</li>
}

// 这才正确
const listItems = n.map(i => <ListItem key={i} value={i} />)
```

**元素的key在它的兄弟元素之间是唯一的, 不同的数组可以相同**

**key是给react用的，不能用props.key读取到， 需要的情况再增加传递 例如 props.id**

### 在JSX中使用map()

```
function NumberList (props) {
  const n = props.n
  return (
    <ul>
      {
        n.map(i => <ListItem key={i.toStrin()} value={i} />)
      }
    </ul>
  )
}
```
**如果一个map()嵌套了太多层级，那就是需要提取组件的时候了**

## 表单: 受控组件

### 受控组件

`input`, `textarea`, `select` 这类表单会维护自身状态，并根据用户输入进行更新， 但是在React中，可变状态通常保存在组件的state中， 并只能用setState更新。

React将其变为以中单一数据源的状态来结合， React负责渲染表单组件， 组件空之用户输入时发生的变化。 称为“受控组件”

#### input

```
class NameForm extends React.Component {
  constructo (props) {
    super(props)
    this.state = {
      value: ''
    }
  }

  handleChange (e) {
    this.setState({value: event.target.value})
  }

  handleSubmit (e) {
    alert(this.state.value)
    e.preventDefault()
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <label>
          Name:
          <input type="text" value={this.state.value} onChange={this.handleChange}>
        </label>
      </form>
    )
  }
}

```
使用受控组件，每个状态的改变都有一个和它相关的处理函数。 这样就可以直接修改或验证用户输入。 例如要显示输入全部都是大写。

```
handleChange (e) {
  this.setState({value: e.target.value.toUpperCase()})
}
```

#### textarea

在React中用value属性来替代textarea。

```
class EasyTeatarea extends React.Component {
  constructo(props) {
    super(props)
    this.state = {
      value: 'test'
    }
    this.handleChange = this.handleChange.bind(this)
    this.handleSubmit = this.handleSbumit.bind(this)
  }

  handleChange (e) {
    this.setState({value: e.target.value})
  }

  handleSubmit (e) {
    alert(this.state.value)
    e.preventDefault()
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <textarea value={this.state.value} onChange={this.handleChange} />
      </form>
    )
  }
}
```
#### select

```
class EasySelect extends React.Component {
  constructo(props) {
    this.state = {value: 'planA'}
    this.handleChange = this.handleChange.bind(this)
  }

  handleChange(e) {
    this.setState({value: e.target.value})
  }

  render() {
    return (
      <form>
        <select value={this.state.value} onChange={this.handleChange}>
          <option value="planA">PlanA</option>
          <option value="planB">PlanB</option>
          <option value="planC">PlanC</option>
        </select>
      </form>
    )
  }
}
```

#### file input

请查阅 [文件输入标签](#fileinput)

#### 多个输入的解决方法

```
class easyInputs  extends React.Component {
  constructo(props) {
    super(props)
    this.state = {
      a: true,
      b: 2
    }
    this.handleInputChange = this.handleInputChange.bind(this)
  }

  handleInputChange (e) {
    const target = e.target
    const value = target.type === 'checkbox > target.checked : target.value
    this.setState({
      [name]: value
    })
  }

  render () {
    return (
      <form>
        <input name="a" type="checkbox" checked={this.state.a} onChange={this.handleInputChange} />
        <input name="b" type="number" value={this.state.b} onChange={this.handleInputChange}>
      </form>
    )
  }
}
```
这里使用了 ES6的 [`计算属性名`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#Computed_property_names) 语法 

```
this.setState({
  [name]: value
})
```
### 受控组件的替代方法

受控组件需要为数据可能发生的每一种方式都编写一个事件处理程序，并通过一个组件来管理全部状态，大多数情况下还好，但在某些情况下使用比较繁琐,可以改用 `非受控组件`技术来替代。


## 非受控组件

编写一个非受控组件， 而非为每个状态更新编写事件处理， 可以使用ref 从DOM获取表单值

```
class newForm extends React.Component {
  constructo(props) {
    super(props)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleSubmit(e) {
    this.input.value
    e.preventDefault()
  }

  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <input type="text" ref={(input) => this.input = input}>
      </form>
    )
  }
}
```

清楚俩解何时使用哪种组件（受控组件和非受控组件）， 阅读这篇文章[Controlled and uncontrolled form inputs in React don't have to be complicated](https://goshakkk.name/controlled-vs-uncontrolled-inputs-react/)


### 默认值

```
render() {
  return (
    <input defaultValue="90" type="text" ref={(input) => this.input = input}>
  )
}
```

<span id="fileinput"></span>
### 文件标签

在React中，`<input type="file" />` 始终是一个不受控组件，因为它的值只能有用户设置，而不是以编程方式设置。

你应该使用File API与文件进行交互

```
class FileInput extends React.Component {
  constructor(props) {
    super(props)
    this.handleSubmit = this.handleSubmit.bind(this)
  }

  handleSubmit(e) {
    alert(this.fileInput.files[0].name)
    e.preventDefault()
  }
  
  render() {
    return (
      Upload file: <input type="file" ref={input => this.fileInput = input}>
    )
  }
}
```
## 状态提升

当多个组件需要共用状态时， 把state提升到共同的父组件中进行管理。

创建一个组件， 接受温度为props

```
function BoilingVerdict(props) {
  if (props.celsius >= 100) {
    return <p>烧开了</>
  }
  return <p>水没烧开</p>
}
```

创建一个组件，渲染一个input输入温度

```
class Calculator extends React.Component {
  constructor(props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.state = {temperature: ''}
  }

  handleChange(e) {
    this.setState({temperature: e.target.value})
  }
  
  render() {
    const temperature = this.state.temperature
    return (
      <input value={temperature} onChange={this.handleChange} />
      <BoilingVerdict celsius={parseFloat(temperature)}>
    )
  }
}
```
增加一个需求， 要显示摄氏度和华氏度。 我们从Calculator中抽离出信组件

```
const scaleNames = {
  c: 'Celsius',
  f: 'Fahrenheit'
}

class TemperatureInput extends React.Component {
  constructo(props) {
    super(props)
    this.handleChange = this.handleChange.bind(this)
    this.state = {temperature: ''}
  }
  handleChange(e) {
    this.setState({temperature: e.target.value})
  }
  render() {
    const temperature = this.state.temperature
    const scale = this.props.scale
    return (
      <input value={temperature} onChange="this.handleChange}>
    )
  }
}

class Calculator extends React.Component {
  render () {
    return (
      <div>
        <TemperatureInput scale="c" />
        <TemperatureInput scale="f" />
      </div>
    )
  }
}
```
至此， 输入狂中输入时候并没有联动更新，继续

```
function toCelsius(f) {
  return (f - 32) * 5 / 9
}

function toFahrenheit(c) {
  return (c * 9 / 5) + 32
}

function tryConvert(temperature, convert) {
  const input = parseFloat(temperature)
  if (Number.isNan(input)) {
    return ''
  }
  const output = convert(input)
  const rounded = Math.round(output * 1000) / 1000
  return rounded.toStrin()
}

```
先创建了互转温度的算法，再创建了非法内容输入的检查

```
render() {
  const temperature = this.props.temperature
}
// 把子组件状态改为 props

handleChange (e) {
  this.props.ontemperatureChange(e.target.value)
}

// 父组件调用如下
<Temperatureinput scale="c" temperature={celsius} onTemperatureChange={this.handleCelsiusChange}>

```
由父组件提供操作方法

!> **在React中任何可变数据理应只有一个单一“数据源”， 状态都是首先添加在需要渲染的组件中， 如果另外组件也需要这些数据，则应提升到共同的父附件中， 保持`自上而下的数据流`。**

## 组合 与 继承

对于一些组件不能提前知道他们的子组件的情况， 使用`children`属性将子元素直接传递输出

```

function FancyBorder(props) {
  return (
    <div className={'cc-' + props.color}>
      {props.children}
    </div>
  )
}

function WelcomeDialog() {
  return (
    <FancyBoarder color="blue">
      <h1> Welecome </h1>
      <p> Thank you</p>
    </FancyBoarder>
  )
}

```

对于在组件中有多个入口的情况，可以使用自己约定的属性而非`children`

```
function SplitPane(props) {
  return (
    <div>
      <div>
        {props.left}
      </div>
      <div>
        {props.right}
      </div>
    </div>
  )
}

function App() {
  return (
    <SplitPane left={<Contacts />} right={<Chat />}>
  )
}
```

### 特殊实例

当一个组件是另一个组件的特殊实例时，通过组合来实现。通过配置属性用较特殊的组件来渲染较通用的组件

```
function Dialog(props) {
  return (
    <FancyBorder color="blue">
      <h1>{props.title}</h1>
      <p>{props.message}</p>
    </FancyBorder>
  )
}

function WelcomeDialog() {
  return (
    <Dialog title="Welcome" message="Thank you" />
  )
}
```

Class版
```
function Dialog(props) {
  return (
    <FancyBorder color="blud">
      <h1>{props.title}</h1>
      <p>{props.message}</p>
      {props.children}
    </FancyBorder>
  )
}

class SignUpDialog extends React.Component {
  constructor(props) {
    super (props)
    this.handleChange = this.handleChange.bind(this)
    this.handleSignUp = this.handleSignUp.bind(this)
    this.state = {login: ''}
  }
  render() {
    return (
      <Dialog title="Mars" message="I'm Comming">
        <input value={this.state.login} onChange={this.handleChange} />
        <button onClick={this.handleSignUp}>Let Go</button>
      </Dialog>
    )
  }

  handleChange(e) {
    this.setState({login: e.target.value})
  }

  handleSignUp() {
    alert(`Welcome to Mars, ${this.state.login}`)
  }
}
```

### 关于继承

属性和组合的方式提供了清晰安全的自定义组件方式， 继承？ 不存在的。

> 类型检查只在开发模式下进行

## 使用prop-types进行类型检查

React内置的类型检查功能是 prop-types

```
import PropTypes from 'prop-types'

class Greeting extends React.Component {
  render () {
    return (
      <h1>Hello, {this.props.name}</h1>
    )
  }
}

Greeting.propTypes = {
  name: PropTypes.string
}

```

PropTypes类型有: 

```
import PropTypes from 'prop-types'
MyComponent.propTypes = {
  // JS原生类型
  optionalArray: PropTypes.array,
  optionalBool: PropTypes.bool,
  optionalFunc: PropTypes.func,
  optionalNumber: PropTypes.number,
  optionalObject: PropTypes.object,
  optionalString: PropTypes.string,
  optionalSymbol: PropTypes.symbol

  // 任何可被渲染的元素(数字，字符串，子元素， 数组)
  optionalNode: PropTypes.node,

  // React元素
  optionalElement: PropTypes.element,

  // 实例
  optionalMessage: PropTypes.instanceOf(Message),

  // 属性和子是某个特定值之一
  optionalEnum: PropTypes.oneOf(['A', 'B']),

  // 列觉类型之一的对象
  optionalUnion: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.instanceOf(Message)
  ]),

  // 指定元素类型的数组
  optionalArrayOf: PropTypes.arrayOf(PropTypes.number),

  // 指定类型的对象
  optionalObjectOf: PropTypes.objectOf(PropTypes.number),

  // 指定属性，类型的对象
  optionalObjectWithShape: PropTypes.shape({
    color: PropTypes.string,
    fontSize: PropTypes.number
  })

  // 在任何propTypes属性后加`.isRequired`， 父组件为提供会报错
  requiredFunc: PropTypes.func.isRequired,

  // 任意类型
  requiredAny: PropTypes.any.isRequired,

  // 可以制定一个自定义验证器， 在验证失败是返回一个Error对象（oneOfType）中不起作用
  customProp: function(props, propName, componentName) {
    if (!/matchme/.test(props[propName])) {
      return new Error(
        'error message
      )
    }
  }

  // 可以提供一个自定义的`arrayOf`或`objectOf`验证器， 失败时返回Error对象， 用于验证数组或者对象的每一个值。 验证器的前两个参数的第一个是数组或者对象本身的值，第二个是他们对应的键。

  customArrayProp: PropTypes.arrayOf(function(propValue, key, componentName, location, propFullName) {
    if (!/matchme/.test(propValue[key])) {
      return new Error(
        'some error'
      )
    }
  })
}

```

使用 PropTypes.element可以指定只传递一个子代

```
import PropTypes from 'prop-types'

class MyCom extends React.Component {
  render () {
    const children = this.props.children
    return (
      <div>{children}</div>
    )
  }
}

MyCom.propTypes = {
  children: PropTypes.element.isRequired
}

```

设置默认属性值, 则父组件不一定要传入

```
Greeting.defaultProps = {
  name: 'Jon'
}
```

## 静态类型检查

Flow 是由Facebook开发的JS代码静态类型检查器， 静态类型检查可以在开发阶段尽早发现错误。

```
npm i --save-dev flow-bin
npm run flow init
```

运行`npm run flow init`前添加flow到`package.json`

```
{
  “scripts": {
    "flow": "flow"
  }
}
```


!> `TODO` Flow详细使用将会单独编写


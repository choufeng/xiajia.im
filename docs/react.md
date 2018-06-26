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



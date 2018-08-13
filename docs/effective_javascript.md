# Effective JavaScript Reading Notes

> `Effective JavaScript` 读书笔记整理

## No.1  Know Which javaScript You Are Using

尽可能了解各个版本的JavaScript和各浏览器版本的兼容性。

严格模式 `use strict` 在不同的运行环境下仍然可能产生不同的结果。

严格模式可以应用在整个脚本中，也可以只用在单个函数中。

谨慎而渐进式的使用严格模式， 严格模式和非严格模式的脚本合并也可能产生意外的结果。

## No.2 Understand JavaScript's Floating-Point Numbers

JS中的数字只有一种类型`Number`， 所有数字都是以64位的双精度浮点数存储。 所以整数只是其一个子集。

所以坑来了

```
8 | 1 // 9
(8).toString(2) // 1000
parseInt("1001", 2) // 9
0.1 + 0.2 // 0.30000000000000004

OMZ...
```
解决方法

```
10 + 20 = 30
```

> 按位运算符将数字视为是32位有符号整数。

## No.3 Beware of Implicit Coercions

某些强制类型转换会让你摸不着头脑

```
3 + true // 4
"2" + 3 // "23"
1 + 2 + "3" // "33"
(1 + 2) + "3" // "33"
1 + "2" + 3 // "123"
(1 + "2") + 3 // "123"
"17" * 3 // 51
"8" | "1" // 9
```

`NaN` 也会让人抓狂

```
var x = NaN
x === NaN // false

isNaN(NaN) // true
isNaN("foo") //true
isNaN(undefined) //true
isNaN({}) //true
isNaN({key: 'value'}) //true

```

不能用相等运算来判断一个值是否是`NaN`
尽量使用`Number.isNaN(value)` 来替代全局函数 `isNaN(value)`。

## No.4 Prefer Primitives to Object Wrappers

Js有5种原始类型: booleans, numbers, strings, null, undefined

然而标准库还提供了用于将booleans, numbers, strings包装为对象的构造函数

所以
```
let s = new String("Jon")
s[2] // n

typeof s // object
```

## No.5 Avoid using == with Mixed Types

```
1.0e0 == {valueOf: function() {return true}} // true
```

相等运算符可在不同类型中比较， 比较的不是值，而是是否指向同一个对象。

盗个图：
![](https://pic1.zhimg.com/80/41b28b0c6def1909e0ad1da86093e620_hd.png)

所以谨慎分析使用`==`和`===`是很有必要的。
`==` 隐藏的强制模式会让错误产生的几率变大

`===`更容易清楚的表达程序语义，除非你要使用类型指向比较。



## No.6 Learn the Limits of Semicolon Insertion

分号


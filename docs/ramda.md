# Ramda.js

> ramda 是一个js函数库，易于函数式编程。本文是在 [Ramda 函数简介](https://adispring.coding.me/2017/10/21/What-Function-Should-I-Use/)的基础上，处于练习记忆目的重写的，感谢原作者ramda.cn的创始人wangzengdi的提炼。

> 当前列表基于version: 0.25.0

> Links: [Ramdajs](https://ramdajs.com/docs/)  [Ramda中文](http://ramda.cn/docs/)

## LIST 列表
| Action | Function |
|---|---|
|列表转换| [map](http://ramda.cn/docs/#map)|
|列表过滤：过滤出符合条件的元素|[filter](http://ramda.cn/docs/#filter)|
|列表过滤：过滤出符合条件的元素|[reject](http://ramda.cn/docs/#reject)|
|列表折叠：从左向右对所有元素依次归约（折叠）|[reduce](http://ramda.cn/docs/#reduce)|
|列表折叠：从右向左对所有元素依次归约（折叠）|[reduceRight](http://ramda.cn/docs/#reduceRight)|
|列表折叠(增强版)|[transduce](http://ramda.cn/docs/#transduce)|
|列表折叠(增强版)|[uniq](http://ramda.cn/docs/#uniq)|
|列表去重：对处理后的元素做相等性判断|[uniqBy](http://ramda.cn/docs/#uniqBy)|
|列表去重：通过断言函数（predicate）判断|[uniqWith](http://ramda.cn/docs/#uniqWith)|
|列表排序|[sort](http://ramda.cn/docs/#sort)|
|列表翻转|[reverse](http://ramda.cn/docs/#reverse)|
|列表翻转|[concat](http://ramda.cn/docs/#concat)|
|列表长度|[length](http://ramda.cn/docs/#length)|
|列表表头拼接元素|[prepend](http://ramda.cn/docs/#prepend)|
|列表表尾拼接元素|[append](http://ramda.cn/docs/#append)|
|列表表尾拼接元素|[adjust](http://ramda.cn/docs/#adjust)|
|替换指定索引处的值|[update](http://ramda.cn/docs/#update)|
|将列表元素转换为其指定的属性值，等价于 R.map(R.prop)|[pluck](http://ramda.cn/docs/#pluck)|
|为列表迭代函数添加两个参数：索引和整个列表|[addIndex](http://ramda.cn/docs/#addIndex)|
|取出特定索引范围内的元素|[slice](http://ramda.cn/docs/#slice)|
|将列表通过分隔符拼接成字符串|[join](http://ramda.cn/docs/#join)|
|取出第 N 个元素|[nth](http://ramda.cn/docs/#nth)|
|取出前 N 个元素|[take](http://ramda.cn/docs/#take)|
|取出后 N 个元素|[takeLast](http://ramda.cn/docs/#takeLast)|
|从前往后取出满足条件的元素，直至不满足条件的首个元素止|[takeWhile](http://ramda.cn/docs/#takeWhile)|
|从后向前取出满足条件的元素，直至不满足条件的首个元素止|[takeLastWhile](http://ramda.cn/docs/#takeLastWhile)|
|删除前 N 个元素|[drop](http://ramda.cn/docs/#drop)|
|删除后 N 个元素|[dropLast](http://ramda.cn/docs/#dropLast)|
|从前往后删除满足条件的元素，直至不满足条件的首个元素止|[dropWhile](http://ramda.cn/docs/#dropWhile)|
|从后向前删除满足条件的元素，直至不满足条件的首个元素止|[dropLastWhile](http://ramda.cn/docs/#dropLastWhile)|
|取出首个元素|[head](http://ramda.cn/docs/#head)|
|取出末尾元素|[last](http://ramda.cn/docs/#last)|
|取出前 length - 1 个元素（删除末尾元素）|[init](http://ramda.cn/docs/#init)|
|取出后 length - 1 个元素（删除首个元素）|[tail](http://ramda.cn/docs/#tail)|
|求差集：{a∣a∈xs ∩ a∉ys}|[difference](http://ramda.cn/docs/#difference)|
|求差集：{a∣a∉xs ∩ a∈ys}|[without](http://ramda.cn/docs/#without)|
|求差集：根据条件计算第一个列表与第二个列表的差集|[differenceWith](http://ramda.cn/docs/#differenceWith)|
|求对称差集：{(xs ∪ ys) - (xs ∩ ys)}|[symmetricDifference](http://ramda.cn/docs/#symmetricDifference)|
|求对称差集：根据条件计算所有不属于两个列表交集的元素|[symmetricDifferenceWith](http://ramda.cn/docs/#symmetricDifferenceWith)|
|求交集：{xs ∩ ys}|[intersection](http://ramda.cn/docs/#intersection)|
|求交集：从 xs 中挑选出在 ys 中符合条件的元素|[innerJoin](http://ramda.cn/docs/#innerJoin)|
|求并集：{xs ∪ ys}|[union](http://ramda.cn/docs/#union)|
|求并集：根据条件判断两元素是否重复|[unionWith](http://ramda.cn/docs/#unionWith)|
|查找列表中首个满足条件的元素|[find](http://ramda.cn/docs/#find)|
|查找列表中首个满足条件的元素的索引|[findIndex](http://ramda.cn/docs/#findIndex)|
|查找列表中最后一个满足条件的元素|[findLast](http://ramda.cn/docs/#findLast)|
|查找列表中最后一个满足条件的元素|[findLastIndex](http://ramda.cn/docs/#findLastIndex)|
|查找给定元素在列表中首次出现时的索引|[indexOf](http://ramda.cn/docs/#indexOf)|
|查找给定元素在列表中末次出现时的索引|[lastIndexOf](http://ramda.cn/docs/#lastIndexOf)|
|列表判断：判断元素是否包含在列表中|[contains](http://ramda.cn/docs/#contains)|
|列表判断：判断是否列表中所有元素都满足条件|[all](http://ramda.cn/docs/#all)|
|列表判断：判断是否列表中所有元素都不满足条件|[none](http://ramda.cn/docs/#none)|
|列表判断：判断是否列表中存在满足条件的元素|[any](http://ramda.cn/docs/#any)|
|列表判断：判断列表是否以给定的值开头|[startsWith](http://ramda.cn/docs/#startsWith)|
|列表判断：判断列表是否以给定的值结尾|[endsWith](http://ramda.cn/docs/#endsWith)|
|列表分组：按是否符合条件，将元素分为两组|[partition](http://ramda.cn/docs/#partition)|
|列表分组：对列表中元素按指定规则分组|[groupBy](http://ramda.cn/docs/#groupBy)|
|列表分段：对列表中元素按指定规则分段|[groupWith](http://ramda.cn/docs/#groupWith)|
|列表分组：对列表中元素按指定规则分组折叠|[reduceBy](http://ramda.cn/docs/#reduceBy)|
|列表分割：在指定索引处|[splitAt](http://ramda.cn/docs/#splitAt)|
|列表分割：每隔 N 个元素|[splitEvery](http://ramda.cn/docs/#splitEvery)|
|列表分割：按条件分割|[splitWhen](http://ramda.cn/docs/#splitWhen)|
|对两个列表相同位置的元素进行组合|[zip](http://ramda.cn/docs/#zip)|
|对两个列表相同位置的元素进行键值对组合，fromPairs ∘ zip|[zipObj](http://ramda.cn/docs/#zipObj)|
|对两个列表相同位置的元素按规则进行组合|[zipWith](http://ramda.cn/docs/#zipWith)|
|由一系列键值对列表创建对象|[fromPairs](http://ramda.cn/docs/#fromPairs)|
|列表彻底扁平化|[flatten](http://ramda.cn/docs/#flatten)|
|列表单层扁平化|[unnest](http://ramda.cn/docs/#unnest)|
|先对列表内元素做 Kleisli 映射，再做扁平化，flatMap，>>=|[chain](http://ramda.cn/docs/#chain)|
|函子间的自然变化？|[sequence](http://ramda.cn/docs/#sequence)|
|列表插入|[insert](http://ramda.cn/docs/#insert)|
|将子列表插入列表|[insertAll](http://ramda.cn/docs/#insertAll)|
|在列表元素之间插入分割元素|[intersperse](http://ramda.cn/docs/#intersperse)|
|列表转换 + 折叠？|[into](http://ramda.cn/docs/#into)|
|将 reduce 的迭代过程记录下来|[mapAccum](http://ramda.cn/docs/#mapAccum)|
|将 reduceRight 的迭代过程记录下来|[mapAccumRight](http://ramda.cn/docs/#mapAccumRight)|
|合并多个对象|[mergeAll](http://ramda.cn/docs/#mergeAll)|
|由两个参数组成列表|[pair](http://ramda.cn/docs/#pair)|
|从 reduce 或 transduce 中提前退出迭代时的值|[reduced](http://ramda.cn/docs/#reduced)|
|可以提前退出的 reduce 迭代|[reduceWhile](http://ramda.cn/docs/#reduceWhile)|
|列表生成：生成左闭右开的升序数字列表|[range](http://ramda.cn/docs/#range)|
|列表生成：生成含有 N 个同一元素的列表|[repeat](http://ramda.cn/docs/#repeat)|
|列表生成：函数执行 N 次，生成 N 元列表|[times](http://ramda.cn/docs/#times)|
|列表生成：通过迭代函数生成列表|[unfold](http://ramda.cn/docs/#unfold)|
|二维列表行列式转换|[transpose](http://ramda.cn/docs/#transpose)|
|二维列表生成|[xprod](http://ramda.cn/docs/#xprod)|

## OBJECT 对象
| Action | Function |
|---|---|
|属性设置|[assoc](http://ramda.cn/docs/#assoc)|
|属性按路径设置|[assocPath](http://ramda.cn/docs/#assocPath)|
|属性删除|[dissoc](http://ramda.cn/docs/#dissoc)|
|属性按路径删除|[dissocPath](http://ramda.cn/docs/#dissocPath)|
|获取属性值|[prop](http://ramda.cn/docs/#prop)|
|获取属性值，带有默认值|[propOr](http://ramda.cn/docs/#propOr)|
|获取路径上的属性值|[path](http://ramda.cn/docs/#path)|
|获取路径上的属性值，带有默认值|[pathOr](http://ramda.cn/docs/#pathOr)|
|判断属性是否满足给定的条件|[propSatisfies](http://ramda.cn/docs/#propSatisfies)|
|判断属性是否与给定值相等|[propEq](http://ramda.cn/docs/#propEq)|
|判断两个对象指定的属性值是否相等|[eqProps](http://ramda.cn/docs/#eqProps)|
|判断路径上的属性值是否满足给定的条件|[pathSatisfies](http://ramda.cn/docs/#pathSatisfies)|
|判断路径上的属性值是否与给定值相等|[pathEq](http://ramda.cn/docs/#pathEq)|
|获取属性值组成的列表|[props](http://ramda.cn/docs/#props)|
|判断属性是否为给定类型|[propls](http://ramda.cn/docs/#propls)|
|判断多个属性是否同时满足给定的条件|[where](http://ramda.cn/docs/#where)|
|判断多个属性是否等于给定对应属性值|[whereEq](http://ramda.cn/docs/#whereEq)|
|删除多个属性|[omit](http://ramda.cn/docs/#omit)|
|提取多个属性|[pick](http://ramda.cn/docs/#pick)|
|提取多个属性|[pickAll](http://ramda.cn/docs/#pickAll)|
|对列表中元素提取多个属性，模拟 SQL 的 select|[project](http://ramda.cn/docs/#project)|
|提取键值满足条件的属性|[pickBy](http://ramda.cn/docs/#pickBy)|
|对特定属性进行特定变换|[evolve](http://ramda.cn/docs/#evolve)|
|是否包含指定的键|[has](http://ramda.cn/docs/#has)|
|是否包含指定的键：包括原型链上的键|[hasIn](http://ramda.cn/docs/#hasIn)|
|键值对换位|[invertObj](http://ramda.cn/docs/#invertObj)|
|键值对换位：将值放入数组中|[invert](http://ramda.cn/docs/#invert)|
|取出所有的键|[keys](http://ramda.cn/docs/#keys)|
|取出所有的键：包括原型链上的键|[keysIn](http://ramda.cn/docs/#keysIn)|
|取出所有的值|[values](http://ramda.cn/docs/#values)|
|取出所有的值：包括原型链上的值|[valuesIn](http://ramda.cn/docs/#valuesIn)|
|透镜：包括属性的 getter 和 setter|[lens](http://ramda.cn/docs/#lens)|
|透镜：指定索引的透镜|[lensIndex](http://ramda.cn/docs/#lensIndex)|
|透镜：指定路径的透镜|[lensPath](http://ramda.cn/docs/#lensPath)|
|透镜：指定属性的透镜|[lensProp](http://ramda.cn/docs/#lensProp)|
|透镜：对被 lens 聚焦的属性做变换|[over](http://ramda.cn/docs/#over)|
|透镜：对被 lens 聚焦的属性进行设置|[set](http://ramda.cn/docs/#set)|
|透镜：读取被 lens 聚焦的属性值|[view](http://ramda.cn/docs/#view)|
|Object 版 map，转换函数参数：(value, key, obj)|[mapObjIndexed](http://ramda.cn/docs/#mapObjIndexed)|
|对象合并|[merge](http://ramda.cn/docs/#merge)|
|对象合并：对重复的属性值按给定规则合并|[mergeWith](http://ramda.cn/docs/#mergeWith)|
|对象合并：对重复的属性值按给定规则合并|[mergeWithKey](http://ramda.cn/docs/#mergeWithKey)|
|对象深递归合并：以左侧对象属性为主|[mergeDeepLeft](http://ramda.cn/docs/#mergeDeepLeft)|
|对象深递归合并：以右侧对象属性为主|[mergeDeepRight](http://ramda.cn/docs/#mergeDeepRight)|
|对象深递归合并：对重复的非对象类型的值按给定规则合并|[mergeDeepWith](http://ramda.cn/docs/#mergeDeepWith)|
|对象深递归合并：对重复的非对象类型的值按给定规则合并|[mergeDeepWithKey](http://ramda.cn/docs/#mergeDeepWithKey)|
|创建包含单个键值对的对象|[objOf](http://ramda.cn/docs/#objOf)|
|将对象键值对转换为元素为键值二元组的列表|[toPairs](http://ramda.cn/docs/#toPairs)|
|将对象键值对转换为元素为键值二元组的列表:包括原型链上的键|[toPairsIn](http://ramda.cn/docs/#toPairsIn)|
|将二元组的列表转换为对象|[fromPairs](http://ramda.cn/docs/#fromPairs)|

## FUNCTION 函数
| Function| Action |
|---|---|
|函数组合：纵向，从右往左|compose|
|函数组合：纵向，从左往右|pipe|
|函数组合：纵向|o|
|函数组合：横向|converge|
|函数组合：横向|useWith|
|Kleisili 函数组合|composeK|
|Kleisili 函数组合|pipeK|
|Promise 函数组合|composeP|
|Promise 函数组合|pipeP|
|单位函数：输出等于输入|identity|
|函数柯里化|curry|
|N 元函数柯里化|curryN|
|将柯里化函数 转为 N 元函数|uncurryN|
|柯里化函数的参数占位符|__|
|参数部分调用：从左往右|partial|
|参数部分调用：从右往左|partialRight|
|函数缓存|memoize|
|函数缓存：可以自定义缓存键值|memoizeWith|
|只执行一次的函数|once|
|创建返回恒定值的函数|always|
|恒定返回 true 的函数|T|
|恒定返回 false 的函数|F|
|Applicative Functor 的 ap 方法，<*>|ap|
|将函数作用于参数列表|apply|
|将接受 单列表参数 的函数转为接受 普通参数列表 的函数|unapply|
|将首个参数（函数）作用于其余参数|call|
|绑定函数上下文|bind|
|利用属性值为函数的对象生成同构对象|applySpec|
|将函数列表作用于参数列表|juxt|
|将给定值传给给定函数，CPS: flip($)|applyTo|
|比较函数，一般用于排序|comparator|
|升序比较函数|ascend|
|降序比较函数|descend|
|将函数封装为 N 元函数|nArg|
|将函数封装为一元函数|unary|
|将函数封装为二元函数|binary|
|提取第 N 个参数|nthArg|
|将构造函数封装为普通函数，创建实例时，不需要 new 操作符|construct|
|将构造函数封装为 N 元普通函数，创建实例时，不需要 new 操作符|constructN|
|通过函数名调用函数|invoker|
|创建相应类型的空值|empty|
|判断是否为空值|isEmpty|
|交换函数前两个参数的位置|flip|
|函数提升|lift|
|N 元函数提升|liftN|
|生成单元素列表|of|
|输出等于输入，但产生副作用的函数，一般用于调试|tap|
|异常捕获|tryCatch|

## LOGIC OPERATION 逻辑运算

|Action|Function|
|---|---|
|判断是否满足所有条件|allPass|
|判断是否满足任一条件|anyPass|
|判断是否同时满足两个条件|both|
|判断是否满足两个条件中的任意一个|either|
|逻辑与操作|and|
|逻辑或操作|or|
|模式匹配，相当于多个 if/else|cond|
|单个 if/else，cond 的特例|ifElse|
|满足条件，则执行处理函数，否则原样返回输入值，ifElse 的特例|when|
|不满足条件时，执行处理函数，否则原样返回输入值，ifElse 的特例|unless|
|逻辑非操作，参数为布尔值|not|
|对函数返回值取反|complement|
|添加默认值|defaultTo|
|一直计算，直到满足给定条件|until|
|判断给定值是否为该类型的空值|isEmpty|
|判断给定值是否为 null 或 undefined|isNil|
|返回给定值所属类型的空值|empty|

## RELATIONAL OPERATION 关系运算

|Action|Function|
|---|---|
|等于|equals|
|完全相等|identical|
|通过规则判断是否相等|eqBy|
|大于|gt|
|大于等于|gte|
|大于|lt|
|小于等于|lte|
|限定有序数据类型的范围|clamp|
|求两个数的较大值|max|
|按规则求两个数的较大值|maxBy|
|求两个数的较小值|min|
|按规则求两个数的较小值|minBy|
|求差集：{a∣a∈xs ∩ a∉ys}|difference|
|求差集：{a∣a∉xs ∩ a∈ys}|without|
|求差集：根据条件计算第一个列表与第二个列表的差集|differenceWith|
|求对称差集：{(xs ∪ ys) - (xs ∩ ys)}|symmetricDifference|
|求对称差集：根据条件计算所有不属于两个列表交集的元素|symmetricDifferenceWith|
|求交集：{xs ∩ ys}|intersection|
|求交集：从 xs 中挑选出在 ys 中符合条件的元素|innerJoin|
|求并集：{xs ∪ ys}|union|
|求并集：根据条件判断两元素是否重复|unionWith|

## COMPUTATION 数学运算

|Action|Function|
|---|---|
|加|add|
|减|subtract|
|乘|multiply|
|除|divide|
|加1|inc|
|减1|dec|
|取反|negate|
|列表累加和|sum|
|列表累乘积|product|
|列表平均值|mean|
|列表平均值|median|
|取模：算术|mathMod|
|取模：JS|modulo|

## TYPE OPERATION 类型操作

|Action|Function|
|---|---|
|类型判断|is|
|类型描述|type|
|属性类型判断|propIs|
|判断是否为 null 或 undefined|isNil|


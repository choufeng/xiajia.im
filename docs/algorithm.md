# Algorithms 算法

## 两个数之和

> 在给定的数组中找到两个值相加等于目标值

```
nums = [1, 3, 6, 9], t = 9

 因为nums[1] + num[2] = 9
 所以返回 [3, 6]
```

### 简单算法
```
for (let i =0; i < nums.length; i++) {
  for (let j = 0; j < nums.length; j++) {
    if (nums[i] + nums[j] === t) {
      return [nums[i], nums[j]]
    }
  }
}
```

### 我的思路
与目标值相减后的数组与元素组对应找匹配的值

```

// 
let n = nums.map(i => t - i)
var r = []
n.map(i => (nums.indexOf(i) > 0) && r.push(i))
console.dir(r)

// Ramda版本
let r = R.reduce((a, v) => R.lte(0, R.indexOf(v, nums)) ? R.append(v, a) : a, [], R.map(i => t - i, nums))
console.dir(r)
```

> 现实很残酷，通过对运行时间的测试，map的效率惨不忍睹， for在大数据下的执行速度远远高于map
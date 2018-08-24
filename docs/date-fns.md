# Date-fns.js

!> date-fns 是一个时间方法库，相比Moment， 他更轻，支持函数式编程。

>当前列表基于version： 1.29.0

>links: [官网](https://date-fns.org/docs/Getting-Started)

## Functions

### Common Helpers

|Actions|Function|
|---|---|
|返回与给定日期相比较的最接近日期的索引|closestIndexTo|
|从最接近给定日期的数组返回日期|closetTo|
|比较两个日期，如果第一个日期在第二个日期之后，则返回1;如果第一个日期在第二个日期之前，则返回-1;如果日期相等，则返回0。|compareAsc|
|比较两个日期，如果第一个日期在第二个日期之后，则返回-1;如果第一个日期在第二个日期之前，则返回1;如果日期相等，则返回0。|compareDesc|
|返回给定日期之间的距离|distanceInWords|
|使用严格单位返回给定日期之间的距离。 这就像`distanceInWords`，但不使用'almost'，'over'，'less'等。|distanceInWordsStrict|
|返回给定日期与现在之间的距离。|distanceInWordsToNow|
|格式化时间|format|
|第一个日期是否晚于第二个|isAfter|
|第一个日期是否早于第二个|isBefore|
|是否是Date实例|isDate|
|给定的日期是否相等？|isEqual|
|给定的日期是否是将来|isFuture|
|给定的日期是否是过去|isPast|
|如果参数为Invalid Date，则返回false，否则返回true。 无效日期是`Date`值为`NaN`|isValid|
|返回给定日期的最新日期。|max|
|返回给定日期中最早的日期。|min|
|将给定参数转换为Date实例。|parse|

### Range Helpers

|Actions|Function|
|---|---|
|给定的日期范围是否与另一个日期范围重叠？|areRangesOverlapping|
|获取两个日期范围内重叠的天数|getOverlappingDaysInRanges|
|给定日期是否在范围内？|isWithinRange|

### 时间戳

|Actions|Function|
|---|---|
|获取给定日期的毫秒时间戳。|getTime|

### 毫秒

|Actions|Function|
|---|---|
|将指定的毫秒数添加到给定日期。|addMilliseconds|
|获取给定日期之间的毫秒数。|differenceInMilliseconds|
|获取给定日期的毫秒数。|getMilliseconds|
|将毫秒数设置为给定日期。|setMilliseconds|
|从给定日期减去指定的毫秒数。|subMilliseconds|

### 秒

|Actions|Function|
|---|---|
|将指定的秒数添加到给定日期。|addSeconds|
|获取给定日期之间的秒数。|differenceInSeconds|
|返回指定日期的秒数(本地时区)。|endOfSecond|
|获取给定日期的秒数。|getSeconds|
|给定日期是否在同一秒内？|isSameSecond|
|给定日期是否与当前日期相同？|isThisSecond|
|将秒设置为给定日期。|setSeconds|
|返回给定日期的秒数。（本地时区）|startOfSecond|
|从给定日期减去指定的秒数。|subSeconds|

### 分钟

|Actions|Function|
|---|---|
|将指定的分钟数添加到给定日期。|addMinutes|
|获取给定日期之间的分钟数。|differenceInMinutes|
|返回给定日期的一分钟结束。(本地时区)|endOfMinute|
|获取给定日期的分钟数。|getMinutes|
|给定日期是否在同一分钟？|isSameMinute|
|给定日期与当前日期在同一分钟？|isThisMinute|
|将分钟设置为给定日期。|setMinutes|
|返回给定日期的一分钟开始。(本地时区)|startOfMinute|
|从给定日期减去指定的分钟数。|subMinutes|

### 小时

|Actions|Function|
|---|---|
|将指定的小时数添加到给定日期。|addHours|
|获取给定日期之间的小时数。|differenceInHours|
|返回给定日期的一小时结束。（本地时区）|endOfHour|
|获取给定日期的小时数。|getHours|
|给定的日期是在同一时间吗？|isSameHour|
|给定日期是否与当前日期相同？|isThisHour|
|将小时数设置为给定日期。|setHours|
|返回给定日期的一小时开始。（本地时区）|startOfHour|
|从给定日期减去指定的小时数。|subHours|

### 天

|Actions|Function|
|---|---|
|将指定的天数添加到给定日期。|addDays|
|获取给定日期之间的日历天数。|differenceInCalendarDays|
|获取给定日期之间的完整天数。|differenceInDays|
|返回指定范围内的日期数组。|eachDay|
|返回给定日期的一天结束。|endOfDay|
|回到今天结束时间。|endOfToday|
|回到明天结束时间。|endOfTomorrow|
|返回昨天结束时间。|endOfYesterday|
|获取给定日期的月份日期。|getdate|
|获取给定日期的一年中的某一天。|getDayOfYear|
|给定日期是否在同一天？|isSameDay|
|今天是给定日期吗？|isToday|
|明天是给定日期吗？|isTomorrow|
|是昨天给定的日期？|isYesterday|
|将当月的日期设置为给定日期。|setDate|
|将一年中的某一天设置为给定日期。|setDayOfYear|
|返回给定日期的一天开始。（本地时区）|startOfDay|
|返回今天的开始时间。|startOfToday|
|回到明天的开始。|startOfTomorrow|
|回到昨天的开始。|startOfYesterday|
|从给定日期减去指定的天数。|subDays|

### 星期

|Actions|Function|
|---|---|
|获取给定日期的星期几。|getDay|
|获取给定日期的ISO周的日期，即星期日为7，星期一为1等。|getISODay|
|给定的日期是周五吗？|isFriday|
|给定的日期是周一吗？|isMonday|
|给定的日期是周六吗？|isSaturday|
|给定的日期是周天吗？|isSunday|
|给定的日期是周四吗？|isThursday|
|给定的日期是周二吗？|isTuesday|
|给定的日期是周三吗？|isWednesday|
|给定的日期是周末吗？|isWeekend|
|将星期几设置为给定日期。|setDay|
|将ISO周的日期设置为给定日期。 ISO周从星期一开始。 7是星期日的指数，1是星期一的指数等。|setISODay|


### 周

|Actions|Function|
|---|---|
|将指定的周数添加到给定日期。|addWeeks|
|获取给定日期之间的日历周数。|differenceInCalendarWeeks|
|获取给定日期之间的整周数。|differenceInWeeks|
|返回指定日期的一周结束时间。（本地时区）|endOfWeek|
|给定日期是在同一周吗？|isSameWeek|
|给定日期与当前日期在同一周吗？|isThisWeek|
|返回给定日期的一周的最后一天。（本地时区）|lastDayOfWeek|
|返回给定日期的一周开始。（本地时区）|startOfWeek|
|从给定日期减去指定的周数。|subWeeks|

### ISO 周

|Actions|Function|
|---|---|
|获取给定日期之间的日历ISO周数。|differenceInCalendarISOWeeks|
|返回给定日期的ISO周结束。|endISOWeek|
|获取给定日期的ISO周。|getISOWeek|
|给定日期是否在同一ISO周？|isSameISOWeek|
|给定日期与当前日期的ISO周相同吗？|isThisISOWeek|
|返回给定日期的ISO周的最后一天。|lastDayOfISOWeek|
|将ISO周设置为给定日期，保存工作日编号。|setISOWeek|
|返回给定日期的ISO周的开始。|startOfISOWeek|

### 月 

|Actions|Function|
|---|---|
|将指定的月数添加到给定日期。|addMonths|
|获取给定日期之间的日历月数。|differenceInCalendarMonths|
|获取给定日期之间的完整月数。|differenceInMonths|
|返回指定日期的月末。（本地时区）|endOfMonth|
|获取给定日期的一个月中的天数。|getDasyInMonth|
|获取给定日期的月份。|getMonth|
|给定日期是一个月的第一天吗？|isFirstDayOfMonth|
|给定日期是一个月的最后一天吗？|isLastDayOfMonth|
|给定日期是在同一个月吗？|isSameMonth|
|给定日期是与当前日期相同的月份吗？|isThisMonth|
|返回给定日期的一个月的最后一天。（本地时区）|lastDayOfMonth|
|将月份设置为给定日期。|setMonth|
|返回给定日期的一个月的开始。（本地时区）|startOfMonth|
|从给定日期减去指定的月数。|subMonths|

### 季度

|Actions|Function|
|---|---|
|将指定的年度季度添加到给定日期。|addQuarters|
|获取给定日期之间的日历季度数。|differenceInCalendarQuarters|
|获取给定日期之间的完整季度数。|differenceInQuarters|
|返回指定日期的一年季度末。|endOfQuarter|
|获取给定日期的年度季度。|getQuarter|
|同一季度的给定日期是？|isSameQuarter|
|给定日期是否与当前日期相同？|isThisQuarter|
|返回给定日期的一季度中最后一天。|lastDayOfQuarter|
|将年度季度设置为给定日期。|setQuarter|
|返回给定日期的一年季度开始。|startOfQuarter|
|从给定日期减去指定的年度季度。|subQuarters|

### 年

|Actions|Function|
|---|---|
|将指定的年数添加到给定日期。|addYears|
|获取给定日期之间的日历年数。|differenceInCalendarYears|
|获取给定日期之间的全年数。|differenceInYears|
|返回给定日期的一年结束。|endOfYear|
|获取给定日期一年中的天数。|getDaysInYear|
|获取给定日期的年份。|getYear|
|是闰年的给定日期吗？|isLeapYear|
|同一年的给定日期是？|isSameYear|
|给定日期是与当前日期相同的年份吗？|isThisYear|
|返回给定日期的一年的最后一天。|lastDayOfyear|
|将年份设置为给定日期。|setYear|
|返回指定日期的一年开头。|startOfYear|
|从给定日期减去指定的年数。|subyears|

### ISO 年内周数

|Actions|Function|
|---|---|
|将指定数量的ISO周编号年份添加到给定日期。|addISOYears|
|获取给定日期之间的日历ISO周编号年数。|differenceInCalendarISOYears|
|获取给定日期之间的完整ISO周编号年份数。|differenceInISOYears|
|返回ISO周编号年份的结束，该年份总是在年度第一个星期四之前3天开始。（本地时区）|endOfISOYear|
|获取给定日期的ISO周编号年份的周数。|getISOWeeksInYear|
|获取给定日期的ISO周编号年份，该年份始终在年度第一个星期四之前3天开始。|getISOYear|
|给定日期是否在同一ISO周编号年份？|isSameISOYear|
|给定日期与当前日期的ISO周编号年份相同吗？|isThisISOYear|
|返回ISO周编号年份的最后一天，该年份始终在年度第一个星期四之前3天开始。|lastDayOfISOYear|
|将ISO周编号年份设置为给定日期，保存周数和工作日编号。|setISOYear|
|返回ISO周编号年份的开始，该年份始终在年度第一个星期四之前3天开始。（当地时间）|startOfISOYear|
|从给定日期减去指定数量的ISO周编号年份。|subISOYears|

## I18n

|Language|Identification|
|---|---|
|English|en|
|Russian|ru|
|Esperanto|eo|
|Chinese Simplified|zh_cn|
|German|de|
|Japanese|ja|
|Spanish|es|
|Dutch|nl|
|Chinese Traditional|zh_tw|
|Norwegian Bokmal|nb|
|Catalan|ca|
|Indonesian|id|
|Italian|it|
|Polish|pl|
|Portuguese|pt|
|Swedish|sv|
|French|fr|
|Turkish|tr|
|Korean|ko|
|Greek|el|
|Slovak|sk|
|Filipino|fil|
|Danish|da|
|Icelandic|is|
|Finnish|fi|
|Thai|th|
|Croatian|hr|
|Arabic|ar|
|Bulgarian|bg|
|Czech|cs|
|macedonian|mk|
|Romanian|ro|


> CC 署名

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
||areRangesOverlapping|
||getOverlappingDasyInRanges|
||isWithinRange|

### 时间戳

|Actions|Function|
|---|---|
||getTime|

### 毫秒

|Actions|Function|
|---|---|
||addMilliseconds|
||differenceInMilliseconds|
||getMilliseconds|
||setMilliseconds|
||subMilliseconds|

### 秒

|Actions|Function|
|---|---|
||addSeconds|
||differenceInSeconds|
||endOfSecond|
||getSeconds|
||isSameSecond|
||isThisSecond|
||setSeconds|
||startOfSecond|
||subSeconds|

### 分钟

|Actions|Function|
|---|---|
||addMinutes|
||differenceInMinutes|
||endOfMinute|
||getMinutes|
||isSameMinute|
||isThisMinute|
||setMinutes|
||startOfMinute|
||subMinutes|

### 小时

|Actions|Function|
|---|---|
||addHours|
||differenceInHours|
||endOfHour|
||getHours|
||isSameHour|
||isThisHour|
||setHours|
||startOfHour|
||subHours|

### 天

|Actions|Function|
|---|---|
||addDays|
||differenceInCalendarDays|
||differenceInDays|
||eachDay|
||endOfDay|
||endOfToday|
||endOfTomorrow|
||endOfYesterday|
||getdate|
||getDayOfYear|
||isSameDay|
||isToday|
||isTomorrow|
||isYesterday|
||setDate|
||setDayOfYear|
||startOfDay|
||startOfToday|
||startOfTomorrow|
||startOfYesterday|
||subDays|

### 星期

|Actions|Function|
|---|---|
||getDay|
||getISODay|
||isFriday|
||isMonday|
||isSaturday|
||isSunday|
||isThursday|
||isTuesday|
||isWednesday|
||isWeekend|
||setDay|
||setISODay|


### 周

|Actions|Function|
|---|---|
||addWeeks|
||differenceInCalendarWeeks|
||differenceInWeeks|
||endOfWeek|
||isSameWeek|
||isThisWeek|
||lastDayOfWeek|
||startOfWeek|

### ISO 周

|Actions|Function|
|---|---|
||differenceInCalendarISOWeeks|
||endISOWeek|
||getISOWeek|
||isSameISOWeek|
||isThisISOWeek|
||lastDayOfISOWeek|
||setISOWeek|
||startOfISOWeek|

### 月 

|Actions|Function|
|---|---|
||addMonths|
||differenceInCalendarMonths|
||differenceInMonths|
||endOfMonth|
||getDasyInMonth|
||getMonth|
||isFirstDayOfMonth|
||isLastDayOfMonth|
||isSameMonth|
||isThisMonth|
||lastDayOfMonth|
||setMonth|
||startOfMonth|
||subMonths|

### 刻钟

|Actions|Function|
|---|---|
||addQuarters|
||differenceInCalendarQuarters|
||differenceInQuarters|
||endOfQuarter|
||getQuarter|
||isSameQuarter|
||isThisQuarter|
||lastDayOfQuarter|
||setQuarter|
||startOfQuarter|
||subQuarters|

### 年

|Actions|Function|
|---|---|
||addYears|
||differenceInCalendarYears|
||differenceInYears|
||endOfYear|
||getDaysInYear|
||getYear|
||isLeapYear|
||isSameYear|
||isThisYear|
||lastDayOfyear|
||setYear|
||startOfYear|
||subyears|

### ISO 年内周数

|Actions|Function|
|---|---|
||addISOYears|
||differenceInCalendarISOYears|
||differenceInISOYears|
||endOfISOYear|
||getISOWeeksInYear|
||getISOYear|
||isSameISOYear|
||isThisISOYear|
||lastDayOfISOYear|
||setISOYear|
||startOfISOYear|
||subISOYears|

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

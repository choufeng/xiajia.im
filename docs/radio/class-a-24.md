---
title: A 类练习 · 系列 24（第 231-240 题）
---

# A 类练习 · 系列 24（第 231-240 题）

> 共 10 题 · 数据来源：[exam.bh5hsu.com](https://exam.bh5hsu.com/practice?examType=A) · 题解为社区/AI 提交（已审核） · 全文朗读见页面顶部播放器（按题分章）

<span data-tts-skip><sub>题解采用 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans">CC BY-NC-SA 4.0</a>（本站经精简整理并署原作者名）</sub></span>

## 第 231 题

<span data-tts-skip><em>MC1-0237 · 单选 · 适用 A/B/C 类</em></span>

2 米波段的话音联络通常位于 144.035-145.800MHz。这也是 IARU 第 3 区波段规划中的一个多模式共用细分频段。假设一部业余电台正以 USB 方式在该频段参与通联，发射带宽小于 3kHz 并且频率容限优于±2kHz，则该电台的主载波设置范围可以是：

:::tip 正确答案
**从 144.037MHz 至 145.795MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 从 144.037MHz 至 145.795MHz ✓
- B. 从 144.030MHz 至 145.795MHz
- C. 从 144.037MHz 至 145.805MHz
- D. 从 144.030MHz 至 145.805MHz

正确答案：A

</details>

**题解**

记住主载波范围：144.037–145.795 MHz；两端分别给带宽和频率容限留出余量。

<span data-tts-skip><sub>—— 题解：01（经精简整理）</sub></span>

## 第 232 题

<span data-tts-skip><em>MC1-0238 · 单选 · 适用 A/B/C 类</em></span>

在 70 厘米波段中，爱好者经常在 438-440MHz 展开话音通信。这也是 IARU 第 3 区波段规划中的一个多模式共用细分频段。假设一部业余电台正以 FM 方式在该频段参与通联，发射带宽小于 20kHz 并且频率容限优于±2kHz，则该电台的主载波设置范围可以是：

:::tip 正确答案
**从 438.012MHz 至 439.988MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 从 438.012MHz 至 439.988MHz ✓
- B. 从 437.988MHz 至 439.988MHz
- C. 从 438.012MHz 至 440.012MHz
- D. 从 437.988MHz 至 440.012MHz

正确答案：A

</details>

**题解**

70厘米波段438,3区波段规划题目,答案中小数点后的数字都是最小和最大。

<span data-tts-skip><sub>—— 题解：bh5uwl（经精简整理）</sub></span>

## 第 233 题

<span data-tts-skip><em>MC1-0239 · 单选 · 适用 A/B/C 类</em></span>

在 70 厘米波段中，爱好者经常在 438-440MHz 展开话音通信。这也是 IARU 第 3 区波段规划中的一个多模式共用细分频段。假设一部业余电台正以 USB 方式在该频段参与通联，发射带宽小于 3kHz 并且频率容限优于±2kHz，则该电台的主载波设置范围可以是：

:::tip 正确答案
**从 438.002MHz 至 439.995MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 从 438.002MHz 至 439.995MHz ✓
- B. 从 437.995MHz 至 439.995MHz
- C. 从 438.002MHz 至 440.005MHz
- D. 从 437.995MHz 至 440.005MHz

正确答案：A

</details>

**题解**

以下内容由AI生成（OpenAI），仅供参考。

好的，我们逐步分析这道题：

**一、题目解析**
题目涉及 **业余无线电频率规划与边带发射的频率占用边界**，这是考试中的高频考点，考查考生对 **话音通信带宽、频率容限以及主载波设置位置** 的理解。

- **频段范围**：题目指出范围是 **438–440 MHz**，这是 IARU 第 3 区（包括中国）的 70cm 波段规划中分配给多模式话音通信的子段。  
- **工作模式**：USB（上边带，Upper Side Band）。  
- **发射带宽**：小于 3 kHz。  
- **频率容限**：优于 ±2 kHz。  

需要确定的是：考虑到带宽和频率容限，电台发射主载波（显示频点）在合法频段内的可设置范围。

**二、无线电原理知识点**
1. **USB 的频谱分布**  
   在 USB 工作模式下，**主载波频率（显示频）以下的频率不含有效信号**，信号完全分布在主载波频率以上，宽度大约等于话音带宽。  
   - 例如：438.000 MHz USB，若带宽为 3 kHz，则实际占用范围为 **438.000 – 438.003 MHz**。

2. **频率容限的作用**  
   发射机频率容限 ±2 kHz 意味着主载波频率可能与实际设定点存在上下 2 kHz 的偏差。  
   因此，为了确保 **实际发射频段始终落入分配范围**，需要在频率上下留出安全边界。

3. **合规要求总结**  
   - 下边界（438 MHz）：USB 信号的下限就是主载波，因此主载波必须 ≥ 438.000 MHz，并且考虑 -2 kHz 容差，所以应 ≥ 438.002 MHz。  
   - 上边界（440 MHz）：USB 信号会往上扩展 3 kHz，再考虑 +2 kHz 容差，所以主载波必须 ≤ (440.000 – 3 kHz – 2 kHz) = 439.995 MHz。

**三、逐一分析选项**
**选项：从 438.002MHz 至 439.995MHz**  
- 下限：438.002 MHz，正好满足 “438.000 + 2 kHz” 的要求。  
- 上限：439.995 MHz，正好满足 “440.000 – (3+2) kHz” 的要求。  
✅ 这是完全正确的计算结果。

**选项：从 437.995MHz 至 439.995MHz**  
- 下限 437.995 MHz 小于 438.002 MHz，意味着发射信号可能越过 438.000 MHz 以下，使用到非业余分配频段。  
❌ 不符合要求，错误。

**选项：从 438.002MHz 至 440.005MHz**  
- 上限 440.005 MHz 已经超过了分配的 440 MHz 上限，即使算上容差，也超出了合法范围。  
❌ 错误。

**选项：从 437.995MHz 至 440.005MHz**  
- 下限与上限都越界，既不满足 438 MHz 下限要求，也超出了 440 MHz 上限。  
❌ 错误。

**四、正确答案**
**从 438.002MHz 至 439.995MHz**

**五、知识点总结**
1. **IARU 波段规划**：考试中会涉及 70 cm 波段的子分配，需要记忆。  
2. **USB 频谱特性**：USB 的频率占用范围完全位于主载波频率以上。  
3. **频率容差计算**：主载波必须留出容差空间，确保在容差极限时仍不会越界。  
4. **通用公式**：  
   - USB 主载波下限 = 频段下限 + 容差  
   - USB 主载波上限 = 频段上限 – 发射带宽 – 容差  

在本题中：  
- 下限 = 438.000 + 0.002 = **438.002 MHz**  
- 上限 = 440.000 – 0.003 – 0.002 = **439.995 MHz**

因此最终答案为：**从 438.002MHz 至 439.995MHz**。

<span data-tts-skip><sub>—— 题解：GPT-5（经精简整理）</sub></span>

## 第 234 题

<span data-tts-skip><em>MC1-0240 · 单选 · 适用 A/B/C 类</em></span>

10 米业余波段中留给卫星业余业务，话音及其他通信方式不应占用的频段为：

:::tip 正确答案
**29.3MMz 至 29.51MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 29.3MMz 至 29.51MHz ✓
- B. 28.3MHz 至 28.61MHz
- C. 28.7MHz 至 28.95MHz
- D. 29.15MHz 至 29.35MHz

正确答案：A

</details>

**题解**

10 米波段（28.0–29.7 MHz）里，29.300–29.510 MHz 是国际公认的业余卫星业务专属频段。

<span data-tts-skip><sub>—— 题解：andy_antengfei（经精简整理）</sub></span>

## 第 235 题

<span data-tts-skip><em>MC1-0241 · 单选 · 适用 A/B/C 类</em></span>

144MHz 业余频段中留给卫星业余业务，话音及其他通信方式不应占用的频段为：

:::tip 正确答案
**145.8MHz 至 146MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 145.8MHz 至 146MHz ✓
- B. 144.8MHz 至 145MHz
- C. 144.2MHz 至 144.5MHz
- D. 145.4MHz 至 144.6MHz

正确答案：A

</details>

**题解**

记住 144–146 MHz（2 米业余段） 的常见频率分配： 
144.0–144.035 MHz → 弱信号、CW、地月通信
144.035–145.8 MHz → 各种模式，含FM 话音、中继等
145.8–146.0 MHz → 卫星业务专用

<span data-tts-skip><sub>—— 题解：andy_antengfei（经精简整理）</sub></span>

## 第 236 题

<span data-tts-skip><em>MC1-0242 · 单选 · 适用 A/B/C 类</em></span>

430MHz 业余频段中留给卫星业余业务，话音及其他通信方式不应占用的频段为：

:::tip 正确答案
**435MHz 至 438MHz**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 435MHz 至 438MHz ✓
- B. 432MHz 至 434MHz
- C. 438MHz 至 439MHz
- D. 433MHz 至 435MHz

正确答案：A

</details>

**题解**

435–438 MHz 是卫星业余业务专用频段，地面话音及其他通信不应占用。

<span data-tts-skip><sub>—— 题解：andy_antengfei（经精简整理）</sub></span>

## 第 237 题

<span data-tts-skip><em>MC1-0246 · 单选 · 适用 A/B/C 类</em></span>

通话时，有什么方法可以让你清晰表述呼号或重要消息中的英语字母？

:::tip 正确答案
**用标准的字母解释法**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. 用标准的字母解释法 ✓
- B. 用打比方的方法
- C. 拍发莫尔斯电码
- D. 用 AI 软件朗读

正确答案：A

</details>

**题解**

**清晰拼读字母**

通话中应使用**标准字母解释法（ITU 语音字母表）**拼读呼号或重要消息中的英语字母。标准词汇含义明确，可减少口音、噪声造成的歧义，也比临时造词更高效。

<span data-tts-skip><sub>—— 题解：济南黄河（经精简整理）</sub></span>

## 第 238 题

<span data-tts-skip><em>MC1-0247 · 单选 · 适用 A/B/C 类</em></span>

需要拼出呼号、术语和必要的文字时，业余无线电爱好者普遍使用 ITU 语音字母表中规定的字母拼读法。呼号 BH1XYZ 可以拼读为：

:::tip 正确答案
**Bravo Hotel One Xray Yankee Zulu**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. Bravo Hotel One Xray Yankee Zulu ✓
- B. Bravo Seven Charlie Romeo Alfa
- C. Four Uniform One Uniform November
- D. Victor Romeo Two Zulu Quebec Whiskey

正确答案：A

</details>

**题解**

**1. 知识点解释**
本题考查 **ITU语音字母表** 的应用。ITU（国际电信联盟）为无线电通信制定了标准语音字母表和数字电码，确保不同语言背景的操作者能清晰辨识字母和数字，避免因发音差异导致的混淆。  
- **字母部分**（摘自《ITU 无线电规则（2024年版）卷2》附录14）：  
  - B → **Bravo**  
  - H → **Hotel**  
  - X → **Xray**  
  - Y → **Yankee**  
  - Z → **Zulu**  
- **数字部分**：  
  - 1 → **One**（在呼号拼读中通常使用常规英文发音，而非ITU数字电码中的“Unaone”）。  

**2. 解题思路**
题目要求对呼号 **BH1XYZ** 进行正确拼读，需逐个字符对应ITU语音字母表：  
1. **B** → Bravo  
2. **H** → Hotel  
3. **1** → One（常规发音）  
4. **X** → Xray  
5. **Y** → Yankee  
6. **Z** → Zulu  

**3. 答案分析**
- **选项一：Bravo Hotel One Xray Yankee Zulu**  
  - 完全匹配ITU标准拼读规则，每个字符均正确对应。  
- **选项二：Bravo Seven Charlie Romeo Alfa**  
  - 错误：包含“7”（Seven）和字母“C”（Charlie），与呼号中的“H”和“X”无关。  
- **选项三：Four Uniform One Uniform November**  
  - 错误：以“4”（Four）开头，且包含重复的“Uniform”和“November”，与呼号无关。  
- **选项四：Victor Romeo Two Zulu Quebec Whiskey**  
  - 错误：以“V”（Victor）开头，“Two”对应数字2，与呼号中的“1”和“X”无关。  

**4. 结论**
呼号 **BH1XYZ** 的正确拼读为 **Bravo Hotel One Xray Yankee Zulu**。  
**依据**：《ITU 无线电规则（2024年版）卷2》附录14（WRC-23，修订版）语音字母表和数字电码。  

**引用文档**
- **《ITU 无线电规则（2024年版）卷2》** 附录14（WRC-23，修订版）语音字母表和数字电码。

<span data-tts-skip><sub>—— 题解：通义千问（经精简整理）</sub></span>

## 第 239 题

<span data-tts-skip><em>MC1-0248 · 单选 · 适用 A/B/C 类</em></span>

需要拼出呼号、术语和必要的文字时，业余无线电爱好者普遍使用 ITU 语音字母表中规定的字母拼读法。呼号 B7CRA 可以拼读为：

:::tip 正确答案
**Bravo Seven Charlie Romeo Alfa**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. Bravo Seven Charlie Romeo Alfa ✓
- B. Bravo Hotel One Xray Yankee Zulu
- C. Four Uniform One Uniform November
- D. Victor Romeo Two Zulu Quebec Whiskey

正确答案：A

</details>

**题解**

**ITU 语音字母表拼读**

呼号 **B7CRA** 拼读为：

**Bravo Seven Charlie Romeo Alfa**。

<span data-tts-skip><sub>—— 题解：济南黄河（经精简整理）</sub></span>

## 第 240 题

<span data-tts-skip><em>MC1-0249 · 单选 · 适用 A/B/C 类</em></span>

需要拼出呼号、术语和必要的文字时，业余无线电爱好者普遍使用 ITU 语音字母表中规定的字母拼读法。呼号 4U1UN 可以拼读为：

:::tip 正确答案
**Four Uniform One Uniform November**<span data-tts-skip>（A）</span>
:::

<details>
<summary>查看全部选项</summary>

- A. Four Uniform One Uniform November ✓
- B. Bravo Hotel One Xray Yankee Zulu
- C. Bravo Seven Charlie Romeo Alfa
- D. Victor Romeo Two Zulu Quebec Whiskey

正确答案：A

</details>

**题解**

**ITU 语音字母表拼读**

呼号 **4U1UN** 拼读为：

**Four Uniform One Uniform November**。

<span data-tts-skip><sub>—— 题解：济南黄河（经精简整理）</sub></span>


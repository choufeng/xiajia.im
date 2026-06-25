# 研究简报：火山引擎豆包语音合成大模型 HTTP REST API（一次性合成）

## Summary

火山引擎语音合成大模型通过 `https://openspeech.bytedance.com/api/v1/tts` 端点提供 HTTP 一次性合成能力，鉴权采用 `Authorization: Bearer; <access_token>` 头 + 请求体 `app` 对象双重传递。大模型版与普通版共用同一端点，区别在于 `voice_type` 使用大模型音色、`cluster` 可能不同。单请求不支持多角色，需分段合成后拼接。

> **重要声明**：本次调研因工具限制无法实时联网验证官方文档。以下信息基于训练数据中的火山引擎文档知识整理，**所有确切值（尤其 cluster、voice_type ID）务必在控制台/官方文档二次核对**后再写入生产代码。标注 ⚠️ 的字段为不确定项。

---

## 一、HTTP 端点 URL

| 项目 | 值 | 置信度 |
|------|-----|--------|
| **端点** | `https://openspeech.bytedance.com/api/v1/tts` | 高 |
| **方法** | `POST` | 高 |
| **Content-Type** | `application/json` | 高 |

大模型版与普通版共用同一端点。区分靠请求体参数（`voice_type`、`cluster`），而非不同 URL。

> ⚠️ **需核实**：部分较新文档可能引入 v2 端点。请在控制台「语音合成大模型」→「API 文档」页面确认最新端点。

---

## 二、鉴权方式

### Authorization 头格式

```
Authorization: Bearer; <access_token>
```

> ⚠️ **关键注意**：火山引擎格式是 `Bearer;`（分号+空格），**不是**标准 OAuth2 的 `Bearer `（空格）。这是火山引擎特有的非标准格式，用错会 401。

### 请求体 app 对象

```json
{
  "app": {
    "appid": "<控制台应用页 App ID>",
    "token": "access_token",
    "cluster": "<集群标识，见第三节>"
  }
}
```

| 字段 | 说明 | 来源 |
|------|------|------|
| `appid` | 控制台创建应用后获得 | 控制台 → 语音技术 → 应用管理 |
| `token` | 与 Authorization 头的 access_token 相同值，**请求体和头都要传** | 控制台 → 应用详情 |
| `cluster` | 集群标识，决定路由到普通/大模型引擎 | 见下节 |

---

## 三、app.cluster 值

| 版本 | cluster 值 | 置信度 |
|------|------------|--------|
| 普通语音合成 | `volcano_tts` | 高 |
| 大模型语音合成 | ⚠️ `volcano_mega`（需核实） | **低——必须核对** |

> **待核实说明**：训练数据中 `volcano_mega` 作为大模型集群标识出现过，但火山引擎文档迭代频繁，不同时期/不同大模型子产品（如双向流式 vs 一次性）可能使用不同 cluster。**请在控制台 → 语音合成大模型 → 应用详情 → 「Cluster」字段确认确切值**。也有可能大模型版复用 `volcano_tts` 但由 voice_type 自动路由。

### 控制台查看路径（预期）

1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. 导航至「语音技术」→「语音合成大模型」
3. 进入具体应用详情页
4. 查看页面上的 **App ID** 和 **Cluster** 字段
5. Access Token 在「鉴权 Token」或同一页面

---

## 四、大模型音色 voice_type（voice_id）

### 命名规则

大模型音色 ID 与普通版（如 `BV001`、`BV002`）不同，通常包含特征后缀：

- `_bigtts`：大模型版音色标识
- `_moon_bigtts` / `_mars_bigtts` / `_venus_bigtts`：大模型音色系列
- `BVxxx_V2_streaming`：流式/新版编号格式

### 推荐英文音色（A/B 对话用）

> ⚠️ **以下音色 ID 基于训练数据记忆，具体可用列表以控制台「音色管理」页为准。** 大模型音色大多支持多语言（中/英/日/韩），即使前缀是 `zh_` 也能合成英文。但若需要「母语级英文」音色，建议在控制台筛选标签为「English」的音色。

| 用途 | voice_type（待核实） | 说明 |
|------|----------------------|------|
| **A 角色女声** | ⚠️ `zh_female_wanxiao_moon_bigtts` | 温柔女声，多语言 |
| **B 角色男声** | ⚠️ `zh_male_M_dio_mars_bigtts` | 成熟男声，多语言 |

**替代方案（编号格式，更稳定）：**

| 用途 | voice_type（待核实） | 说明 |
|------|----------------------|------|
| **A 角色** | ⚠️ `BV700_streaming` | 大模型女声 |
| **B 角色** | ⚠️ `BV701_streaming` | 大模型男声 |

> **务必在控制台核对**：前往 控制台 → 语音合成大模型 → 音色试听/管理，找到带 **English** 标签或 **多语言** 标签的音色，复制完整 voice_type 字符串。推荐选择名称中含 `en_` 前缀或明确标注支持英文的音色。

---

## 五、请求体完整 JSON 结构

```json
{
  "app": {
    "appid": "YOUR_APP_ID",
    "token": "access_token",
    "cluster": "volcano_mega"
  },
  "user": {
    "uid": "unique_user_id"
  },
  "audio": {
    "voice_type": "zh_female_wanxiao_moon_bigtts",
    "encoding": "mp3",
    "speed_ratio": 1.0,
    "volume_ratio": 1.0,
    "pitch_ratio": 1.0
  },
  "request": {
    "reqid": "<UUID v4>",
    "text": "Hello, this is a test of the Doubao TTS big model.",
    "text_type": "plain",
    "operation": "query",
    "with_frontend": 1,
    "frontend_type": "unitTson"
  }
}
```

### 字段说明

| 层级 | 字段 | 类型 | 说明 |
|------|------|------|------|
| `app.appid` | string | 控制台 App ID | 必填 |
| `app.token` | string | Access Token（同 Authorization 头） | 必填 |
| `app.cluster` | string | 集群标识 | 必填 |
| `user.uid` | string | 用户标识，自定义即可 | 可选 |
| `audio.voice_type` | string | 大模型音色 ID | 必填 |
| `audio.encoding` | string | `mp3` / `wav` / `ogg` / `pcm` | 必填 |
| `audio.speed_ratio` | float | 语速 0.2~3.0，默认 1.0 | 可选 |
| `audio.volume_ratio` | float | 音量 0.1~3.0，默认 1.0 | 可选 |
| `audio.pitch_ratio` | float | 音调 0.1~3.0，默认 1.0 | 可选 |
| `request.reqid` | string | UUID，每次请求唯一 | 必填 |
| `request.text` | string | 待合成文本 | 必填 |
| `request.text_type` | string | `plain`（纯文本）| 可选，默认 plain |
| `request.operation` | string | `query`（一次性合成）| 必填 |

> `operation: "query"` = 一次性返回完整音频；若需流式则用 WebSocket 而非 HTTP。

---

## 六、响应体结构

### 成功响应

```json
{
  "reqid": "请求时传入的 UUID",
  "code": 3000,
  "message": "Success",
  "sequence": -1,
  "data": "<base64 编码的 MP3 音频数据>"
}
```

| 字段 | 说明 |
|------|------|
| `code` | **3000** = 成功（非 200，注意区别于 HTTP 状态码） |
| `message` | `"Success"` 或错误描述 |
| `data` | Base64 编码的音频字节流，需 `Buffer.from(data, 'base64')` 解码写入文件 |
| `sequence` | -1 表示完整音频（非分片） |

### 常见错误码

| code | 含义 |
|------|------|
| 3001 | 参数错误 |
| 3003 | 鉴权失败（检查 token/appid/cluster） |
| 3005 | 文本过长 |
| 3010 | 并发超限 |
| 3011 | 字符额度不足 |

> ⚠️ 错误码具体值需核对官方文档，以上基于训练数据。

---

## 七、单请求多角色（SSML 多音色）

**不支持。** 火山引擎 TTS HTTP API 单请求只能指定一个 `voice_type`。

### A/B 双人对话实现方案

```
分段合成 → base64 解码 → Buffer 拼接 → 写入单一 MP3
```

```javascript
// 伪代码
const segments = [
  { speaker: 'A', text: "Hi there, how are you?" },
  { speaker: 'B', text: "I'm great, thanks for asking!" },
  { speaker: 'A', text: "Let's get started." },
];

const audioChunks = [];
for (const seg of segments) {
  const voiceId = seg.speaker === 'A' ? VOICE_A : VOICE_B;
  const res = await tts(seg.text, voiceId);
  audioChunks.push(Buffer.from(res.data, 'base64'));
}
const fullAudio = Buffer.concat(audioChunks);
fs.writeFileSync('dialogue.mp3', fullAudio);
```

> MP3 帧拼接对多数播放器兼容，但技术上拼接后的 MP3 无标准元信息头。如需严格合规，用 `ffmpeg` 或 `lame` 重新编码。

---

## 八、计费/额度/限制

> ⚠️ 以下为训练数据中的大致信息，**以控制台「计费说明」页为准**。

| 项目 | 说明（待核实） |
|------|----------------|
| 免费额度 | 新用户可能有体验额度（如数万字符） |
| 计费单位 | 按合成字符数计费 |
| 单次文本上限 | ⚠️ 约 1000 字符/请求（需核实，大模型版可能更长） |
| 并发限制 | ⚠️ 默认 QPS 限制，可在控制台申请提升 |
| 价格档位 | 大模型版价格高于普通版 |

---

## 最小 curl 示例（英文文本 + 大模型音色）

```bash
curl -X POST 'https://openspeech.bytedance.com/api/v1/tts' \
  -H 'Authorization: Bearer; YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "app": {
      "appid": "YOUR_APP_ID",
      "token": "access_token",
      "cluster": "volcano_mega"
    },
    "user": {
      "uid": "demo_user"
    },
    "audio": {
      "voice_type": "zh_female_wanxiao_moon_bigtts",
      "encoding": "mp3",
      "speed_ratio": 1.0
    },
    "request": {
      "reqid": "550e8400-e29b-41d4-a716-446655440000",
      "text": "Hello, welcome to the podcast. Today we are going to talk about artificial intelligence.",
      "text_type": "plain",
      "operation": "query"
    }
  }'
```

> 将 `YOUR_APP_ID`、`YOUR_ACCESS_TOKEN`、`cluster`、`voice_type` 替换为控制台实际值。

---

## Node.js fetch 调用要点

```javascript
import crypto from 'crypto';
import fs from 'fs';

const APP_ID = process.env.VOLC_TTS_APPID;
const ACCESS_TOKEN = process.env.VOLC_TTS_TOKEN;
const CLUSTER = 'volcano_mega';       // ⚠️ 控制台核实
const VOICE_A = 'zh_female_wanxiao_moon_bigtts';  // ⚠️ 控制台核实
const VOICE_B = 'zh_male_M_dio_mars_bigtts';      // ⚠️ 控制台核实

const ENDPOINT = 'https://openspeech.bytedance.com/api/v1/tts';

async function tts(text, voiceType) {
  const reqid = crypto.randomUUID();

  const body = {
    app: {
      appid: APP_ID,
      token: 'access_token',    // 固定字面值
      cluster: CLUSTER,
    },
    user: { uid: 'node_demo' },
    audio: {
      voice_type: voiceType,
      encoding: 'mp3',
      speed_ratio: 1.0,
      volume_ratio: 1.0,
      pitch_ratio: 1.0,
    },
    request: {
      reqid: reqid,
      text: text,
      text_type: 'plain',
      operation: 'query',
    },
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer; ${ACCESS_TOKEN}`,   // 注意分号
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  // 检查业务码
  if (json.code !== 3000) {
    throw new Error(`TTS error ${json.code}: ${json.message}`);
  }

  // base64 → Buffer
  const audioBuffer = Buffer.from(json.data, 'base64');
  return audioBuffer;
}

// 用法：合成单段
async function main() {
  const audio = await tts(
    "Hello, this is a test of the Doubao TTS big model.",
    VOICE_A
  );
  fs.writeFileSync('output.mp3', audio);
  console.log(`Done: ${audio.length} bytes`);
}

// 用法：A/B 对话拼接
async function dialogue() {
  const segments = [
    { speaker: VOICE_A, text: "Hey, did you finish the report?" },
    { speaker: VOICE_B, text: "Yeah, I sent it to your email this morning." },
    { speaker: VOICE_A, text: "Great, let me take a look right now." },
  ];

  const chunks = [];
  for (const seg of segments) {
    const buf = await tts(seg.text, seg.speaker);
    chunks.push(buf);
  }

  const full = Buffer.concat(chunks);
  fs.writeFileSync('dialogue.mp3', full);
  console.log(`Dialogue: ${full.length} bytes`);
}

main();
```

### 关键注意点

1. **`Authorization: Bearer; <token>`** — 分号+空格，不是空格
2. **`app.token`** — 值固定为字面值 `"access_token"`（不是你的真实 token），真实 token 只在 Authorization 头传
3. **reqid** — 每次请求生成新 UUID，用 `crypto.randomUUID()`
4. **code 3000** — 业务成功码，不是 HTTP 200
5. **base64 解码** — `Buffer.from(json.data, 'base64')` 直接得到 MP3 字节
6. **拼接对话** — `Buffer.concat()` 合并多段 MP3，无需额外处理（大多数播放器兼容）

> ⚠️ 第 2 点需特别核实：训练数据中 `app.token` 的值有两种说法——一是固定字面值 `"access_token"`，二是传入真实 access token。**建议两种都试**，以控制台示例代码为准。

---

## 官方文档来源 URL

> ⚠️ 以下 URL 基于训练数据中的文档路径记忆，**实际可能已变更**。请从 [火山引擎文档首页](https://www.volcengine.com/docs) 搜索「语音合成大模型」获取最新链接。

| 文档 | URL（待验证） | 用途 |
|------|---------------|------|
| 语音合成 HTTP API | `https://www.volcengine.com/docs/6561/79823` | 接口参数详解 |
| 大模型音色列表 | `https://www.volcengine.com/docs/6561/1257544` | voice_type 查询 |
| 错误码 | `https://www.volcengine.com/docs/6561/1111014` | code 含义 |
| 计费说明 | `https://www.volcengine.com/docs/6561/1225046` | 价格与额度 |
| 控制台 | `https://console.volcengine.com/speech/service/8` | 应用与音色管理 |

**建议搜索入口**：
- [火山引擎文档中心](https://www.volcengine.com/docs) → 搜索「语音合成大模型」
- [火山引擎控制台](https://console.volcengine.com/) → 语音技术 → 语音合成大模型

---

## Gaps（无法确认的项）

以下信息 **必须在控制台或官方文档中二次核对**，不可直接写入生产代码：

1. **`app.cluster` 大模型确切值** — `volcano_mega` 未经验证，可能为 `volcano_tts` 或其他
2. **`app.token` 字段含义** — 是固定值 `"access_token"` 还是真实 token
3. **英文音色 voice_type 完整字符串** — 以上 4 个 ID 均需在控制台「音色管理」页复制确认
4. **端点是否已升级到 v2** — 可能存在新端点
5. **错误码完整列表** — 3000/3001/3003/3005/3010/3011 均需核实
6. **单次文本长度上限** — 大模型版可能支持更长文本
7. **免费额度与单价** — 计费信息变化频繁
8. **`with_frontend` / `frontend_type` 参数** — 大模型版是否需要/支持

### 建议下一步

1. 登录控制台截图应用详情页（含 appid、cluster、token）
2. 在「音色管理」页找到 2 个支持英文的大模型音色，复制 voice_type
3. 阅读控制台提供的「API 文档」和「示例代码」（通常有 curl/Java/Python）
4. 用真实参数跑通 curl 请求，确认 `code: 3000`
5. 确认 `app.token` 字段用法后移植到 Node.js

---

*调研日期：2026-06-17*
*工具限制说明：本次调研未使用联网搜索工具（不可用），所有信息基于训练数据中的火山引擎文档知识。标注 ⚠️ 的字段未经实时验证。*

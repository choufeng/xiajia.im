// 21 天成人英语训练营 · 多端同步数据模型
// 设计文档：docs/research/convex-backend-feasibility.md
// 无认证配对码模式：workspaceKey 为客户端生成的 UUID v4，数据按 key 分区。
// 所有可同步行都带 updatedAt（LWW 依据）；scenarios/sentences 另有 deletedAt 墓碑。
// 注意：settings 表是白名单字段（voiceName/rate/model），API Key 永不入库。
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  scenarios: defineTable({
    workspaceKey: v.string(),
    id: v.string(), // 客户端 uid，与前端 localStorage 中的 id 一致
    name: v.string(),
    note: v.string(),
    createdAt: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceKey", "id"]),

  sentences: defineTable({
    workspaceKey: v.string(),
    id: v.string(),
    scenarioId: v.optional(v.string()),
    zh: v.string(),
    en: v.string(),
    addedAt: v.string(),
    repsTotal: v.number(),
    listens: v.number(),
    predictUnlocked: v.boolean(),
    shadowReps: v.number(),
    review: v.object({
      d2: v.optional(v.string()),
      d7: v.optional(v.string()),
      d30: v.optional(v.string()),
    }),
    red: v.boolean(),
    redCount: v.number(),
    lastPracticed: v.optional(v.string()),
    source: v.string(),
    updatedAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_workspace", ["workspaceKey", "id"]),

  // 每设备每日一行：并发多机练习时天然无冲突，今日总数 = 各行之和
  practiceDays: defineTable({
    workspaceKey: v.string(),
    day: v.string(), // YYYY-MM-DD（设备本地时区）
    deviceId: v.string(),
    reps: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceKey", "day", "deviceId"]),

  // 每个 workspace 一行；白名单字段，绝不含 apiKey
  settings: defineTable({
    workspaceKey: v.string(),
    voiceName: v.string(),
    rate: v.number(),
    model: v.string(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceKey"]),
});

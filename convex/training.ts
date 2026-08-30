// 21 天成人英语训练营 · 同步函数
// 安全模型：无认证。workspaceKey 即凭证（128-bit 随机 UUID v4）。
// 服务端防御：key/表名/字段白名单 + 长度/数量上限 + 行级 LWW（旧写不覆盖新写）。
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const LIMITS = {
  textLen: 2000,
  shortLen: 200,
  idLen: 64,
  count: 1_000_000,
  maxSentences: 5000,
  maxScenarios: 300,
  maxPracticeDayRows: 5000,
};

function assertKey(key: string) {
  if (typeof key !== "string" || !UUID_RE.test(key)) {
    throw new Error("invalid workspaceKey");
  }
}
function str(x: unknown, max: number, field: string): string {
  if (typeof x !== "string") throw new Error("bad " + field);
  if (x.length > max) throw new Error("too long " + field);
  return x;
}
function num(x: unknown, field: string): number {
  if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > LIMITS.count) {
    throw new Error("bad " + field);
  }
  return x;
}
function bool(x: unknown, field: string): boolean {
  if (typeof x !== "boolean") throw new Error("bad " + field);
  return x;
}
function optStr(x: unknown, max: number, field: string): string | undefined {
  if (x === null || x === undefined) return undefined;
  return str(x, max, field);
}
function stamp(x: unknown): number {
  return num(x, "updatedAt");
}
// 去掉服务端内部字段，只回传业务字段
function pub<T extends { _id: unknown; _creationTime: number }>(d: T) {
  const { _id, _creationTime, ...rest } = d as any;
  void _id;
  void _creationTime;
  return rest;
}

// ---- 读取：整个 workspace（订阅此 query 即获得实时多端推送）----
export const getWorkspace = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    assertKey(key);
    const [scenarios, sentences, practiceDays, settings] = await Promise.all([
      ctx.db
        .query("scenarios")
        .withIndex("by_workspace", (q) => q.eq("workspaceKey", key))
        .collect(),
      ctx.db
        .query("sentences")
        .withIndex("by_workspace", (q) => q.eq("workspaceKey", key))
        .collect(),
      ctx.db
        .query("practiceDays")
        .withIndex("by_workspace", (q) => q.eq("workspaceKey", key))
        .collect(),
      ctx.db
        .query("settings")
        .withIndex("by_workspace", (q) => q.eq("workspaceKey", key))
        .first(),
    ]);
    return {
      scenarios: scenarios.map(pub),
      sentences: sentences.map(pub),
      practiceDays: practiceDays.map(pub),
      settings: settings ? pub(settings) : null,
    };
  },
});

// ---- 写入：行级 upsert（含墓碑删除），单入口 ----
export const upsertRow = mutation({
  args: { key: v.string(), table: v.string(), row: v.any() },
  handler: async (ctx, { key, table, row }) => {
    assertKey(key);
    const r = (row ?? {}) as Record<string, unknown>;
    switch (table) {
      case "scenario":
        return upsertScenario(ctx, key, r);
      case "sentence":
        return upsertSentence(ctx, key, r);
      case "practiceDay":
        return upsertPracticeDay(ctx, key, r);
      case "settings":
        return upsertSettings(ctx, key, r);
      default:
        throw new Error("unknown table");
    }
  },
});

async function upsertScenario(ctx: any, key: string, r: Record<string, unknown>) {
  const clean = {
    workspaceKey: key,
    id: str(r.id, LIMITS.idLen, "id"),
    name: str(r.name ?? "", LIMITS.shortLen, "name"),
    note: typeof r.note === "string" ? str(r.note, LIMITS.textLen, "note") : "",
    createdAt: str(r.createdAt ?? "", 32, "createdAt"),
    updatedAt: stamp(r.updatedAt),
    deletedAt: r.deletedAt == null ? undefined : num(r.deletedAt, "deletedAt"),
  };
  const existing = await ctx.db
    .query("scenarios")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key).eq("id", clean.id))
    .unique();
  if (existing && existing.updatedAt > clean.updatedAt) return { skipped: true };
  if (!existing && !clean.deletedAt) {
    const all = await ctx.db
      .query("scenarios")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key))
      .collect();
    if (all.length >= LIMITS.maxScenarios) throw new Error("scenario limit reached");
  }
  if (existing) await ctx.db.patch(existing._id, clean);
  else await ctx.db.insert("scenarios", clean);
  return { ok: true };
}

async function upsertSentence(ctx: any, key: string, r: Record<string, unknown>) {
  const review = (r.review ?? {}) as Record<string, unknown>;
  const milestone = (x: unknown) => (x === "done" ? "done" : undefined);
  const clean = {
    workspaceKey: key,
    id: str(r.id, LIMITS.idLen, "id"),
    scenarioId: optStr(r.scenarioId, LIMITS.idLen, "scenarioId"),
    zh: str(r.zh ?? "", LIMITS.textLen, "zh"),
    en: str(r.en ?? "", LIMITS.textLen, "en"),
    addedAt: str(r.addedAt ?? "", 32, "addedAt"),
    repsTotal: num(r.repsTotal ?? 0, "repsTotal"),
    listens: num(r.listens ?? 0, "listens"),
    predictUnlocked: bool(r.predictUnlocked ?? false, "predictUnlocked"),
    shadowReps: num(r.shadowReps ?? 0, "shadowReps"),
    review: {
      d2: milestone(review.d2),
      d7: milestone(review.d7),
      d30: milestone(review.d30),
    },
    red: bool(r.red ?? false, "red"),
    redCount: num(r.redCount ?? 0, "redCount"),
    lastPracticed: optStr(r.lastPracticed, 32, "lastPracticed"),
    source: str(r.source ?? "manual", 32, "source"),
    updatedAt: stamp(r.updatedAt),
    deletedAt: r.deletedAt == null ? undefined : num(r.deletedAt, "deletedAt"),
  };
  const existing = await ctx.db
    .query("sentences")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key).eq("id", clean.id))
    .unique();
  if (existing && existing.updatedAt > clean.updatedAt) return { skipped: true };
  if (!existing && !clean.deletedAt) {
    const all = await ctx.db
      .query("sentences")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key))
      .collect();
    if (all.length >= LIMITS.maxSentences) throw new Error("sentence limit reached");
  }
  if (existing) await ctx.db.patch(existing._id, clean);
  else await ctx.db.insert("sentences", clean);
  return { ok: true };
}

async function upsertPracticeDay(ctx: any, key: string, r: Record<string, unknown>) {
  const day = str(r.day, 10, "day");
  if (!DAY_RE.test(day)) throw new Error("bad day");
  const clean = {
    workspaceKey: key,
    day,
    deviceId: str(r.deviceId, LIMITS.idLen, "deviceId"),
    reps: num(r.reps ?? 0, "reps"),
    updatedAt: stamp(r.updatedAt),
  };
  const existing = await ctx.db
    .query("practiceDays")
    .withIndex(
      "by_workspace",
      (q: any) =>
        q.eq("workspaceKey", key).eq("day", clean.day).eq("deviceId", clean.deviceId),
    )
    .unique();
  if (existing && existing.updatedAt > clean.updatedAt) return { skipped: true };
  if (!existing) {
    const all = await ctx.db
      .query("practiceDays")
      .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key))
      .collect();
    if (all.length >= LIMITS.maxPracticeDayRows) throw new Error("practiceDay limit reached");
  }
  if (existing) await ctx.db.patch(existing._id, clean);
  else await ctx.db.insert("practiceDays", clean);
  return { ok: true };
}

async function upsertSettings(ctx: any, key: string, r: Record<string, unknown>) {
  // 白名单：只接受 voiceName / rate / model。API Key 一律丢弃（客户端也不会发送）。
  const rate = typeof r.rate === "number" && Number.isFinite(r.rate) ? r.rate : 0.9;
  const clean = {
    workspaceKey: key,
    voiceName: typeof r.voiceName === "string" ? str(r.voiceName, LIMITS.shortLen, "voiceName") : "",
    rate: Math.min(Math.max(rate, 0), 5),
    model: typeof r.model === "string" ? str(r.model, 100, "model") : "deepseek-v4-flash",
    updatedAt: stamp(r.updatedAt),
  };
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_workspace", (q: any) => q.eq("workspaceKey", key))
    .first();
  if (existing && existing.updatedAt > clean.updatedAt) return { skipped: true };
  if (existing) await ctx.db.patch(existing._id, clean);
  else await ctx.db.insert("settings", clean);
  return { ok: true };
}

// ---- 定时清理（crons.ts 调度）：墓碑 30 天后物理删除；500 天前的日计数删除 ----
export const cleanupStale = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const tombstoneCutoff = now - 30 * 24 * 3600 * 1000;
    const dayCutoff = new Date(now - 500 * 24 * 3600 * 1000);
    const cutoffStr =
      dayCutoff.getFullYear() +
      "-" +
      String(dayCutoff.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(dayCutoff.getDate()).padStart(2, "0");

    for (const table of ["scenarios", "sentences"] as const) {
      const rows = await ctx.db.query(table).collect();
      for (const r of rows) {
        if (r.deletedAt !== undefined && r.deletedAt < tombstoneCutoff) {
          await ctx.db.delete(r._id);
        }
      }
    }
    const pd = await ctx.db.query("practiceDays").collect();
    for (const r of pd) {
      if (r.day < cutoffStr) await ctx.db.delete(r._id);
    }
  },
});

// 定时任务：每日清理过期墓碑与远古日计数
// 注意：convex 1.x 新 API —— cronJobs() 工厂函数；internal 引用自 _generated/api
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "training-daily-cleanup",
  { hourUTC: 3, minuteUTC: 17 },
  internal.training.cleanupStale,
);

export default crons;

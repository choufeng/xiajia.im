// 定时任务：每日清理过期墓碑与远古日计数
import { cronManager } from "convex/server";
import { internal } from "./_generated/server";

export default cronManager.defineCrons({
  dailyCleanup: cronManager.daily(internal.training.cleanupStale, {
    hourUTC: 3,
    minuteUTC: 17,
  }),
});

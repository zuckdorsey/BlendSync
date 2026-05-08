import cron from "node-cron";
import type { AppConfig } from "./config.js";
import { getSettings } from "./db.js";
import { SyncService } from "./sync.js";

export async function startScheduler(config: AppConfig) {
  const settings = await getSettings();
  const [hour = "7", minute = "0"] = settings.syncTime.split(":");
  const expression = `${Number(minute)} ${Number(hour)} * * *`;
  const sync = new SyncService(config);

  return cron.schedule(
    expression,
    async () => {
      try {
        await sync.runNow();
      } catch (error) {
        console.error("Scheduled sync failed:", error);
      }
    },
    { timezone: settings.timezone }
  );
}

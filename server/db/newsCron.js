import cron from "node-cron";
import { importAllNews } from "./newsImporter.js";

let started = false;

export function scheduleNewsImports() {
  if (started) return;
  started = true;

  // Initial import on boot (after a short delay so the DB schema migration has settled).
  setTimeout(() => {
    importAllNews().catch((err) =>
      console.error("Initial news import failed:", err)
    );
  }, 5_000);

  // Then every 6 hours.
  cron.schedule("0 */6 * * *", () => {
    importAllNews().catch((err) =>
      console.error("Scheduled news import failed:", err)
    );
  });
}

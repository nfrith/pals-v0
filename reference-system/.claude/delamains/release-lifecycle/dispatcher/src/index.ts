import { existsSync } from "fs";
import { writeFileSync, unlinkSync } from "fs";
import { resolve as resolvePath, dirname, join } from "path";
import { scan } from "./watcher.js";
import { resolve, dispatch, type DispatchEntry } from "./dispatcher.js";
import { DispatchLifecycle } from "./dispatch-lifecycle.js";
import { formatDispatcherVersionLine, loadDispatcherVersionInfo } from "./dispatcher-version.js";
import { resolveTelemetryPaths } from "./telemetry.js";

// -------------------------------------------------------------------
// The only input: system root. Bundle-local runtime identity comes
// from runtime-manifest.json beside delamain.yaml.
//
// If SYSTEM_ROOT is not set, walk up from the dispatcher's location
// looking for .als/system.ts. Works at any nesting depth and after
// deployment to .claude/delamains/.
// -------------------------------------------------------------------

function findSystemRoot(start: string): string {
  let dir = start;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, ".als", "system.ts"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("No .als/system.ts found in parent directories");
}

const SYSTEM_ROOT = process.env["SYSTEM_ROOT"]
  ? resolvePath(process.env["SYSTEM_ROOT"])
  : findSystemRoot(resolvePath(import.meta.dir));
const BUNDLE_ROOT = dirname(dirname(resolvePath(import.meta.dir)));

const POLL_MS = parseInt(process.env["POLL_MS"] ?? "30000", 10);

// -------------------------------------------------------------------
// Startup — crawl the ALS declaration surface once
// -------------------------------------------------------------------

try {
  console.log(formatDispatcherVersionLine(await loadDispatcherVersionInfo(BUNDLE_ROOT)));
} catch (error) {
  console.error(`[dispatcher] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const config = await resolve(BUNDLE_ROOT, SYSTEM_ROOT);

console.log(`[dispatcher] system: ${SYSTEM_ROOT}`);
console.log(`[dispatcher] bundle: ${BUNDLE_ROOT}`);
console.log(`[dispatcher] module: ${config.moduleId}`);
console.log(`[dispatcher] delamain: ${config.delamainName}`);
console.log(`[dispatcher] status field: ${config.statusField}`);
console.log(`[dispatcher] entity: ${config.entityName}`);
console.log(`[dispatcher] entity path: ${config.entityPath}`);
console.log(`[dispatcher] module root: ${config.moduleRoot}`);
if (config.discriminatorField) {
  console.log(`[dispatcher] discriminator: ${config.discriminatorField}=${config.discriminatorValue}`);
}
console.log(`[dispatcher] states: ${config.allStates.join(", ")}`);
console.log(`[dispatcher] watching: ${config.dispatchTable.map((e) => e.state).join(", ")}`);
console.log(`[dispatcher] polling every ${POLL_MS}ms`);

// -------------------------------------------------------------------
// Heartbeat — write status to .claude/delamains/{name}/status.json
// -------------------------------------------------------------------

const STATUS_FILE = join(
  SYSTEM_ROOT,
  ".claude",
  "delamains",
  config.delamainName,
  "status.json",
);
const { directory: TELEMETRY_DIR } = resolveTelemetryPaths(BUNDLE_ROOT);
const lifecycle = new DispatchLifecycle();

let lastItemsScanned = 0;

function writeHeartbeat(itemsScanned: number) {
  const heartbeat = lifecycle.heartbeat();
  try {
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({
        name: config.delamainName,
        pid: process.pid,
        last_tick: new Date().toISOString(),
        poll_ms: POLL_MS,
        active_dispatches: heartbeat.active_dispatches,
        items_scanned: itemsScanned,
        delegated_dispatches: heartbeat.delegated_dispatches,
        delegated_items: heartbeat.delegated_items,
      }) + "\n",
    );
  } catch {
    // Non-fatal — statusline just won't see us
  }
}

function clearHeartbeat() {
  try {
    unlinkSync(STATUS_FILE);
  } catch {
    // Already gone
  }
}

function ensureTelemetryDir() {
  try {
    Bun.mkdirSync(TELEMETRY_DIR, { recursive: true });
  } catch {
    // Non-fatal — telemetry stays unavailable
  }
}

// -------------------------------------------------------------------
// Poll loop
// -------------------------------------------------------------------

let tickCount = 0;

function findRule(status: string): DispatchEntry | undefined {
  return config.dispatchTable.find((e) => e.state === status);
}

function logCounts(prefix: string) {
  const counts = lifecycle.counts();
  console.log(`${prefix} (active=${counts.active}, delegated=${counts.delegated})`);
}

function updateHeartbeat() {
  writeHeartbeat(lastItemsScanned);
}

function logCompletion(itemId: string, success: boolean, disposition: string) {
  const counts = lifecycle.counts();
  console.log(
    `[dispatcher] ${itemId} finished (success=${success}, guard=${disposition}, active=${counts.active}, delegated=${counts.delegated})`,
  );
}

process.on("beforeExit", (code) => {
  const counts = lifecycle.counts();
  console.log(
    `[dispatcher] beforeExit fired (code=${code}, active=${counts.active}, delegated=${counts.delegated}, ticks=${tickCount})`,
  );
});

process.on("exit", (code) => {
  const counts = lifecycle.counts();
  console.log(
    `[dispatcher] exit code=${code} active=${counts.active} delegated=${counts.delegated} ticks=${tickCount}`,
  );
});

process.on("uncaughtException", (err) => {
  console.error("[dispatcher] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[dispatcher] unhandledRejection:", reason);
});

async function tick() {
  tickCount++;
  logCounts(`[dispatcher] tick #${tickCount}`);

  const items = await scan(
    config.moduleRoot,
    config.entityPath,
    config.statusField,
    config.discriminatorField,
    config.discriminatorValue,
  );
  lastItemsScanned = items.length;

  for (const release of lifecycle.reconcile(items)) {
    const releasedKinds = [
      release.releasedActive ? "active" : null,
      release.releasedDelegated ? "delegated" : null,
    ].filter((value): value is string => value !== null);

    console.log(
      `[dispatcher] release ${release.itemId} after status change ${release.previousStatus} -> ${release.nextStatus}`
        + (releasedKinds.length > 0 ? ` (${releasedKinds.join(", ")})` : ""),
    );
  }

  for (const item of items) {
    const rule = findRule(item.status);
    if (!rule || lifecycle.isGuarded(item.id)) continue;

    lifecycle.markDispatchStarted(item.id, item.status);
    logCounts(`[dispatcher] dispatch ${item.id} -> ${item.status}`);
    dispatch(item.id, item.filePath, rule, config.agents, config, BUNDLE_ROOT)
      .then((r) => {
        const disposition = lifecycle.completeDispatch({
          itemId: item.id,
          state: item.status,
          success: r.success,
          delegated: rule.delegated,
        });
        logCompletion(item.id, r.success, disposition);
        updateHeartbeat();
      })
      .catch((error) => {
        const disposition = lifecycle.completeDispatch({
          itemId: item.id,
          state: item.status,
          success: false,
          delegated: rule.delegated,
        });
        console.error(`[dispatcher] ${item.id} dispatch error:`, error);
        logCompletion(item.id, false, disposition);
        updateHeartbeat();
      });
  }

  updateHeartbeat();
}

await tick();
ensureTelemetryDir();
const interval = setInterval(tick, POLL_MS);

const keepalive = Bun.serve({
  port: 0,
  fetch: () => new Response("dispatcher alive"),
});
console.log(`[dispatcher] keepalive on port ${keepalive.port}`);

let forceShutdownRequested = false;

const stop = (signal: string) => {
  const counts = lifecycle.counts();
  if (counts.active > 0) {
    console.log(`[dispatcher] ${signal} ignored while ${counts.active} direct dispatch(es) are active`);
    console.log(`[dispatcher] active: ${lifecycle.activeItemIds().join(", ")}`);
    return false;
  }

  console.log(
    `[dispatcher] ${signal} received, shutting down (active=${counts.active}, delegated=${counts.delegated})`,
  );
  clearInterval(interval);
  keepalive.stop();
  clearHeartbeat();
  process.exit(0);
  return true;
};

process.on("SIGTERM", () => {
  const counts = lifecycle.counts();
  console.log(
    `[dispatcher] SIGTERM ignored (active=${counts.active}, delegated=${counts.delegated}, ticks=${tickCount})`,
  );
});

process.on("SIGINT", () => {
  if (forceShutdownRequested) {
    console.log("[dispatcher] second SIGINT - force quit");
    clearInterval(interval);
    keepalive.stop();
    clearHeartbeat();
    process.exit(1);
  }

  forceShutdownRequested = true;
  if (!stop("SIGINT")) return;
});

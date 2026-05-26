/**
 * Analytics Dashboard example — Host-side integration
 *
 * Demonstrates every direction of the wMEP protocol on a richer
 * module than the counter:
 *
 *   HOST to MODULE   construction        Dashboard(requires, config)
 *   HOST to MODULE   capabilities        dashboard.capabilities.refresh()
 *   MODULE to HOST   events              dashboard.on('chart:clicked', cb)
 *   MODULE to HOST   lifecycle           dashboard.on('wmep:mounted', cb)
 *   HOST to MODULE   listeners           dashboard.notify('data:invalidated')
 *   HOST to MODULE   teardown            await dashboard.unmount('reason')
 *   MODULE to HOST   requires            requires.metrics.query(...)
 *                                        for await (const u of
 *                                          requires.metrics.live(...)) { ... }
 *
 * Run:
 *   npx tsx examples/analytics-dashboard/host-app.ts
 */

import { Dashboard } from "./dashboard.wmep.js";
import type {
  AggregateResult,
  LiveUpdate,
  MetricPoint,
} from "./dashboard.wmep.js";

// ---------------------------------------------------------------
// Helper: synthesise a deterministic-ish time series for the mock
// metrics backend below.
// ---------------------------------------------------------------
function generateTimeSeries(metric: string, days: number): MetricPoint[] {
  const points: MetricPoint[] = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    points.push({
      timestamp: new Date(now - i * 86_400_000).toISOString(),
      value: Math.floor(Math.random() * 1000),
      label: metric,
    });
  }
  return points.reverse();
}

async function run(): Promise<void> {
  console.log("=== wMEP Analytics Dashboard Example ===\n");

  // ---------------------------------------------------------------
  // HOST to MODULE: construction.
  //
  // The host supplies:
  //   - requires (Dashboard['requires']): a metrics object whose
  //     query / aggregate are async functions and whose live() is
  //     an AsyncIterable that the module drains with `for await`.
  //   - config (Dashboard['config']): chart type, refresh
  //     interval, and date range.
  // ---------------------------------------------------------------
  const dashboard = Dashboard(
    {
      logger: {
        write: (entry) =>
          console.log(`[Module] ${entry.action}`, entry.detail ?? ""),
      },
      metrics: {
        query: async ({ metric }) => generateTimeSeries(metric, 7),

        aggregate: async ({ metrics }) => {
          const result: AggregateResult = {};
          for (const m of metrics) {
            const values = generateTimeSeries(m, 30).map((p) => p.value);
            const total = values.reduce((a, b) => a + b, 0);
            result[m] = {
              total,
              avg: Math.round(total / values.length),
              min: Math.min(...values),
              max: Math.max(...values),
            };
          }
          return result;
        },

        live: async function* ({ metrics }): AsyncIterable<LiveUpdate> {
          for (let i = 0; i < 3; i++) {
            const m = metrics[i % metrics.length] ?? "pageviews";
            yield {
              metric: m,
              value: Math.floor(Math.random() * 500),
              timestamp: new Date().toISOString(),
            };
          }
        },
      },
    },
    {
      chartType: "area",
      // 0 disables the auto-refresh interval so the example
      // terminates promptly. Real hosts would set 30_000 etc.
      refreshInterval: 0,
      dateRange: {
        preset: "last7days",
        start: "2026-03-25",
        end: "2026-04-01",
      },
      primaryMetric: "pageviews",
    },
  );

  // ---------------------------------------------------------------
  // MODULE to HOST: subscribe to lifecycle + author-declared events.
  // ---------------------------------------------------------------
  dashboard.on("wmep:mounted", () => {
    console.log("[Host] wmep:mounted -> dashboard is ready");
  });
  dashboard.on("wmep:unmounted", ({ reason }) => {
    console.log(`[Host] wmep:unmounted -> reason=${reason ?? "(none)"}`);
  });
  dashboard.on("filter:changed", (e) => {
    console.log("[Host] filter:changed:", e);
  });
  dashboard.on("chart:clicked", (e) => {
    console.log("[Host] chart:clicked:", e);
  });

  // ---------------------------------------------------------------
  // HOST to MODULE: notify is safe even before mount — wMEP
  // buffers it FIFO and replays once onMount resolves.
  // ---------------------------------------------------------------
  console.log(
    "-- notify data:invalidated (pre-mount; will buffer and trigger refresh after onMount resolves) --",
  );
  dashboard.notify("data:invalidated", { reason: "warmup" });

  // ---------------------------------------------------------------
  // HOST to MODULE: capability calls run synchronously through the
  // typed surface declared in Dashboard['capabilities'].
  // ---------------------------------------------------------------
  console.log("-- getFilters --");
  console.log("[Host] filters:", dashboard.capabilities.getFilters());

  console.log("-- setChart -> bar --");
  console.log("[Host]", dashboard.capabilities.setChart({ chartType: "bar" }));

  console.log("-- refresh --");
  console.log("[Host]", await dashboard.capabilities.refresh());

  console.log("-- queryMetrics pageviews --");
  const pageviews = await dashboard.capabilities.queryMetrics({
    metric: "pageviews",
    startDate: "2026-03-25",
    endDate: "2026-04-01",
    groupBy: "day",
  });
  console.log(`[Host] pageviews points: ${pageviews.length}`);

  console.log("-- getAggregates pageviews,revenue --");
  const agg = await dashboard.capabilities.getAggregates({
    metrics: ["pageviews", "revenue"],
    startDate: "2026-03-01",
    endDate: "2026-04-01",
  });
  console.log("[Host] aggregates:", agg);

  console.log("-- setFilters region=us-east --");
  dashboard.capabilities.setFilters({
    filters: { region: "us-east", segment: "enterprise" },
  });

  console.log("-- reportClick --");
  dashboard.capabilities.reportClick({
    metric: "pageviews",
    value: 450,
    timestamp: "2026-03-28T00:00:00Z",
  });

  console.log("-- consumeLiveFeed pageviews,revenue --");
  const live = await dashboard.capabilities.consumeLiveFeed({
    metrics: ["pageviews", "revenue"],
  });
  console.log(`[Host] live updates received: ${live.length}`);

  // ---------------------------------------------------------------
  // HOST to MODULE: teardown.
  // ---------------------------------------------------------------
  console.log("-- unmount --");
  await dashboard.unmount("demo-finished");

  console.log("\n=== Done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * @aurorah/wmep-analytics-dashboard — internal implementation
 *
 * This file is private to the `analytics-dashboard/` directory:
 *   - it may freely export/import internal helpers
 *   - it is NEVER imported by any file outside this directory
 *   - it must satisfy `WmepFactory<Dashboard>` from the contract
 *
 * All event/listener/lifecycle plumbing lives in `createWmepModule`.
 * The code below is pure domain logic.
 */

import { createWmepModule } from "../../src/core/index.js";
import type {
  AggregateResult,
  Dashboard,
  LiveUpdate,
  MetricPoint,
  ChartType,
} from "./dashboard.wmep.js";

const DEFAULT_PRIMARY_METRIC = "pageviews";

// `createWmepModule<Dashboard>(setup)` returns a fully-formed
// `WmepFactory<Dashboard>`. The setup function receives the
// resolved `requires`, `config`, and a typed `emit`.
export const createDashboard = createWmepModule<Dashboard>(
  ({ requires, config, emit }) => {
    // ---------------------------------------------------------------
    // Private module state.
    //
    // Captured by the closure returned below. No outside code can
    // reach it — only the methods in `capabilities` and the
    // handlers in `listeners` can read or modify it.
    // ---------------------------------------------------------------
    let chartType: ChartType = config.chartType ?? "line";
    const refreshInterval = config.refreshInterval ?? 30_000;
    const primaryMetric = config.primaryMetric ?? DEFAULT_PRIMARY_METRIC;
    let dateRange: { start?: string; end?: string } = {
      start: config.dateRange?.start,
      end: config.dateRange?.end,
    };
    let filters: Record<string, unknown> = {};
    let lastSeries: MetricPoint[] = [];
    let lastAggregates: AggregateResult | null = null;

    // ---------------------------------------------------------------
    // Source tag for the structured logger.
    //
    // Every state-changing action funnels through requires.logger
    // with a `source` discriminator, the same way the counter
    // example tags `bump | reset | reset-on-request | interval-tick`.
    // ---------------------------------------------------------------
    type DashboardSource =
      | "setChart"
      | "refresh"
      | "queryMetrics"
      | "getAggregates"
      | "setFilters"
      | "reportClick"
      | "consumeLiveFeed"
      | "data:invalidated"
      | "interval-refresh";

    const log = (
      action: string,
      source: DashboardSource,
      extra?: Record<string, unknown>,
    ): void => {
      requires.logger.write({
        action,
        detail: { source, ...extra },
      });
    };

    // ---------------------------------------------------------------
    // Helpers.
    //
    // Internal helpers stay private — they're not part of the
    // contract. They centralise date-range resolution and the
    // refresh fetch sequence.
    // ---------------------------------------------------------------
    const resolveDateRange = (): { startDate: string; endDate: string } => ({
      startDate: dateRange.start ?? "2026-03-25",
      endDate: dateRange.end ?? "2026-04-01",
    });

    const doRefresh = async (
      source: DashboardSource,
    ): Promise<{
      ok: true;
      refreshedAt: string;
      pointCount: number;
    }> => {
      const { startDate, endDate } = resolveDateRange();
      lastSeries = await requires.metrics.query({
        metric: primaryMetric,
        startDate,
        endDate,
        groupBy: "day",
        filters,
      });
      lastAggregates = await requires.metrics.aggregate({
        metrics: [primaryMetric, "revenue"],
        startDate,
        endDate,
      });
      const refreshedAt = new Date().toISOString();
      log("dashboard:refresh", source, {
        refreshedAt,
        pointCount: lastSeries.length,
      });
      return { ok: true, refreshedAt, pointCount: lastSeries.length };
    };

    return {
      // HOST to MODULE: capabilities
      // Implementations of every method declared in
      // Dashboard['capabilities']. Each signature matches the
      // boundary exactly — otherwise the boundary file would
      // fail to type-check.
      capabilities: {
        getFilters: () => ({
          filters: { ...filters },
          chartType,
          dateRange: { ...dateRange },
        }),

        setChart: ({ chartType: next }) => {
          chartType = next;
          log("dashboard:setChart", "setChart", { chartType });
          return { chartType };
        },

        refresh: () => doRefresh("refresh"),

        queryMetrics: async ({ metric, startDate, endDate, groupBy }) => {
          const points = await requires.metrics.query({
            metric,
            startDate,
            endDate,
            groupBy,
            filters,
          });
          log("dashboard:queryMetrics", "queryMetrics", {
            metric,
            count: points.length,
          });
          return points;
        },

        getAggregates: async ({ metrics, startDate, endDate }) => {
          const result = await requires.metrics.aggregate({
            metrics,
            startDate,
            endDate,
          });
          log("dashboard:getAggregates", "getAggregates", { metrics });
          return result;
        },

        setFilters: ({ filters: next }) => {
          filters = { ...next };
          log("dashboard:setFilters", "setFilters", {
            filters: { ...filters },
          });
          emit("filter:changed", {
            filters: { ...filters },
            dateRange: { ...dateRange },
          });
        },

        reportClick: ({ metric, value, timestamp }) => {
          log("dashboard:reportClick", "reportClick", {
            metric,
            value,
            timestamp,
          });
          emit("chart:clicked", { metric, value, timestamp });
        },

        consumeLiveFeed: async ({ metrics }) => {
          // The host's `requires.metrics.live` is just an
          // AsyncIterable. We consume it natively, no special
          // protocol layer involved.
          const collected: LiveUpdate[] = [];
          for await (const update of requires.metrics.live({ metrics })) {
            collected.push(update);
          }
          log("dashboard:consumeLiveFeed", "consumeLiveFeed", {
            metrics,
            received: collected.length,
          });
          return collected;
        },
      },

      // HOST to MODULE: listener handlers.
      // Declarative map. `createWmepModule` routes
      // `notify('data:invalidated', ...)` calls here, buffering
      // anything that arrives before onMount resolves.
      listeners: {
        "data:invalidated": ({ reason }) => {
          log("dashboard:data-invalidated", "data:invalidated", { reason });
          // Trigger a background refresh. We don't await here —
          // notify handlers are fire-and-forget by design.
          void doRefresh("data:invalidated").catch(() => {});
        },
      },

      // ---------------------------------------------------------------
      // Lifecycle (React useEffect shape).
      //
      // On mount: warm caches with one refresh, and (optionally)
      // start an auto-refresh interval. The cleanup returned
      // clears the interval on unmount.
      // ---------------------------------------------------------------
      onMount: async () => {
        requires.logger.write({ action: "dashboard:mount" });

        await doRefresh("refresh").catch(() => {
          /* host backend may not be wired up yet — non-fatal */
        });

        const timer =
          refreshInterval > 0
            ? setInterval(() => {
                void doRefresh("interval-refresh").catch(() => {});
              }, refreshInterval)
            : null;

        return () => {
          if (timer) clearInterval(timer);
          requires.logger.write({ action: "dashboard:unmount" });
        };
      },
    };
  },
);

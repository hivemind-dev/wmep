/**
 * @aurorah/wmep-analytics-dashboard — boundary file
 *
 * THE BOUNDARY FILE for the analytics-dashboard module.
 *
 * Outside code (any file outside the `analytics-dashboard/`
 * directory) MUST import the module from THIS file. It is the
 * only legal cross-module entry point.
 *
 * One symbol — `Dashboard` — is exported. Declaration merging
 * makes it both the contract (TYPE space) and the factory
 * (VALUE space), so consumers write
 *   import { Dashboard } from './dashboard.wmep'
 * once and use it for typing AND construction.
 */

import type { WmepFactory, WmepModule } from "../../src/core/index.js";

// The implementation lives in an INTERNAL file. It is referenced
// here only to wire it into the boundary export below.
import { createDashboard } from "./dashboard.js";

// -----------------------------------------------------------------
// Domain types (shared at the boundary).
//
// These describe the SHAPE of values that cross the module/host
// boundary in either direction. They are not internal helpers —
// they are part of the public contract.
// -----------------------------------------------------------------
export interface MetricPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export type AggregateResult = Record<
  string,
  { total: number; avg: number; min: number; max: number }
>;

export interface LiveUpdate {
  metric: string;
  value: number;
  timestamp: string;
}

export type ChartType = "line" | "bar" | "area" | "pie";

// -----------------------------------------------------------------
// The contract.
//
// `Dashboard` extends WmepModule<C, E, L, R, K>, filling each of
// the five slots with concrete types in the fixed wMEP order:
//   1) capabilities (HOST to MODULE)
//   2) events       (MODULE to HOST)
//   3) listeners    (HOST to MODULE)
//   4) requires     (MODULE to HOST)
//   5) config       (HOST to MODULE)
// -----------------------------------------------------------------
export interface Dashboard extends WmepModule<
  // HOST to MODULE: capabilities
  {
    /** Returns current filters, chart type, and date range. */
    getFilters(): {
      filters: Record<string, unknown>;
      chartType: ChartType;
      dateRange: { start?: string; end?: string };
    };

    /** Switch the active chart type. */
    setChart(p: { chartType: ChartType }): { chartType: ChartType };

    /** Refresh the cached series + aggregates from the host. */
    refresh(): Promise<{
      ok: true;
      refreshedAt: string;
      pointCount: number;
    }>;

    /** Run an ad-hoc time-series query. */
    queryMetrics(p: {
      metric: string;
      startDate: string;
      endDate: string;
      groupBy?: string;
    }): Promise<MetricPoint[]>;

    /** Multi-metric aggregate over a date range. */
    getAggregates(p: {
      metrics: string[];
      startDate: string;
      endDate: string;
    }): Promise<AggregateResult>;

    /** Replace the active filters. Emits 'filter:changed'. */
    setFilters(p: { filters: Record<string, unknown> }): void;

    /** Report a chart-click interaction. Emits 'chart:clicked'. */
    reportClick(p: { metric: string; value: number; timestamp: string }): void;

    /** Drain live updates until the source completes. */
    consumeLiveFeed(p: { metrics: string[] }): Promise<LiveUpdate[]>;
  },
  // MODULE to HOST: events
  {
    "filter:changed": {
      filters: Record<string, unknown>;
      dateRange: { start?: string; end?: string };
    };
    "chart:clicked": { metric: string; value: number; timestamp: string };
  },
  // HOST to MODULE: listeners
  {
    /** Tell the dashboard that cached data is stale. */
    "data:invalidated": { reason?: string };
  },
  // MODULE to HOST: requires
  {
    /** Host-supplied audit logger. The dashboard reports every
     *  state-changing action through this endpoint, mirroring
     *  the counter example's logging convention. */
    logger: { write(entry: { action: string; detail?: unknown }): void };

    /** Time-series query against the host's metrics backend. */
    metrics: {
      query(p: {
        metric: string;
        startDate: string;
        endDate: string;
        groupBy?: string;
        filters?: Record<string, unknown>;
      }): Promise<MetricPoint[]>;

      aggregate(p: {
        metrics: string[];
        startDate: string;
        endDate: string;
      }): Promise<AggregateResult>;

      /**
       * AsyncIterable feed of live updates. The module
       * drives consumption with `for await ... of`.
       */
      live(p: { metrics: string[] }): AsyncIterable<LiveUpdate>;
    };
  },
  // HOST to MODULE: config
  {
    chartType?: ChartType;
    refreshInterval?: number;
    dateRange?: { preset?: string; start?: string; end?: string };
    primaryMetric?: string;
  }
> {
  /** Identity of this module — overrides the base default. */
  module: { name: "@aurorah/wmep-analytics-dashboard"; version: "1.0.0" };
}

// -----------------------------------------------------------------
// The factory.
//
// `const Dashboard` lives in TypeScript's value space and is bound
// to the implementation imported from the internal file. The
// declared type `WmepFactory<Dashboard>` makes the implementation
// conform to the contract — otherwise this assignment fails to
// compile, catching contract drift right here at the boundary.
// -----------------------------------------------------------------
export const Dashboard: WmepFactory<Dashboard> = createDashboard;

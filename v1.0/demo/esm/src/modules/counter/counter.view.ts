/**
 * @demo/counter — module-owned UI (vanilla DOM)
 */

import type { WmepInstance } from "@aurorah/wmep";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";
import { h } from "../../lib/dom";

import { Counter } from "./counter.wmep";

import "./counter.scss";

export interface CounterViewProps {
  initial?: number;
  step?: number;
}

export interface CounterViewHandle {
  el: HTMLElement;
  instance: WmepInstance<Counter>;
  destroy(): Promise<void>;
}

export function createCounterView(
  props: CounterViewProps = {},
): CounterViewHandle {
  const initial = props.initial ?? DEFAULT_CONFIG.counter.initial;
  const step = props.step ?? DEFAULT_CONFIG.counter.step;

  const instance = Counter(
    { logger: createLogger("@demo/counter") },
    { initial, step },
  );

  const valueEl = h(
    "div",
    { className: "counter-value" },
    String(initial),
  );
  const sourceEl = h(
    "div",
    { className: "counter-source" },
    "last source: (initial)",
  );

  const minusBtn = h(
    "button",
    {
      className: "btn btn-red",
      onClick: () => instance.capabilities.decrement(),
    },
    `- ${step}`,
  );
  const resetBtn = h(
    "button",
    {
      className: "btn btn-gray",
      onClick: () => instance.capabilities.reset(),
    },
    "Reset",
  );
  const plusBtn = h(
    "button",
    {
      className: "btn btn-green",
      onClick: () => instance.capabilities.bump(),
    },
    `+ ${step}`,
  );

  const plus5Btn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.capabilities.bump({ amount: 5 }),
    },
    "+5",
  );
  const plus10Btn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.capabilities.bump({ amount: 10 }),
    },
    "+10",
  );
  const notifyBtn = h(
    "button",
    {
      className: "btn btn-ghost",
      onClick: () => instance.notify("counter:reset-request", undefined),
    },
    "notify reset-request",
  );

  const root = h(
    "section",
    { className: "module-panel counter-panel" },
    h(
      "header",
      { className: "module-panel-header" },
      h("span", { className: "module-panel-title" }, "Counter"),
      h("span", { className: "module-panel-subtitle" }, "@demo/counter"),
    ),
    h(
      "div",
      { className: "counter-display" },
      valueEl,
      sourceEl,
    ),
    h(
      "div",
      { className: "counter-buttons" },
      minusBtn,
      resetBtn,
      plusBtn,
    ),
    h(
      "div",
      { className: "counter-extra-buttons" },
      plus5Btn,
      plus10Btn,
      notifyBtn,
    ),
  );

  const off = instance.on("counter:changed", (e) => {
    valueEl.textContent = String(e.value);
    sourceEl.textContent = `last source: ${e.source}`;
  });

  return {
    el: root,
    instance,
    destroy: async () => {
      off();
      await instance.unmount("counter-view-unmount");
    },
  };
}

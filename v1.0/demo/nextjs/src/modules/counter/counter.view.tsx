/**
 * @demo/counter — module-owned UI
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { DEFAULT_CONFIG } from "../configuration/configuration.wmep";
import { createLogger } from "../../lib/host";

import { Counter } from "./counter.wmep";

import "./counter.scss";

export interface CounterViewProps {
  initial?: number;
  step?: number;
}

export function CounterView({
  initial = DEFAULT_CONFIG.counter.initial,
  step = DEFAULT_CONFIG.counter.step,
}: CounterViewProps): React.ReactElement {
  const [value, setValue] = useState<number>(initial);
  const [lastSource, setLastSource] = useState<string>("(initial)");
  const instanceRef = useRef<ReturnType<typeof Counter> | null>(null);

  useEffect(() => {
    const counter = Counter(
      { logger: createLogger("@demo/counter") },
      { initial, step },
    );
    instanceRef.current = counter;

    const off = counter.on("counter:changed", (e) => {
      setValue(e.value);
      setLastSource(e.source);
    });

    return () => {
      off();
      void counter.unmount("counter-view-unmount");
    };
  }, [initial, step]);

  const bump = (amount?: number) => instanceRef.current?.capabilities.bump(amount ? { amount } : undefined);
  const decrement = () => instanceRef.current?.capabilities.decrement();
  const reset = () => instanceRef.current?.capabilities.reset();
  const requestReset = () => instanceRef.current?.notify("counter:reset-request", undefined);

  return (
    <section className="module-panel counter-panel">
      <header className="module-panel-header">
        <span className="module-panel-title">Counter</span>
        <span className="module-panel-subtitle">@demo/counter</span>
      </header>

      <div className="counter-display">
        <div className="counter-value">{value}</div>
        <div className="counter-source">last source: {lastSource}</div>
      </div>

      <div className="counter-buttons">
        <button className="btn btn-red" onClick={decrement}>
          - {step}
        </button>
        <button className="btn btn-gray" onClick={reset}>
          Reset
        </button>
        <button className="btn btn-green" onClick={() => bump()}>
          + {step}
        </button>
      </div>

      <div className="counter-extra-buttons">
        <button className="btn btn-ghost" onClick={() => bump(5)}>
          +5
        </button>
        <button className="btn btn-ghost" onClick={() => bump(10)}>
          +10
        </button>
        <button className="btn btn-ghost" onClick={requestReset}>
          notify reset-request
        </button>
      </div>
    </section>
  );
}

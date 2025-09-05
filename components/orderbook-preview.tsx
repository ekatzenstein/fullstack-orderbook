"use client";

import * as React from "react";
import {
  useOrderBookState,
  setOrderBookSymbol,
  setOrderBookSigFigs,
} from "@/lib/orderbook/store";

export function OrderBookPreview() {
  const { symbol, nSigFigs, bids, asks, connected, frames, lastUpdateTs } =
    useOrderBookState();

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Order Book (preview)</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Symbol</label>
          <select
            className="bg-background border border-border rounded px-2 py-1 text-xs"
            value={symbol}
            onChange={(e) => setOrderBookSymbol(e.target.value as any)}
          >
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
          </select>
          <label className="text-xs text-muted-foreground">nSigFigs</label>
          <select
            className="bg-background border border-border rounded px-2 py-1 text-xs"
            value={nSigFigs}
            onChange={(e) => setOrderBookSigFigs(Number(e.target.value))}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Status: {connected ? "connected" : "disconnected"} • frames: {frames}
        {lastUpdateTs
          ? ` • last: ${new Date(lastUpdateTs).toLocaleTimeString()}`
          : ""}
      </div>
      {frames === 0 && (
        <div className="mt-4 text-xs text-muted-foreground">
          No data yet. Waiting for websocket updates...
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
        <div>
          <div className="text-muted-foreground mb-1">Bids</div>
          <div className="divide-y divide-border/60">
            {(bids ?? []).slice(0, 10).map(([px, sz]) => (
              <div key={`bid-${px}`} className="flex justify-between py-0.5">
                <span className="text-bid">{px}</span>
                <span className="text-foreground/80">{sz}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Asks</div>
          <div className="divide-y divide-border/60">
            {(asks ?? []).slice(0, 10).map(([px, sz]) => (
              <div key={`ask-${px}`} className="flex justify-between py-0.5">
                <span className="text-ask">{px}</span>
                <span className="text-foreground/80">{sz}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

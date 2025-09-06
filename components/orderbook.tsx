"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { motion, AnimatePresence } from "motion/react";
import {
  useOrderBookState,
  setOrderBookSymbol,
  setOrderBookDisplayCurrency,
  setOrderBookSigFigs,
} from "@/lib/orderbook/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function useDepthScales(bids: [number, number][], asks: [number, number][]) {
  const maxSz = React.useMemo(() => {
    const b = bids.length ? Math.max(...bids.map(([, sz]) => sz)) : 0;
    const a = asks.length ? Math.max(...asks.map(([, sz]) => sz)) : 0;
    return Math.max(b, a, 1);
  }, [bids, asks]);
  const x = React.useMemo(
    () => scaleLinear().domain([0, maxSz]).range([0, 100]),
    [maxSz]
  );
  return x;
}

export function OrderBook() {
  const { symbol, nSigFigs, displayCurrency, bids, asks } = useOrderBookState();

  // Build ladders from nearest levels (no step bucketing): 12 asks above, 12 bids below
  const { ladderAsks, ladderBids, bestBid, bestAsk } = React.useMemo(() => {
    const ascAsks = [...(asks ?? [])].sort((a, b) => a[0] - b[0]);
    const descBids = [...(bids ?? [])].sort((a, b) => b[0] - a[0]);
    const count = Math.min(12, ascAsks.length, descBids.length);
    const asksNear = ascAsks.slice(0, count).sort((a, b) => b[0] - a[0]);
    const bidsNear = descBids.slice(0, count);
    const bb = descBids.length ? descBids[0][0] : 0;
    const ba = ascAsks.length ? ascAsks[0][0] : 0;
    return {
      ladderAsks: asksNear,
      ladderBids: bidsNear,
      bestBid: bb,
      bestAsk: ba,
    };
  }, [asks, bids]);

  // Cumulative for pyramid depth
  const { cumAsks, cumBids, maxCumAsk, maxCumBid } = React.useMemo(() => {
    const ca: number[] = new Array(ladderAsks.length).fill(0);
    const cb: number[] = new Array(ladderBids.length).fill(0);
    let sum = 0;
    for (let i = ladderAsks.length - 1; i >= 0; i--) {
      sum += ladderAsks[i][1];
      ca[i] = sum;
    }
    let s2 = 0;
    for (let i = 0; i < ladderBids.length; i++) {
      s2 += ladderBids[i][1];
      cb[i] = s2;
    }
    return {
      cumAsks: ca,
      cumBids: cb,
      maxCumAsk: Math.max(1, ...ca),
      maxCumBid: Math.max(1, ...cb),
    };
  }, [ladderAsks, ladderBids]);

  // Price formatter based on significant digits
  const fmtPrice = React.useCallback(
    (px: number) => {
      if (!Number.isFinite(px)) return String(px);
      const order = Math.floor(Math.log10(Math.abs(px)));
      const decimals = Math.max(0, Math.min(8, nSigFigs - order - 1));
      const rounded = Number(px.toFixed(decimals));
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(rounded);
    },
    [nSigFigs]
  );

  const Row = React.useCallback(
    ({
      side,
      px,
      sz,
      cum,
      max,
    }: {
      side: "bid" | "ask";
      px: number;
      sz: number;
      cum: number;
      max: number;
    }) => {
      const widthPct = Math.max(0, Math.min(100, (cum / (max || 1)) * 100));
      const totalUsd = px * sz;
      const sizeDisp = displayCurrency === "USD" ? totalUsd : sz;
      const totalDisp = displayCurrency === "USD" ? totalUsd : sz * px; // same for USD here
      return (
        <div className="relative grid grid-cols-[1fr_1fr_1fr] items-center gap-3 py-0.5">
          <div className="absolute inset-0 w-full h-full">
            <AnimatePresence initial={false}>
              <motion.div
                key={`${side}-${px}`}
                initial={{ width: 0, opacity: 0.8 }}
                animate={{ width: `${widthPct}%`, opacity: 0.8 }}
                exit={{ width: 0, opacity: 0.2 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={
                  side === "bid" ? "h-full bg-depth-bid" : "h-full bg-depth-ask"
                }
                style={{ height: "calc(100% - 2px)" }}
              />
            </AnimatePresence>
          </div>
          <span
            className={`px-1 justify-self-start ${
              side === "bid" ? "text-bid" : "text-ask"
            }`}
          >
            {fmtPrice(px)}
          </span>
          <span className="text-foreground/80 text-center justify-self-center">
            {displayCurrency === "USD"
              ? Math.abs(sizeDisp) >= 1_000_000_000
                ? `${(sizeDisp / 1_000_000_000).toFixed(2)}B`
                : Math.abs(sizeDisp) >= 1_000_000
                ? `${(sizeDisp / 1_000_000).toFixed(2)}M`
                : Math.abs(sizeDisp) >= 1_000
                ? `${(sizeDisp / 1_000).toFixed(2)}K`
                : new Intl.NumberFormat("en-US").format(sizeDisp)
              : Number(sizeDisp).toExponential(1)}
          </span>
          <span className="text-foreground/90 font-medium text-right justify-self-end">
            {displayCurrency === "USD"
              ? Math.abs(totalDisp) >= 1_000_000_000
                ? `${(totalDisp / 1_000_000_000).toFixed(2)}B`
                : Math.abs(totalDisp) >= 1_000_000
                ? `${(totalDisp / 1_000_000).toFixed(2)}M`
                : Math.abs(totalDisp) >= 1_000
                ? `${(totalDisp / 1_000).toFixed(2)}K`
                : new Intl.NumberFormat("en-US").format(totalDisp)
              : Number(totalDisp).toExponential(1)}
          </span>
        </div>
      );
    },
    [fmtPrice, displayCurrency]
  );

  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadPct =
    spread != null && bestBid != null && bestAsk != null
      ? (spread / ((bestAsk + bestBid) / 2)) * 100
      : null;

  return (
    <section className="rounded-md border border-border bg-panel p-4 w-full  max-w-[400px]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Orders</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Symbol</label>
          <Select
            value={symbol}
            onValueChange={(v) => setOrderBookSymbol(v as any)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BTC">BTC</SelectItem>
              <SelectItem value="ETH">ETH</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] text-[11px] text-muted-foreground px-1">
        <div className="justify-self-start">Price</div>
        <div className="text-center justify-self-center">
          Size ({displayCurrency === "USD" ? "USD" : symbol})
        </div>
        <div className="text-right justify-self-end">
          Total ({displayCurrency === "USD" ? "USD" : symbol})
        </div>
      </div>
      <div className="mt-1 text-xs space-y-0.5">
        {ladderAsks.map(([px, sz], i) => (
          <Row
            key={`ask-${px}`}
            side="ask"
            px={px}
            sz={sz}
            cum={cumAsks[i]}
            max={maxCumAsk}
          />
        ))}
        <div className="my-2 flex bg-input/30 items-center justify-between px-2 py-1">
          <span>Spread</span>
          <span className="flex items-center gap-2">
            {spread != null ? fmtPrice(spread) : "-"}
            {spreadPct != null ? (
              <span className="text-foreground/70">
                {spreadPct.toFixed(2)}%
              </span>
            ) : null}
          </span>
        </div>
        {ladderBids.map(([px, sz], i) => (
          <Row
            key={`bid-${px}`}
            side="bid"
            px={px}
            sz={sz}
            cum={cumBids[i]}
            max={maxCumBid}
          />
        ))}
      </div>
      {/* Footer controls: nSigFigs and display */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <button
            className={`px-2 py-1 rounded-sm text-xs hover:cursor-pointer ${
              displayCurrency === "USD"
                ? "bg-input/50 text-primary"
                : "bg-transparent text-muted-foreground"
            }`}
            onClick={() => setOrderBookDisplayCurrency("USD")}
          >
            USD
          </button>
          <button
            className={`px-2 py-1 rounded-sm text-xs hover:cursor-pointer ${
              displayCurrency === "COIN"
                ? "bg-input/50 text-primary"
                : "bg-transparent text-muted-foreground"
            }`}
            onClick={() => setOrderBookDisplayCurrency("COIN")}
          >
            {symbol}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>nSigFigs</span>
          <Select
            value={String(nSigFigs)}
            onValueChange={(v) => setOrderBookSigFigs(Number(v))}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5">5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

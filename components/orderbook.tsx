"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { motion, AnimatePresence } from "motion/react";
import {
  useOrderBookState,
  setOrderBookSigFigs,
  setOrderBookSymbol,
  setOrderBookDisplayCurrency,
  pauseOrderBook,
  resumeOrderBook,
} from "@/lib/orderbook/store";
import { Button } from "@/components/ui/button";
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
  const { symbol, nSigFigs, displayCurrency, bids, asks, paused } =
    useOrderBookState();

  // Select closest 12 asks (lowest) and 12 bids (highest)
  const { asksDesc, bidsDesc, count } = React.useMemo(() => {
    const ascAsks = [...(asks ?? [])].sort((a, b) => a[0] - b[0]);
    const descBids = [...(bids ?? [])].sort((a, b) => b[0] - a[0]);
    const n = Math.min(12, ascAsks.length, descBids.length);
    return {
      asksDesc: ascAsks.slice(0, n).sort((a, b) => b[0] - a[0]),
      bidsDesc: descBids.slice(0, n),
      count: n,
    };
  }, [asks, bids]);

  const scale = useDepthScales(bidsDesc, asksDesc);

  const fmtSig = React.useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return String(value);
      const digits = Math.max(1, Math.min(8, nSigFigs ?? 2));
      return Number(value).toPrecision(digits);
    },
    [nSigFigs]
  );

  const fmtPrice = React.useCallback((px: number) => {
    if (!Number.isFinite(px)) return String(px);
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(px);
  }, []);

  const Row = React.useCallback(
    ({ side, px, sz }: { side: "bid" | "ask"; px: number; sz: number }) => {
      const widthPct = scale(sz);
      const sizeUsd = px * sz;
      const sizeDisp = displayCurrency === "USD" ? sizeUsd : sz;
      const totalDisp = displayCurrency === "USD" ? px * sz : sz;
      return (
        <div className="relative grid grid-cols-[1fr_auto_auto] items-center gap-3 py-0.5">
          <div className="absolute inset-0 w-full h-full">
            <AnimatePresence initial={false}>
              <motion.div
                key={`${side}-${px}`}
                initial={{ width: 0, opacity: 0.7 }}
                animate={{ width: `${widthPct}%`, opacity: 0.7 }}
                exit={{ width: 0, opacity: 0.2 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={
                  side === "bid" ? "h-full bg-depth-bid" : "h-full bg-depth-ask"
                }
                style={{ height: "calc(100% - 2px)" }}
              />
            </AnimatePresence>
          </div>
          <span className={side === "bid" ? "text-bid" : "text-ask"}>
            {fmtPrice(px)}
          </span>
          <span className="text-foreground/80">
            {displayCurrency === "USD" ? fmtPrice(sizeDisp) : fmtSig(sizeDisp)}
          </span>
          <span className="text-foreground/90 font-medium">
            {displayCurrency === "USD"
              ? fmtPrice(totalDisp)
              : fmtSig(totalDisp)}
          </span>
        </div>
      );
    },
    [scale, fmtSig, fmtPrice, displayCurrency]
  );

  // Single-column layout: asks (closest -> far) above, spread, bids (closest -> far) below

  const bestBid = React.useMemo(
    () => (bids && bids.length ? Math.max(...bids.map(([px]) => px)) : null),
    [bids]
  );
  const bestAsk = React.useMemo(
    () => (asks && asks.length ? Math.min(...asks.map(([px]) => px)) : null),
    [asks]
  );
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const spreadPct =
    spread != null && bestBid != null && bestAsk != null
      ? (spread / ((bestAsk + bestBid) / 2)) * 100
      : null;

  return (
    <section className="rounded-md border border-border bg-panel p-4  max-w-[400px]">
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
          <label className="text-xs text-muted-foreground">nSigFigs</label>
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
          <label className="text-xs text-muted-foreground">Display</label>
          <Select
            value={displayCurrency}
            onValueChange={(v) => setOrderBookDisplayCurrency(v as any)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="COIN">COIN</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (paused ? resumeOrderBook() : pauseOrderBook())}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      <div className="mt-4 text-xs space-y-0.5">
        {asksDesc.map(([px, sz]) => (
          <Row key={`ask-${px}`} side="ask" px={px} sz={sz} />
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
        {bidsDesc.map(([px, sz]) => (
          <Row key={`bid-${px}`} side="bid" px={px} sz={sz} />
        ))}
      </div>
    </section>
  );
}

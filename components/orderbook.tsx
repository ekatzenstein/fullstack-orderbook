"use client";

import * as React from "react";
import { scaleLinear } from "d3-scale";
import { motion, AnimatePresence } from "motion/react";
import {
  useOrderBookState,
  setOrderBookSigFigs,
  setOrderBookSymbol,
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
  const { symbol, nSigFigs, bids, asks, paused } = useOrderBookState();
  const scale = useDepthScales(bids, asks);

  const fmt = React.useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) return String(value);
      const digits = Math.max(1, Math.min(8, nSigFigs ?? 2));
      return Number(value).toPrecision(digits);
    },
    [nSigFigs]
  );

  const Row = React.useCallback(
    ({ side, px, sz }: { side: "bid" | "ask"; px: number; sz: number }) => {
      const widthPct = scale(sz);
      return (
        <div className="relative flex items-center justify-between py-0.5">
          <div className="absolute inset-0 w-full h-full">
            <AnimatePresence initial={false}>
              <motion.div
                key={`${side}-${px}`}
                initial={{ width: 0, opacity: 0.7 }}
                animate={{ width: `${widthPct}%`, opacity: 0.7 }}
                exit={{ width: 0, opacity: 0.2 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className={
                  side === "bid"
                    ? "h-full bg-depth-bid/60 rounded-sm"
                    : "h-full bg-depth-ask/60 rounded-sm"
                }
                style={{ height: "calc(100% - 2px)" }}
              />
            </AnimatePresence>
          </div>
          <span className={side === "bid" ? "text-bid" : "text-ask"}>
            {fmt(px)}
          </span>
          <span className="text-foreground/80">{fmt(sz)}</span>
        </div>
      );
    },
    [scale, fmt]
  );

  return (
    <section className="rounded-md border border-border bg-card p-4">
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => (paused ? resumeOrderBook() : pauseOrderBook())}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-8 text-xs">
        <div>
          <div className="text-muted-foreground mb-1">Bids</div>
          <div>
            {(bids ?? []).slice(0, 15).map(([px, sz]) => (
              <Row key={`bid-${px}`} side="bid" px={px} sz={sz} />
            ))}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground mb-1">Asks</div>
          <div>
            {(asks ?? []).slice(0, 15).map(([px, sz]) => (
              <Row key={`ask-${px}`} side="ask" px={px} sz={sz} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

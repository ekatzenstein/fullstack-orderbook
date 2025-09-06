"use client";

import { OrderBookRow } from "@/components/orderbook-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SIG_FIGS } from "@/config/constants";
import {
  setOrderBookDisplayCurrency,
  setOrderBookSigFigs,
  setOrderBookSymbol,
  useOrderBookState,
} from "@/lib/orderbook/store";
import * as React from "react";

export function OrderBook() {
  const { symbol, nSigFigs, displayCurrency, bids, asks, loading } =
    useOrderBookState();

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

  // Compact formatter (K/M/B) with fallback to decimals (no scientific)
  const fmtCompact = React.useCallback((n: number) => {
    if (!Number.isFinite(n)) return String(n);
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    const maxDecimals = 2;
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: maxDecimals,
    }).format(n);
  }, []);

  // Row extracted to `OrderBookRow`

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
          <label className="text-sm text-muted-foreground">Symbol</label>
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
          Size ({displayCurrency === "USD" ? "USD" : `${symbol}`})
        </div>
        <div className="text-right justify-self-end">
          Total ({displayCurrency === "USD" ? "USD" : `${symbol}`})
        </div>
      </div>
      <div
        className={`mt-1 text-xs space-y-0.5 ${
          loading ? "opacity-60 blur-[0.2px]" : "opacity-100"
        } relative min-h-[520px]`}
      >
        {ladderAsks.map(([px, sz], i) => (
          <OrderBookRow
            key={`ask-${px}`}
            side="ask"
            px={px}
            sz={sz}
            cum={cumAsks[i]}
            max={maxCumAsk}
            displayCurrency={displayCurrency}
            fmtPrice={fmtPrice}
            fmtCompact={fmtCompact}
          />
        ))}
        {ladderAsks.length > 0 && ladderBids.length > 0 ? (
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
        ) : null}
        {ladderBids.map(([px, sz], i) => (
          <OrderBookRow
            key={`bid-${px}`}
            side="bid"
            px={px}
            sz={sz}
            cum={cumBids[i]}
            max={maxCumBid}
            displayCurrency={displayCurrency}
            fmtPrice={fmtPrice}
            fmtCompact={fmtCompact}
          />
        ))}
        {loading ? (
          <div className="pointer-events-none absolute inset-0">
            <div className="h-full w-full bg-gradient-to-b from-transparent via-input/40 to-transparent animate-pulse" />
          </div>
        ) : null}
      </div>
      {/* Footer controls: nSigFigs and display */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <button
            className={`px-2 py-1 rounded-sm text-sm hover:cursor-pointer ${
              displayCurrency === "USD" ? "bg-input/50" : "bg-transparent"
            }`}
            onClick={() => setOrderBookDisplayCurrency("USD")}
          >
            USD
          </button>
          <button
            className={`px-2 py-1 rounded-sm text-sm hover:cursor-pointer ${
              displayCurrency === "COIN" ? "bg-input/50" : "bg-transparent"
            }`}
            onClick={() => setOrderBookDisplayCurrency("COIN")}
          >
            {symbol}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">nSigFigs</span>
          <Select
            value={String(nSigFigs)}
            onValueChange={(v) => setOrderBookSigFigs(Number(v))}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIG_FIGS.map((nSigFig) => (
                <SelectItem key={nSigFig} value={String(nSigFig)}>
                  {nSigFig}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}

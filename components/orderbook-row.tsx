"use client";

import { AnimatePresence, motion } from "motion/react";
import * as React from "react";

export interface OrderBookRowProps {
  side: "bid" | "ask";
  px: number;
  sz: number;
  cum: number;
  max: number;
  displayCurrency: "USD" | "COIN";
  fmtPrice: (px: number) => string;
  fmtCompact: (n: number) => string;
}

export function OrderBookRow({
  side,
  px,
  sz,
  cum,
  max,
  displayCurrency,
  fmtPrice,
  fmtCompact,
}: OrderBookRowProps) {
  const widthPct = Math.max(0, Math.min(100, (cum / (max || 1)) * 100));
  const totalUsd = px * sz;
  const sizeDisp = displayCurrency === "USD" ? sz * px : sz;
  const totalDisp = displayCurrency === "USD" ? px * cum : cum;

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
        {fmtCompact(sizeDisp)}
      </span>
      <span className="text-foreground/90 font-medium text-right justify-self-end">
        {fmtCompact(totalDisp)}
      </span>
    </div>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { HyperliquidWsClient } from "@/lib/hyperliquid/ws-client";
import type { SymbolCode, L2Level } from "@/lib/hyperliquid/types";

export interface OrderBookState {
  symbol: SymbolCode;
  nSigFigs: number;
  bids: L2Level[];
  asks: L2Level[];
  connected: boolean;
  frames: number;
  lastUpdateTs: number | null;
}

type Subscriber = () => void;

class OrderBookDataSource {
  private client = new HyperliquidWsClient("mainnet");
  private listeners: Set<Subscriber> = new Set();
  private current: OrderBookState = {
    symbol: "BTC",
    nSigFigs: 2,
    bids: [],
    asks: [],
    connected: false,
    frames: 0,
    lastUpdateTs: null,
  };

  constructor() {
    if (typeof window !== "undefined") {
      this.client.connect();
      this.client.onOpen(() => {
        this.current = { ...this.current, connected: true };
        this.emit();
      });
      this.client.onClose((ev) => {
        this.current = { ...this.current, connected: false };
        this.emit();
      });
      this.client.onError?.((ev) => {
        // Surface disconnect via connected flag already handled in onClose
        // Optionally, we could track last error
      });
      this.client.onL2Message((snap) => {
        // Accept exact match or prefixed variant like BTC-PERP
        const matchesSymbol =
          snap.coin === this.current.symbol ||
          snap.coin.startsWith(`${this.current.symbol}-`);
        if (!matchesSymbol) return;
        // Expecting bids/asks arrays
        this.current = {
          ...this.current,
          bids: snap.levels.bids,
          asks: snap.levels.asks,
          frames: this.current.frames + 1,
          lastUpdateTs: Date.now(),
        };
        this.emit();
      });
      this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
      // Also attempt common perp suffix variant
      this.client.subscribeL2Book(
        `${this.current.symbol}-PERP` as any,
        this.current.nSigFigs
      );
    }
  }

  setSymbol(symbol: SymbolCode) {
    if (symbol === this.current.symbol) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.client.unsubscribeL2Book(
      `${this.current.symbol}-PERP` as any,
      this.current.nSigFigs
    );
    this.current = { ...this.current, symbol, bids: [], asks: [] };
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.client.subscribeL2Book(`${symbol}-PERP` as any, this.current.nSigFigs);
    this.emit();
  }

  setSigFigs(nSigFigs: number) {
    if (nSigFigs === this.current.nSigFigs) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.client.unsubscribeL2Book(
      `${this.current.symbol}-PERP` as any,
      this.current.nSigFigs
    );
    this.current = { ...this.current, nSigFigs, bids: [], asks: [] };
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.client.subscribeL2Book(
      `${this.current.symbol}-PERP` as any,
      this.current.nSigFigs
    );
    this.emit();
  }

  getSnapshot = () => this.current;

  subscribe = (cb: Subscriber) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  private emit() {
    this.listeners.forEach((cb) => cb());
  }
}

// Singleton data source for the app lifetime
const dataSource = new OrderBookDataSource();

export function useOrderBookState(): OrderBookState {
  // Provide getServerSnapshot to avoid SSR hydration warnings.
  return useSyncExternalStore(
    dataSource.subscribe,
    dataSource.getSnapshot,
    dataSource.getSnapshot
  );
}

export function setOrderBookSymbol(symbol: SymbolCode) {
  dataSource.setSymbol(symbol);
}

export function setOrderBookSigFigs(nSigFigs: number) {
  dataSource.setSigFigs(nSigFigs);
}

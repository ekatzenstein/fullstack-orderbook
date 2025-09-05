"use client";

import { useSyncExternalStore } from "react";
import { HyperliquidWsClient } from "@/lib/hyperliquid/ws-client";
import type { SymbolCode, L2Level } from "@/lib/hyperliquid/types";

export interface OrderBookState {
  symbol: SymbolCode;
  nSigFigs: number;
  displayCurrency: "USD" | "COIN";
  bids: L2Level[];
  asks: L2Level[];
  connected: boolean;
  frames: number;
  lastUpdateTs: number | null;
  paused: boolean;
}

type Subscriber = () => void;

class OrderBookDataSource {
  private client = new HyperliquidWsClient("mainnet");
  private listeners: Set<Subscriber> = new Set();
  private current: OrderBookState = {
    symbol: "BTC",
    nSigFigs: 2,
    displayCurrency: "COIN",
    bids: [],
    asks: [],
    connected: false,
    frames: 0,
    lastUpdateTs: null,
    paused: false,
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
        if (this.current.paused) return;
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
      // Keep it simple: subscribe to plain coin only
    }
  }

  setSymbol(symbol: SymbolCode) {
    if (this.current.paused) {
      this.current = { ...this.current, symbol, bids: [], asks: [] };
      this.emit();
      return;
    }
    if (symbol === this.current.symbol) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.current = { ...this.current, symbol, bids: [], asks: [] };
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.emit();
  }

  setSigFigs(nSigFigs: number) {
    if (this.current.paused) {
      this.current = { ...this.current, nSigFigs, bids: [], asks: [] };
      this.emit();
      return;
    }
    if (nSigFigs === this.current.nSigFigs) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.current = { ...this.current, nSigFigs, bids: [], asks: [] };
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.emit();
  }

  setDisplayCurrency(currency: "USD" | "COIN") {
    if (currency === this.current.displayCurrency) return;
    this.current = { ...this.current, displayCurrency: currency };
    this.emit();
  }

  pause() {
    if (this.current.paused) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.current = { ...this.current, paused: true };
    this.emit();
  }

  resume() {
    if (!this.current.paused) return;
    this.current = { ...this.current, paused: false };
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
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

export function setOrderBookDisplayCurrency(currency: "USD" | "COIN") {
  dataSource.setDisplayCurrency(currency);
}

export function pauseOrderBook() {
  dataSource.pause();
}

export function resumeOrderBook() {
  dataSource.resume();
}

"use client";

import { useSyncExternalStore } from "react";
import { HyperliquidWsClient } from "@/lib/hyperliquid/ws-client";
import type { SymbolCode, L2Level } from "@/lib/hyperliquid/types";

export interface OrderBookState {
  symbol: SymbolCode;
  nSigFigs: number;
  displayCurrency: "USD" | "COIN";
  priceDecimals: number;
  bids: L2Level[];
  asks: L2Level[];
  connected: boolean;
  frames: number;
  lastUpdateTs: number | null;
  loading: boolean;
}

type Subscriber = () => void;

/**
 * Note: I typically would use Zustand with Immer for a store, but OOO may be more appropriate for a Webhook implementation.
 */
class OrderBookDataSource {
  private client = new HyperliquidWsClient("mainnet");
  private listeners: Set<Subscriber> = new Set();
  private current: OrderBookState = {
    symbol: "BTC",
    nSigFigs: 3,
    displayCurrency: "USD",
    priceDecimals: 1,
    bids: [],
    asks: [],
    connected: false,
    frames: 0,
    lastUpdateTs: null,
    loading: true,
  };

  constructor() {
    if (typeof window !== "undefined") {
      this.client.connect();
      this.client.onOpen(() => {
        this.current = { ...this.current, connected: true, loading: true };
        this.emit();
      });
      this.client.onClose((ev) => {
        this.current = { ...this.current, connected: false };
        this.emit();
      });
      this.client.onError?.((ev) => {
        // Surface disconnect via connected flag already handled in onClose
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
          loading: false,
        };
        this.emit();
      });
      this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
    }
  }

  setSymbol(symbol: SymbolCode) {
    if (symbol === this.current.symbol) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.current = { ...this.current, symbol, loading: true };
    this.emit();
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
  }

  setSigFigs(nSigFigs: number) {
    if (nSigFigs === this.current.nSigFigs) return;
    this.client.unsubscribeL2Book(this.current.symbol, this.current.nSigFigs);
    this.current = { ...this.current, nSigFigs, loading: true };
    this.emit();
    this.client.subscribeL2Book(this.current.symbol, this.current.nSigFigs);
  }

  setDisplayCurrency(currency: "USD" | "COIN") {
    if (currency === this.current.displayCurrency) return;
    this.current = { ...this.current, displayCurrency: currency };
    this.emit();
  }

  setPriceDecimals(decimals: number) {
    if (decimals === this.current.priceDecimals) return;
    this.current = { ...this.current, priceDecimals: decimals };
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

export function setOrderBookPriceDecimals(decimals: number) {
  dataSource.setPriceDecimals(decimals);
}

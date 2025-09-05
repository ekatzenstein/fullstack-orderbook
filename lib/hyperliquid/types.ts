export type SymbolCode = "BTC" | "ETH" | "BTC-PERP" | "ETH-PERP";

export type L2Level = [price: number, size: number];

export interface L2Snapshot {
  type: "l2Book";
  coin: SymbolCode;
  levels: {
    bids: L2Level[];
    asks: L2Level[];
  };
  nSigFigs?: number;
}

export interface SubscribeL2Book {
  method: "subscribe";
  subscription: {
    type: "l2Book";
    coin: SymbolCode;
    nSigFigs?: number;
  };
}

export interface UnsubscribeL2Book {
  method: "unsubscribe";
  subscription: {
    type: "l2Book";
    coin: SymbolCode;
    nSigFigs?: number;
  };
}

export type WsOutbound = SubscribeL2Book | UnsubscribeL2Book;

export type WsInbound =
  | { channel: "subscriptionResponse"; data: SubscribeL2Book }
  | { channel: "l2Book"; data: L2Snapshot };

// Some WS servers accept an array form under `subscriptions`.
export interface SubscribeL2BookAlt {
  method: "subscribe";
  subscriptions: Array<{
    type: "l2Book";
    coin: SymbolCode;
    nSigFigs?: number;
  }>;
}

export interface UnsubscribeL2BookAlt {
  method: "unsubscribe";
  subscriptions: Array<{
    type: "l2Book";
    coin: SymbolCode;
    nSigFigs?: number;
  }>;
}

export type WsOutboundAlt = SubscribeL2BookAlt | UnsubscribeL2BookAlt;

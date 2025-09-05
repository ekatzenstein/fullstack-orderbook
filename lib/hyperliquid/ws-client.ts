import { getHyperliquidWsUrl, HyperliquidNetwork } from "./endpoints";
import type {
  SymbolCode,
  WsInbound,
  WsOutbound,
  L2Snapshot,
  L2Level,
} from "./types";

type Listener = (snapshot: L2Snapshot) => void;

export class HyperliquidWsClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private heartbeat: number | null = null;
  private reconnectTimer: number | null = null;
  private isManuallyClosed = false;
  private sendQueue: string[] = [];
  private onOpenListeners: Set<(ev: Event) => void> = new Set();
  private onCloseListeners: Set<(ev: CloseEvent) => void> = new Set();
  private onErrorListeners: Set<(ev: Event) => void> = new Set();

  private onMessageListeners: Set<Listener> = new Set();
  private activeL2Subs: Array<{ coin: SymbolCode; nSigFigs?: number }> = [];

  constructor(network: HyperliquidNetwork = "mainnet") {
    this.url = getHyperliquidWsUrl(network);
  }

  connect(): void {
    if (this.ws) return;
    this.isManuallyClosed = false;
    if (typeof window !== "undefined") {
      console.info("[HL-WS] connecting", this.url);
    }
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener("open", (ev) => {
      this.startHeartbeat();
      // Flush any queued messages
      if (this.sendQueue.length) {
        this.sendQueue.forEach((msg) => this.ws?.send(msg));
        this.sendQueue = [];
      }
      if (typeof window !== "undefined") {
        console.info("[HL-WS] open", { readyState: this.ws?.readyState });
      }
      this.onOpenListeners.forEach((cb) => cb(ev));
      // Re-subscribe to active streams after reconnect
      for (const sub of this.activeL2Subs) {
        const payload: WsOutbound = {
          method: "subscribe",
          subscription: {
            type: "l2Book",
            coin: sub.coin,
            ...(sub.nSigFigs ? { nSigFigs: sub.nSigFigs } : {}),
          },
        };
        this.send(payload);
      }
    });
    this.ws.addEventListener("message", (evt) => {
      try {
        const raw = evt.data as string;
        if (typeof window !== "undefined") {
          console.debug("[HL-WS] message", raw.slice(0, 200));
        }
        const parsed = JSON.parse(raw) as unknown;
        const snap = this.normalizeL2Book(parsed);
        if (snap) {
          if (typeof window !== "undefined") {
            console.debug("[HL-WS] l2 snap", {
              coin: snap.coin,
              bids: snap.levels.bids.length,
              asks: snap.levels.asks.length,
              nSigFigs: snap.nSigFigs,
            });
          }
          this.onMessageListeners.forEach((cb) => cb(snap));
        }
      } catch {
        // Ignore malformed
      }
    });
    this.ws.addEventListener("close", (ev) => {
      this.stopHeartbeat();
      this.ws = null;
      if (typeof window !== "undefined") {
        console.warn("[HL-WS] close", { code: ev.code, reason: ev.reason });
      }
      this.onCloseListeners.forEach((cb) => cb(ev));
      if (!this.isManuallyClosed) {
        this.scheduleReconnect();
      }
    });
    this.ws.addEventListener("error", (ev) => {
      // Treat errors as close to trigger reconnect
      if (typeof window !== "undefined") {
        console.error("[HL-WS] error", ev);
      }
      this.onErrorListeners.forEach((cb) => cb(ev));
      this.ws?.close();
    });
  }

  disconnect(): void {
    this.isManuallyClosed = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  }

  private startHeartbeat() {
    // Browsers cannot send WebSocket ping frames. Some servers close on
    // unexpected payloads, so we avoid sending custom "ping" strings.
    this.stopHeartbeat();
    this.heartbeat = null;
  }

  private stopHeartbeat() {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  subscribeL2Book(coin: SymbolCode, nSigFigs?: number) {
    const payload: WsOutbound = {
      method: "subscribe",
      subscription: { type: "l2Book", coin, ...(nSigFigs ? { nSigFigs } : {}) },
    };
    if (typeof window !== "undefined") {
      console.info("[HL-WS] subscribe", payload);
    }
    // Track subscription for reconnects (dedupe by coin+nSigFigs)
    const exists = this.activeL2Subs.some(
      (s) => s.coin === coin && s.nSigFigs === nSigFigs
    );
    if (!exists) this.activeL2Subs.push({ coin, nSigFigs });
    this.send(payload);
  }

  unsubscribeL2Book(coin: SymbolCode, nSigFigs?: number) {
    const payload: WsOutbound = {
      method: "unsubscribe",
      subscription: { type: "l2Book", coin, ...(nSigFigs ? { nSigFigs } : {}) },
    };
    if (typeof window !== "undefined") {
      console.info("[HL-WS] unsubscribe", payload);
    }
    this.activeL2Subs = this.activeL2Subs.filter(
      (s) => !(s.coin === coin && s.nSigFigs === nSigFigs)
    );
    this.send(payload);
  }

  onL2Message(listener: Listener) {
    this.onMessageListeners.add(listener);
    return () => this.onMessageListeners.delete(listener);
  }

  private send(msg: WsOutbound) {
    const data = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (typeof window !== "undefined") {
        console.debug("[HL-WS] send", data);
      }
      this.ws.send(data);
    } else {
      if (typeof window !== "undefined") {
        console.debug("[HL-WS] queue", data);
      }
      this.sendQueue.push(data);
    }
  }

  private normalizeL2Book(message: unknown): L2Snapshot | null {
    // We accept a few shapes and normalize to { bids, asks }
    // 1) { channel: "l2Book", data: { coin, levels: { bids: [ [px, sz], ...], asks: [...] }, nSigFigs? } }
    // 2) { channel: "l2Book", data: { coin, bids: [ [px, sz], ...], asks: [...] } }
    // 3) { type: "l2Book", coin, levels: [ [px, sz, side], ...] }
    // 4) { channel: "l2Book", data: { coin, levels: [ [px, sz, side], ...] } }

    const toNumber = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const isLevelTuple = (v: unknown): v is L2Level => {
      if (!Array.isArray(v) || v.length < 2) return false;
      const px = toNumber(v[0]);
      const sz = toNumber(v[1]);
      return px !== null && sz !== null;
    };
    const mapLevelTuple = (v: unknown): L2Level | null => {
      if (!Array.isArray(v) || v.length < 2) return null;
      const px = toNumber(v[0]);
      const sz = toNumber(v[1]);
      return px !== null && sz !== null ? [px, sz] : null;
    };

    const extract = (
      payload: unknown
    ): {
      coin: SymbolCode;
      bids: L2Level[];
      asks: L2Level[];
      nSigFigs?: number;
    } | null => {
      if (!payload || typeof payload !== "object") return null;
      const anyPayload = payload as Record<string, unknown>;

      const channel = anyPayload["channel"];
      const data = anyPayload["data"];
      const channelOk =
        !channel ||
        (typeof channel === "string" &&
          channel.toLowerCase().includes("l2book"));
      const root =
        channelOk && data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : anyPayload;

      if (!root) return null;

      const coin = root["coin"] as unknown;
      if (
        coin !== "BTC" &&
        coin !== "ETH" &&
        coin !== "BTC-PERP" &&
        coin !== "ETH-PERP"
      )
        return null;

      const nSigFigsMaybe = root["nSigFigs"];

      // Case A: root.levels is an object with bids/asks arrays
      const levels = root["levels"] as unknown;
      if (levels && typeof levels === "object" && !Array.isArray(levels)) {
        const lv = levels as Record<string, unknown>;
        const bids = Array.isArray(lv["bids"])
          ? ((lv["bids"] as unknown[])
              .map(mapLevelTuple)
              .filter(Boolean) as L2Level[])
          : [];
        const asks = Array.isArray(lv["asks"])
          ? ((lv["asks"] as unknown[])
              .map(mapLevelTuple)
              .filter(Boolean) as L2Level[])
          : [];
        return {
          coin,
          bids,
          asks,
          nSigFigs: toNumber(nSigFigsMaybe) ?? undefined,
        };
      }

      // Case B: root has bids/asks directly
      if (
        Array.isArray((root as Record<string, unknown>)["bids"]) ||
        Array.isArray((root as Record<string, unknown>)["asks"])
      ) {
        const bids = Array.isArray((root as Record<string, unknown>)["bids"])
          ? (((root as Record<string, unknown>)["bids"] as unknown[])
              .map(mapLevelTuple)
              .filter(Boolean) as L2Level[])
          : [];
        const asks = Array.isArray((root as Record<string, unknown>)["asks"])
          ? (((root as Record<string, unknown>)["asks"] as unknown[])
              .map(mapLevelTuple)
              .filter(Boolean) as L2Level[])
          : [];
        return {
          coin,
          bids,
          asks,
          nSigFigs: toNumber(nSigFigsMaybe) ?? undefined,
        };
      }

      // Case C: levels is an array of tuples [px, sz, side]
      if (
        Array.isArray(levels) &&
        (levels as unknown[]).length > 0 &&
        (!Array.isArray((levels as unknown[])[0]) ||
          (Array.isArray((levels as unknown[])[0]) &&
            typeof ((levels as unknown[])[0] as unknown[])[0] !== "object"))
      ) {
        const bids: L2Level[] = [];
        const asks: L2Level[] = [];
        for (const entry of levels as unknown[]) {
          if (!Array.isArray(entry) || entry.length < 3) continue;
          const px = toNumber(entry[0]);
          const sz = toNumber(entry[1]);
          if (px === null || sz === null) continue;
          const side = entry[2];
          if (side === "bid" || side === 0) bids.push([px, sz]);
          else if (side === "ask" || side === 1) asks.push([px, sz]);
        }
        return {
          coin,
          bids,
          asks,
          nSigFigs: toNumber(nSigFigsMaybe) ?? undefined,
        };
      }

      // Case D: levels is a pair [bids[], asks[]] where inner arrays are objects { px, sz, ... }
      if (
        Array.isArray(levels) &&
        (levels as unknown[]).length >= 2 &&
        Array.isArray((levels as unknown[])[0]) &&
        Array.isArray((levels as unknown[])[1])
      ) {
        const rawBids = (levels as unknown[])[0] as unknown[];
        const rawAsks = (levels as unknown[])[1] as unknown[];
        const bids: L2Level[] = [];
        const asks: L2Level[] = [];
        for (const obj of rawBids) {
          if (obj && typeof obj === "object") {
            const px = toNumber((obj as any).px);
            const sz = toNumber((obj as any).sz);
            if (px !== null && sz !== null) bids.push([px, sz]);
          }
        }
        for (const obj of rawAsks) {
          if (obj && typeof obj === "object") {
            const px = toNumber((obj as any).px);
            const sz = toNumber((obj as any).sz);
            if (px !== null && sz !== null) asks.push([px, sz]);
          }
        }
        return {
          coin,
          bids,
          asks,
          nSigFigs: toNumber(nSigFigsMaybe) ?? undefined,
        };
      }

      return null;
    };

    const normalized = extract(message);
    if (!normalized) return null;
    return {
      type: "l2Book",
      coin: normalized.coin,
      levels: { bids: normalized.bids, asks: normalized.asks },
      nSigFigs: normalized.nSigFigs,
    };
  }

  onOpen(cb: (ev: Event) => void) {
    this.onOpenListeners.add(cb);
    return () => this.onOpenListeners.delete(cb);
  }

  onClose(cb: (ev: CloseEvent) => void) {
    this.onCloseListeners.add(cb);
    return () => this.onCloseListeners.delete(cb);
  }

  onError(cb: (ev: Event) => void) {
    this.onErrorListeners.add(cb);
    return () => this.onErrorListeners.delete(cb);
  }
}

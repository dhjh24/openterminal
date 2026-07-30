import { useCallback, useEffect } from "react";
import { create } from "zustand";

export type QuotesConnectionState = "connecting" | "connected" | "disconnected";

export type QuoteTick = {
  token: string;
  market: string;
  symbol: string;
  ltp: number;
  change: number;
  change_pct: number;
  oi: number | null;
  volume: number | null;
  ts: string;
};

export type QuoteCandle = {
  token: string;
  interval: string;
  t: number; // ms epoch
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  status?: string;
};

type QuotesStore = {
  connectionState: QuotesConnectionState;
  ticksByToken: Record<string, QuoteTick>;
  candlesByKey: Record<string, QuoteCandle>;
  marketStatus: any | null;
  setConnectionState: (state: QuotesConnectionState) => void;
  upsertTick: (tick: QuoteTick) => void;
  upsertCandle: (candle: QuoteCandle) => void;
  setMarketStatus: (status: any) => void;
};

export const useQuotesStore = create<QuotesStore>((set) => ({
  connectionState: "disconnected",
  ticksByToken: {},
  candlesByKey: {},
  marketStatus: null,
  setConnectionState: (connectionState) => set({ connectionState }),
  upsertTick: (tick) =>
    set((state) => ({
      ticksByToken: {
        ...state.ticksByToken,
        [tick.token]: tick,
      },
    })),
  upsertCandle: (candle) =>
    set((state) => ({
      candlesByKey: {
        ...state.candlesByKey,
        [`${candle.token}|${candle.interval}`]: candle,
      },
    })),
  setMarketStatus: (marketStatus) => set({ marketStatus }),
}));

function normalizeSymbols(symbols: string[]): string[] {
  return Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));
}

/** Map India / legacy aliases to US exchange tokens for the US market profile. */
export function normalizeMarket(market: string): string {
  const raw = String(market || "").trim().toUpperCase();
  if (raw === "NYSE" || raw === "NASDAQ") return raw;
  if (raw === "IN" || raw === "NSE" || raw === "NFO" || raw === "BSE") return "NASDAQ";
  return raw || "NASDAQ";
}

function toToken(market: string, symbol: string): string {
  return `${normalizeMarket(market)}:${symbol.trim().toUpperCase()}`;
}

function parseToken(token: string): { market: string; symbol: string } | null {
  const [market, symbol] = token.trim().toUpperCase().split(":");
  if (!market || !symbol) return null;
  return { market, symbol };
}

const WS_QUOTES_SUFFIX = "/ws/quotes";

function collapseDuplicateApiSegments(path: string): string {
  return path.replace(/\/api(?:\/api)+/g, "/api");
}

export function buildQuotesWsUrl(): string {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || "/api").trim();
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const url = new URL(apiBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const basePath = collapseDuplicateApiSegments(url.pathname.replace(/\/+$/, "") || "/api");
    url.pathname = collapseDuplicateApiSegments(`${basePath}${WS_QUOTES_SUFFIX}`);
    return url.toString();
  }

  if (typeof window === "undefined") return collapseDuplicateApiSegments(`/api${WS_QUOTES_SUFFIX}`);
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const normalizedBase = apiBase.startsWith("/") ? apiBase : `/${apiBase}`;
  const path = collapseDuplicateApiSegments(`${normalizedBase.replace(/\/+$/, "")}${WS_QUOTES_SUFFIX}`);
  return `${wsProtocol}//${window.location.host}${path}`;
}

const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 8_000;

class QuotesWsManager {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = false;
  private wantedCounts = new Map<string, number>();
  private sentSubscriptions = new Set<string>();
  private listeners = new Set<(tick: QuoteTick) => void>();
  lastCloseCode: number | null = null;
  lastCloseReason: string | null = null;

  addListener(cb: (tick: QuoteTick) => void) {
    this.listeners.add(cb);
  }

  removeListener(cb: (tick: QuoteTick) => void) {
    this.listeners.delete(cb);
  }

  subscribe(market: string, symbols: string[]) {
    const next = normalizeSymbols(symbols);
    if (!next.length) return;

    for (const symbol of next) {
      const token = toToken(market, symbol);
      this.wantedCounts.set(token, (this.wantedCounts.get(token) || 0) + 1);
    }

    this.shouldReconnect = true;
    this.ensureConnected();
    this.flushSubscriptions();
  }

  unsubscribe(market: string, symbols: string[]) {
    const next = normalizeSymbols(symbols);
    if (!next.length) return;

    for (const symbol of next) {
      const token = toToken(market, symbol);
      const count = this.wantedCounts.get(token) || 0;
      if (count <= 1) {
        this.wantedCounts.delete(token);
      } else {
        this.wantedCounts.set(token, count - 1);
      }
    }

    this.flushSubscriptions();
    if (this.wantedCounts.size === 0) {
      this.shouldReconnect = false;
      this.closeSocket();
    }
  }

  private ensureConnected() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.connect();
  }

  private clearPingTimers() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private startPing(ws: WebSocket) {
    this.clearPingTimers();
    this.pingInterval = setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
      try {
        this.socket.send(JSON.stringify({ op: "ping" }));
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
        this.pongTimeout = setTimeout(() => {
          if (import.meta.env.DEV) {
            console.warn("[quotes-ws] pong timeout — closing socket to reconnect");
          }
          this.socket?.close();
        }, PONG_TIMEOUT_MS);
      } catch {
        this.socket?.close();
      }
    }, PING_INTERVAL_MS);
  }

  private connect() {
    this.clearReconnectTimer();
    useQuotesStore.getState().setConnectionState("connecting");

    const url = buildQuotesWsUrl();

    const ws = new WebSocket(url);
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.sentSubscriptions.clear();
      useQuotesStore.getState().setConnectionState("connected");
      // #region agent log
      fetch('http://localhost:7732/ingest/e3dc31c6-26af-4b2c-99d0-d7886b2cd9a5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'30ea21'},body:JSON.stringify({sessionId:'30ea21',runId:'pre-fix',hypothesisId:'H6',location:'useQuotesStream.ts:onopen',message:'ws open',data:{url},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      this.startPing(ws);
      this.flushSubscriptions();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (!payload) return;

        if (payload.type === "pong") {
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
          return;
        }

        if (payload.type === "error") {
          if (import.meta.env.DEV) {
            console.warn("[quotes-ws] server error:", payload);
          }
          return;
        }

        if (payload.type === "market_status") {
          useQuotesStore.getState().setMarketStatus(payload.data);
          return;
        }

        if (typeof payload.symbol !== "string") return;
        if (payload.type === "candle") {
          const interval = String(payload.interval || "").trim();
          const t = Number(payload.t);
          const o = Number(payload.o);
          const h = Number(payload.h);
          const l = Number(payload.l);
          const c = Number(payload.c);
          const v = Number(payload.v ?? 0);
          if (!interval || ![t, o, h, l, c].every(Number.isFinite)) return;
          useQuotesStore.getState().upsertCandle({
            token: payload.symbol.toUpperCase(),
            interval,
            t,
            o,
            h,
            l,
            c,
            v: Number.isFinite(v) ? v : 0,
            status: typeof payload.status === "string" ? payload.status : undefined,
          });
          return;
        }
        if (payload.type !== "tick") return;
        const parsed = parseToken(payload.symbol);
        if (!parsed) return;
        const ltp = Number(payload.ltp);
        if (!Number.isFinite(ltp)) return;
        const tick: QuoteTick = {
          token: payload.symbol.toUpperCase(),
          market: parsed.market,
          symbol: parsed.symbol,
          ltp,
          change: Number.isFinite(Number(payload.change)) ? Number(payload.change) : 0,
          change_pct: Number.isFinite(Number(payload.change_pct)) ? Number(payload.change_pct) : 0,
          oi: Number.isFinite(Number(payload.oi)) ? Number(payload.oi) : null,
          volume: Number.isFinite(Number(payload.volume)) ? Number(payload.volume) : null,
          ts: typeof payload.ts === "string" ? payload.ts : new Date().toISOString(),
        };
        useQuotesStore.getState().upsertTick(tick);
        this.listeners.forEach((l) => l(tick));
      } catch {
        // Ignore malformed messages.
      }
    };

    ws.onclose = (event) => {
      this.clearPingTimers();
      this.socket = null;
      this.sentSubscriptions.clear();
      this.lastCloseCode = event.code;
      this.lastCloseReason = event.reason || null;
      useQuotesStore.getState().setConnectionState("disconnected");

      if (import.meta.env.DEV) {
        console.warn("[quotes-ws] closed", { code: event.code, reason: event.reason, wasClean: event.wasClean });
      }

      if (this.shouldReconnect && this.wantedCounts.size > 0) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = () => {
      if (import.meta.env.DEV) {
        console.warn("[quotes-ws] connection error");
      }
      ws.close();
    };
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    const baseDelay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** this.reconnectAttempt);
    const delay = baseDelay + Math.round(Math.random() * 300);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private flushSubscriptions() {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const desired = new Set(this.wantedCounts.keys());
    const toSubscribe = Array.from(desired).filter((token) => !this.sentSubscriptions.has(token));
    const toUnsubscribe = Array.from(this.sentSubscriptions).filter((token) => !desired.has(token));

    if (toSubscribe.length) {
      ws.send(JSON.stringify({ op: "subscribe", symbols: toSubscribe }));
      for (const token of toSubscribe) this.sentSubscriptions.add(token);
    }
    if (toUnsubscribe.length) {
      ws.send(JSON.stringify({ op: "unsubscribe", symbols: toUnsubscribe }));
      for (const token of toUnsubscribe) this.sentSubscriptions.delete(token);
    }
  }

  private closeSocket() {
    this.clearReconnectTimer();
    this.clearPingTimers();
    this.sentSubscriptions.clear();
    const ws = this.socket;
    this.socket = null;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    } else {
      useQuotesStore.getState().setConnectionState("disconnected");
    }
  }
}

const manager = new QuotesWsManager();

export function useQuotesStream(market: string, onTick?: (tick: QuoteTick) => void) {
  const connectionState = useQuotesStore((s) => s.connectionState);

  useEffect(() => {
    if (!onTick) return;
    manager.addListener(onTick);
    return () => manager.removeListener(onTick);
  }, [onTick]);

  const subscribe = useCallback((symbols: string[]) => manager.subscribe(market, symbols), [market]);
  const unsubscribe = useCallback((symbols: string[]) => manager.unsubscribe(market, symbols), [market]);
  return {
    subscribe,
    unsubscribe,
    connectionState,
    isConnected: connectionState === "connected",
  };
}

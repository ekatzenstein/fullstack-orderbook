# Fullstack OrderBook

A high-performance, real-time order book built with Next.js (App Router) and Tailwind, streaming live L2 data via WebSocket and rendering a smooth, readable, and compact depth view.

## Features

- Live L2 order book (Hyperliquid WebSocket)
  - Typed WebSocket client with reconnect and message queueing
  - Symbol switching (BTC / ETH)
  - Significant digits (nSigFigs) control (2–5)
- Order book UI
  - Single-column layout: asks (top) → spread → bids (bottom)
  - Cumulative depth bars (inverted pyramid) with Motion animations
  - Column headers: Price, Size, Total
  - Price formatted by significant digits; Size/Total formatted compactly (K/M/B)
  - Display toggle (USD or current symbol) controls Size/Total units
  - Smooth updates: keeps previous book while loading; subtle blur/pulse skeleton; stable height on first load
- Theming and UI polish
  - Tailwind v4 design tokens, dark-first theme
  - shadcn components with neutral hover/selected states (no blue)

## Tech Stack

- Next.js (App Router, React Server Components)
- TypeScript
- Tailwind CSS v4
- Motion (Framer Motion)
- shadcn/ui (Select, Button, etc.)

## Project Structure (highlights)

- `app/` — App Router pages, layout, and global styles
- `components/orderbook.tsx` — Main order book widget
- `components/orderbook-row.tsx` — Row rendering (depth bar + values)
- `lib/orderbook/store.ts` — Client-side store (useSyncExternalStore)
- `lib/hyperliquid/` — WebSocket endpoints, types, and client
- `components/ui/` — shadcn UI primitives

## Running Locally

Install dependencies and start the dev server:

```bash
# using yarn
yarn
yarn dev

# using npm
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Configuration

- Default symbol: BTC
- Default display: USD
- Default nSigFigs: 3 (clamped 2–5)
- WebSocket: mainnet `wss://api.hyperliquid.xyz/ws`

You can change defaults in `lib/orderbook/store.ts`.

## Notes on Performance & UX

- The order book keeps the previous snapshot visible while new data streams in to avoid flicker.
- A subtle blur and pulsing overlay indicate loading without collapsing height.
- Depth bars scale by cumulative side liquidity to convey ladder shape at a glance.

## License

MIT

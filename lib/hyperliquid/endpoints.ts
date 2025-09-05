export type HyperliquidNetwork = "mainnet" | "testnet";

export function getHyperliquidWsUrl(
  network: HyperliquidNetwork = "mainnet"
): string {
  return network === "testnet"
    ? "wss://api.hyperliquid-testnet.xyz/ws"
    : "wss://api.hyperliquid.xyz/ws";
}

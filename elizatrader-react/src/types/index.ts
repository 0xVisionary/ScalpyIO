export interface Message {
  id: string;
  text: string;
  type: 'user' | 'bot';
  timestamp: Date;
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
}

export interface TokenInfo {
  address: string;
  context?: string;
}

export interface TokenMetrics {
  name: string;
  symbol: string;
  price: number;
  priceChange24hPercent: number;
  mc: number;
  liquidity: number;
  holder: number;
  volume24h: number | null;
  trade24h: number;
  numberMarkets: number;
  extensions?: {
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  };
} 
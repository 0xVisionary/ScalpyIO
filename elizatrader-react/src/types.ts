export interface Message {
  id: string;
  text: string;
  type: 'user' | 'bot' | 'update';
  timestamp: Date;
}

export interface QuickLink {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

export interface TokenMetrics {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange24hPercent: number;
  mc: number;  // Market Cap
  liquidity: number;
  holder: number;
  volume24h: number;
  trade24h: number;
  numberMarkets: number;
  extensions?: {
    description?: string;
    website?: string;
    twitter?: string;
    telegram?: string;
  };
} 
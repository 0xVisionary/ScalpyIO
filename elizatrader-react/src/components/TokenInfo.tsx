import { useState, useEffect } from 'react';
import { TokenMetrics } from '../types';
import { fetchTokenMetrics } from '../services/api';

interface TokenInfoProps {
  tokenAddress: string;
}

const TokenInfo = ({ tokenAddress }: TokenInfoProps) => {
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!tokenAddress) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const metrics = await fetchTokenMetrics(tokenAddress);
        if (mounted) {
          setTokenMetrics(metrics);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch token information');
          setTokenMetrics(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [tokenAddress]);

  return (
    <div className="space-y-3">
      <div className="bg-dark-blue p-3 rounded border border-border-blue">
        <div className="text-sm text-gray-400 mb-2">
          {loading ? "Loading..." : tokenMetrics ? "Token Found" : "Waiting for token address..."}
        </div>
        <div className="font-mono text-sm break-all bg-[#1a1f2e] p-2 rounded-md border border-[#2d3548]">
          {tokenAddress || "No address detected"}
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm p-2 bg-red-500/10 rounded">
          {error}
        </div>
      )}

      {tokenMetrics && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-400">Name:</span>{' '}
            {tokenMetrics.name}
          </div>
          <div>
            <span className="text-gray-400">Symbol:</span>{' '}
            {tokenMetrics.symbol}
          </div>
          <div>
            <span className="text-gray-400">Price:</span>{' '}
            ${tokenMetrics.price.toFixed(6)}
          </div>
          <div>
            <span className="text-gray-400">24h Change:</span>{' '}
            <span className={tokenMetrics.priceChange24hPercent >= 0 ? 'text-green-500' : 'text-red-500'}>
              {tokenMetrics.priceChange24hPercent.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-gray-400">Market Cap:</span>{' '}
            ${tokenMetrics.mc.toLocaleString()}
          </div>
          <div>
            <span className="text-gray-400">Liquidity:</span>{' '}
            ${tokenMetrics.liquidity.toLocaleString()}
          </div>
          <div>
            <span className="text-gray-400">Holders:</span>{' '}
            {tokenMetrics.holder.toLocaleString()}
          </div>
          <div>
            <span className="text-gray-400">24h Volume:</span>{' '}
            {tokenMetrics.volume24h ? `$${tokenMetrics.volume24h.toLocaleString()}` : 'N/A'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenInfo; 
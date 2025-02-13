import { useState, useEffect } from 'react';
import { QuickLink } from '../types';

interface QuickLinksProps {
  tokenAddress: string;
}

const QuickLinks = ({ tokenAddress }: QuickLinksProps) => {
  const [links, setLinks] = useState<QuickLink[]>([]);

  useEffect(() => {
    if (tokenAddress) {
      // Generate default links when token address is available
      const defaultLinks: QuickLink[] = [
        {
          id: 'dextools',
          name: 'DexTools',
          url: `https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}`
        },
        {
          id: 'etherscan',
          name: 'Etherscan',
          url: `https://etherscan.io/token/${tokenAddress}`
        },
        {
          id: 'dexscreener',
          name: 'DexScreener',
          url: `https://dexscreener.com/ethereum/${tokenAddress}`
        }
      ];
      setLinks(defaultLinks);
    } else {
      setLinks([]);
    }
  }, [tokenAddress]);

  if (!tokenAddress || links.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        Enter a token address to see quick links
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="button text-center text-sm py-2"
        >
          {link.name}
        </a>
      ))}
    </div>
  );
};

export default QuickLinks; 
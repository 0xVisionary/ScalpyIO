import React from 'react';

interface AnalysisData {
  symbol: string;
  trustScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  marketMetrics: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    volumeChange24h: number;
    liquidity: number;
    marketCap: number;
  };
  socialMetrics: {
    holders: number;
    activeHolders: number;
    tweetVolume: string;
    sentiment: number;
    communityHealth: 'STRONG' | 'MODERATE' | 'WEAK';
    socialActivity: 'HIGH' | 'MODERATE' | 'LOW';
  };
  socialLinks?: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  trustSignals: Array<{
    type: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    category: 'LIQUIDITY' | 'COMMUNITY' | 'DEVELOPMENT' | 'SOCIAL';
    text: string;
  }>;
  riskFactors: Array<{
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
  }>;
  safetyChecklist: {
    liquidityLocked: boolean;
    verifiedContract: boolean;
    activeTeam: boolean;
    sustainableTokenomics: boolean;
    communityEngagement: boolean;
  };
  verdict: {
    trustRating: 'SAFE' | 'CAUTION' | 'HIGH RISK';
    summary: string;
    keyPoints: string[];
  };
  isLoading?: {
    metrics?: boolean;
    social?: boolean;
    analysis?: boolean;
  };
}

const TrustScoreIndicator: React.FC<{ score: number }> = ({ score }) => {
  const dots = Array(10).fill(0);
  const filledDots = Math.round(score);
  
  return (
    <div className="flex gap-1 items-center">
      <div className="flex gap-0.5">
        {dots.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full ${
              i < filledDots ? 'bg-blue-500' : 'bg-gray-600'
            }`}
          />
        ))}
      </div>
      <span className="text-gray-400 ml-2">{score}/10</span>
    </div>
  );
};

const SafetyBadge: React.FC<{ rating: 'SAFE' | 'CAUTION' | 'HIGH RISK' }> = ({ rating }) => {
  const colors = {
    SAFE: 'bg-green-500',
    CAUTION: 'bg-yellow-500',
    'HIGH RISK': 'bg-red-500',
  } as const;
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[rating]} text-black`}>
      {rating}
    </span>
  );
};

const CategoryIcon: React.FC<{ category: 'LIQUIDITY' | 'COMMUNITY' | 'DEVELOPMENT' | 'SOCIAL' }> = ({ category }) => {
  const icons = {
    LIQUIDITY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    COMMUNITY: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    DEVELOPMENT: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    SOCIAL: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  };

  return icons[category];
};

const SocialLinks: React.FC<{ links?: AnalysisData['socialLinks'] }> = ({ links }) => {
  if (!links) return null;

  return (
    <div className="flex gap-2 mt-2">
      {links.twitter && (
        <a
          href={links.twitter}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-[#242b3d] rounded-lg hover:bg-[#2d3548] transition-colors"
          title="Twitter"
        >
          <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
        </a>
      )}
      {links.telegram && (
        <a
          href={links.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-[#242b3d] rounded-lg hover:bg-[#2d3548] transition-colors"
          title="Telegram"
        >
          <svg className="w-5 h-5 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.417 0-.755-.338-.755-.756V14.96l-2.252-1.923c-.573-.49-.583-1.19.12-1.79l8.327-5.24c.467-.294 1.085-.036 1.236.985z"/>
          </svg>
        </a>
      )}
      {links.website && (
        <a
          href={links.website}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-[#242b3d] rounded-lg hover:bg-[#2d3548] transition-colors"
          title="Website"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
        </a>
      )}
    </div>
  );
};

const Shimmer: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-gradient-to-r from-[#242b3d] via-[#2d3548] to-[#242b3d] ${className}`} />
);

const AnalysisCard: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const isLoading = data.isLoading || {};

  return (
    <div className="bg-[#1a1f2e] rounded-lg border border-[#2d3548] shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#242b3d] to-[#1a1f2e] p-4 border-b border-[#2d3548]">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-white">{data.symbol} Trust Analysis</h2>
              {isLoading.analysis ? (
                <Shimmer className="w-24 h-6 rounded" />
              ) : (
                <>
                  <TrustScoreIndicator score={data.trustScore} />
                </>
              )}
            </div>
            {isLoading.analysis ? (
              <Shimmer className="w-full h-4 rounded" />
            ) : (
              <p className="text-gray-300 text-sm">{data.verdict.summary}</p>
            )}
            {!isLoading.metrics && <SocialLinks links={data.socialLinks} />}
          </div>
          {isLoading.analysis ? (
            <Shimmer className="w-20 h-6 rounded" />
          ) : (
            <SafetyBadge rating={data.verdict.trustRating} />
          )}
        </div>
      </div>

      {/* Safety Checklist */}
      <div className="p-4 border-b border-[#2d3548]">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">SAFETY CHECKLIST</h3>
        <div className="grid grid-cols-2 gap-4">
          {isLoading.analysis ? (
            Array(6).fill(0).map((_, i) => (
              <Shimmer key={i} className="h-6 rounded" />
            ))
          ) : (
            Object.entries(data.safetyChecklist || {
              liquidityLocked: false,
              verifiedContract: false,
              activeTeam: false,
              sustainableTokenomics: false,
              communityEngagement: false
            }).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={`text-2xl ${value ? 'text-green-500' : 'text-red-500'}`}>
                  {value ? '✓' : '✗'}
                </span>
                <span className="text-gray-300 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trust Signals */}
      <div className="p-4 border-b border-[#2d3548]">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">TRUST SIGNALS</h3>
        <div className="space-y-3">
          {isLoading.analysis ? (
            Array(3).fill(0).map((_, i) => (
              <Shimmer key={i} className="h-20 rounded-lg" />
            ))
          ) : (
            (data.trustSignals || []).map((signal, i) => (
              <div key={i} className="flex items-start gap-3 bg-[#242b3d] p-3 rounded-lg">
                <div className="shrink-0 text-gray-400">
                  <CategoryIcon category={signal.category} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${
                      signal.type === 'POSITIVE' ? 'text-green-500' :
                      signal.type === 'NEGATIVE' ? 'text-red-500' :
                      'text-yellow-500'
                    }`}>
                      {signal.category}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{signal.text}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Risk Factors */}
      <div className="p-4 border-b border-[#2d3548]">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">RISK FACTORS</h3>
        <div className="space-y-2">
          {isLoading.analysis ? (
            Array(3).fill(0).map((_, i) => (
              <Shimmer key={i} className="h-6 rounded" />
            ))
          ) : (
            (data.riskFactors || []).map((risk, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  risk.severity === 'HIGH' ? 'bg-red-500' :
                  risk.severity === 'MEDIUM' ? 'bg-yellow-500' :
                  'bg-green-500'
                } text-black`}>
                  {risk.severity}
                </span>
                <span className="text-gray-300 text-sm">{risk.description}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Community & Social */}
      <div className="p-4 border-b border-[#2d3548]">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">COMMUNITY & SOCIAL</h3>
        <div className="grid grid-cols-2 gap-4">
          {isLoading.social ? (
            Array(4).fill(0).map((_, i) => (
              <Shimmer key={i} className="h-6 rounded" />
            ))
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Community Health:</span>
                  <span className={`font-medium ${
                    data.socialMetrics?.communityHealth === 'STRONG' ? 'text-green-500' :
                    data.socialMetrics?.communityHealth === 'WEAK' ? 'text-red-500' :
                    'text-yellow-500'
                  }`}>
                    {data.socialMetrics?.communityHealth || 'MODERATE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Social Activity:</span>
                  <span className={`font-medium ${
                    data.socialMetrics?.socialActivity === 'HIGH' ? 'text-green-500' :
                    data.socialMetrics?.socialActivity === 'LOW' ? 'text-red-500' :
                    'text-yellow-500'
                  }`}>
                    {data.socialMetrics?.socialActivity || 'LOW'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Holders:</span>
                  <span className="text-white">{data.socialMetrics?.holders?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-300">Active Holders:</span>
                  <span className="text-white">{data.socialMetrics?.activeHolders?.toLocaleString() || '0'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key Points */}
      <div className="p-4 bg-gradient-to-r from-[#242b3d] to-[#1a1f2e]">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">KEY POINTS</h3>
        {isLoading.analysis ? (
          <div className="space-y-2">
            {Array(3).fill(0).map((_, i) => (
              <Shimmer key={i} className="h-4 rounded" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {(data.verdict?.keyPoints || []).map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span className="text-gray-300 text-sm">{point}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AnalysisCard; 
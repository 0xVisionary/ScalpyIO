// src/plugin/src/services.ts
import {
  Service,
  elizaLogger,
  generateObjectDeprecated,
  ModelClass,
} from "@elizaos/core";
import { Scraper, SearchMode } from "agent-twitter-client";
import { io } from "../server.js";
var BirdeyeService = class extends Service {
  apiKey = null;
  runtime = null;
  static get serviceType() {
    return "birdeye";
  }
  get serviceType() {
    return "birdeye";
  }
  async initialize(runtime) {
    this.runtime = runtime;
    this.apiKey = runtime.getSetting("BIRDEYE_API_KEY");
    if (!this.apiKey) {
      console.log(
        "Missing BIRDEYE_API_KEY in environment variables",
        runtime.getSetting("BIRDEYE_API_KEY")
      );
      throw new Error("Missing BIRDEYE_API_KEY in environment variables");
    }
  }
  /**
   * Extract coin symbol/address from text
   * @param text - User input text
   * @returns Symbol (e.g., "JUP") or address
   */
  async extractCoinIdentifier(text) {
    try {
      const prompt = `You are a cryptocurrency token identifier. Extract the token symbol or address from this message. 
If you find a token symbol (usually prefixed with $) or a Solana address, return it in JSON format.
Only extract ONE token, preferably the first one mentioned. Make sure you output this in markdown as you would show it in a chat.

Message: "${text}"

Return in this exact JSON format:
{
  "symbol": "TOKEN_SYMBOL_WITHOUT_$", // e.g., "JUP" (not $JUP)
  "address": "SOLANA_ADDRESS_IF_FOUND" // leave empty if not found
}

Rules:
- Token symbols are usually prefixed with $ (e.g., $JUP, $BONK)
- Solana addresses are base58 encoded and 32-44 characters long
- If no valid token is found, return null for both fields
- Remove the $ prefix from symbols in the response
- Only include the first token found`;
      const result = await generateObjectDeprecated({
        context: prompt,
        modelClass: ModelClass.LARGE,
        runtime: this.runtime,
      });
      try {
        const parsed = result;
        return parsed?.symbol || parsed?.address;
      } catch (e) {
        elizaLogger.error("Failed to parse LLM response:", result);
      }
    } catch (error) {
      elizaLogger.error("Error extracting coin identifier:", error);
    }
    const symbolMatch = text.match(/\$([A-Z]+)/);
    if (symbolMatch) return symbolMatch[1];
    const addressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
    return addressMatch ? addressMatch[0] : null;
  }
  /**
   * Get token metrics from Birdeye
   * @param tokenIdentifier - Token symbol or address
   */
  async getTokenMetrics(tokenIdentifier) {
    let address = tokenIdentifier;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(tokenIdentifier)) {
      const searchResult = await this.searchToken(tokenIdentifier);
      if (!searchResult.result?.[0]) {
        throw new Error(`No token found for symbol: ${tokenIdentifier}`);
      }
      address = searchResult.result[0].address;
    }
    const endpoint = `https://public-api.birdeye.so/defi/token_overview?address=${address}`;
    const response = await fetch(endpoint, {
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: "application/json",
        "x-chain": "solana",
      },
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error("Failed to fetch token metrics");
    }
    return data.data;
  }
  /**
   * Format data for LLM trust score analysis
   */
  createTrustScorePrompt(metrics, tweets) {
    elizaLogger.info("Creating trust score prompt", JSON.stringify(metrics));
    let twitterAnalysis = "";
    if (tweets && tweets.length > 0) {
      const recentTweets = tweets.slice(0, 5);
      twitterAnalysis = `
Recent Twitter Activity:
${recentTweets
  .map((tweet, index) => {
    const tweetDetails = {
      number: index + 1,
      url: tweet.permanentUrl,
      author: `@${tweet.username}`,
      engagement: `${tweet.likes} likes, ${tweet.retweets} retweets, ${tweet.replies} replies`,
      views: tweet.views,
      content:
        tweet.text.length > 200
          ? `${tweet.text.substring(0, 200)}...`
          : tweet.text,
    };
    return `
Tweet ${tweetDetails.number} (${tweetDetails.url}):
- Author: ${tweetDetails.author}
- Engagement: ${tweetDetails.engagement}
- Views: ${tweetDetails.views}
- Content: ${tweetDetails.content}
`;
  })
  .join("\n")}`;
    }
    console.log("Twitter analysis:", twitterAnalysis);
    return `You are a cryptocurrency expert analyst. Evaluate trustworthiness based on these metrics. Format your response in markdown exactly as shown:

**${metrics.name} (${metrics.symbol})**
- Price: $${metrics.price.toFixed(4)}
- 24h Change: ${metrics.priceChange24hPercent.toFixed(2)}%
- Market Cap: $${metrics.mc.toLocaleString()}
- Liquidity: $${metrics.liquidity.toLocaleString()}
- Holders: ${metrics.holder.toLocaleString()}
- 24h Volume: ${
      metrics.volume24h ? `$${metrics.volume24h.toLocaleString()}` : "N/A"
    }
- 24h Trades: ${metrics.trade24h.toLocaleString()}
- Markets: ${metrics.numberMarkets}${
      metrics.extensions?.description
        ? `\nDescription: ${metrics.extensions.description}`
        : ""
    }${
      metrics.extensions?.website
        ? `\nWebsite: ${metrics.extensions.website}`
        : ""
    }${
      metrics.extensions?.twitter
        ? `\nTwitter: ${metrics.extensions.twitter}`
        : ""
    }${
      metrics.extensions?.telegram
        ? `\nTelegram: ${metrics.extensions.telegram}`
        : ""
    }

Recent Twitter Activity:${
      tweets && tweets.length > 0
        ? tweets
            .slice(0, 5)
            .map((tweet, index) => {
              const tweetDetails = {
                number: index + 1,
                url: tweet.permanentUrl,
                author: `@${tweet.username}`,
                engagement: `${tweet.likes} likes, ${tweet.retweets} RTs, ${tweet.replies} replies`,
                views: tweet.views,
                content:
                  tweet.text.length > 200
                    ? `${tweet.text.substring(0, 200)}...`
                    : tweet.text,
              };
              return `\n${tweetDetails.number}. ${tweetDetails.author}: ${tweetDetails.content}\n   ${tweetDetails.engagement} | ${tweetDetails.views} views`;
            })
            .join("\n")
        : "\nNo recent tweets found."
    }

### Trust Score:2/10

Market Health
- \`Liquidity and Trading Metrics\`: The liquidity metrics and trading volume analysis
- \`Price Action and Volatility\`: Analysis of price movements and stability
- \`Market Cap Implications\`: What the market cap suggests about the token

Community Engagement
- \`Holder Analysis\`: Assessment of holder distribution and behavior
- \`Social Media Presence\`: Evaluation of social media activity and reach
- \`Community Activity\`: Analysis of community engagement and growth

Risk Assessment
- \`Key Risks\`: Major risk factors identified
- \`Warning Signs\`: Potential red flags to consider
- \`Stability Factors\`: Elements contributing to stability

Key Recommendations
- \`Main Points\`: Key points for investors to consider
- \`Risk Mitigation\`: Suggested risk mitigation strategies
- \`Action Items\`: Recommended next steps

Social Media Analysis
- \`Twitter Engagement\`: Analysis of Twitter metrics and reach
- \`Discussion Quality\`: Assessment of community discussions
- \`Community Credibility\`: Evaluation of community trustworthiness

Risk Indicators
- \`Red Flags\`: Identified warning signs
- \`Positive Signs\`: Notable positive indicators
- \`Notable Patterns\`: Observed trading and community patterns`;
  }
  /**
   * Search for tokens by symbol or name
   * @param keyword - Token symbol or name to search for
   * @returns First matching token result
   */
  async searchToken(keyword) {
    console.log("Searching for token:", keyword);
    const endpoint = `https://public-api.birdeye.so/defi/v3/search?chain=solana&keyword=${encodeURIComponent(
      keyword
    )}&target=token&sort_by=volume_24h_usd&sort_type=desc&offset=0&limit=1`;
    const response = await fetch(endpoint, {
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`Search API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.success || !data.data?.items?.[0]) {
      throw new Error("Failed to search for token");
    }
    return data.data.items[0];
  }
};
var TwitterScrapperService = class extends Service {
  static serviceType = "twitter-scrapper";
  runtime = null;
  scraper = null;
  constructor() {
    super();
  }
  async getCachedCookies(username) {
    try {
      return await this.runtime?.cacheManager.get(
        `twitter/${username}/cookies`
      );
    } catch (error) {
      elizaLogger.error("TWITTER_SCRAPPER", "Error getting cached cookies", {
        error,
      });
      return null;
    }
  }
  async cacheCookies(username, cookies) {
    try {
      await this.runtime?.cacheManager.set(
        `twitter/${username}/cookies`,
        cookies
      );
      elizaLogger.debug("TWITTER_SCRAPPER", "Cached cookies for Twitter");
    } catch (error) {
      elizaLogger.error("TWITTER_SCRAPPER", "Error caching cookies", { error });
    }
  }
  async setCookiesFromArray(scraper, cookiesArray) {
    const cookieStrings = cookiesArray.map(
      (cookie) =>
        `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${
          cookie.path
        }; ${cookie.secure ? "Secure" : ""}; ${
          cookie.httpOnly ? "HttpOnly" : ""
        }; SameSite=${cookie.sameSite || "Lax"}`
    );
    await scraper.setCookies(cookieStrings);
  }
  async initialize(runtime) {
    this.runtime = runtime;
    const username = runtime.getSetting("TWITTER_USERNAME");
    const password = runtime.getSetting("TWITTER_PASSWORD");
    const email = runtime.getSetting("TWITTER_EMAIL");
    const twitter2faSecret = runtime.getSetting("TWITTER_2FA_SECRET");
    if (!username) {
      throw new Error("Twitter username not configured");
    }
    const scraper = new Scraper();
    this.scraper = scraper;
    try {
      const cachedCookies = await this.getCachedCookies(username);
      if (cachedCookies) {
        elizaLogger.info("TWITTER_SCRAPPER", "Using cached cookies");
        await this.setCookiesFromArray(scraper, cachedCookies);
        if (await scraper.isLoggedIn()) {
          elizaLogger.success(
            "TWITTER_SCRAPPER",
            "Successfully logged in using cached cookies"
          );
          return;
        }
        elizaLogger.warn(
          "TWITTER_SCRAPPER",
          "Cached cookies expired, proceeding with login"
        );
      }
      await scraper.login(username, password, email, twitter2faSecret);
      elizaLogger.success(
        "TWITTER_SCRAPPER",
        "Successfully logged in to Twitter"
      );
      const newCookies = await scraper.getCookies();
      await this.cacheCookies(username, newCookies);
    } catch (error) {
      elizaLogger.error(
        "TWITTER_SCRAPPER",
        "Failed to initialize Twitter scraper",
        { error }
      );
      throw error;
    }
  }
  /**
   * Fetch tweets related to a token
   * @param address - Token address
   * @returns Array of tweets or empty array if scraping fails
   */
  async fetchTokenTweets(address) {
    if (!this.scraper) {
      elizaLogger.warn(
        "Twitter scraper not initialized - missing credentials or failed initialization"
      );
      return [];
    }
    try {
      elizaLogger.info("Fetching tweets for address >>>>", address);
      const response = await this.scraper.fetchSearchTweets(
        address,
        20,
        SearchMode.Top
      );
      elizaLogger.info("Fetched tweets XXXX", response.tweets);
      elizaLogger.info(
        `Fetched ${response.tweets.length} tweets for address ${address}`
      );
      return response.tweets;
    } catch (error) {
      elizaLogger.error("Error fetching tweets:", error);
      return [];
    }
  }
};

// src/plugin/src/actions.ts
import {
  ModelClass as ModelClass2,
  elizaLogger as elizaLogger2,
  generateText,
} from "@elizaos/core";
var scanCoinAction = {
  name: "SCAN_COIN",
  similes: [
    "SCAN_ADDRESS",
    "GET_COIN_INFO",
    "GET_ADDRESS_INFO",
    "ANALYZE_COIN",
    "ANALYZE_ADDRESS",
    "SCAN_TOKEN",
    "GET_TOKEN_INFO",
    "ANALYZE_TOKEN",
    "GET_TOKEN_ANALYSIS",
    "GET_TOKEN_METRICS",
    "GET_TOKEN_TWEETS",
    "GET_TOKEN_TRUST_SCORE",
    "GET_TOKEN_RISK_SCORE",
    "GET_TOKEN_SAFETY_SCORE",
    "TELL_ME_ABOUT_TOKEN",
    "TELL_ME_ABOUT_COIN",
    "WHAT_DO_YOU_KNOW_ABOUT_TOKEN",
    "WHAT_DO_YOU_KNOW_ABOUT_COIN",
    "IS_TOKEN_SAFE",
    "IS_COIN_SAFE",
    "CHECK_TOKEN_SAFETY",
    "CHECK_COIN_SAFETY",
    "TOKEN_INFORMATION",
    "COIN_INFORMATION",
    "CHECK_ADDRESS",
    "ANALYZE_THIS_ADDRESS",
    "WHAT_IS_THIS_ADDRESS",
  ],
  description:
    "Analyzes and provides information about Solana coins/tokens including trust scores, safety metrics, and market analysis. This action triggers when users ask about specific tokens using $ symbol (like $JUP, $WIF) or when they provide a Solana token address (like 'So11111111111111111111111111111111111111112'). It handles natural queries like 'What can you tell me about $TOKEN?', 'Is this coin safe?', or 'Can you check this address: So1...'",
  validate: async (runtime, message) => {
    return true;
  },
  suppressInitialMessage: true,
  handler: async (runtime, message, _state, _options, callback) => {
    try {
      elizaLogger.info("Scanning coin");
      const extensionId = runtime.userId;
      const birdeye = runtime.getService("birdeye");
      const twitterScrapper = runtime.getService("twitter-scrapper");
      const text = message.content.text;

      elizaLogger.info(`Text: ${text}`);
      const identifier = await birdeye.extractCoinIdentifier(text);
      elizaLogger.info(`Identifier: ${identifier}`);

      if (!identifier) {
        if (extensionId) {
          io.to(extensionId).emit("streaming_update", {
            text: "No valid coin symbol/address found. Please use format like $JUP or provide a Solana address.",
            type: "update",
          });
        }
        callback({
          text: "No valid coin symbol/address found. Please use format like $JUP or provide a Solana address.",
        });
        return false;
      }

      // Initial status update
      if (extensionId) {
        io.to(extensionId).emit("streaming_update", {
          text: `Analyzing ${identifier}...`,
          type: "update",
        });
      }

      // Fetch metrics
      const metrics = await birdeye.getTokenMetrics(identifier);
      elizaLogger.info(`Metrics: ${metrics}`);

      // Metrics status update
      if (extensionId) {
        io.to(extensionId).emit("streaming_update", {
          text: `Found token metrics for ${
            metrics.symbol
          }:\nPrice: $${metrics.price.toFixed(
            4
          )}\n24h Change: ${metrics.priceChange24hPercent.toFixed(
            2
          )}%\nMarket Cap: $${metrics.mc.toLocaleString()}\nFetching social data...`,
          type: "update",
        });
      }

      // Fetch Twitter data
      const tweets = await twitterScrapper.fetchTokenTweets(metrics.address);
      elizaLogger.info(`Fetched ${tweets.length} tweets`);

      // Twitter data status update
      if (extensionId) {
        io.to(extensionId).emit("streaming_update", {
          text: `Analyzing ${tweets.length} recent tweets and market data...`,
          type: "update",
        });
      }

      // Start streaming analysis chunks
      const analysisChunks = [
        {
          title: "Market Overview",
          content: `Analyzing ${metrics.symbol} with current price $${
            metrics.price?.toFixed(4) || "N/A"
          } (${
            metrics.priceChange24hPercent?.toFixed(2) || "N/A"
          }% 24h change).\nMarket cap is $${
            metrics.mc?.toLocaleString() || "N/A"
          } with $${
            metrics.liquidity?.toLocaleString() || "N/A"
          } in liquidity.`,
        },
        {
          title: "Trading Activity",
          content: `24h trading volume is $${
            metrics.volume24h?.toLocaleString() || "N/A"
          } across ${metrics.numberMarkets || "N/A"} markets with ${
            metrics.trade24h?.toLocaleString() || "N/A"
          } trades.\nThe token has ${
            metrics.holder?.toLocaleString() || "N/A"
          } unique holders.`,
        },
        {
          title: "Social Metrics",
          content: `Found ${
            tweets.length
          } recent tweets discussing this token.\n${
            metrics.extensions?.twitter
              ? `Twitter: ${metrics.extensions.twitter}\n`
              : ""
          }${
            metrics.extensions?.telegram
              ? `Telegram: ${metrics.extensions.telegram}\n`
              : ""
          }${
            metrics.extensions?.website
              ? `Website: ${metrics.extensions.website}`
              : ""
          }`,
        },
      ];

      // Emit each analysis chunk with error handling
      for (const chunk of analysisChunks) {
        try {
          if (extensionId) {
            io.to(extensionId).emit("streaming_update", {
              text: `**${chunk.title}**\n${chunk.content}`,
              type: "bot",
            });
            // Add a small delay between chunks
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        } catch (error) {
          console.error(`Error emitting chunk ${chunk.title}:`, error);
          // Continue with next chunk even if one fails
          continue;
        }
      }

      // Generate final analysis
      const llmPrompt = birdeye.createTrustScorePrompt(metrics, tweets);
      elizaLogger.info(`LLM Prompt: ${llmPrompt}`);
      elizaLogger.info("Generating final analysis...");

      if (extensionId) {
        io.to(extensionId).emit("streaming_update", {
          text: "🔍 Analyzing market health and trading patterns...",
          type: "update",
        });
      }

      // Start the analysis generation
      const analysisPromise = generateText({
        context: llmPrompt,
        modelClass: ModelClass.LARGE,
        runtime,
      });

      // While waiting for analysis, emit progress updates
      const updateMessages = [
        "💹 Evaluating price action and volatility...",
        "🏦 Assessing liquidity and trading metrics...",
        "👥 Analyzing holder distribution...",
        "🌐 Evaluating social media presence...",
        "⚠️ Checking for potential risk factors...",
        "📊 Calculating final trust score...",
        "📝 Preparing comprehensive analysis...",
        "🎯 Finalizing recommendations...",
      ];

      let messageIndex = 0;
      const updateInterval = setInterval(() => {
        if (messageIndex < updateMessages.length && extensionId) {
          io.to(extensionId).emit("streaming_update", {
            text: updateMessages[messageIndex],
            type: "update",
          });
          messageIndex++;
        }
      }, 2000); // Send a new update every 2 seconds

      try {
        const analysis = await analysisPromise;
        // Clear the interval once analysis is complete
        clearInterval(updateInterval);

        elizaLogger.info(`Analysis: ${analysis}`);
        if (analysis && callback) {
          // Final progress update
          if (extensionId) {
            io.to(extensionId).emit("streaming_update", {
              text: "✅ Analysis complete! Preparing final report...",
              type: "update",
            });
          }

          await callback({
            text: `**${metrics.symbol} Final Analysis**\n${analysis}`,
          });
        }
      } catch (error) {
        clearInterval(updateInterval);
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Coin scan failed:", error);
      if (message.extensionId) {
        io.to(message.extensionId).emit("streaming_update", {
          text: "Sorry, I encountered an error while processing your request.",
          type: "update",
        });
      }
      callback({
        text: "Sorry, I couldn't retrieve the coin data at this time. Please try again later.",
      });
      return false;
    }
  },
  examples: [
    // Example 1: Basic coin scan
    [
      {
        user: "{{user1}}",
        content: { text: "Can you scan $JUP and tell me if it's safe?" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll analyze Jupiter ($JUP) for you...",
          action: "SCAN_COIN",
        },
      },
    ],
    // Example 2: Address scan
    [
      {
        user: "{{user1}}",
        content: { text: "What's the trust score for this address: So1ara..." },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll check that Solana address for you...",
          action: "SCAN_COIN",
        },
      },
    ],
    // Example 3: Multiple tokens comparison
    [
      {
        user: "{{user1}}",
        content: { text: "Compare the safety of $BONK and $WIF please" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll analyze both BONK and WIF tokens for comparison...",
          action: "SCAN_COIN",
        },
      },
    ],
    // Example 4: Detailed analysis request
    [
      {
        user: "{{user1}}",
        content: {
          text: "Give me a full analysis of $ORCA including liquidity and trading volume",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll perform a comprehensive analysis of ORCA token...",
          action: "SCAN_COIN",
        },
      },
    ],
    // Example 5: Quick safety check
    [
      {
        user: "{{user1}}",
        content: { text: "Is this token safe? $PYTH" },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Let me check the safety metrics for PYTH...",
          action: "SCAN_COIN",
        },
      },
    ],
  ],
};
var actions_default = scanCoinAction;

// src/plugin/src/index.ts
var tradingBuddyPlugin = {
  name: "tradingBuddyPlugin",
  description:
    "Agent that helps with trading and investing in crypto on the Solana blockchain, get info about coins, addresses, and more",
  actions: [actions_default],
  evaluators: [],
  providers: [],
  services: [new BirdeyeService(), new TwitterScrapperService()],
};
var index_default = tradingBuddyPlugin;
export { index_default as default, tradingBuddyPlugin };
//# sourceMappingURL=index.js.map

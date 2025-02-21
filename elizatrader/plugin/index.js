// src/plugin/src/services.ts
import {
  Service,
  elizaLogger,
  generateObjectDeprecated,
  ModelClass,
} from "@elizaos/core";
import { Scraper, SearchMode } from "agent-twitter-client";
import { getIO } from "../socket.js";
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
   * Store the last scanned token for a user
   * @param userId - The user's ID
   * @param tokenData - Token data to store
   */
  async storeLastToken(userId, tokenData) {
    try {
      if (!userId) {
        elizaLogger.warn("Missing userId in storeLastToken");
        return;
      }

      if (!tokenData || typeof tokenData !== "object") {
        elizaLogger.warn("Invalid tokenData in storeLastToken");
        return;
      }

      const db = this.runtime.databaseAdapter;
      if (!db) {
        elizaLogger.error("Database adapter not initialized");
        return;
      }

      // Wait for runtime to be fully initialized
      if (!this.runtime.agentId) {
        elizaLogger.warn(
          "Runtime not fully initialized, skipping token storage"
        );
        return;
      }

      // Ensure we have required fields with fallbacks
      const content = {
        address: tokenData.address || "",
        symbol: tokenData.symbol || "UNKNOWN",
        timestamp: Date.now(),
        name: tokenData.name || "",
        price: tokenData.price || 0,
        marketCap: tokenData.mc || 0,
        liquidity: tokenData.liquidity || 0,
      };

      const id = `last_token_${userId}`; // Unique ID for this user's last token

      // Delete any existing memory first
      try {
        await db.deleteMemories({
          type: "last_token",
          userId,
          roomId: "default",
          tableName: "memories", // Explicitly specify the table name
        });
      } catch (deleteError) {
        elizaLogger.warn("Error clearing old token memory:", deleteError);
      }

      // Create new memory entry
      await db.createMemory({
        id,
        type: "last_token",
        content: JSON.stringify(content),
        embedding: null, // No embedding needed for this use case
        userId,
        roomId: "default",
        agentId: this.runtime.agentId,
        unique: true, // Ensure only one last token per user
        tableName: "memories", // Explicitly specify the table name
      });

      elizaLogger.info(`Stored last token for user ${userId}:`, content);
    } catch (error) {
      elizaLogger.error("Error storing last token:", error);
      // Don't throw - we want to continue even if storage fails
    }
  }

  /**
   * Get the last scanned token for a user
   * @param userId - The user's ID
   * @returns Last token data or null
   */
  async getLastToken(userId) {
    if (!userId) {
      elizaLogger.debug("No userId provided to getLastToken");
      return null;
    }

    const db = this.runtime.databaseAdapter;
    if (!db) {
      elizaLogger.error("Database adapter not initialized");
      return null;
    }

    try {
      // Get the most recent memory of type "last_token" for this user
      const memories = await db.getMemories({
        tableName: "memories", // Specify the table name
        roomId: "default",
        count: 1,
        unique: true,
        type: "last_token",
        userId,
      });

      if (!memories || memories.length === 0) {
        elizaLogger.debug(`No last token found for user ${userId}`);
        return null;
      }

      const lastToken = memories[0];
      if (!lastToken.content) {
        elizaLogger.debug("Invalid token data format, clearing token");
        await this.clearLastToken(userId);
        return null;
      }

      elizaLogger.debug(
        `Found last token for user ${userId}:`,
        lastToken.content
      );
      return lastToken.content;
    } catch (error) {
      elizaLogger.error("Database error in getLastToken:", {
        error: error.message || error,
        stack: error.stack,
        userId,
      });
      return null;
    }
  }

  /**
   * Clear the last token for a user
   * @param userId - The user's ID
   */
  async clearLastToken(userId) {
    try {
      if (!userId) {
        elizaLogger.warn("No userId provided to clearLastToken");
        return;
      }

      const db = this.runtime.databaseAdapter;
      if (!db) {
        elizaLogger.error("Database adapter not initialized");
        return;
      }

      // Delete memory by type and userId
      await db.deleteMemories({
        tableName: "memories", // Specify the table name
        type: "last_token",
        userId,
        roomId: "default",
      });

      elizaLogger.info(`Cleared last token for user ${userId}`);
    } catch (error) {
      elizaLogger.error("Error clearing last token:", error);
      throw error;
    }
  }
  /**
   * Extract coin symbol/address from text
   * @param text - User input text
   * @param userId - User ID for state management
   * @returns Symbol (e.g., "JUP") or address
   */
  async extractCoinIdentifier(text, userId) {
    // First check for a Solana address - updated pattern to match addresses starting with any letter/number
    const addressMatch = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
    if (addressMatch) {
      elizaLogger.info(`Found Solana address: ${addressMatch[0]}`);
      return addressMatch[0];
    }

    // If no address found, check for a token symbol (with or without $)
    const symbolMatch = text.match(/(?:\$)?([A-Z]{2,})\b/);
    if (symbolMatch) {
      try {
        elizaLogger.info(`Found token symbol: ${symbolMatch[1]}`);
        // Try to get the address for this symbol
        const searchResult = await this.searchToken(symbolMatch[1]);
        if (searchResult.address) {
          return searchResult.address;
        }
      } catch (error) {
        elizaLogger.error("Error searching for token:", error);
      }
    }

    // If no valid identifier found, return null and let ElizaOS handle it
    return null;
  }

  /**
   * Format data for LLM trust score analysis
   */
  createTrustScorePrompt(metrics, tweets) {
    elizaLogger.info("Creating trust score prompt", JSON.stringify(metrics));

    // Add null checks for metrics
    if (!metrics || typeof metrics !== "object") {
      elizaLogger.error("Invalid metrics data:", metrics);
      metrics = {
        name: "Unknown",
        symbol: "Unknown",
        price: 0,
        priceChange24hPercent: 0,
        mc: 0,
        liquidity: 0,
        holder: 0,
        volume24h: 0,
        trade24h: 0,
        numberMarkets: 0,
        extensions: {},
      };
    }

    let twitterAnalysis = "";
    if (tweets && tweets.length > 0) {
      const recentTweets = tweets.slice(0, 5);
      twitterAnalysis = `
Recent Twitter Activity:
${recentTweets
  .map((tweet, index) => {
    const tweetDetails = {
      number: index + 1,
      url: tweet.permanentUrl || "",
      author: tweet.username ? `@${tweet.username}` : "Unknown",
      engagement: `${tweet.likes || 0} likes, ${
        tweet.retweets || 0
      } retweets, ${tweet.replies || 0} replies`,
      views: tweet.views || 0,
      content: tweet.text
        ? tweet.text.length > 200
          ? `${tweet.text.substring(0, 200)}...`
          : tweet.text
        : "",
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

    return `You are a cryptocurrency expert analyst. Analyze the provided metrics and return a structured analysis in the exact JSON format shown below. Include detailed explanations and insights for each section.

Token Metrics:
- Name: ${metrics.name || "Unknown"}
- Symbol: ${metrics.symbol || "Unknown"}
- Price: $${(metrics.price || 0).toFixed(4)}
- 24h Change: ${(metrics.priceChange24hPercent || 0).toFixed(2)}%
- Market Cap: $${(metrics.mc || 0).toLocaleString()}
- Liquidity: $${(metrics.liquidity || 0).toLocaleString()}
- Holders: ${(metrics.holder || 0).toLocaleString()}
- 24h Volume: ${
      metrics.volume24h ? `$${metrics.volume24h.toLocaleString()}` : "N/A"
    }
- 24h Trades: ${(metrics.trade24h || 0).toLocaleString()}
- Markets: ${metrics.numberMarkets || 0}
${
  metrics.extensions?.description
    ? `\nDescription: ${metrics.extensions.description}`
    : ""
}

Social Links:
${metrics.extensions?.website ? `- Website: ${metrics.extensions.website}` : ""}
${metrics.extensions?.twitter ? `- Twitter: ${metrics.extensions.twitter}` : ""}
${
  metrics.extensions?.telegram
    ? `- Telegram: ${metrics.extensions.telegram}`
    : ""
}

${twitterAnalysis}

Return your analysis in this exact JSON format. IMPORTANT: Your response must be valid JSON that can be parsed. Do not include any explanatory text outside the JSON structure. Replace all placeholder values (text between < >) with actual values:

{
  "symbol": "${metrics.symbol}",
  "trustScore": 7,  // Example: replace with actual number between 1-10
  "riskLevel": "MODERATE",  // Example: replace with actual value "LOW", "MODERATE", or "HIGH"
  "marketMetrics": {
    "price": ${metrics.price},
    "priceChange24h": ${metrics.priceChange24hPercent},
    "volume24h": ${metrics.volume24h || 0},
    "volumeChange24h": 0,
    "liquidity": ${metrics.liquidity},
    "marketCap": ${metrics.mc}
  },
  "socialMetrics": {
    "holders": ${metrics.holder},
    "activeHolders": 1000,  // Example: replace with actual number
    "tweetVolume": "moderate",  // Example: replace with actual string
    "sentiment": 0.7,  // Example: replace with actual number between 0-1
    "communityHealth": "MODERATE",  // Example: replace with "STRONG", "MODERATE", or "WEAK"
    "socialActivity": "MODERATE"  // Example: replace with "HIGH", "MODERATE", or "LOW"
  },
  "socialLinks": {
    ${
      metrics.extensions?.website
        ? `"website": "${metrics.extensions.website}",`
        : ""
    }
    ${
      metrics.extensions?.twitter
        ? `"twitter": "${metrics.extensions.twitter}",`
        : ""
    }
    ${
      metrics.extensions?.telegram
        ? `"telegram": "${metrics.extensions.telegram}"`
        : ""
    }
  },
  "trustSignals": [
    {
      "type": "POSITIVE",  // Example: replace with "POSITIVE", "NEUTRAL", or "NEGATIVE"
      "category": "LIQUIDITY",  // Example: replace with "LIQUIDITY", "COMMUNITY", "DEVELOPMENT", or "SOCIAL"
      "text": "Strong liquidity pool with stable depth"  // Example: replace with actual explanation
    }
  ],
  "riskFactors": [
    {
      "severity": "MEDIUM",  // Example: replace with "HIGH", "MEDIUM", or "LOW"
      "description": "Moderate concentration of tokens in top holders"  // Example: replace with actual description
    }
  ],
  "safetyChecklist": {
    "liquidityLocked": true,  // Example: replace with actual boolean
    "verifiedContract": true,  // Example: replace with actual boolean
    "activeTeam": true,  // Example: replace with actual boolean
    "sustainableTokenomics": true,  // Example: replace with actual boolean
    "communityEngagement": true  // Example: replace with actual boolean
  },
  "verdict": {
    "trustRating": "SAFE",  // Example: replace with "SAFE", "CAUTION", or "HIGH RISK"
    "summary": "Token shows strong fundamentals with good liquidity and active community",  // Example: replace with actual summary
    "keyPoints": [
      "High liquidity and trading volume",  // Example: replace with actual key points
      "Active development team",
      "Growing community engagement"
    ]
  }
}

IMPORTANT: Your response must be ONLY the JSON object above with your analysis. Do not include any text before or after the JSON. Ensure all values are properly formatted and the JSON is valid.

Guidelines for analysis:
1. Trust Score (1-10):
   - Consider liquidity, market cap, holder distribution, and social metrics
   - Higher scores for established projects with strong metrics
   - Lower scores for new or risky projects

2. Risk Level:
   - LOW: Established project with strong metrics
   - MODERATE: Some concerns but generally stable
   - HIGH: Multiple red flags or concerning metrics

3. Trust Signals:
   - Analyze liquidity depth and stability
   - Evaluate community engagement and growth
   - Assess development activity and transparency
   - Consider social media presence and quality

4. Risk Factors:
   - Identify potential vulnerabilities
   - Flag unusual trading patterns
   - Note governance or centralization risks
   - Consider market manipulation risks

5. Safety Checklist:
   - Verify liquidity locking status
   - Check contract verification
   - Assess team activity and transparency
   - Evaluate tokenomics sustainability
   - Gauge community engagement quality

6. Verdict:
   - Provide clear, actionable summary
   - Highlight key strengths and concerns
   - Include specific recommendations
   - Consider both short and long-term outlook

Ensure all assessments are data-driven and objective. Include specific metrics and observations to support your conclusions.`;
  }
  /**
   * Search for tokens by symbol or name
   * @param keyword - Token symbol or name to search for
   * @returns First matching token result
   */
  async searchToken(keyword) {
    console.log("Searching for token:", keyword);
    const endpoint = `https://public-api.birdeye.so/defi/token_overview?address=${keyword}`;
    const response = await fetch(endpoint, {
      headers: {
        "X-API-KEY": this.apiKey,
        Accept: "application/json",
        "x-chain": "solana",
      },
    });
    if (!response.ok) {
      throw new Error(`Search API request failed: ${response.statusText}`);
    }
    const data = await response.json();
    console.log("Search API Response data:", data);
    if (!data.success || !data.data) {
      throw new Error("Failed to search for token");
    }
    return data.data;
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
    // Direct address patterns - must be exact Solana address format
    "^[A-Za-z1-9][A-HJ-NP-Za-km-z]{31,43}$", // Exact address match only
    "^Scan:\\s*[A-Za-z1-9][A-HJ-NP-Za-km-z]{31,43}$", // Scan: prefix with address
  ],
  description:
    "Analyzes and provides information about Solana coins/tokens including trust scores, safety metrics, and market analysis.",
  validate: async (runtime, message) => {
    const text = message.content.text.trim();
    elizaLogger.debug("Validating scan coin action for text:", text);

    // First check if this is an auto-scan request (starts with Scan:)
    if (/^Scan:/i.test(text)) {
      const cleanText = text.replace(/^Scan:\s*/i, "").trim();
      const hasValidIdentifier = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/.test(
        cleanText
      );
      elizaLogger.debug(
        `Auto-scan request validation result: ${hasValidIdentifier}`
      );
      return hasValidIdentifier;
    }

    // Then check for a direct token identifier
    const hasDirectIdentifier = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/.test(text);
    if (hasDirectIdentifier) {
      elizaLogger.debug("Direct token identifier found");
      return true;
    }

    // Let ElizaOS handle all other messages
    elizaLogger.debug(
      "No direct token identifier found, letting ElizaOS handle with memory"
    );
    return false;
  },
  suppressInitialMessage: true,
  handler: async (runtime, message, _state, _options, callback) => {
    try {
      elizaLogger.info("Scanning coin");
      let text = message.content.text;
      const extensionId = runtime.userId;
      const birdeye = runtime.getService("birdeye");
      const twitterScrapper = runtime.getService("twitter-scrapper");

      // Remove "Scan:" prefix if present
      text = text.replace(/^Scan:\s*/i, "").trim();
      elizaLogger.info(`Processing text: ${text}`);

      // Handle clear/reset commands first
      if (/^(clear|reset|forget|start over)$/i.test(text.trim())) {
        await birdeye.clearLastToken(runtime.userId);
        await callback({
          text: "I've cleared your last token. You can start fresh with a new token analysis.",
          type: "bot",
        });
        return true;
      }

      // Extract token identifier from text
      const identifier = await birdeye.extractCoinIdentifier(
        text,
        runtime.userId
      );

      if (!identifier) {
        elizaLogger.debug("No token identifier found");
        return false;
      }

      elizaLogger.info(`Using identifier: ${identifier}`);

      // Initial status update
      if (extensionId) {
        console.log("DEBUG - Emitting initial analysis update:", {
          extensionId,
          message: `Analyzing ${identifier}...`,
          socketInstance: !!getIO(),
        });
        getIO()
          .to(extensionId)
          .emit("streaming_update", {
            text: `Analyzing ${identifier}...`,
            type: "update",
          });
      }

      // Fetch metrics
      const metrics = await birdeye.searchToken(identifier);
      elizaLogger.info(`Got metrics for ${metrics.symbol}`);

      // Store the token for this user
      try {
        await birdeye.storeLastToken(runtime.userId, {
          address: metrics.address,
          symbol: metrics.symbol,
        });
        elizaLogger.info(`Stored token context for user ${runtime.userId}`);
      } catch (storeError) {
        elizaLogger.error("Failed to store token context:", storeError);
        // Continue with analysis even if storage fails
      }

      // Metrics status update
      if (extensionId) {
        console.log("DEBUG - Emitting metrics update:", {
          extensionId,
          symbol: metrics.symbol,
          socketInstance: !!getIO(),
        });
        getIO()
          .to(extensionId)
          .emit("streaming_update", {
            text: `Found token metrics for ${
              metrics.symbol || "Unknown"
            }:\nPrice: $${(metrics.price || 0).toFixed(4)}\n24h Change: ${(
              metrics.priceChange24hPercent || 0
            ).toFixed(2)}%\nMarket Cap: $${(
              metrics.mc || 0
            ).toLocaleString()}\nFetching social data...`,
            type: "update",
          });
      }

      // Fetch Twitter data
      const tweets = await twitterScrapper.fetchTokenTweets(metrics.address);
      elizaLogger.info(`Fetched ${tweets.length} tweets`);

      // Twitter data status update
      if (extensionId) {
        console.log("DEBUG - Emitting twitter data update:", {
          extensionId,
          tweetCount: tweets.length,
          socketInstance: !!getIO(),
        });
        getIO()
          .to(extensionId)
          .emit("streaming_update", {
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
            console.log("DEBUG - Emitting analysis chunk:", {
              extensionId,
              chunkTitle: chunk.title,
              socketInstance: !!getIO(),
            });
            getIO()
              .to(extensionId)
              .emit("streaming_update", {
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
        console.log("DEBUG - Emitting analysis start:", {
          extensionId,
          socketInstance: !!getIO(),
        });
        getIO().to(extensionId).emit("streaming_update", {
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
          console.log("DEBUG - Emitting progress update:", {
            extensionId,
            messageIndex,
            message: updateMessages[messageIndex],
            socketInstance: !!getIO(),
          });
          getIO().to(extensionId).emit("streaming_update", {
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
            console.log("DEBUG - Emitting final analysis completion:", {
              extensionId,
              socketInstance: !!getIO(),
            });
            getIO().to(extensionId).emit("streaming_update", {
              text: "✅ Analysis complete! Preparing final report...",
              type: "update",
            });
          }

          try {
            // The response is already a valid JSON string, no need for cleaning
            const analysisData =
              typeof analysis === "string" ? JSON.parse(analysis) : analysis;

            // Validate required fields
            if (
              !analysisData.symbol ||
              typeof analysisData.trustScore === "undefined" ||
              !analysisData.riskLevel
            ) {
              elizaLogger.error(
                "Invalid analysis data structure:",
                analysisData
              );
              throw new Error("Missing required fields in analysis data");
            }

            // Send the structured data
            await callback({
              text: JSON.stringify(analysisData, null, 2),
              type: "bot",
            });
          } catch (parseError) {
            elizaLogger.error("Failed to parse analysis JSON:", parseError);
            elizaLogger.error("Raw analysis:", analysis);

            // Try to send the raw analysis as a fallback
            if (
              typeof analysis === "string" &&
              analysis.trim().startsWith("{") &&
              analysis.trim().endsWith("}")
            ) {
              await callback({
                text: analysis,
                type: "bot",
              });
            } else {
              await callback({
                text: "Sorry, I encountered an error while formatting the analysis. Please try again.",
                type: "bot",
              });
            }
          }
        }
      } catch (error) {
        clearInterval(updateInterval);
        throw error;
      }

      return true;
    } catch (error) {
      console.error("Coin scan failed:", error);
      if (message.extensionId) {
        getIO().to(message.extensionId).emit("streaming_update", {
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

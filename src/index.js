#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from "node-fetch";

const server = new Server({
  name: "mcp-citation-checker",
  version: "1.0.0",
});

// Helper function to check Perplexity citations
async function checkPerplexityCitations(domain) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return {
      platform: "perplexity",
      domain: domain,
      cited: false,
      error: "PERPLEXITY_API_KEY not configured",
    };
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "user",
            content: `Check if content from ${domain} is cited or used in AI search results.`,
          },
        ],
        return_citations: true,
      }),
    });

    if (!response.ok) {
      return {
        platform: "perplexity",
        domain: domain,
        cited: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const citations = data.citations || [];
    const cited = citations.some((c) =>
      c.toLowerCase().includes(domain.toLowerCase())
    );

    return {
      platform: "perplexity",
      domain: domain,
      cited: cited,
      citationCount: citations.length,
      citations: citations,
    };
  } catch (error) {
    return {
      platform: "perplexity",
      domain: domain,
      cited: false,
      error: error.message,
    };
  }
}

// Helper function to check ChatGPT citations
async function checkChatGPTCitations(domain) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      platform: "chatgpt",
      domain: domain,
      cited: false,
      error: "OPENAI_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `Search and report if ${domain} is cited or referenced in web search results.`,
            },
          ],
          tools: [{ type: "web_search_preview" }],
          tool_choice: "auto",
        }),
      }
    );

    if (!response.ok) {
      return {
        platform: "chatgpt",
        domain: domain,
        cited: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const content = JSON.stringify(data);
    const cited = content.toLowerCase().includes(domain.toLowerCase());

    return {
      platform: "chatgpt",
      domain: domain,
      cited: cited,
    };
  } catch (error) {
    return {
      platform: "chatgpt",
      domain: domain,
      cited: false,
      error: error.message,
    };
  }
}

// Helper function to check Google AIO citations
async function checkGoogleAIOCitations(domain) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return {
      platform: "google_aio",
      domain: domain,
      cited: false,
      error: "DATAFORSEO_LOGIN or DATAFORSEO_PASSWORD not configured",
    };
  }

  try {
    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const response = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: `"${domain}" site:google.com`,
          language_code: "en",
          location_code: 2840,
        }),
      }
    );

    if (!response.ok) {
      return {
        platform: "google_aio",
        domain: domain,
        cited: false,
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    const results = data.tasks?.[0]?.result || [];
    const cited = results.length > 0;

    return {
      platform: "google_aio",
      domain: domain,
      cited: cited,
      resultCount: results.length,
    };
  } catch (error) {
    return {
      platform: "google_aio",
      domain: domain,
      cited: false,
      error: error.message,
    };
  }
}

// Tool: check_citation
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "check_citation") {
    const domain = args.domain;

    if (!domain) {
      return {
        content: [
          {
            type: "text",
            text: "Error: domain parameter is required",
          },
        ],
        isError: true,
      };
    }

    const results = await Promise.all([
      checkPerplexityCitations(domain),
      checkChatGPTCitations(domain),
      checkGoogleAIOCitations(domain),
    ]);

    const summary = {
      domain: domain,
      platforms: results,
      citedBy: results.filter((r) => r.cited).map((r) => r.platform),
      citationRate: results.filter((r) => r.cited).length / 3,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  if (name === "batch_check") {
    const domains = args.domains;

    if (!Array.isArray(domains) || domains.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: domains parameter must be a non-empty array",
          },
        ],
        isError: true,
      };
    }

    const results = [];
    for (const domain of domains) {
      const platformResults = await Promise.all([
        checkPerplexityCitations(domain),
        checkChatGPTCitations(domain),
        checkGoogleAIOCitations(domain),
      ]);

      results.push({
        domain: domain,
        platforms: platformResults,
        citedBy: platformResults.filter((r) => r.cited).map((r) => r.platform),
        citationRate: platformResults.filter((r) => r.cited).length / 3,
      });
    }

    const summary = {
      totalDomains: domains.length,
      results: results,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  }

  if (name === "citation_rate") {
    const domains = args.domains;

    if (!Array.isArray(domains) || domains.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Error: domains parameter must be a non-empty array",
          },
        ],
        isError: true,
      };
    }

    const allResults = [];
    for (const domain of domains) {
      const platformResults = await Promise.all([
        checkPerplexityCitations(domain),
        checkChatGPTCitations(domain),
        checkGoogleAIOCitations(domain),
      ]);

      allResults.push({
        domain: domain,
        platforms: platformResults,
      });
    }

    const metrics = {
      totalDomains: domains.length,
      perplexityCitations: allResults.filter((r) =>
        r.platforms.some((p) => p.platform === "perplexity" && p.cited)
      ).length,
      chatgptCitations: allResults.filter((r) =>
        r.platforms.some((p) => p.platform === "chatgpt" && p.cited)
      ).length,
      googleAIOCitations: allResults.filter((r) =>
        r.platforms.some((p) => p.platform === "google_aio" && p.cited)
      ).length,
      averageCitationRate:
        allResults.reduce((sum, r) => {
          const cited = r.platforms.filter((p) => p.cited).length;
          return sum + cited / 3;
        }, 0) / allResults.length,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(metrics, null, 2),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
    isError: true,
  };
});

// Tool definitions
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      {
        name: "check_citation",
        description:
          "Check if a domain is cited by AI platforms (Perplexity, ChatGPT, Google AIO)",
        inputSchema: {
          type: "object",
          properties: {
            domain: {
              type: "string",
              description: "The domain to check for citations (e.g., example.com)",
            },
          },
          required: ["domain"],
        },
      },
      {
        name: "batch_check",
        description:
          "Check multiple domains for citations across AI platforms",
        inputSchema: {
          type: "object",
          properties: {
            domains: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of domains to check for citations",
            },
          },
          required: ["domains"],
        },
      },
      {
        name: "citation_rate",
        description: "Get aggregated citation metrics for multiple domains",
        inputSchema: {
          type: "object",
          properties: {
            domains: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of domains to analyze for citation rates",
            },
          },
          required: ["domains"],
        },
      },
    ],
  };
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);

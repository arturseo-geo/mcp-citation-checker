# mcp-citation-checker

An MCP (Model Context Protocol) server for checking if domains are cited by AI platforms including Perplexity, ChatGPT, and Google AI Overview.

## Installation

### Via npm

```bash
npm install -g mcp-citation-checker
```

### From source

```bash
git clone https://github.com/arturseo-geo/mcp-citation-checker.git
cd mcp-citation-checker
npm install
```

## Configuration

The server requires API credentials for three platforms. Set the following environment variables:

### Perplexity API
```bash
export PERPLEXITY_API_KEY="your_perplexity_api_key"
```

### OpenAI (ChatGPT)
```bash
export OPENAI_API_KEY="your_openai_api_key"
```

### DataForSEO (Google AI Overview)
```bash
export DATAFORSEO_LOGIN="your_dataforseo_username"
export DATAFORSEO_PASSWORD="your_dataforseo_password"
```

## Usage

### Starting the server

```bash
mcp-citation-checker
```

Or if running from source:

```bash
npm start
```

### Available Tools

#### 1. `check_citation`

Check if a single domain is cited by AI platforms.

**Input:**
```json
{
  "domain": "example.com"
}
```

**Output:**
```json
{
  "domain": "example.com",
  "platforms": [
    {
      "platform": "perplexity",
      "domain": "example.com",
      "cited": true,
      "citationCount": 5,
      "citations": ["citation1", "citation2", ...]
    },
    {
      "platform": "chatgpt",
      "domain": "example.com",
      "cited": true
    },
    {
      "platform": "google_aio",
      "domain": "example.com",
      "cited": true,
      "resultCount": 3
    }
  ],
  "citedBy": ["perplexity", "chatgpt", "google_aio"],
  "citationRate": 1.0,
  "timestamp": "2026-03-26T10:30:00.000Z"
}
```

#### 2. `batch_check`

Check multiple domains for citations across all platforms.

**Input:**
```json
{
  "domains": ["example.com", "another.com", "thirdsite.org"]
}
```

**Output:**
```json
{
  "totalDomains": 3,
  "results": [
    {
      "domain": "example.com",
      "platforms": [...],
      "citedBy": ["perplexity", "chatgpt"],
      "citationRate": 0.67
    },
    ...
  ],
  "timestamp": "2026-03-26T10:30:00.000Z"
}
```

#### 3. `citation_rate`

Get aggregated citation metrics for multiple domains.

**Input:**
```json
{
  "domains": ["example.com", "another.com", "thirdsite.org"]
}
```

**Output:**
```json
{
  "totalDomains": 3,
  "perplexityCitations": 2,
  "chatgptCitations": 3,
  "googleAIOCitations": 1,
  "averageCitationRate": 0.67,
  "timestamp": "2026-03-26T10:30:00.000Z"
}
```

## API Integration Details

### Perplexity
- **Endpoint:** `https://api.perplexity.ai/chat/completions`
- **Model:** `sonar`
- **Features:** Returns array of citations, domain matching performed locally

### ChatGPT
- **Endpoint:** `https://api.openai.com/v1/chat/completions`
- **Model:** `gpt-4o-mini`
- **Features:** Uses web_search_preview tool for real-time search results

### Google AI Overview
- **Endpoint:** `https://api.dataforseo.com/v3/serp/google/organic/live/advanced`
- **Authentication:** Basic Auth (Base64 encoded username:password)
- **Features:** Searches for domain mentions in Google SERP results

## Error Handling

Each platform check includes error handling:
- Missing API credentials return an error object with `cited: false` and `error` message
- API failures return error details without throwing exceptions
- Network errors are caught and returned as error responses

## Requirements

- Node.js ≥ 18.0.0
- Active API keys for Perplexity, OpenAI, and DataForSEO
- Network access to all three API endpoints

## License

MIT License — see LICENSE file for details

## Author

Artur Ferreira <artur@thegeolab.net>

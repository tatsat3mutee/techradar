---
title: "MCP Servers — Extending AI with External Tools"
description: "Hands-on guide to the Model Context Protocol: building MCP servers, connecting them to VS Code and Claude, tool annotations, OAuth auth, and real-world use cases."
date: "2026-04-15"
author: "Tatsat Pandey"
tags: ["MCP", "Model Context Protocol", "VS Code", "Claude", "Tool Use"]
bannerGradient: "linear-gradient(135deg, #d4a574, #bc8cff)"
featured: true
---

## Why MCP Matters

The Model Context Protocol (MCP) is an open standard — created by Anthropic and now adopted across the industry — that lets AI assistants connect to external tools, data sources, and services through a unified interface. Instead of every AI tool building its own integration layer, MCP provides one protocol that works everywhere.

> **Think of it like USB for AI tools.** Before USB, every device had its own connector. MCP does the same thing for AI-to-tool communication.

**Who's adopted it:** VS Code (Copilot), Claude Desktop, Cursor, Windsurf, JetBrains IDEs, Cline, and more. The spec reached 1.0 in March 2025.

## Architecture: How MCP Works

```
┌─────────────┐     MCP Protocol      ┌─────────────┐
│  MCP Client │ ◄──────────────────► │  MCP Server  │
│ (VS Code,   │   JSON-RPC over       │ (Your code)  │
│  Claude)     │   stdio or HTTP       │              │
└─────────────┘                        └──────┬───────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │  External Service  │
                                    │  (DB, API, Files)  │
                                    └───────────────────┘
```

Three primitives:
- **Tools** — Functions the AI can call (e.g., `search_docs`, `run_query`)
- **Resources** — Read-only data the AI can access (e.g., file contents, DB schemas)
- **Prompts** — Reusable prompt templates the server offers to the client

## Building Your First MCP Server

Install the SDK:

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
```

Create a simple server that provides a weather tool:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "weather-server",
  version: "1.0.0",
});

server.tool(
  "get_weather",
  "Get current weather for a city",
  { city: z.string().describe("City name, e.g. 'San Francisco'") },
  async ({ city }) => {
    // In production, call a real weather API
    return {
      content: [{ type: "text", text: `Weather in ${city}: 72°F, sunny` }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Connecting to VS Code

Add to your workspace's `.vscode/mcp.json`:

```json
{
  "servers": {
    "weather": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-servers/weather/index.js"]
    }
  }
}
```

Once saved, Copilot agent mode will automatically discover the tools. Type `@` in chat to see available MCP tools, or just ask a question and the agent will call the right tool.

## Connecting to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/weather/index.js"]
    }
  }
}
```

## Tool Annotations

MCP 1.0 introduced tool annotations to help clients understand what tools do:

```typescript
server.tool(
  "delete_record",
  "Delete a database record by ID",
  { id: z.string() },
  async ({ id }) => { /* ... */ },
  {
    annotations: {
      destructiveHint: true,    // Client should warn before calling
      idempotentHint: true,     // Safe to retry
      readOnlyHint: false,      // Modifies state
      openWorldHint: false,     // Operates on known data
    }
  }
);
```

## Transport Options

| Transport | Use Case | Pros | Cons |
|-----------|----------|------|------|
| **stdio** | Local tools, CLI | Simple, no networking | Same machine only |
| **Streamable HTTP** | Remote servers, shared tools | Network-accessible, OAuth support | More setup |

For production, use Streamable HTTP with OAuth 2.1 authentication so your MCP servers can be shared securely across teams.

## Real-World MCP Servers Worth Using

- **GitHub MCP Server** — Search repos, create issues, read PRs directly from chat
- **Filesystem Server** — Read/write files with sandboxed access
- **PostgreSQL Server** — Query databases, inspect schemas
- **Playwright Server** — Browser automation from AI chat
- **Fetch Server** — HTTP requests to any API

## Key Takeaways

1. MCP is becoming the standard for AI-tool integration — learn it now
2. Start with stdio transport for local development, move to HTTP for production
3. Tool descriptions matter — the AI reads them to decide when to use your tool
4. Add annotations so clients can warn users before destructive operations
5. Check the [MCP Server Registry](https://github.com/modelcontextprotocol/servers) for pre-built servers before building your own

## Resources

- [MCP Specification](https://spec.modelcontextprotocol.io) — Official protocol spec
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Server & client SDK
- [VS Code MCP Docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) — Integration guide
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers) — Pre-built servers

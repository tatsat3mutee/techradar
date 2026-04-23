---
title: "MCP Servers — Extending AI with External Tools"
description: "Hands-on guide to the Model Context Protocol: building MCP servers, connecting them to VS Code and Claude, tool annotations, OAuth auth, and real-world use cases."
date: "2026-04-15"
author: "Tatsat Pandey"
presenters:
  - name: "Rajagopal Neelakantan"
    role: "MCP Session Lead"
  - name: "Tatsat Pandey"
    role: "Session Author"
tags: ["MCP", "Model Context Protocol", "VS Code", "Claude", "Tool Use"]
bannerGradient: "linear-gradient(135deg, #d4a574, #bc8cff)"
featured: true
---

## Session Presenters

| Presenter | Role |
|-----------|------|
| **Rajagopal Neelakantan** | MCP Session Lead |
| **Tatsat Pandey** | Session Author & Content |

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

## 🏋️ LevelUP MCP — Team Exercise Guide

This hands-on exercise walks your team through installing and using the **LevelUP MCP** server directly inside VS Code Copilot.

### Pre-requisite

Make sure everyone has **VS Code 1.110.0 or higher** installed. Check via **Help → About** in VS Code.

### Step 1: Log in to LevelUP Hub

1. Open your browser and navigate to **[https://levelup.web.att.com/genai-marketplace](https://levelup.web.att.com/genai-marketplace)**
2. Log in with your AT&T credentials if prompted
3. You should land on the LevelUP Hub GenAI Marketplace showing a list of tools

### Step 2: Find and Install LevelUP MCP

1. On the marketplace page, find the card titled **"LevelUP MCP"** (it has an **MCP** tag)
2. Use the **Filters** to narrow by type if needed
3. Click the **"Install"** button on the LevelUP MCP card
4. This automatically triggers installation into VS Code — make sure VS Code is open in the background
5. Wait for the installation to complete. You may see a confirmation prompt in VS Code

### Step 3: Verify the Installation

1. Switch to VS Code
2. Open the **GitHub Copilot chat panel** (`Ctrl+Alt+I` or via `Ctrl+Shift+P` → "Copilot Chat")
3. Confirm LevelUP MCP tools are available — you should be able to invoke MCP tools from within Copilot

### Step 4: Try the MCP Tools

Test these prompts inside **VS Code GitHub Copilot Chat**:

**Test 1 — Your open work items:**
```
#get_my_open_work_items
```
Returns a list of your currently open work items if anything is assigned to you.

**Test 2 — PR status:**
```
#get_pr_status
```
Returns the status of your pull requests.

### Step 5: Explore Further

- Type `#` in Copilot Chat to browse all available MCP tool suggestions
- Try **combining tools** — check a work item, then check if there's a related PR
- Note down tools that are useful for your day-to-day workflow

---

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

---
title: "MCP Servers — Extending AI with External Tools"
description: "Enterprise-safe MCP overview focused on the approved LevelUP MCP workflow in VS Code Copilot."
date: "2026-04-15"
author: "Rajagopal Neelakantan"
presenters:
  - name: "Rajagopal Neelakantan"
    role: "MCP Session Lead"
tags: ["MCP", "Model Context Protocol", "VS Code", "Claude", "Tool Use"]
bannerGradient: "linear-gradient(135deg, #d4a574, #bc8cff)"
featured: true
---

## Basic MCP Overview

The Model Context Protocol (MCP) is the interface layer that lets an AI client call approved tools instead of only generating text.

In simple terms:

- **Client** — VS Code Copilot is the client that receives your prompt.
- **Server** — an approved MCP server exposes specific tools the client can use.
- **Tools** — actions the assistant can call, such as fetching work items or checking PR status.

> In our domain, the approved path right now is **LevelUP MCP**. This session is intentionally focused on that enterprise-safe workflow rather than public or custom MCP servers.

## What Developers Should Remember

1. MCP is useful because it gives Copilot access to real systems and approved actions.
2. In our environment, **LevelUP MCP** is the MCP route developers should use.
3. Do not install random public MCP servers or build ad hoc tool connections unless policy changes.
4. Start with the approved LevelUP use cases inside VS Code Copilot chat.

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

1. MCP is the protocol layer behind tool-enabled AI workflows.
2. **LevelUP MCP** is the approved enterprise entry point for this session.
3. The two safest starter flows are checking your open work items and PR status.
4. Keep experiments inside approved VS Code Copilot and LevelUP workflows.

## Resources

- [LevelUP Hub GenAI Marketplace](https://levelup.web.att.com/genai-marketplace) — Install the approved LevelUP MCP server
- [VS Code MCP Docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) — Background reading for how MCP works in VS Code

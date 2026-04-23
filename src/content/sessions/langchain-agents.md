---
title: "Building AI Agents with LangChain & LangGraph"
description: "From simple chains to stateful multi-agent systems: building production-grade AI agents with LangChain, LangGraph, tool calling, and human-in-the-loop workflows."
date: "2026-04-10"
author: "Tatsat Pandey"
tags: ["LangChain", "LangGraph", "AI Agents", "Python", "Tool Calling"]
bannerGradient: "linear-gradient(135deg, #3fb950, #58a6ff)"
featured: true
---

## Why Agents Matter Now

The shift from prompt-response to agentic AI is the defining trend of 2026. Instead of single-turn Q&A, agents plan multi-step tasks, call tools, read databases, write code, and self-correct — all autonomously. If you're building with LLMs in production, you need to understand agents.

> **Key insight:** An agent is just an LLM in a loop — it decides what to do, executes an action, observes the result, and decides again. The hard part is making that loop reliable.

## Core Architecture

Every agent has three components:

1. **Planner** — The LLM decides the next action based on the current state
2. **Tools** — Functions the agent can call (search, calculator, database, API, code execution)
3. **Memory** — State carried across turns (conversation history, scratchpad, long-term storage)

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.tools import tool

@tool
def search_docs(query: str) -> str:
    """Search internal documentation for relevant information."""
    # Your retrieval logic here
    return f"Found results for: {query}"

llm = ChatOpenAI(model="gpt-4.1")
agent = create_tool_calling_agent(llm, [search_docs], prompt)
executor = AgentExecutor(agent=agent, tools=[search_docs], verbose=True)
```

## LangGraph: Stateful Multi-Agent Systems

LangGraph takes agents beyond single loops. It models agent workflows as **directed graphs** where nodes are functions and edges are conditional transitions.

### When to Use LangGraph vs. Plain LangChain

| Use Case | LangChain AgentExecutor | LangGraph |
|----------|------------------------|-----------|
| Simple tool calling | ✅ | Overkill |
| Multi-step with retries | ⚠️ Fragile | ✅ |
| Human-in-the-loop | ❌ | ✅ |
| Multi-agent handoffs | ❌ | ✅ |
| Persistent state | ❌ | ✅ |

### Building a LangGraph Agent

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated

class AgentState(TypedDict):
    messages: list
    next_action: str

graph = StateGraph(AgentState)
graph.add_node("planner", planner_node)
graph.add_node("executor", executor_node)
graph.add_node("reviewer", reviewer_node)

graph.add_edge("planner", "executor")
graph.add_conditional_edges("executor", should_continue, {
    "review": "reviewer",
    "done": END,
})
graph.add_edge("reviewer", "planner")  # feedback loop
```

## Human-in-the-Loop Patterns

Production agents need guardrails. LangGraph's `interrupt_before` and `interrupt_after` let you pause execution for human approval:

- **Approve before action** — Agent proposes a database write; human reviews first
- **Review after action** — Agent executes, human validates the output
- **Escalation** — Agent detects low confidence and routes to a human

## Key Takeaways

1. Start simple — a single-tool agent with `AgentExecutor` covers 80% of use cases
2. Move to LangGraph when you need state, branching, or human oversight
3. Always add observability — use LangSmith to trace every agent decision
4. Test with adversarial inputs — agents fail in creative ways you won't predict
5. Keep tool descriptions precise — the LLM reads them to decide which tool to call

## Resources

- [LangChain Docs](https://python.langchain.com/docs/) — Official documentation
- [LangGraph Tutorial](https://langchain-ai.github.io/langgraph/tutorials/) — Step-by-step graph building
- [LangSmith](https://smith.langchain.com/) — Observability and tracing platform

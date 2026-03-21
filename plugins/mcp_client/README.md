# MCP Client

Connect Sapphire to external tools via the [Model Context Protocol](https://modelcontextprotocol.io). MCP servers expose tools that Sapphire's AI can use — file systems, databases, APIs, and thousands of community-built integrations.

## Quick Start

1. Enable the MCP Client plugin in **Settings**
2. Go to **Settings → Plugins → MCP Client**
3. Click **+ Add Local** or **+ Add Remote**
4. Once connected, MCP tools appear in your **Toolsets** view
5. Enable the tools you want in your active toolset

## Local Servers (stdio)

Local MCP servers run as subprocesses on your machine. Most are distributed as npm packages.

### Example: Filesystem Server

```
Command: npx
Args: -y @modelcontextprotocol/server-filesystem /home/user/documents
```

This gives the AI tools to read, write, and search files in the specified directory.

### Example: GitHub Server

```
Command: npx
Args: -y @modelcontextprotocol/server-github
Env: GITHUB_TOKEN=ghp_your_token_here
```

### Requirements

Local servers that use `npx` require [Node.js](https://nodejs.org) to be installed. Python-based MCP servers work with your existing Python environment.

## Remote Servers (HTTP)

Remote MCP servers are hosted by third parties. Enter the URL and optional API key.

### Example

```
URL: https://mcp.example.com
API Key: your-key (if required)
```

## How It Works

MCP tools register alongside native Sapphire tools in the toolset system. The AI doesn't know or care whether a tool is local or from an MCP server — it just uses them.

```
MCP Server advertises tools
  → Sapphire discovers and registers them
  → AI sees them in its tool list
  → AI calls a tool
  → Sapphire proxies the call to the MCP server
  → Result returned to AI
```

## Managing Tools

Connected MCP servers appear as collapsible modules in the **Toolsets** view:

- Toggle individual tools on/off
- Module header shows tool count
- Works with custom toolsets — include only the MCP tools you want

## Troubleshooting

- **"Command not found"** — Install Node.js for npx-based servers, or check the command path
- **Server shows "error"** — Click the reconnect button (↻) to retry
- **Tools not appearing** — Check your active toolset includes the MCP module
- **Slow tool calls** — MCP calls have a 30-second timeout. Some servers need time for first response

## Popular MCP Servers

Browse available servers at [mcp.so](https://mcp.so) or [smithery.ai](https://smithery.ai). Thousands of community-built servers available for databases, APIs, cloud services, and more.

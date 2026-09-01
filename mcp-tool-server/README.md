# Draw.io MCP Tool Server

The official [draw.io](https://www.draw.io) MCP server that opens diagrams in the local draw.io desktop app by default. Supports XML, CSV, and Mermaid.js. Set `DRAWIO_OPEN=browser` for the upstream web editor.

This fork is [VictorMarcolino/drawio-mcp](https://github.com/VictorMarcolino/drawio-mcp). Upstream: [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp). Also in this repo:

- **[MCP App Server](https://github.com/jgraph/drawio-mcp/tree/main/mcp-app-server)** — Renders diagrams inline in AI chat interfaces. Hosted at `https://mcp.draw.io/mcp` — no install required.
- **[Claude Code Plugin](https://github.com/jgraph/drawio-mcp/tree/main/plugins/claude-code)** — Claude Code plugin that generates native `.drawio` files with optional PNG/SVG/PDF export.
- **[Project Instructions](https://github.com/jgraph/drawio-mcp/tree/main/project-instructions)** — Zero-install approach using Claude Project instructions.

## Features

- **Open XML diagrams**: Load native draw.io/mxGraph XML format
- **Import CSV data**: Convert tabular data to diagrams (org charts, flowcharts, etc.)
- **Render Mermaid.js**: Transform Mermaid syntax into editable draw.io diagrams
- **Customizable display**: Lightbox mode, dark mode, and more

## Installation

### From this fork

```bash
git clone https://github.com/VictorMarcolino/drawio-mcp.git
cd drawio-mcp/mcp-tool-server
npm install
node src/index.js
```

Upstream `npx @drawio/mcp` still opens the **browser**. This fork defaults to desktop.

### Global installation

```bash
cd drawio-mcp/mcp-tool-server
npm install -g .
drawio-mcp
```

### From source

Same as [From this fork](#from-this-fork). Upstream clone: [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp).

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "drawio": {
      "command": "node",
      "args": ["/path/to/drawio-mcp/mcp-tool-server/src/index.js"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add drawio -- node /path/to/drawio-mcp/mcp-tool-server/src/index.js
```

Or manually in `.claude/settings.json`:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "node",
      "args": ["/path/to/drawio-mcp/mcp-tool-server/src/index.js"]
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your workspace (or run **MCP: Open User Configuration** for a global config):

```json
{
  "servers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "@drawio/mcp"]
    }
  }
}
```

Then click **Start** above the server entry, **trust** the server when prompted, switch Copilot Chat to **Agent mode**, and make sure the drawio tools are enabled under **Configure Tools** (🔧) in the chat input.

> **Note:** Use this stdio server for VS Code — it opens diagrams in the browser and works with any standard MCP client. The hosted `https://mcp.draw.io/mcp` endpoint is a different server that renders diagrams *inline* via the [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) protocol, which Copilot does not yet support. Other clients that use stdio (Windsurf, etc.) use the same config shape as above.

### Cursor

Add the server to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "drawio": {
      "command": "node",
      "args": ["/path/to/drawio-mcp/mcp-tool-server/src/index.js"]
    }
  }
}
```

Enable the server when prompted (or under **Cursor Settings → MCP**), then ask the Agent to create a diagram — it opens in the **draw.io desktop** app by default (`DRAWIO_OPEN=desktop`). Set `DRAWIO_OPEN=browser` to keep the upstream browser tab.

> **Tip:** Cursor also supports the [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) extension, so the hosted [MCP App Server](../mcp-app-server) at `https://mcp.draw.io/mcp` works in Cursor too, rendering diagrams *inline* in chat instead of opening an editor. Use this stdio server if you prefer the full draw.io editor (desktop or browser).

### Other MCP Clients

Configure your MCP client to run the server via stdio:

```bash
node /path/to/drawio-mcp/mcp-tool-server/src/index.js
```

### Desktop draw.io (default in this fork)

By default this server writes a temporary `.drawio` / `.mmd` / `.csv` file and
opens it with the **local draw.io app** (`drawio` on PATH, or `DRAWIO_CMD`).

```json
{
  "mcpServers": {
    "drawio": {
      "command": "node",
      "args": ["/path/to/drawio-mcp/mcp-tool-server/src/index.js"],
      "env": {
        "DRAWIO_OPEN": "desktop",
        "DRAWIO_CMD": "drawio"
      }
    }
  }
}
```

Run `npm install` in `mcp-tool-server` first. Set `DRAWIO_OPEN=browser` to use a
`#create=` URL in the default browser instead (upstream behaviour).
`DRAWIO_BASE_URL` only applies in that mode.

### Self-hosted draw.io

To open diagrams in a self-hosted draw.io instance, set the `DRAWIO_BASE_URL` environment variable to your instance URL (default: `https://app.diagrams.net/`):

```json
{
  "mcpServers": {
    "drawio": {
      "command": "npx",
      "args": ["-y", "@drawio/mcp"],
      "env": {
        "DRAWIO_BASE_URL": "https://drawio.example.com/"
      }
    }
  }
}
```

## Tools

### `open_drawio_xml`

Opens the draw.io editor with XML content.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Draw.io XML content |
| `lightbox` | boolean | No | Read-only view mode (default: false) |
| `dark` | string | No | "auto", "true", or "false" (default: "auto") |
| `routing` | string | No | `"libavoid"` reroutes connectors around shapes (obstacle-avoiding orthogonal routing) before opening |

### `open_drawio_csv`

Opens the draw.io editor with CSV data converted to a diagram.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | CSV content |
| `lightbox` | boolean | No | Read-only view mode (default: false) |
| `dark` | string | No | "auto", "true", or "false" (default: "auto") |

### `open_drawio_mermaid`

Opens the draw.io editor with a Mermaid.js diagram.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Mermaid.js syntax |
| `lightbox` | boolean | No | Read-only view mode (default: false) |
| `dark` | string | No | "auto", "true", or "false" (default: "auto") |

### `search_shapes`

Searches the draw.io shape library (~10,000 shapes: AWS, Azure, GCP, Cisco, Kubernetes, P&ID, electrical, BPMN, …) and returns matching shapes with ready-to-use style strings for `open_drawio_xml`. When the built-in libraries have no good match, results are supplemented from the draw.io icon service (brand logos and general-purpose concept icons, e.g. `react`, `slack`, `shopping cart`). Use only for diagrams needing industry-specific, branded, or pictorial icons — standard flowcharts, UML, ERD, and org charts don't need it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Space-separated keywords (e.g. `aws lambda`, `cisco router`) |
| `limit` | number | No | Max results (default: 10, max: 50) |

### `list_pages` / `get_page` / `set_page`

Page-level access to a local multi-page `.drawio` file, so one page can be inspected or edited without loading the whole file. Pages are addressed by zero-based index, exact name, or id (as returned by `list_pages`). Compressed pages are decompressed/re-compressed transparently. Paths must end in `.drawio` or `.xml`.

| Tool | Parameters | Result |
|------|------------|--------|
| `list_pages` | `path` | `[{index, id, name, approxSizeBytes}]` for every page |
| `get_page` | `path`, `page` | The page's `mxGraphModel` XML |
| `set_page` | `path`, `page`, `content` | Replaces that page's content (a single `<mxGraphModel>` element); all other pages stay untouched |

## Example Prompts

- "Use `open_drawio_mermaid` to create a sequence diagram showing OAuth2 authentication flow"
- "Use `open_drawio_csv` to create an org chart: CEO → CTO, CFO; CTO → 3 Engineers"
- "Use `open_drawio_xml` to create a detailed AWS architecture diagram with VPC, subnets, and security groups"

> **Tip:** Claude Desktop may have multiple ways to create diagrams. To ensure it uses the draw.io MCP, mention the tool name explicitly or add a system instruction:
> *"Always use the draw.io MCP tools to create diagrams."*

## How It Works

1. The MCP server receives diagram content (XML, CSV, or Mermaid)
2. Content is compressed using pako deflateRaw and encoded as base64
3. A draw.io URL is generated with the `#create` hash parameter
4. The URL is returned to the LLM, which can present it to the user
5. Opening the URL loads draw.io with the diagram ready to view/edit

The `open_drawio_xml` tool description includes the full XML generation reference (edge routing, containers, layers, tags, metadata, dark mode, etc.) loaded from [`shared/xml-reference.md`](../shared/xml-reference.md) — the single source of truth for all draw.io MCP prompts. A `prepack` script bundles this file into the npm package so it works after `npm install`.

## Related Resources

- [draw.io](https://www.draw.io) - Free online diagram editor
- [draw.io Desktop](https://github.com/jgraph/drawio-desktop) - Desktop application
- [drawio-mcp on GitHub](https://github.com/jgraph/drawio-mcp) - Full repository with all four approaches
- [MCP Specification](https://modelcontextprotocol.io/)

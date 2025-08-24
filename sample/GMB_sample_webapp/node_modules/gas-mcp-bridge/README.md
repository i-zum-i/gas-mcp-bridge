承知しました。README の内容を **正しい Markdown フォーマット** に整形しました。見出し・リスト・コードブロックを揃え、読みやすさを向上させています。

---

# GAS MCP Bridge

Turn your Google Apps Script (GAS) project into an MCP (Model Context Protocol) server with zero hassle 🚀

---

## ✨ Features

* 📦 **npm package** → drop into any clasp project
* 📝 **YAML annotation comments** → define MCP tools directly in your GAS code
* 🔄 **mcp build** → auto-generate `mcp.tools.json` & discover WebApp URL
* 🛠 **mcp start** → run a ready-to-use MCP server (stdio/TCP)
* 🔒 **API token authentication** (stored in Script Properties)
* 🤖 **Helpful fallback**: no annotations = auto echo tool with template guidance

---

## 🚀 Quick Start

### 1. Install

```bash
npm i -D gas-mcp-bridge
```

### 2. Setup a clasp project

```bash
clasp login
clasp create --type webapp --title "my-gas-mcp"
```

### 3. Configure authentication

* In GAS Script Properties, set:

  ```
  API_TOKEN=<random-string>
  ```

* Locally:

  ```bash
  export GAS_API_TOKEN=<same-token>
  ```

### 4. Annotate your GAS code

```js
/* @mcp
name: sheet.appendRow
description: Append one row to a sheet
path: sheet.appendRow
schema:
  type: object
  properties:
    spreadsheetId: { type: string }
    rangeA1: { type: string }
    values:
      type: array
      items: { anyOf: [{ type: string }, { type: number }] }
  required: [spreadsheetId, rangeA1, values]
*/
function sheet_appendRow({ spreadsheetId, rangeA1, values }) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = ss.getRange(rangeA1).getSheet();
  sheet.appendRow(values);
  return { appended: true };
}
```

### 5. Build & start

```bash
npx mcp build   # generate mcp.tools.json and detect WebApp URL
npx mcp start   # launch MCP server
```

---

## 🧪 Behavior without annotations

* **Default** → generates an echo tool that returns your input + annotation template
* **Strict mode** → `MCP_STRICT=1 npx mcp build` fails if no annotations
* **Empty mode** → `MCP_MODE=empty npx mcp build` writes empty `tools: []`

**Example echo response:**

```json
{
  "testTool": true,
  "note": "This is a test tool. Please add /* @mcp ... */ annotations and run npx mcp build again.",
  "inputReceived": { "message": "hello" },
  "howToAnnotate": {
    "template": "/* @mcp\nname: <tool.name>\ndescription: <desc>\npath: <key>\nschema:\n  type: object\n  properties:\n    ...\n  required: [...]\n*/",
    "example": "/* @mcp\nname: sheet.appendRow\n...*/"
  }
}
```

---

## 🔐 Security

* GAS WebApp is published as `ANYONE_ANONYMOUS` but requires `Authorization: Bearer <API_TOKEN>`
* Token is checked inside GAS `doPost` handler

---

## 📖 Development Workflow

```bash
# Initial run
npx mcp build   # generate tool definitions & config
npx mcp start   # start MCP server

# After adding/updating annotations
npx mcp build
```

---

## 🔌 MCP Client Configuration

### Claude Desktop

Add to `~/.claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gas-mcp-bridge": {
      "command": "npx",
      "args": ["mcp", "start"],
      "cwd": "/path/to/your/gas-project"
    }
  }
}
```

Restart Claude Desktop and your GAS tools will be available in chat.

---

### Cursor

Add to workspace settings (`.cursor-settings.json` or global settings):

```json
{
  "mcp.servers": [
    {
      "name": "gas-mcp-bridge",
      "command": "npx",
      "args": ["mcp", "start"],
      "cwd": "/path/to/your/gas-project"
    }
  ]
}
```

---

### Claude Code

Ensure the server is running:

```bash
npx mcp start
```

Claude Code will automatically discover MCP servers via stdio connection in the current directory.

---

### VS Code (via MCP Extension)

Install an MCP extension and configure in `settings.json`:

```json
{
  "mcp.servers": {
    "gas-mcp-bridge": {
      "command": "npx",
      "args": ["mcp", "start"],
      "cwd": "/path/to/your/gas-project"
    }
  }
}
```

---

### Generic MCP Client

For stdio transport:

```bash
npx mcp start
```

For TCP transport:

```bash
MCP_TRANSPORT=tcp MCP_TCP_PORT=3333 npx mcp start
```

---

### Environment Variables

```bash
export GAS_API_TOKEN="your-gas-api-token"    # Required for GAS authentication
export MCP_TIMEOUT_MS=30000                  # Request timeout (default: 30s)
export MCP_RETRY=2                           # Retry attempts (default: 0)
export MCP_TRANSPORT=stdio                   # Transport mode (stdio/tcp)
export MCP_TCP_PORT=3333                     # TCP port when transport=tcp
```

---

### Example Usage in Clients

**Claude Desktop:**

```
"Use sheet.appendRow to add ['Task', 'In Progress', 'John'] to spreadsheet 1ABC...xyz"
```

**Cursor:**

```
@gas-mcp-bridge drive.listFiles {"query": "modifiedTime > '2024-01-01'", "maxResults": 5}
```

**Claude Code:**

```
Can you help me append some data to my spreadsheet using the sheet.appendRow tool?
```

---

## 🌱 Roadmap

* TypeScript → JSON Schema autogen (`ts-json-schema-generator`)
* Support for scopes, examples, rateLimit metadata
* CI/CD validation for `mcp.tools.json` drift

---

## 📜 License

MIT © 2025 Contributors

---

💡 With **GAS MCP Bridge**, you can expose your existing Google Workspace automations as standard MCP tools — instantly usable from Claude, VSCode, or any MCP client.

---

👉 このまま GitHub README.md にコピーすれば崩れずに表示されます。
ご希望なら **目次 (Table of Contents)** を自動生成して先頭に追加しますか？

GAS MCP Bridge

Turn your Google Apps Script (GAS) project into an MCP (Model Context Protocol) server with zero hassle 🚀

⸻

✨ Features
   •   📦 npm package → drop into any clasp project
   •   📝 YAML annotation comments → define MCP tools directly in your GAS code
   •   🔄 mcp build → auto-generate mcp.tools.json & discover WebApp URL
   •   🛠 mcp start → run a ready-to-use MCP server (stdio/TCP)
   •   🔒 API token authentication (stored in Script Properties)
   •   🤖 Helpful fallback: no annotations = auto echo tool with template guidance

⸻

🚀 Quick Start

1. Install

npm i -D gas-mcp-bridge

2. Setup a clasp project

clasp login
clasp create --type webapp --title "my-gas-mcp"

3. Configure authentication
   •   In GAS Script Properties, set:

API_TOKEN=<random-string>


   •   Locally:

export GAS_API_TOKEN=<same-token>



4. Annotate your GAS code

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

5. Build & start

npx mcp build   # generate mcp.tools.json and detect WebApp URL
npx mcp start   # launch MCP server


⸻

🧪 Behavior without annotations
   •   Default → generates an echo tool that returns your input + annotation template
   •   Strict mode → MCP_STRICT=1 npx mcp build fails if no annotations
   •   Empty mode → MCP_MODE=empty npx mcp build writes empty tools: []

Example echo response:

{
  "testTool": true,
  "note": "This is a test tool. Please add /* @mcp ... */ annotations and run npx mcp build again.",
  "inputReceived": { "message": "hello" },
  "howToAnnotate": {
    "template": "/* @mcp\nname: <tool.name>\ndescription: <desc>\npath: <key>\nschema:\n  type: object\n  properties:\n    ...\n  required: [...]\n*/",
    "example": "/* @mcp\nname: sheet.appendRow\n...*/"
  }
}


⸻

🔐 Security
   •   GAS WebApp is published as ANYONE_ANONYMOUS but requires Authorization: Bearer <API_TOKEN>
   •   Token is checked inside GAS doPost handler

⸻

📖 Development Workflow

# Initial run
npx mcp build   # generate tool definitions & config
npx mcp start   # start MCP server

# After adding/updating annotations
npx mcp build


⸻

🌱 Roadmap
   •   TypeScript → JSON Schema autogen (ts-json-schema-generator)
   •   Support for scopes, examples, rateLimit metadata
   •   CI/CD validation for mcp.tools.json drift

⸻

📜 License

MIT © 2025 Contributors

⸻

💡 With GAS MCP Bridge, you can expose your existing Google Workspace automations as standard MCP tools — instantly usable from Claude, VSCode, or any MCP client.

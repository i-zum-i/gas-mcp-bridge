0. 用語・前提

用語	説明
MCP	Model Context Protocol。LLM クライアントとツール（サーバ）を接続する標準プロトコル
ブリッジ	本パッケージ gas-mcp-bridge（Node.js）。MCP サーバとして起動し GAS を呼び出す
GAS	Google Apps Script。WebApp として doPost を公開
clasp	GAS をローカルで管理・デプロイする CLI
A方式	GAS ソース内の YAML ブロック注釈で MCP ツールを宣言する方式
tools JSON	mcp.tools.json。ブリッジが読み込む MCP ツール定義ファイル
config JSON	.mcp-gas.json。GAS URL・scriptId・deploymentId 等の接続設定


⸻

1. 全体構成

graph LR
  subgraph Client[MCP Client]
    C1[Claude / VSCode MCP / 他]
  end
  subgraph Bridge[gas-mcp-bridge (Node.js)]
    B1[CLI: mcp build/start]
    B2[Generator: A方式スキャン]
    B3[Server: @modelcontextprotocol/sdk]
    B4[Apps Script API Client]
    B5[HTTP Client to GAS]
  end
  subgraph GAS[Google Apps Script WebApp]
    G1[doPost Router]
    G2[Tool Functions<br>(sheet.appendRow 等)]
    G3[Script Properties<br>(API_TOKEN)]
  end

  C1 -- MCP stdio/TCP --> B3
  B3 -- Tool call --> B5
  B5 -- HTTPS JSON --> G1
  G1 --> G2
  G2 --> G1
  G1 -- JSON --> B5
  B5 --> B3 --> C1

  B1 --> B2
  B1 --> B4
  B4 -. read deploys .- GAS


⸻

2. 処理フロー

2.1 mcp build フロー

sequenceDiagram
  autonumber
  participant Dev as Developer (CLI)
  participant CLI as mcp(build)
  participant Gen as Generator(A方式)
  participant ASAPI as Apps Script API
  participant FS as Filesystem

  Dev->>CLI: npx mcp build
  CLI->>Gen: ソース走査 & YAML注釈抽出
  Gen-->>CLI: tools[]（名称/説明/schema/path）
  CLI->>FS: write mcp.tools.json
  CLI->>ASAPI: .clasp.json/.clasprc.json から認証→deployments.list
  alt WebApp URL あり
    ASAPI-->>CLI: webApp.url (/exec)
  else 無ければ
    CLI->>CLI: execa('npx clasp deploy')
    CLI->>ASAPI: deployments.list 再取得
  end
  CLI->>FS: write .mcp-gas.json（gasUrl/scriptId/deploymentId/apiToken）
  CLI-->>Dev: 完了ログ（件数/URL/モード）

2.2 mcp start フロー

sequenceDiagram
  autonumber
  participant Dev as Developer (CLI)
  participant CLI as mcp(start)
  participant MCP as MCP Server
  participant GAS as GAS WebApp

  Dev->>CLI: npx mcp start
  CLI->>CLI: mcp.tools.json / .mcp-gas.json 読込（無ければ build）
  CLI->>MCP: stdio/TCP サーバ起動
  MCP-->>Dev: ready

  Dev->>MCP: tools.call(name, input)
  alt name === "echo" && 注釈ゼロ由来
    MCP-->>Dev: テスト用レス + 注釈テンプレ
  else 通常ツール
    MCP->>GAS: POST /exec { tool:path, args } + Authorization
    GAS-->>MCP: { ok:true, result } or { ok:false, message }
    MCP-->>Dev: result or error
  end


⸻

3. モジュール設計（Node 側）

3.1 ディレクトリ

/src
  cli.ts               # エントリ: mcp build/start
  generate.ts          # A方式: YAMLブロック抽出 → mcp.tools.json 生成
  discover.ts          # .clasp.json /.clasprc.json → Apps Script API → WebApp URL 検出
  server.ts            # MCP サーバ（stdio/TCP）
  gas-client.ts        # GAS 呼び出し(fetch)
  tools-loader.ts      # mcp.tools.json ロード
  schema.ts            # optional: ajv による schema 検証
  log.ts               # ログラッパ（picocolors）

3.2 主要 I/F（型）

// ツール定義（mcp.tools.json）
export type ToolDef = {
  name: string;
  description?: string;
  path: string;      // GAS 側のルーティングキー（省略時は name を使用）
  schema: any;       // JSON Schema（v2020-12想定）
};

// 接続設定（.mcp-gas.json）
export type GasConfig = {
  gasUrl: string;         // https://script.google.com/macros/s/.../exec
  scriptId: string;
  deploymentId?: string;
  apiToken?: string;      // GAS Script Properties(API_TOKEN) と一致
};

3.3 主要関数

関数	役割	入出力
generateToolsJson(cwd)	A方式スキャン & mcp.tools.json 生成	{ outPath, count }
discoverGASWebAppURL(cwd, {autoDeploy})	WebApp URL 検出（なければ clasp deploy）	{ gasUrl, scriptId, deploymentId }
startServer({ gasUrl, apiToken, toolDefs, transport, port })	MCP サーバ起動（stdio/TCP）	Promise<void>
callGAS(gasUrl, { tool, args, token })	GAS を HTTPS POST で呼び出し	Promise<any>


⸻

4. CLI 仕様

| コマンド | 説明 | 主な処理 | 退出コード |
|—|—|—:|
| mcp build | ツール定義生成 + WebApp URL 検出 | A方式→mcp.tools.json / Apps Script API→.mcp-gas.json | 成功=0 / 失敗≠0 |
| mcp start | MCP サーバ起動 | 設定読込→@modelcontextprotocol/sdk 起動 | 成功=0 / 失敗≠0 |

4.1 環境変数

変数	役割	既定
GAS_API_TOKEN	Authorization 用 Bearer Token（GAS Script Properties と一致）	空（未設定可、GAS 側で不要なら）
MCP_STRICT	1 なら注釈ゼロ時に build 失敗	未設定
MCP_MODE	empty なら注釈ゼロ時に tools: [] 出力	未設定（既定は echo 自動生成）
MCP_TRANSPORT	stdio or tcp	stdio
MCP_TCP_PORT	TCP ポート	3333
MCP_TIMEOUT_MS	GAS 呼び出しタイムアウト	30000
MCP_RETRY	リトライ回数	0
HTTP_PROXY 等	プロキシ	-


⸻

5. A方式（YAML 注釈）→ ツール定義

5.1 GAS ソース記述（例）

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

5.2 生成される mcp.tools.json（抜粋）

{
  "tools": [
    {
      "name": "sheet.appendRow",
      "description": "Append one row to a sheet",
      "path": "sheet.appendRow",
      "schema": {
        "type": "object",
        "properties": {
          "spreadsheetId": { "type": "string" },
          "rangeA1": { "type": "string" },
          "values": {
            "type": "array",
            "items": { "anyOf": [{ "type": "string" }, { "type": "number" }] }
          }
        },
        "required": ["spreadsheetId", "rangeA1", "values"]
      }
    }
  ]
}

5.3 注釈未検出時の生成モード
   •   既定：echo ツール 1 件を自動生成（テスト用／注釈テンプレ返却）
   •   MCP_STRICT=1：エラー終了
   •   MCP_MODE=empty：{"tools":[]} を出力

⸻

6. GAS 側実装

6.1 appsscript.json（例）

{
  "timeZone": "Asia/Tokyo",
  "exceptionLogging": "STACKDRIVER",
  "webapp": { "access": "ANYONE_ANONYMOUS", "executeAs": "USER_DEPLOYING" }
}

6.2 Code.gs ルータ

function doPost(e) {
  try {
    // 認証
    const hdrs = e?.headers || {};
    const auth = hdrs['Authorization'] || hdrs['authorization'] || e?.parameter?.auth || '';
    const token = (auth.startsWith('Bearer ') ? auth.slice(7) : null);
    const props = PropertiesService.getScriptProperties();
    const required = props.getProperty('API_TOKEN');
    if (required && token !== required) return json({ ok:false, message:'unauthorized' });

    // 本体
    const body = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const { tool, args } = body;

    const result = route(tool, args);
    return json({ ok:true, result });
  } catch (err) {
    return json({ ok:false, message:String(err) });
  }
}

function route(tool, args) {
  if (tool === 'sheet.appendRow') return sheet_appendRow(args);
  if (tool === 'drive.search')   return drive_search(args);
  throw new Error('unknown tool: ' + tool);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

6.3 代表ツール例

/* @mcp
name: drive.search
description: Search files in Google Drive
path: drive.search
schema:
  type: object
  properties:
    query: { type: string }
  required: [query]
*/
function drive_search({ query }) {
  const it = DriveApp.searchFiles(query);
  const out = [];
  while (it.hasNext()) {
    const f = it.next();
    out.push({ id:f.getId(), name:f.getName(), url:f.getUrl() });
    if (out.length >= 20) break;
  }
  return out;
}


⸻

7. エラーモデル & ロギング

層	典型エラー	ブリッジの挙動
Generator	YAML パース失敗 / 必須キー不足	該当注釈をスキップ。MCP_STRICT=1 なら終了
Discover	.clasp.json/~/.clasprc.json 不在	明示ログ→終了
Apps Script API	認可エラー / デプロイ未検出	clasp deploy リトライ→失敗なら終了
GAS 呼び出し	HTTP 非200 / { ok:false }	例外化→MCP エラーとして返却
MCP Server	実行時例外	例外を伝播（標準 SDK のエラー応答）

   •   ログレベル：MCP_LOG_LEVEL=debug|info|warn|error（将来拡張）
   •   出力例（info）：
      •   ✔ Generated mcp.tools.json (2 tools)
      •   ✔ WebApp URL: https://script.google.com/.../exec
      •   ⚠ No @mcp annotations found. Generating default echo tool.

⸻

8. セキュリティ設計

項目	設計
認証	Authorization: Bearer <API_TOKEN>。GAS Script Properties の値と一致必須
公開設定	WebApp は ANYONE_ANONYMOUS（Bearer が実質保護）。社外公開を想定しないなら Workspace 内などに変更可
機密	.clasprc.json はローカル限定。CI では GCP SA + Apps Script API を推奨（将来対応）
任意強化	HMAC 署名、Rate Limit、IP 制限、/dev と /exec の使い分け


⸻

9. 生成ファイル仕様

9.1 mcp.tools.json

{
  "tools": [
    {
      "name": "string",
      "description": "string (optional)",
      "path": "string",                // GAS ルーティングキー
      "schema": { /* JSON Schema */ }
    }
  ]
}

9.2 .mcp-gas.json

{
  "gasUrl": "https://script.google.com/macros/s/.../exec",
  "scriptId": "AKfycbx...",
  "deploymentId": "AKfycbx...:XXXX",
  "apiToken": "env:GAS_API_TOKEN or literal"
}


⸻

10. 代表的シーケンス（ツール呼び出し）

sequenceDiagram
  autonumber
  participant Client as MCP Client
  participant Server as gas-mcp-bridge
  participant GAS as GAS WebApp

  Client->>Server: tools.call("drive.search", {query:"title contains 'spec'"})
  Server->>GAS: POST /exec {tool:"drive.search", args:{...}} + Bearer
  GAS-->>Server: {ok:true, result:[{id,name,url},...]}
  Server-->>Client: result


⸻

11. テスト計画（抜粋）

テスト	観点	期待結果
注釈ゼロ→build	既定モード	mcp.tools.json に echo 1 件、mcp start でテンプレ返却
注釈ゼロ→STRICT	MCP_STRICT=1	build エラー終了
注釈ゼロ→empty	MCP_MODE=empty	{"tools":[]} 出力
注釈あり→build	A方式	tools が JSON に反映
start→call→GAS	end-to-end	GAS の戻り値が MCP クライアントへ届く
未デプロイ→build	自動デプロイ	clasp deploy 実行後に URL 取得
認証失敗	Bearer 不一致	{ok:false, message:'unauthorized'} をエラーとして受領


⸻

12. 拡張ポイント
   •   TypeScript 型 → JSON Schema 自動生成（ts-json-schema-generator）
   •   scopes / examples / rateLimit メタの注釈・JSON 透過
   •   ステージング/本番の切替（--channel=dev|prod、/dev URL 対応）
   •   TCP トランスポート（MCP_TRANSPORT=tcp）の本格サポートと TLS 経由
   •   CI で mcp.tools.json の差分検証（スナップショットテスト）

⸻

13. 参考スニペット（Node 側・抜粋）

13.1 server.ts の echo フォールバック

execute: async (input) => {
  if (def.name === 'echo' && def.path === 'echo') {
    return {
      testTool: true,
      note: 'これはテスト用ツールです。/* @mcp ... */ 注釈を追加してから `npx mcp build` を実行してください。',
      inputReceived: input ?? null,
      howToAnnotate: {
        template: [
          '/* @mcp',
          'name: <tool.name>',
          'description: <説明（任意）>',
          'path: <ルーティングキー（省略可）>',
          'schema:',
          '  type: object',
          '  properties:',
          '    <paramA>: { type: string }',
          '  required: [<paramA>]',
          '*/'
        ].join('\n')
      }
    };
  }
  return await callGAS(gasUrl, { tool: def.path, args: input, token: apiToken });
}


⸻

13.2 discover.ts の自動デプロイ方針（擬似）

// 1) list deployments → WEB_APP url 有り? → そのまま採用
// 2) 無ければ execa('npx','clasp','deploy') → 再取得
// 3) 最終的に url 取れなければエラー終了（ヒント付きログ）

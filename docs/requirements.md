要件定義書：GAS × MCP ブリッジ化

1. 背景と目的
   •   Google Apps Script (GAS) を既存の clasp プロジェクトで管理している。
   •   これを MCP (Model Context Protocol) サーバとして簡単に公開できる仕組みが欲しい。
   •   追加学習コストなしに、npx mcp build / start で GAS プロジェクトが MCPクライアントから利用可能なツール群になることを目指す。

⸻

2. 全体アーキテクチャ

[MCPクライアント] ── stdio/TCP ──> [ブリッジ (npmパッケージ)]
                                          │
                                          ▼
                                [GAS WebApp API (clasp)]

   •   ブリッジ (Node.js)
      •   npm パッケージとして提供。
      •   MCP サーバを実装。
      •   MCPクライアントからの呼び出しを GAS WebApp に転送。
   •   GAS WebApp
      •   doPost で JSON を受け、対応する関数を実行。
      •   clasp によるプロジェクト管理。
      •   Script Properties に API_TOKEN を持ち、ブリッジからの呼び出しを認可。

⸻

3. 要件一覧

3.1 ブリッジ (npmパッケージ)
   •   npm パッケージ化
   •   clasp プロジェクトに npm i -D で導入できる。
   •   bin/mcp CLI を提供。

3.2 CLI 機能
   •   mcp build
	1.	.gs/.ts を走査し、A方式 YAML注釈から mcp.tools.json を自動生成。
	2.	.clasp.json と ~/.clasprc.json を参照し、scriptId とトークンを取得。
	3.	Apps Script API で WebApp URL を自動検出/デプロイ。
	4.	.mcp-gas.json に URL・scriptId・API_TOKEN を書き出す。
   •   mcp start
      •   .mcp-gas.json と mcp.tools.json を読み込み。
      •   MCP サーバを stdio/TCP で起動。
      •   ツール呼び出しは GAS WebApp へ転送し、レスポンスを返却。
   •   mcp generate（内部処理）
      •   YAML 注釈を走査し、mcp.tools.json を生成。
      •   mcp build 内で自動実行される。

3.3 ツール定義（A方式 YAML注釈）
   •   GAS 関数に下記形式のコメントを付与：

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
  // ...
}

   •   name と schema は必須。
   •   path が省略された場合は name を利用。

3.4 コメントが無い場合の挙動（3方式）
   •   デフォルト（親切モード）
      •   echo ツールを自動生成。
      •   テスト用であることと 注釈テンプレートを返す。
   •   MCP_STRICT=1 環境変数あり（厳格モード）
      •   注釈が無ければエラー終了。
   •   MCP_MODE=empty 環境変数あり（柔軟モード）
      •   空の tools: [] を生成。

3.5 セキュリティ
   •   GAS WebApp は ANYONE_ANONYMOUS 公開とするが、
Authorization: Bearer <API_TOKEN> による認証を必須とする。
   •   API_TOKEN は Script Properties に保存。

⸻

4. 運用フロー
	1.	clasp プロジェクトを準備

clasp login
clasp create --type webapp --title "my-gas-mcp"


	2.	ブリッジを導入

npm i -D gas-mcp-bridge


	3.	API_TOKEN を設定
      •   GAS スクリプトのプロパティに API_TOKEN を保存。
      •   ローカル環境変数にも設定：

export GAS_API_TOKEN=<同じトークン>


	4.	注釈を書く
      •   GAS ソースコードに /* @mcp ... */ コメントを追加。
	5.	ビルド＆起動

npx mcp build   # mcp.tools.json と .mcp-gas.json を自動生成
npx mcp start   # MCPサーバを起動


	6.	MCPクライアントから接続
      •   Claude や VSCode MCP 拡張から接続 → ツール呼び出し可能。

⸻

5. 例：コメントが無い場合のレスポンス

{
  "testTool": true,
  "note": "これはテスト用ツールです。下のテンプレートに従って @mcp 注釈を書いてください。",
  "inputReceived": { "message": "hello" },
  "howToAnnotate": {
    "template": "/* @mcp\nname: <tool.name>\ndescription: <説明>\npath: <ルーティングキー>\nschema:\n  type: object\n  properties:\n    ...\n  required: [...]\n*/",
    "example": "/* @mcp\nname: sheet.appendRow\n..."
  }
}


⸻

6. 拡張検討（今後の要件候補）
   •   TypeScript の型 → JSON Schema 自動変換 (ts-json-schema-generator)
   •   scopes, examples, rateLimit 等の追加メタ情報対応
   •   CI/CD による mcp.tools.json 差分チェック
   •   GAS 側に「echo」実装を置き、双方向に揃える運用

⸻

✅ これで clasp プロジェクトがそのまま MCP サーバ化できる要件が整理できました。

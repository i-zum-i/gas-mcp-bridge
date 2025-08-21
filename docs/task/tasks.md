進捗フラグの意味
   •   ✅ Done（完了）
   •   🟡 In Progress（作業中）
   •   ⛔ Blocked（ブロック）
   •   ⬜ Todo（未着手）

⸻

タスク一覧（WBS）

列：ID / タスク / 詳細 / 依存 / 成果物 / 状態

A. リポジトリ & パッケージ基盤

ID	タスク	詳細	依存	成果物	状態
A-1	リポジトリ雛形作成	pnpm/npm初期化、src//dist/、TS設定、ESLint、Prettier、commit lint		ルート構成、package.json	⬜
A-2	ライセンス/CI下地	LICENSE(MIT),CODE_OF_CONDUCT.md,CONTRIBUTING.md、GitHub Actions（lint/test/build）	A-1	ルートDocs、.github/workflows	⬜
A-3	NPM公開設定	name: gas-mcp-bridge、bin: { mcp: "./dist/cli.js" }、semantic-release	A-1	公開可能package.json	⬜

B. CLI・コマンド実装

ID	タスク	詳細	依存	成果物	状態
B-1	CLI枠組み	src/cli.ts（mcp build / mcp start）最小実装・ヘルプ表示	A-1	dist/cli.js	⬜
B-2	ログ&終了コード	picocolors導入、成功=0/失敗≠0、明快メッセージ	B-1	統一ログユーティリティ	⬜
B-3	環境変数取り込み	GAS_API_TOKEN, MCP_STRICT, MCP_MODE, MCP_TRANSPORT, MCP_TCP_PORT	B-1	env読み取り処理	⬜

C. A方式ジェネレータ（mcp.tools.json 自動生成）

ID	タスク	詳細	依存	成果物	状態
C-1	YAML抽出ロジック	/* @mcp ... */ ブロック抽出（.gs/.ts、fast-glob、js-yaml）	B-1	src/generate.ts	⬜
C-2	仕様検証	name/schema必須、path省略時はname流用、重複は後勝ち	C-1	バリデーション関数	⬜
C-3	モード分岐(3方式)	注釈ゼロ→①既定echo生成 ②MCP_STRICT=1でエラー ③MCP_MODE=emptyで空	C-1	mcp.tools.json生成	⬜
C-4	JSON Schema検証(任意)	ajvでschema健全性チェック（警告/エラー）	C-2	警告ログ	⬜
C-5	CLI統合	mcp build 内で自動実行・件数/モードをログ	B-1,C-1	生成完了ログ	⬜

D. GAS WebApp URL 自動検出（Apps Script API 連携）

ID	タスク	詳細	依存	成果物	状態
D-1	.clasp.json読取	scriptId取得、存在チェック	B-1	discover.ts	⬜
D-2	~/.clasprc.json読取	OAuth資格情報取り出し	D-1	認証セット	⬜
D-3	APIクライアント	googleapisでprojects.deployments.list呼び出し	D-2	WebApp URL取得	⬜
D-4	自動デプロイ	URL無し時に execa('npx clasp deploy') 実行→再取得	D-3	デプロイ後URL	⬜
D-5	設定出力	.mcp-gas.json へ {gasUrl, scriptId, deploymentId, apiToken}	D-3	.mcp-gas.json	⬜
D-6	例外/ヒント	認証/権限/未デプロイ時の具体的対処ログ	D-3	エラーメッセージ	⬜

E. MCPサーバ実装（ブリッジ本体）

ID	タスク	詳細	依存	成果物	状態
E-1	SDK組込み	@modelcontextprotocol/sdk でstdioサーバ起動	B-1	server.ts	⬜
E-2	TCP対応(任意)	startTcp({port}) オプション、MCP_TRANSPORT切替	E-1	TCP起動	⬜
E-3	ツール登録	mcp.tools.json を動的ロードしてTool化	C-5	ツール一覧登録	⬜
E-4	echoフォールバック	echoはローカル応答（テスト用+注釈テンプレ返却）	C-3	開発支援応答	⬜
E-5	ログ	ツール呼び出し・成功/失敗・実行時間の簡易ログ	E-1	実行ログ	⬜

F. GAS 呼び出しクライアント

ID	タスク	詳細	依存	成果物	状態
F-1	HTTP POST実装	node-fetch で POST /exec、Authorization: Bearer	E-3	gas-client.ts	⬜
F-2	エラー変換	HTTP非200 / {ok:false} をMCPエラー化	F-1	例外処理	⬜
F-3	リトライ/Timeout	MCP_RETRY,MCP_TIMEOUT_MS 反映	F-1	安定化	⬜

G. GAS 側テンプレ（リポジトリ同梱の例示）

ID	タスク	詳細	依存	成果物	状態
G-1	appsscript.json例	webapp.access, executeAs 推奨値の例		サンプルJSON	⬜
G-2	ルータ雛形	doPost 認証/tool/args で分岐・JSON返却		Code.gs例	⬜
G-3	サンプル関数	sheet.appendRow, drive.search, echo（任意）		サンプルコード	⬜
G-4	A方式注釈例	YAMLブロック注釈の最小/応用例		コメント例	⬜

H. ドキュメント

ID	タスク	詳細	依存	成果物	状態
H-1	README(OSS調)	バッジ、Quick Start、注釈、モード、セキュリティ	A-2	README.md	⬜
H-2	FAQ/トラブルシュート	.clasp.json形式差、権限、プロキシ、CI	D系	docs/faq.md	⬜
H-3	開発者ガイド	モジュール構成、I/O、拡張方法	全体	docs/dev.md	⬜

I. テスト & CI

ID	タスク	詳細	依存	成果物	状態
I-1	ユニットテスト	generate, discover, gas-client	C,D,F	vitest/jestテスト	⬜
I-2	スナップショット	mcp.tools.json 生成結果の差分検知	C-5	Snapshots	⬜
I-3	E2E(簡易)	モックGAS(ローカルHTTP) → build/start/call疎通	E,F	e2eスクリプト	⬜
I-4	GitHub Actions	lint/test/build/（任意でrelease）	A-2	.github/workflows	⬜

J. リリース & メンテ

ID	タスク	詳細	依存	成果物	状態
J-1	バージョニング	0.1.0 初期タグ、CHANGELOG 生成	I-1	タグ/CHANGELOG	⬜
J-2	NPM公開	npm publish or semantic-release	J-1	npmパッケージ	⬜
J-3	Issueテンプレ	Bug/Feature/Question テンプレ	A-2	.github/ISSUE_TEMPLATE	⬜


⸻

開発運用（進捗管理テンプレ）

1) イテレーション用チェックリスト（例）
   •   A-1 リポジトリ雛形作成
   •   B-1 CLI枠組み
   •   C-1 YAML抽出ロジック
   •   D-3 WebApp URL検出
   •   E-1 MCPサーバstdio起動
   •   F-1 GAS POST呼び出し
   •   G-2 ルータ雛形追加
   •   I-3 簡易E2E疎通
   •   H-1 README初版

2) Issueテンプレ（例：Feature）

## 概要
{タスクIDと短い説明}

## 受け入れ条件(AC)
- [ ] ログに{...}が出力される
- [ ] {ファイル}が生成される
- [ ] エラー時のメッセージが表示される

## 実装メモ
- 関連: {依存タスク/PR}
- 想定影響範囲: {cli/generator/server}


⸻

受け入れ条件（全体のDefinition of Done）
   •   npx mcp build：
      •   注釈あり → mcp.tools.json に反映、.mcp-gas.json にURL/ID/Token出力。
      •   注釈なし（既定）→ echo 1件生成。
      •   MCP_STRICT=1 → 注釈ゼロでエラー終了。
   •   npx mcp start：
      •   stdioでMCPサーバ起動、echoはテンプレを返す。
      •   注釈ツールはGASにPOSTされ、結果がMCPクライアントに返る。
   •   代表的なエラーで具体的な対処ヒントがログに出る。
   •   README・FAQが整備され、最小E2Eが通る。

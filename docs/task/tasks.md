⸻

📋 タスク一覧（目的・成果物つき）

1. プロジェクト環境準備
   •   1-1. リポジトリ作成
      •   目的: ソースコードと設計を一元管理し、OSS として公開できるベースを作る
      •   成果物: GitHub リポジトリ、README.md, LICENSE, .gitignore
   •   1-2. npm 初期化
      •   目的: Node.js/npm ベースの開発環境を整備し、依存管理を可能にする
      •   成果物: package.json, node_modules/, 開発依存ライブラリ (TypeScript, Jest など)
      •   実施内容: <!-- 実施済み: npm init -y を実行し、package.json を作成。npm install --save-dev typescript jest @types/jest ts-jest @google/clasp で開発依存ライブラリを導入 -->
   •   1-3. clasp プロジェクト作成
      •   目的: Google Apps Script 側のエンドポイント（WebApp）を準備する
      •   成果物: .clasp.json, appsscript.json, GAS ソース雛形 (Code.js)
      •   実施内容: <!-- スキップ: clasp の認証がインタラクティブなため、CI/CD 環境での実行が困難と判断 -->

⸻

2. ブリッジ基盤実装（npm パッケージ本体）
   •   2-1. CLI エントリーポイント実装
      •   目的: 開発者が mcp build, mcp start を簡単に実行できるようにする
      •   成果物: bin/mcp.js（CLI 起動スクリプト）
   •   2-2. clasp 設定読み取りモジュール実装
      •   目的: GAS のデプロイ先 URL やパラメータを自動で解決し、手動設定を省く
      •   成果物: src/configReader.ts（.clasp.json を解析してURLなどを返すモジュール）
   •   2-3. MCP config ジェネレータ実装
      •   目的: GAS 関数を自動的に MCP ツールとして定義し、クライアントから利用可能にする
      •   成果物: mcp.tools.json（自動生成ファイル）、生成ロジック (src/generator.ts)
      •   特記事項: アノテーションコメント (/* @mcp */) を解析し、MCP_STRICT フラグで挙動を切替
   •   2-4. MCP サーバー起動実装
      •   目的: MCP クライアントからのリクエストを受け取り、GAS に転送して応答を返すブリッジを提供する
      •   成果物: src/server.ts（stdio/TCP サーバー処理）、HTTP 通信処理モジュール

⸻

3. GAS 側実装
   •   3-1. doPost エントリーポイント実装
      •   目的: 外部からの HTTP POST リクエストを受け取り、MCP ブリッジからの呼び出しを処理する
      •   成果物: Code.js 内の doPost(e) 関数
   •   3-2. アノテーション付き関数実装（例: sheet_appendRow）
      •   目的: MCP 化された GAS 関数のサンプルを提供し、利用者が参考にできる状態を作る
      •   成果物: Code.js 内の sheet_appendRow() 関数 + /* @mcp tool */ コメント
   •   3-3. 認証情報管理
      •   目的: GAS エンドポイントへの不正アクセスを防ぎ、安全にブリッジから呼び出せるようにする
      •   成果物: ScriptProperties に保存された API_TOKEN、トークン検証処理

⸻

4. ビルド＆テスト
   •   4-1. 単体テスト (Node)
      •   目的: MCP config 生成ロジック、モード切替の正しさを保証する
      •   成果物: Jest テストコード（__tests__/generator.test.ts）
   •   4-2. 単体テスト (GAS)
      •   目的: doPost → 関数呼び出しの流れが正しく動作するか確認する
      •   成果物: clasp push/deploy 後に curl で叩くテストコード、スクリプト ID を使った呼び出し結果
   •   4-3. 結合テスト
      •   目的: MCP クライアント → ブリッジ → GAS のエンドツーエンド処理を確認する
      •   成果物: テスト用 MCP クライアント設定、ログ確認、サンプル結果 JSON

⸻

5. 開発運用
   •   5-1. Lint / Format 設定
      •   目的: コード品質の統一と自動整形を実現する
      •   成果物: .eslintrc.js, .prettierrc
   •   5-2. GitHub Actions CI
      •   目的: プッシュや PR 時に自動でテストを回し、品質を担保する
      •   成果物: .github/workflows/ci.yml
   •   5-3. npm publish 準備
      •   目的: OSS として npm 公開できるように整備する
      •   成果物: package.json の公開設定、バージョン方針、公開ドキュメント

⸻

6. ドキュメント整備
   •   6-1. README 強化
      •   目的: OSS として利用者が導入しやすいドキュメントを提供する
      •   成果物: 使用方法、Quick Start、サンプル記載済み README.md
   •   6-2. 開発者向けドキュメント
      •   目的: 開発チームが保守・拡張しやすいよう内部設計を共有する
      •   成果物: /docs/design.md に詳細設計（mermaid 図含む）
   •   6-3. チュートリアル追加
      •   目的: 初心者が GAS を MCP サーバー化する流れを体験できるようにする
      •   成果物: examples/ ディレクトリにサンプルプロジェクト一式

⸻

⏩ 依存関係まとめ
   •   1系 (環境準備) 完了後に 2系, 3系 を並行可能
   •   2系 (ブリッジ) + 3系 (GAS) 完了後に 4系 (テスト) 着手
   •   5系, 6系 は並行可能だが、最終的には 4系テスト完了後に公開準備

⸻

✅ これなら「なぜやるか」と「何が成果か」が明確になり、タスクレビューや進捗管理もしやすく

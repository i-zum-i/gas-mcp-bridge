機能一覧（GAS × MCP ブリッジ）

A. パッケージ/配布
   •   A1. npmパッケージ提供（Must）
      •   gas-mcp-bridge として配布。bin/mcp を同梱。
   •   A2. clasp プロジェクトへのローカル導入（Must）
      •   npm i -D gas-mcp-bridge で既存の GAS（clasp）プロジェクトに追加可能。
   •   A3. npmスクリプト自動追記（任意）（May）
      •   postinstall で package.json に mcp:start / mcp:build を追記（ユーザー選択式）。

B. CLI コマンド
   •   B1. mcp build（Must）
      •   B1-1. A方式スキャン：.gs/.ts を走査し /* @mcp ... */ YAML注釈から mcp.tools.json 自動生成。
      •   B1-2. WebApp URL 自動検出：.clasp.json（scriptId） と ~/.clasprc.json（認証） から Apps Script API を呼び出し、最新デプロイの WebApp URL（/exec） を取得。
      •   B1-3. 自動デプロイ：WebApp デプロイ未検出時は clasp deploy を実行し再取得。
      •   B1-4. 設定出力：.mcp-gas.json に gasUrl/scriptId/deploymentId/apiToken を保存。apiToken は環境変数 GAS_API_TOKEN を採用。
      •   B1-5. 出力ログ：生成件数、URL、モード（strict/empty/echo）を明示。
   •   B2. mcp start（Must）
      •   B2-1. 設定読込：.mcp-gas.json と mcp.tools.json を読込、無ければ build を自動実行。
      •   B2-2. サーバ起動：MCP サーバ（標準は stdio、オプションで TCP）。
      •   B2-3. リクエスト中継：MCP ツール呼び出しを GAS WebApp に HTTP POST で転送、結果をクライアントへ返却。
      •   B2-4. ローカル echo 分岐：echo 定義時は GAS を呼ばず、テスト用＋注釈テンプレをローカル応答。
   •   B3. mcp generate（内部/隠しまたは公開）（Should）
      •   build 内で自動実行。単独実行にも対応可能。

C. ツール定義（A方式 YAML注釈）
   •   C1. YAMLブロック注釈（Must）
      •   name / schema（必須）、description / path（任意）。path 省略時は name を流用。
   •   C2. 重複処理（Should）
      •   name キーで後勝ちマージ。
   •   C3. スキーマ妥当性（May）
      •   生成時に JSON Schema 検証（ajv）の警告/エラー表示。

D. コメント未検出時の挙動（3方式）
   •   D1. 親切モード（デフォルト）（Must）
      •   mcp.tools.json に echo ツールを1件生成。
      •   サーバ実行時、echo は テスト用である旨と 注釈テンプレ＋例を返す。
   •   D2. 厳格モード（Should）
      •   MCP_STRICT=1 npx mcp build で注釈が無ければ エラー終了。
   •   D3. 空モード（Should）
      •   MCP_MODE=empty npx mcp build で {"tools":[]} を生成。

E. GAS 呼び出しアダプタ
   •   E1. HTTP POST 呼び出し（Must）
      •   headers: { 'Content-Type':'application/json', 'Authorization':'Bearer <API_TOKEN>' }。
      •   body: { tool: <path>, args: <payload> }。
   •   E2. 失敗時の扱い（Must）
      •   HTTP 非200、{ ok:false, message } は MCP 側で適切なエラーに変換。
   •   E3. タイムアウト/リトライ（Should）
      •   リトライ回数/待機時間は環境変数で調整可能に（例：MCP_RETRY=2、MCP_TIMEOUT_MS=30000）。

F. MCP サーバ
   •   F1. stdio 起動（Must）
      •   既定は stdio。Claude/VSCode MCP 互換。
   •   F2. TCP 起動（任意ポート）（Should）
      •   --tcp or 環境変数で有効化、MCP_TCP_PORT 指定。
   •   F3. ログ出力（Should）
      •   起動/停止/ツール実行/エラーを簡潔に出力。MCP_LOG_LEVEL で制御。

G. セキュリティ
   •   G1. API トークン（Must）
      •   GAS 側 Script Properties に API_TOKEN。
      •   ブリッジは Authorization: Bearer を必須付与。
   •   G2. WebApp 公開設定（Must）
      •   ANYONE_ANONYMOUS で公開。ただし トークン検証で実質的に保護。
   •   G3. 追加保護（任意）（May）
      •   HMAC 署名、Rate Limit、IP アロウリスト等の拡張余地を確保。

H. 設定/自動検出
   •   H1. .clasp.json 解析（Must）
      •   scriptId の取得。
   •   H2. ~/.clasprc.json 解析（Must）
      •   OAuth 資格情報の読み取り。Apps Script API クライアントへセット。
   •   H3. Apps Script API 操作（Must）
      •   projects.deployments.list により WebApp URL 取得。
      •   未デプロイ時は clasp deploy 実行 → 再取得。
   •   H4. 出力ファイル（Must）
      •   mcp.tools.json、.mcp-gas.json の生成/更新。

I. GAS 側最小実装（ガイド）
   •   I1. ルーター雛形（Should）
      •   doPost で Authorization / tool / args を受け取り、関数ディスパッチ。
   •   I2. 例：sheet.appendRow / drive.search（Should）
      •   README/テンプレに収録。
   •   I3. echo（任意）（May）
      •   GAS 側にも echo を置く運用方針も提示（ただしブリッジ単体で完結可）。

J. エラーハンドリング/UX
   •   J1. 明快な CLI メッセージ（Must）
      •   見つからないファイル、権限不足、API 失敗、デプロイ失敗等で原因/対処を表示。
   •   J2. フェイルセーフ（Should）
      •   設定ファイルが欠損しても build が修復を試みる。
   •   J3. 退出コード（Must）
      •   CI で扱える終了コード（成功0、エラー≠0）。

K. 開発者体験（DX）
   •   K1. 1コマンド体験（Must）
      •   npx mcp build → npx mcp start。
   •   K2. ドキュメント/README（Must）
      •   特徴、導入、注釈の書き方、モード、セキュリティ、FAQ。
   •   K3. 例外系 FAQ（Should）
      •   ~/.clasprc.json が複数アカウント/形式差のときの対処、プロキシ環境など。

L. 互換性/将来拡張
   •   L1. TypeScript からのスキーマ自動生成（May）
      •   ts-json-schema-generator 連携の余地。
   •   L2. メタ拡張（May）
      •   注釈で scopes / examples / rateLimit を記述→mcp.tools.json にパススルー。
   •   L3. ステージング/本番 URL 切替（May）
      •   --channel=dev|prod 等でデプロイ切替。
   •   L4. ストリーミング表現（検討）
      •   GAS はストリーミング不可のため、MCP への段階出力は Node側で分割応答として表現（将来検討）。

M. テスト/デバッグ
   •   M1. ローカル E2E テスト（Should）
      •   モック GAS（ローカル JSON エコー）で CLI の疎通確認が可能。
   •   M2. echo コマンドテスト（Must）
      •   注釈テンプレの返却確認。
   •   M3. スナップショットテスト（May）
      •   mcp.tools.json 生成結果の差分検知。

⸻

受け入れ基準（抜粋）
   •   npm i -D gas-mcp-bridge 後、注釈ゼロのプロジェクトで
      •   npx mcp build が成功し、mcp.tools.json に echo が1件出力される。
      •   npx mcp start で MCP サーバが起動し、クライアントから echo が呼べる。
   •   A方式注釈を1件追加し、npx mcp build 後に mcp.tools.json にそのツールが反映され、正常に GAS が呼ばれる。
   •   MCP_STRICT=1 npx mcp build で、注釈ゼロの状態はエラー終了する。
   •   デプロイのない GAS でも mcp build が clasp deploy を自動実行し、URL を取得できる。

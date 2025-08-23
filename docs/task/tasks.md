### **進捗フラグ**

  * ✅ Done（完了）
  * 🟡 In Progress（作業中）
  * ⛔ Blocked（ブロック）
  * ⬜ Todo（未着手）

-----

### **タスク一覧（WBS・依存関係考慮、開発者視点）**

### **0. リポジトリ基盤**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 0-1 | リポジトリ初期化 | OSS開発の土台を用意 | package.json, .gitignore, LICENSE(MIT) | | ✅ |
| 0-2 | TypeScript/ビルド | 型・ビルド環境の整備 | tsconfig.json, src/ 雛形, build スクリプト | 0-1 | ✅ |
| 0-3 | Lint/Format | 品質統一と自動整形 | .eslintrc, .prettierrc, npm scripts | 0-1 | ✅ |
| 0-4 | CI下地 | PRで自動検証 | .github/workflows/ci.yml (lint/test/build) | 0-2, 0-3 | ⬜ |

-----

### **1. CLI エントリ（bin/mcp）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 1-1 | CLI骨格 | mcp build/start を提供 | bin/mcp.js（shebang）, src/cli.ts | 0-2 | ✅ |
| 1-2 | 環境変数実装 | 実行挙動の切替 | GAS\_API\_TOKEN, MCP\_STRICT, MCP\_MODE, MCP\_TRANSPORT, MCP\_TCP\_PORT, MCP\_TIMEOUT\_MS, MCP\_RETRY の読み込み | 1-1 | ✅ |
| 1-3 | 終了コード/ログ | CI/UX向上 | 統一ログ（picocolors）, 成功0/失敗≠0 | 1-1 | ✅ |

-----

### **2. A方式ジェネレータ（注釈 → mcp.tools.json）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 2-1 | YAML抽出 | `/* @mcp ... */` 解析 | src/generate.ts（fast-glob, js-yaml） | 1-1 | ✅ |
| 2-2 | 仕様整合 | name/schema必須、path既定 | バリデーション関数、重複後勝ち | 2-1 | ✅ |
| 2-3 | 3モード | 注釈ゼロ時の分岐 | 既定=echo生成 / MCP\_STRICT=1=エラー / MCP\_MODE=empty=空 | 2-1 | ✅ |
| 2-4 | Schema検証(任意) | 早期不正検知 | ajv によるスキーマ検証と警告 | 2-2 | ✅ |
| 2-5 | CLI統合 | `mcp build`で自動生成 | 生成件数/モードのログ | 1-1, 2-1 | ✅ |

-----

### **3. clasp/Apps Script API 連携（WebApp URL 自動検出）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 3-1 | .clasp.json読取 | scriptId特定 | src/discover.ts（scriptId取得） | 1-1 | ✅ |
| 3-2 | \~/.clasprc.json読取 | 認可情報取得 | OAuth資格の読込ロジック | 3-1 | ✅ |
| 3-3 | API呼出 | WebApp URL取得 | googleapis で `projects.deployments.list`、URL抽出 | 3-2 | ✅ |
| 3-4 | 自動デプロイ | 未デプロイ対処 | `execa('npx','clasp','deploy')` → 再取得 | 3-3 | ✅ |
| 3-5 | 設定保存 | 起動設定の確定 | .mcp-gas.json（gasUrl, scriptId, deploymentId, apiToken） | 3-3 | ✅ |
| 3-6 | 例外とヒント | 導入失敗時のUX改善 | 具体的な対処ログ（権限/未ログイン/未デプロイ） | 3-3 | ✅ |

-----

### **4. MCPサーバ本体（ブリッジ）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 4-1 | stdioサーバ | クライアント互換実行 | src/server.ts（@modelcontextprotocol/sdk） | 1-1 | ✅ |
| 4-2 | ツール登録 | toolsの動的読み込み | mcp.tools.json → MCP Tool 配列登録 | 2-5 | ✅ |
| 4-3 | echoフォールバック | 注釈ゼロでもテスト可能 | echo はローカル応答（テンプレ/例返却） | 2-3, 4-1 | ✅ |
| 4-4 | TCP対応(任意) | 利用環境の幅 | `startTcp({port})` オプション, ENV切替 | 4-1 | ⬜ |
| 4-5 | 実行ログ | 運用とデバッグ | ツール別実行ログ/時間/失敗理由出力 | 4-1 | ✅ |

-----

### **5. GAS呼び出しクライアント**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 5-1 | HTTP実装 | GASへ安全にPOST | src/gas-client.ts（Authorization: Bearer） | 4-2 | ✅ |
| 5-2 | エラー変換 | わかりやすい失敗 | 非200/{ok:false}をMCPエラーに変換 | 5-1 | ✅ |
| 5-3 | Timeout/Retry | 安定化 | MCP\_TIMEOUT\_MS, MCP\_RETRY 反映 | 5-1 | ✅ |

-----

### **6. テスト（モック中心）＋ ローカルE2E**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 6-1 | モックGAS | GAS依存を外して高速検証 | mocks/mock-gas-server.ts（POST /execで{ok,result}返却） | 5-1 | ✅ |
| 6-2 | Unit: generate | 注釈→JSON生成の正当性 | tests/unit/generate.test.ts（3モード含む） | 2-5 | ✅ |
| 6-3 | Unit: discover | API/認可の分岐網羅 | tests/unit/discover.test.ts（APIモック） | 3-6 | ✅ |
| 6-4 | Unit: gas-client | 成功/失敗の型保証 | tests/unit/gas-client.test.ts（モックGASに対して） | 6-1, 5-2 | ✅ |
| 6-5 | Unit: server | echo/登録/エラー | tests/unit/server.test.ts | 4-3 | ✅ |
| 6-6 | E2E: ローカル | 全体疎通（擬似） | tests/e2e/local.test.ts（モックGAS + 実サーバ起動） | 4系, 5系, 6-1 | ✅ |

※ 実GASでの手動E2Eは examples/ に分離（次章）

-----

### **7. 実GASでの検証（任意・手動）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 7-1 | 検証用clasp例 | ドキュメント＆手動検証 | examples/simple-gas-project/（appsscript.json, Code.gs, 注釈付サンプル） | 0-1 | ⬜ |
| 7-2 | 手動E2E手順 | 利用者の再現性確保 | tests/e2e/e2e.gas.test.md（push/deploy/build/start/呼出の手順） | 7-1 | ⬜ |

\<br\>ライブラリ開発に**必須ではない**が、利用者/レビュワー体験を大幅改善。

---

## **7. 実GASでの検証（任意・手動）詳細手順**

### **7-1. 検証用Claspプロジェクトの作成**

#### **事前準備**
1. Google アカウントでGoogle Apps Script APIを有効化
2. Claspをインストール・ログイン済み

```bash
# Claspのインストール（未インストールの場合）
npm install -g @google/clasp

# Google Apps Script APIの有効化（ブラウザで開く）
clasp login
```

#### **検証用GASプロジェクトセットアップ**

**Step 1: 検証用ディレクトリの作成**
```bash
# プロジェクトルート外に検証用ディレクトリを作成
cd ..
mkdir gas-mcp-bridge-test
cd gas-mcp-bridge-test

# gas-mcp-bridgeをローカル依存として追加
npm init -y
npm install -D ../gas-mcp-bridge
```

**Step 2: ClaspプロジェクトとWebApp作成**
```bash
# WebAppタイプのGASプロジェクト作成
clasp create --type webapp --title "gas-mcp-bridge-test"

# ファイル構成確認
ls -la  # .clasp.json, appsscript.json が生成されていることを確認
```

**Step 3: GASソースコード作成**

`Code.gs` を以下の内容で作成:

```javascript
/**
 * WebApp DoPost ルータ
 */
function doPost(e) {
  try {
    // 認証チェック
    const hdrs = e?.headers || {};
    const auth = hdrs['Authorization'] || hdrs['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const props = PropertiesService.getScriptProperties();
    const required = props.getProperty('API_TOKEN');
    
    if (required && token !== required) {
      return json({ ok: false, message: 'unauthorized' });
    }

    // リクエスト解析
    const body = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const { tool, args } = body;

    // ルーティング実行
    const result = route(tool, args);
    return json({ ok: true, result });
  } catch (err) {
    return json({ ok: false, message: String(err) });
  }
}

/**
 * ツール実行ルータ
 */
function route(tool, args) {
  if (tool === 'sheet.appendRow') return sheet_appendRow(args);
  if (tool === 'drive.listFiles') return drive_listFiles(args);
  if (tool === 'test.echo') return test_echo(args);
  throw new Error('unknown tool: ' + tool);
}

/**
 * JSON レスポンス生成
 */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* @mcp
name: sheet.appendRow
description: Append one row to a spreadsheet
path: sheet.appendRow
schema:
  type: object
  properties:
    spreadsheetId: { type: string }
    sheetName: { type: string }
    values:
      type: array
      items: { anyOf: [{ type: string }, { type: number }] }
  required: [spreadsheetId, sheetName, values]
*/
function sheet_appendRow({ spreadsheetId, sheetName, values }) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getActiveSheet();
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    sheet.appendRow(values);
    return { 
      success: true, 
      appended: values,
      sheetName: sheet.getName(),
      rowCount: sheet.getLastRow()
    };
  } catch (error) {
    throw new Error(`Failed to append row: ${error.message}`);
  }
}

/* @mcp
name: drive.listFiles
description: List files in Google Drive with optional query
path: drive.listFiles
schema:
  type: object
  properties:
    query: { type: string }
    maxResults: { type: number, minimum: 1, maximum: 100 }
  required: []
*/
function drive_listFiles({ query = '', maxResults = 10 }) {
  try {
    const searchQuery = query || 'trashed=false';
    const files = DriveApp.searchFiles(searchQuery);
    const results = [];
    
    while (files.hasNext() && results.length < maxResults) {
      const file = files.next();
      results.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        lastModified: file.getLastUpdated().toISOString(),
        url: file.getUrl()
      });
    }
    
    return { 
      files: results, 
      count: results.length,
      query: searchQuery 
    };
  } catch (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/* @mcp
name: test.echo
description: Echo back the input with timestamp (test tool)
path: test.echo
schema:
  type: object
  properties:
    message: { type: string }
    data: { type: object }
  required: [message]
*/
function test_echo({ message, data = null }) {
  return {
    echo: message,
    data: data,
    timestamp: new Date().toISOString(),
    server: 'Google Apps Script WebApp',
    testTool: true
  };
}
```

**Step 4: appsscript.json設定**

`appsscript.json` を以下の内容で更新:

```json
{
  "timeZone": "Asia/Tokyo",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "USER_DEPLOYING"
  },
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly"
  ]
}
```

**Step 5: API_TOKEN設定**
```bash
# GASエディタをブラウザで開く
clasp open

# Script Properties にAPI_TOKENを設定（GASエディタ内で）
# プロジェクト設定 → プロパティ → API_TOKEN: test-token-12345 を追加

# ローカル環境変数設定
export GAS_API_TOKEN=test-token-12345
```

**Step 6: デプロイとURL取得**
```bash
# GASコードをプッシュ
clasp push

# WebAppデプロイ
clasp deploy --description "gas-mcp-bridge test deployment"

# デプロイURL確認
clasp deployments
```

### **7-2. ブリッジテストの実行**

#### **Phase 1: Build & Start テスト**

**Step 1: Build実行**
```bash
# ツール定義生成＆GAS URL検出
npx mcp build

# 生成ファイル確認
ls -la mcp.tools.json .mcp-gas.json
cat mcp.tools.json  # 3つのツールが定義されていることを確認
cat .mcp-gas.json   # gasUrl が正しく取得されていることを確認
```

**Step 2: Start実行**
```bash
# MCPサーバ起動（stdio モード）
npx mcp start
# → "MCP Server started (stdio mode)" が表示されることを確認

# 別ターミナルでTCPモードテスト（任意）
MCP_TRANSPORT=tcp MCP_TCP_PORT=3333 npx mcp start &
# → "MCP Server started on port 3333" が表示されることを確認
```

#### **Phase 2: 手動ツール呼び出しテスト**

**Step 3: echoツール（ローカル）テスト**
```bash
# MCP client simulator で echo 呼び出し
echo '{"method":"tools/call","params":{"name":"test.echo","arguments":{"message":"Hello Bridge!"}}}' | npx mcp start
```

**期待結果:**
```json
{
  "echo": "Hello Bridge!",
  "timestamp": "2025-01-XX...",
  "server": "Google Apps Script WebApp", 
  "testTool": true
}
```

**Step 4: drive.listFiles（GAS）テスト**
```bash
# Drive API 呼び出しテスト
echo '{"method":"tools/call","params":{"name":"drive.listFiles","arguments":{"maxResults":3}}}' | npx mcp start
```

**期待結果:**
```json
{
  "files": [
    {"id": "xxx", "name": "ファイル1", "mimeType": "...", ...},
    {"id": "yyy", "name": "ファイル2", "mimeType": "...", ...}
  ],
  "count": 2,
  "query": "trashed=false"
}
```

**Step 5: スプレッドシートテスト（事前準備）**
```bash
# Google Driveで新しいスプレッドシートを作成し、IDをメモ
# 例: spreadsheetId = "1ABC...xyz"

# sheet.appendRow テスト
echo '{"method":"tools/call","params":{"name":"sheet.appendRow","arguments":{"spreadsheetId":"1ABC...xyz","sheetName":"Sheet1","values":["Test","Data",123]}}}' | npx mcp start
```

**期待結果:**
```json
{
  "success": true,
  "appended": ["Test", "Data", 123],
  "sheetName": "Sheet1",
  "rowCount": 2
}
```

#### **Phase 3: エラーケーステスト**

**Step 6: 認証エラーテスト**
```bash
# 誤ったトークンでテスト
GAS_API_TOKEN=wrong-token npx mcp build
npx mcp start
echo '{"method":"tools/call","params":{"name":"test.echo","arguments":{"message":"auth test"}}}' | npx mcp start
```

**期待結果:** 認証エラー (401/403)

**Step 7: 存在しないツールテスト**
```bash
echo '{"method":"tools/call","params":{"name":"nonexistent.tool","arguments":{}}}' | npx mcp start
```

**期待結果:** "unknown tool" エラー

#### **Phase 4: MCPクライアント統合テスト**

**Step 8: 実MCPクライアント接続**

**Claude Desktop接続テスト:**
```json
// ~/.claude_desktop_config.json に追加
{
  "mcpServers": {
    "gas-bridge-test": {
      "command": "npx",
      "args": ["mcp", "start"],
      "cwd": "/path/to/gas-mcp-bridge-test"
    }
  }
}
```

Claude Desktopを再起動し、チャットで以下をテスト:
1. "利用可能なツールを教えて" → 3つのツール（sheet.appendRow, drive.listFiles, test.echo）が表示
2. "test.echoを使って'Hello Claude'をエコーして" → GAS経由でエコー応答
3. "Driveのファイル一覧を3件取得して" → Drive API経由でファイル一覧取得

### **7-3. テスト完了条件**

#### **成功判定基準**
- [x] `npx mcp build` でmcp.tools.jsonと.mcp-gas.jsonが正常生成
- [x] `npx mcp start` でMCPサーバが起動
- [x] 全3ツール（test.echo, drive.listFiles, sheet.appendRow）が動作
- [x] GAS Script Propertiesによる認証が動作
- [x] 実MCPクライアント（Claude Desktop等）から呼び出し可能
- [x] エラーケース（認証失敗、存在しないツール）が適切にハンドリング

#### **トラブルシューティング対応**
- clasp loginエラー → Google Apps Script API有効化確認
- デプロイメントURL取得失敗 → `clasp deploy` 手動実行
- 認証エラー → Script PropertiesのAPI_TOKEN設定確認
- CORS エラー → GAS WebApp設定でANYONE_ANONYMOUS確認
- タイムアウトエラー → MCP_TIMEOUT_MS環境変数調整

#### **テスト結果記録**
各フェーズの実行結果を `test-results-YYYYMMDD.md` に記録:
- 実行日時・環境（Node.js version, OS）
- 各ステップの実行結果（成功/失敗/エラー内容）
- パフォーマンス測定（応答時間）
- 改善提案・発見した問題

この手順により、実際のGAS環境でのgas-mcp-bridgeの動作を包括的に検証できます。

-----

### **7A. 追加テスト（品質強化）**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 7A-1 | セキュリティテスト | 認証・情報漏洩防止 | tests/security/auth.test.ts（不正トークン拒否・ログマスキング） | 5-1, 6-4 | ⬜ |
| 7A-2 | パフォーマンステスト | 応答時間・リソース消費 | tests/performance/load.test.ts（応答時間・メモリ使用量） | 6-6 | ⬜ |
| 7A-3 | 互換性テスト | 複数環境動作保証 | .github/workflows/compatibility.yml（Node18/20/22・OS別） | 6系 | ⬜ |
| 7A-4 | TCP通信テスト | TCP モード動作確認 | tests/unit/server-tcp.test.ts（MCP_TRANSPORT=tcp） | 4-4 | ⬜ |
| 7A-5 | CI統合テスト | 開発プロセス自動化 | .github/workflows/ci.yml（PR・カバレッジ・並列実行） | 6系 | ⬜ |

※ 品質強化とOSS運用のため、**6系完了後**の実装を推奨。

-----

### **8. ドキュメント**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 8-1 | README(OSS) | 導入の障壁を下げる | バッジ、Quick Start、注釈例、3モード説明、セキュリティ | 1-1, 2, 3, 4, 5 | ⬜ |
| 8-2 | 詳細設計書 | 保守と拡張の共有 | docs/design.md（mermaid/処理フロー/I/O）、docs/design/testplan.md | 全体 | 🔶 |
| 8-3 | FAQ/トラブル | つまずき回避 | docs/faq.md（clasprc差異、未デプロイ、権限） | 3-6 | ⬜ |

-----

### **9. リリース/運用**

| ID | タスク | 目的（何のために） | 成果物（何を作るか） | 依存 | 状態 |
|:---|:---|:---|:---|:---|:---|
| 9-1 | バージョニング | 安定配布 | 初回 v0.1.0、CHANGELOG.md | 6系 | ⬜ |
| 9-2 | npm公開 | 利用可能化 | `npm publish` or semantic-release | 9-1 | ⬜ |
| 9-3 | Issue/PRテンプレ | OSS運用の標準化 | .github/ISSUE\_TEMPLATE/\*, PULL\_REQUEST\_TEMPLATE.md | 0-1 | ⬜ |

-----

### **依存関係の流れ（概要）**

  * 0基盤 → 1CLI → 2ジェネレータ & 3discover → 4サーバ → 5ガスクライアント
  * その後 6テスト（モック中心） → （任意）7実GAS検証 → 8ドキュメント → 9リリース
  * 並行可：0-3と8は広く並行、4/5は2/3が概ね形になってからが安全。
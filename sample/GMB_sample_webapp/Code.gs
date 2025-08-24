// ====== 設定 ======
const TZ = 'Asia/Tokyo';
const PROP_SHEET_ID = 'SPREADSHEET_ID';  // Script Properties に設定
const PROP_SHEET_NAME = 'SHEET_NAME';    // 任意（未設定なら先頭シート）

/**
 * Web アプリのエントリ（GET）
 * 例: https://script.google.com/.../exec/2025/08/01
 * パス: /YYYY/MM/DD
 */
function doGet(e) {
  try {
    const path = (e && e.pathInfo) ? String(e.pathInfo) : '';
    const cleaned = path.replace(/^\//, '');
    if (!cleaned) {
      return json(400, { ok: false, error: 'Path must be /YYYY/MM/DD' });
    }

    const [YYYY, MM, DD] = cleaned.split('/');
    if (!/^\d{4}$/.test(YYYY) || !/^\d{2}$/.test(MM) || !/^\d{2}$/.test(DD)) {
      return json(400, { ok: false, error: 'Invalid path format. Use /YYYY/MM/DD' });
    }

    // JSTで厳密解釈（例: 2025/02/30 を弾く）
    const y = Number(YYYY), m = Number(MM), d = Number(DD);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || (date.getUTCMonth() + 1) !== m || date.getUTCDate() !== d) {
      return json(400, { ok: false, error: 'Invalid date value' });
    }
    const targetYmd = Utilities.formatDate(date, TZ, 'yyyy/MM/dd');

    // シート参照
    const props = PropertiesService.getScriptProperties();
    const spreadsheetId = props.getProperty(PROP_SHEET_ID);
    if (!spreadsheetId) {
      return json(500, { ok: false, error: 'Script Property SPREADSHEET_ID not set' });
    }
    const sheetName = props.getProperty(PROP_SHEET_NAME);
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    if (!sheet) {
      return json(500, { ok: false, error: 'Sheet not found' });
    }

    // A:日付, B:時間, C:予約名 をまとめて取得
    const lastRow = sheet.getLastRow();
    if (lastRow < 1) {
      return json(404, { ok: false, error: 'No data' });
    }
    const rng = sheet.getRange(1, 1, lastRow, 3); // A:C
    const values = rng.getValues(); // [[A1,B1,C1], [A2,B2,C2], ...]

    // 同一日付の「B+C」を収集（「時間 予約名」のフォーマットで返す）
    const hits = [];
    for (let i = 0; i < values.length; i++) {
      const a = values[i][0]; // 日付
      const b = values[i][1]; // 時間
      const c = values[i][2]; // 予約名

      const key = normalizeToYmd(a);
      if (!key) continue;
      if (key === targetYmd) {
        const time = normalizeToHm(b);   // 'HH:mm'
        const name = (c == null) ? '' : String(c).trim();
        hits.push(`${time} ${name}`.trim());
      }
    }

    if (hits.length === 0) {
      return json(404, { ok: false, error: 'Not found', date: targetYmd });
    }

    // 返却: カンマ区切り文字列（要求仕様）
    const joined = hits.join(',');
    return json(200, { ok: true, date: targetYmd, value: joined, count: hits.length, items: hits });
  } catch (err) {
    return json(500, { ok: false, error: String(err && err.message || err) });
  }
}

/**
 * Web アプリのエントリ（POST）- MCP Bridge用
 */
function doPost(e) {
  try {
    // 認証チェック（任意）
    const hdrs = e?.headers || {};
    const auth = hdrs['Authorization'] || hdrs['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const props = PropertiesService.getScriptProperties();
    const required = props.getProperty('API_TOKEN');
    
    if (required && token !== required) {
      return json(401, { ok: false, message: 'unauthorized' });
    }

    // リクエスト解析
    const body = e.postData?.contents ? JSON.parse(e.postData.contents) : {};
    const { tool, args } = body;

    // ルーティング実行
    const result = route(tool, args);
    return json(200, { ok: true, result });
  } catch (err) {
    return json(500, { ok: false, message: String(err && err.message || err) });
  }
}

/**
 * ツール実行ルータ
 */
function route(tool, args) {
  if (tool === 'reservation.getByDate') return reservation_getByDate(args);
  if (tool === 'reservation.addEntry') return reservation_addEntry(args);  
  if (tool === 'reservation.listDates') return reservation_listDates(args);
  throw new Error('unknown tool: ' + tool);
}

/* @mcp
name: reservation.getByDate
description: Get reservation entries for a specific date
path: reservation.getByDate
schema:
  type: object
  properties:
    date:
      type: string
      pattern: '^\d{4}/\d{2}/\d{2}$'
      description: 'Date in YYYY/MM/DD format'
  required: [date]
*/
function reservation_getByDate({ date }) {
  if (!date || !/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
    throw new Error('Date must be in YYYY/MM/DD format');
  }

  // 既存のdoGetロジックを再利用
  const [YYYY, MM, DD] = date.split('/');
  const y = Number(YYYY), m = Number(MM), d = Number(DD);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  
  if (dateObj.getUTCFullYear() !== y || (dateObj.getUTCMonth() + 1) !== m || dateObj.getUTCDate() !== d) {
    throw new Error('Invalid date value');
  }

  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(PROP_SHEET_ID);
  if (!spreadsheetId) {
    throw new Error('Script Property SPREADSHEET_ID not set');
  }

  const sheetName = props.getProperty(PROP_SHEET_NAME);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet not found');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return { date, reservations: [], count: 0 };
  }

  const rng = sheet.getRange(1, 1, lastRow, 3);
  const values = rng.getValues();

  const hits = [];
  for (let i = 0; i < values.length; i++) {
    const a = values[i][0];
    const b = values[i][1];
    const c = values[i][2];

    const key = normalizeToYmd(a);
    if (!key) continue;
    if (key === date) {
      const time = normalizeToHm(b);
      const name = (c == null) ? '' : String(c).trim();
      hits.push({
        time: time,
        name: name,
        display: `${time} ${name}`.trim()
      });
    }
  }

  return {
    date: date,
    reservations: hits,
    count: hits.length,
    summary: hits.map(h => h.display).join(',')
  };
}

/* @mcp
name: reservation.addEntry
description: Add a new reservation entry to the sheet
path: reservation.addEntry
schema:
  type: object
  properties:
    date:
      type: string
      pattern: '^\d{4}/\d{2}/\d{2}$'
      description: 'Date in YYYY/MM/DD format'
    time:
      type: string
      pattern: '^\d{1,2}:\d{2}$'
      description: 'Time in HH:MM format'
    name:
      type: string
      description: 'Reservation name/description'
  required: [date, time, name]
*/
function reservation_addEntry({ date, time, name }) {
  if (!date || !/^\d{4}\/\d{2}\/\d{2}$/.test(date)) {
    throw new Error('Date must be in YYYY/MM/DD format');
  }
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error('Time must be in HH:MM format');
  }
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required and must be a string');
  }

  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(PROP_SHEET_ID);
  if (!spreadsheetId) {
    throw new Error('Script Property SPREADSHEET_ID not set');
  }

  const sheetName = props.getProperty(PROP_SHEET_NAME);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet not found');
  }

  // 新しい行を追加
  const [YYYY, MM, DD] = date.split('/');
  const dateObj = new Date(YYYY, MM - 1, DD); // JST
  sheet.appendRow([dateObj, time, name.trim()]);

  return {
    success: true,
    added: {
      date: date,
      time: time,
      name: name.trim()
    },
    rowCount: sheet.getLastRow()
  };
}

/* @mcp
name: reservation.listDates
description: Get list of unique dates that have reservations
path: reservation.listDates
schema:
  type: object
  properties:
    limit:
      type: number
      minimum: 1
      maximum: 100
      default: 50
      description: 'Maximum number of dates to return'
  required: []
*/
function reservation_listDates({ limit = 50 } = {}) {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(PROP_SHEET_ID);
  if (!spreadsheetId) {
    throw new Error('Script Property SPREADSHEET_ID not set');
  }

  const sheetName = props.getProperty(PROP_SHEET_NAME);
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
  if (!sheet) {
    throw new Error('Sheet not found');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    return { dates: [], count: 0 };
  }

  const rng = sheet.getRange(1, 1, lastRow, 1); // A列のみ
  const values = rng.getValues();

  const uniqueDates = new Set();
  for (let i = 0; i < values.length; i++) {
    const normalized = normalizeToYmd(values[i][0]);
    if (normalized) {
      uniqueDates.add(normalized);
    }
  }

  const sortedDates = Array.from(uniqueDates)
    .sort()
    .slice(0, Math.min(limit, 100));

  return {
    dates: sortedDates,
    count: sortedDates.length,
    totalUnique: uniqueDates.size
  };
}

/**
 * 任意の値（Date or 文字列）を 'yyyy/MM/dd' に正規化。不可なら null。
 */
function normalizeToYmd(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, TZ, 'yyyy/MM/dd');
  }
  if (typeof v === 'string') {
    const s = v.trim();
    const m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) {
      const y = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
      const dt = new Date(Date.UTC(y, mm - 1, dd));
      if (dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === mm && dt.getUTCDate() === dd) {
        return Utilities.formatDate(dt, TZ, 'yyyy/MM/dd');
      }
    }
  }
  return null;
}

/**
 * B列「時間」を 'HH:mm' に正規化（Date/文字列対応）
 * - GASの時刻セルは 1899-12-30 ベースの Date として来ることが多い
 * - 文字列なら 'H:mm' / 'HH:mm' などを素直に採用（簡易）
 */
function normalizeToHm(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, TZ, 'HH:mm');
  }
  if (typeof v === 'number') {
    // まれに数値（Excel/Sheetsの時刻シリアル）で来るケースに備える（24時間=1.0）
    // 0.5 = 12:00 のような場合を扱う
    const totalMinutes = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  if (typeof v === 'string') {
    const s = v.trim();
    // ざっくり HH:mm / H:mm を許容
    const m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      return `${pad2(Number(m[1]))}:${pad2(Number(m[2]))}`;
    }
    // その他はそのまま返す（例: '午前10:00' 等）
    return s;
  }
  return '';
}

function pad2(n) {
  return (n < 10 ? '0' : '') + String(n);
}

/**
 * JSON レスポンス
 */
function json(_status, obj) {
  const payload = JSON.stringify({ status: _status, ...obj }, null, 2);
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}
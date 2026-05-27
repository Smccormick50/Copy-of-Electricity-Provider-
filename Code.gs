/*****
 * McCoy's Electrical Provider Search API
 *
 * This version is more forgiving:
 * - Uses the exact spreadsheet ID below.
 * - Can use a specific tab if you fill in SHEET_NAME.
 * - If SHEET_NAME is blank, it scans all tabs and uses the tabs that look like
 *   electrical provider data.
 * - Returns the source sheet/tab names so the app can show what it loaded.
 *****/

const SPREADSHEET_ID = '1pVbdn5lAn42CXMBxAtBdOre2DqlgkLEqQ2aQ8g83b7E';

// IMPORTANT:
// If your provider list is on a specific bottom tab in Google Sheets, type that
// tab name exactly between the quotes. Example: 'Electrical Provider List'
// Leave blank to auto-scan all tabs.
const SHEET_NAME = '';

function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : '';

  try {
    const result = getSheetRows_();

    return output_({
      ok: true,
      updatedAt: new Date().toISOString(),
      spreadsheetId: SPREADSHEET_ID,
      spreadsheetName: result.spreadsheetName,
      spreadsheetUrl: result.spreadsheetUrl,
      sheetNames: result.sheetNames,
      usedSheets: result.usedSheets,
      headersBySheet: result.headersBySheet,
      count: result.data.length,
      data: result.data
    }, callback);

  } catch (error) {
    return output_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    }, callback);
  }
}

function getSheetRows_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const allSheets = spreadsheet.getSheets();
  const sheetNames = allSheets.map(sheet => sheet.getName());

  let sheetsToRead = [];

  if (SHEET_NAME) {
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      throw new Error('The tab named "' + SHEET_NAME + '" was not found. Available tabs: ' + sheetNames.join(', '));
    }
    sheetsToRead = [sheet];
  } else {
    // Auto-find any tab that appears to contain store/provider data.
    sheetsToRead = allSheets.filter(sheet => {
      const values = sheet.getDataRange().getDisplayValues();
      return findHeaderRowIndex_(values) !== -1;
    });

    // Fallback: use the first tab so the error/debug output still helps.
    if (!sheetsToRead.length && allSheets.length) {
      sheetsToRead = [allSheets[0]];
    }
  }

  const data = [];
  const usedSheets = [];
  const headersBySheet = {};

  sheetsToRead.forEach(sheet => {
    const values = sheet.getDataRange().getDisplayValues();
    const headerRowIndex = findHeaderRowIndex_(values);
    if (headerRowIndex === -1) return;

    const headers = values[headerRowIndex].map((header, index) => {
      const cleaned = String(header || '').trim();
      return cleaned || `Column ${index + 1}`;
    });

    const rows = values.slice(headerRowIndex + 1)
      .filter(row => row.some(cell => String(cell || '').trim() !== ''))
      .map(row => {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = String(row[index] || '').trim();
        });
        record['_Source Sheet'] = sheet.getName();
        return record;
      });

    if (rows.length) {
      usedSheets.push(sheet.getName());
      headersBySheet[sheet.getName()] = headers;
      data.push(...rows);
    }
  });

  return {
    spreadsheetName: spreadsheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetNames: sheetNames,
    usedSheets: usedSheets,
    headersBySheet: headersBySheet,
    data: data
  };
}

function findHeaderRowIndex_(values) {
  const maxRowsToCheck = Math.min(values.length, 15);

  for (let rowIndex = 0; rowIndex < maxRowsToCheck; rowIndex++) {
    const normalized = values[rowIndex].map(cell => normalizeHeader_(cell));

    const hasStore = normalized.some(value => [
      'store',
      'store number',
      'store no',
      'store num',
      'store id',
      'location',
      'location number',
      'site',
      'site number'
    ].includes(value));

    const hasProviderInfo = normalized.some(value => [
      'electrical provider',
      'electric provider',
      'electricity provider',
      'provider',
      'utility provider',
      'delivery co',
      'delivery company',
      'tdsp',
      'tdu',
      'esid',
      'esi id',
      'esiid',
      'account',
      'account number',
      'outage phone',
      'outage phone number',
      'outage number'
    ].includes(value));

    if (hasStore && hasProviderInfo) return rowIndex;
  }

  return -1;
}

function normalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[#.:()/\\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);

  if (callback) {
    // JSONP is used so the GitHub Pages app can read the Apps Script data.
    if (!/^[\w.$]+$/.test(callback)) {
      return ContentService
        .createTextOutput('Invalid callback')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

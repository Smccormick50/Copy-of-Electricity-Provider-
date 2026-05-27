/*****
 * McCoy's Electrical Provider Search API
 * Paste this file into Google Apps Script attached to your spreadsheet,
 * then deploy it as a Web App.
 *****/

const SPREADSHEET_ID = '1pVbdn5lAn42CXMBxAtBdOre2DqlgkLEqQ2aQ8g83b7E';
const SHEET_NAME = ''; // Leave blank to use the first sheet, or type the tab name here.

function doGet(e) {
  try {
    const callback = e && e.parameter ? e.parameter.callback : '';
    const data = getSheetRows_();
    return output_({
      ok: true,
      updatedAt: new Date().toISOString(),
      count: data.length,
      data: data
    }, callback);
  } catch (error) {
    const callback = e && e.parameter ? e.parameter.callback : '';
    return output_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    }, callback);
  }
}

function getSheetRows_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = SHEET_NAME ? spreadsheet.getSheetByName(SHEET_NAME) : spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error('Sheet tab was not found. Check SHEET_NAME in Code.gs.');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map((header, index) => {
    const cleaned = String(header || '').trim();
    return cleaned || `Column ${index + 1}`;
  });

  return values.slice(1)
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .map(row => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = String(row[index] || '').trim();
      });
      return record;
    });
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

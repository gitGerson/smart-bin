// Paste into the spreadsheet via Extensions > Apps Script, set the SECRET
// script property, then Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone).

const SHEET_NAME = "Log";
const HEADERS = ["Time (WIB)", "Type", "Distance (cm)", "Fill (%)", "Note"];

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const secret = PropertiesService.getScriptProperties().getProperty("SECRET");

  if (!secret || data.secret !== secret) {
    return json({ ok: false, error: "Unauthorized" });
  }

  const sheet = getLogSheet();
  sheet.appendRow([
    data.time,
    data.type,
    data.distanceCm,
    data.fillPercent === null ? "" : data.fillPercent,
    data.note,
  ]);

  return json({ ok: true });
}

function getLogSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

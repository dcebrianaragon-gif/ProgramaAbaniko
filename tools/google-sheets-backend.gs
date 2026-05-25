// Programa Abaniko — Google Apps Script backend
// Desplegar como: Aplicación web > Ejecutar como "Yo" > Acceso "Cualquier persona"
// Esto añade CORS automaticamente a todas las respuestas.

const SPREADSHEET_ID = "";
const SHEET_NAME = "app_state";
const DEFAULT_APP_ID = "programa-abaniko";
const HEADERS = ["app_id", "payload", "updated_at"];

function doGet(event) {
  try {
    const params = event && event.parameter ? event.parameter : {};
    const action = String(params.action || "read").toLowerCase();
    const appId = String(params.appId || DEFAULT_APP_ID);

    if (action === "health") {
      return output_({
        ok: true,
        backend: "google-sheets",
        appId,
        message: "Google Sheets listo y sincronizando en tiempo real."
      }, params.callback);
    }

    if (action === "read") {
      return output_(readState_(appId), params.callback);
    }

    // Soporte de escritura via GET (fallback cuando el POST falla por CORS)
    // El payload viene URL-encoded en el parametro 'payload'
    if (action === "write") {
      const rawPayload = params.payload || "";
      if (!rawPayload) {
        return output_({ ok: false, message: "Falta el parametro payload." }, params.callback);
      }
      const payload = JSON.parse(rawPayload);
      return output_(writeState_(appId, payload), params.callback);
    }

    return output_({ ok: false, message: "Accion no soportada." }, params.callback);
  } catch (error) {
    return output_({ ok: false, message: error.message || "Error interno." }, event?.parameter?.callback);
  }
}

function doPost(event) {
  try {
    const body = parseBody_(event);
    const action = String(body.action || "write").toLowerCase();
    const appId = String(body.appId || DEFAULT_APP_ID);

    if (action === "health") {
      return output_({ ok: true, backend: "google-sheets", appId, message: "Google Sheets listo." });
    }

    if (action !== "write") {
      return output_({ ok: false, message: "Accion no soportada." });
    }

    return output_(writeState_(appId, body.payload || {}));
  } catch (error) {
    return output_({ ok: false, message: error.message || "Error interno." });
  }
}

function parseBody_(event) {
  const contents = event?.postData?.contents || "";
  if (!contents) {
    return {};
  }
  try {
    return JSON.parse(contents);
  } catch {
    return {};
  }
}

function getSpreadsheet_() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Vincula este script a una hoja de calculo o rellena SPREADSHEET_ID.");
  }
  return spreadsheet;
}

function getStateSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => firstRow[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function findRow_(sheet, appId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(appId)) {
      return index + 2;
    }
  }
  return 0;
}

function readState_(appId) {
  const sheet = getStateSheet_();
  const row = findRow_(sheet, appId);
  if (!row) {
    return {
      ok: true,
      appId,
      payload: null,
      updatedAt: ""
    };
  }
  const values = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
  return {
    ok: true,
    appId,
    payload: values[1] ? JSON.parse(values[1]) : null,
    updatedAt: values[2] || ""
  };
}

function writeState_(appId, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getStateSheet_();
    const row = findRow_(sheet, appId) || sheet.getLastRow() + 1;
    const updatedAt = new Date().toISOString();
    const normalizedPayload = Object.assign({}, payload, {
      updatedAt: payload.updatedAt || updatedAt
    });
    sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
      appId,
      JSON.stringify(normalizedPayload),
      normalizedPayload.updatedAt
    ]]);
    return {
      ok: true,
      appId,
      payload: normalizedPayload,
      updatedAt: normalizedPayload.updatedAt
    };
  } finally {
    lock.releaseLock();
  }
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

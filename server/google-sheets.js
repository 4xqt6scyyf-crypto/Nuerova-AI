const { google } = require('googleapis');

function getSpreadsheetId() {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
}

function getSheetsRange() {
  const explicitRange = process.env.GOOGLE_SHEETS_RANGE || '';
  if (explicitRange.trim().length > 0) {
    return explicitRange;
  }

  const fallbackSheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Signups';
  return `${fallbackSheetName}!A:B`;
}

function getSheetNameFromRange(rangeValue) {
  if (typeof rangeValue !== 'string' || rangeValue.length === 0) {
    return null;
  }

  const bangIndex = rangeValue.indexOf('!');
  if (bangIndex === -1) {
    return rangeValue;
  }

  return rangeValue.slice(0, bangIndex);
}

function normalizePrivateKey(privateKey) {
  if (typeof privateKey !== 'string' || privateKey.length === 0) {
    return '';
  }

  return privateKey.replace(/\\n/g, '\n');
}

function parseServiceAccount() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (_error) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n') || '';

  if (!clientEmail || !privateKey) {
    return null;
  }

  return {
    client_email: clientEmail,
    private_key: privateKey
  };
}

function isGoogleSheetsConfigured() {
  if (!getSpreadsheetId() || !getSheetsRange()) {
    return false;
  }

  try {
    return Boolean(parseServiceAccount());
  } catch (_error) {
    return false;
  }
}

function createSheetsClient() {
  const credentials = parseServiceAccount();
  const spreadsheetId = getSpreadsheetId();
  const sheetsRange = getSheetsRange();

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is required');
  }

  if (!sheetsRange) {
    throw new Error('GOOGLE_SHEETS_RANGE is required');
  }

  if (!credentials) {
    throw new Error('Google service account credentials are required');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

function getGoogleSheetsTarget() {
  return {
    spreadsheetId: getSpreadsheetId(),
    range: getSheetsRange()
  };
}

async function verifyGoogleSheetsAccess() {
  const sheets = createSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetsRange = getSheetsRange();
  const sheetName = getSheetNameFromRange(sheetsRange);

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties.title'
  });

  const spreadsheetTitle = spreadsheet.data.properties?.title || null;
  const availableSheetTitles = (spreadsheet.data.sheets || [])
    .map((entry) => entry.properties?.title)
    .filter(Boolean);

  const hasTargetSheet = sheetName ? availableSheetTitles.includes(sheetName) : true;
  if (!hasTargetSheet) {
    throw new Error(`sheet tab "${sheetName}" not found`);
  }

  await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetsRange
  });

  return {
    spreadsheetTitle,
    availableSheetTitles
  };
}

async function upsertSignupInGoogleSheet(signup) {
  const sheets = createSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetsRange = getSheetsRange();
  const email = signup.email.trim().toLowerCase();
  const createdAt = signup.created_at || signup.createdAt;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetsRange,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[email, createdAt]]
    }
  });

  return { mode: 'inserted' };
}

async function getRecentSignupsFromGoogleSheet(limit = 10) {
  const sheets = createSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const sheetsRange = getSheetsRange();

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetsRange
  });

  const rows = result.data.values || [];
  const normalizedRows = rows
    .map((row) => ({ email: row[0] || null, timestamp: row[1] || null }))
    .filter((row) => row.email && row.timestamp)
    .filter((row) => String(row.email).toLowerCase() !== 'email')
    .slice(-Math.max(1, limit))
    .reverse();

  return normalizedRows;
}

module.exports = {
  getGoogleSheetsTarget,
  getRecentSignupsFromGoogleSheet,
  isGoogleSheetsConfigured,
  verifyGoogleSheetsAccess,
  upsertSignupInGoogleSheet
};
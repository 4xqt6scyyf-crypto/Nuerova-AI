require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const {
  getGoogleSheetsTarget,
  getRecentSignupsFromGoogleSheet,
  isGoogleSheetsConfigured,
  verifyGoogleSheetsAccess,
  upsertSignupInGoogleSheet
} = require('./google-sheets');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SIGNUPS_FILE = path.join(__dirname, 'data', 'signups.json');

app.use(cors());
app.use(express.json());

const signupLog = [];
const trackEvents = [];

const REQUIRED_ENV_VARS = [
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_SHEETS_RANGE',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
];

function validateEnvConfig() {
  const missing = REQUIRED_ENV_VARS.filter((name) => {
    const value = process.env[name];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    console.error(`Missing required environment variables for Google Sheets: ${missing.join(', ')}`);
    console.error('Google Sheets sync will stay disabled until these are configured.');
  }
}

function formatGoogleSheetsError(error) {
  const statusCode = error?.code || error?.status;
  const details = error?.errors?.[0]?.message || error?.response?.data?.error?.message || error?.message || 'unknown error';

  if (statusCode === 403) {
    return `permission denied (${details})`;
  }

  if (statusCode === 400) {
    return `invalid sheets request (${details})`;
  }

  return details;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureSignupsFile() {
  await fs.mkdir(path.dirname(SIGNUPS_FILE), { recursive: true });

  try {
    await fs.access(SIGNUPS_FILE);
  } catch (_error) {
    await fs.writeFile(SIGNUPS_FILE, '[]\n', 'utf8');
  }
}

async function loadSignups() {
  await ensureSignupsFile();
  const content = await fs.readFile(SIGNUPS_FILE, 'utf8');
  const parsed = JSON.parse(content);

  signupLog.length = 0;
  for (const entry of parsed) {
    if (entry && typeof entry.email === 'string') {
      const createdAt = typeof entry.createdAt === 'string'
        ? entry.createdAt
        : (typeof entry.created_at === 'string' ? entry.created_at : null);

      if (!createdAt) {
        continue;
      }

      signupLog.push({
        email: entry.email,
        createdAt,
        created_at: typeof entry.created_at === 'string' ? entry.created_at : createdAt,
        referrer: typeof entry.referrer === 'string' && entry.referrer.length > 0 ? entry.referrer : null
      });
    }
  }
}

async function persistSignups() {
  await fs.writeFile(SIGNUPS_FILE, `${JSON.stringify(signupLog, null, 2)}\n`, 'utf8');
}

async function handleSignup(req, res) {
  const { email, referrer: providedReferrer } = req.body || {};

  if (!email) {
    return res.status(400).json({ ok: false, error: 'email is required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: 'email is invalid' });
  }

  const createdAt = new Date().toISOString();
  const headerReferrer = req.get('referer') || req.get('referrer') || null;
  const normalizedBodyReferrer = typeof providedReferrer === 'string' && providedReferrer.trim().length > 0
    ? providedReferrer.trim()
    : null;

  const signupEntry = {
    email: email.trim(),
    createdAt,
    created_at: createdAt,
    referrer: normalizedBodyReferrer || headerReferrer
  };

  signupLog.push(signupEntry);

  try {
    await persistSignups();
  } catch (error) {
    console.error('Failed to persist signup:', error.message);
    return res.status(500).json({ ok: false, error: 'failed to save signup' });
  }

  const sheetsEnabled = isGoogleSheetsConfigured();
  let sheetsResult = null;

  if (sheetsEnabled) {
    try {
      sheetsResult = await upsertSignupInGoogleSheet(signupEntry);
    } catch (error) {
      console.error('Failed to sync signup to Google Sheets:', formatGoogleSheetsError(error));
      return res.status(500).json({
        ok: false,
        error: 'failed to sync signup to google sheets'
      });
    }
  }

  console.log(`New signup: ${signupEntry.email}`);
  return res.status(200).json({
    ok: true,
    sheets: {
      enabled: sheetsEnabled,
      synced: sheetsEnabled,
      mode: sheetsResult ? sheetsResult.mode : null
    }
  });
}

app.post('/api/signup', handleSignup);
app.post('/signup', handleSignup);

app.post('/track', (req, res) => {
  const { userId, agent, endpoint, provider, cost, metadata } = req.body || {};

  const event = {
    id: trackEvents.length + 1,
    userId: userId || null,
    agent: agent || null,
    endpoint: endpoint || null,
    provider: provider || null,
    cost: typeof cost === 'number' ? cost : null,
    metadata: metadata || null,
    createdAt: new Date().toISOString()
  };

  trackEvents.push(event);

  return res.status(201).json({ ok: true, event });
});

app.get('/app-config.js', (_req, res) => {
  const configuredBaseUrl = process.env.VITE_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const serialized = JSON.stringify({ API_BASE_URL: configuredBaseUrl });

  res.type('application/javascript');
  res.send(`window.__APP_CONFIG__ = ${serialized};`);
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    sheetsConfigured: isGoogleSheetsConfigured()
  });
});

app.get('/health/sheets', async (_req, res) => {
  const configured = isGoogleSheetsConfigured();
  const target = getGoogleSheetsTarget();

  if (!configured) {
    return res.status(200).json({
      ok: true,
      configured: false,
      reachable: false,
      target,
      error: null
    });
  }

  try {
    const result = await verifyGoogleSheetsAccess();
    return res.status(200).json({
      ok: true,
      configured: true,
      reachable: true,
      target,
      spreadsheetTitle: result.spreadsheetTitle,
      error: null
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      configured: true,
      reachable: false,
      target,
      error: error.message
    });
  }
});

app.get('/signups', async (_req, res) => {
  try {
    if (!isGoogleSheetsConfigured()) {
      return res.status(200).json({
        ok: true,
        count: 0,
        signups: []
      });
    }

    const latest = await getRecentSignupsFromGoogleSheet(10);
    return res.status(200).json({
      ok: true,
      count: latest.length,
      signups: latest
    });
  } catch (error) {
    console.error('Failed to read signups from Google Sheets:', formatGoogleSheetsError(error));
    return res.status(503).json({
      ok: false,
      error: 'failed to read signups from google sheets',
      signups: []
    });
  }
});

async function start() {
  validateEnvConfig();
  await loadSignups();

  app.listen(PORT, HOST, () => {
    const isCodespaces = Boolean(process.env.CODESPACES);
    console.log(`AI Spend Tracker API listening on http://${HOST}:${PORT}`);
    if (isCodespaces) {
      console.log('Codespaces detected: ensure ports 3000 (API) and 8080 (frontend) are forwarded/public as needed.');
    }
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

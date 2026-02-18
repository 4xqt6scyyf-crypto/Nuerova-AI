const path = require('path');
const dotenv = require('dotenv');
const Sentry = require('@sentry/node');

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const dsn = process.env.SENTRY_DSN || '';

if (dsn && !(typeof Sentry.getClient === 'function' && Sentry.getClient())) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    sendDefaultPii: true,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    debug: process.env.SENTRY_DEBUG === '1'
  });
}

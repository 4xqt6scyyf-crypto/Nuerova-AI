require('./instrument.js');

const Sentry = require('@sentry/node');

async function run() {
  try {
    // Intentional error to verify Sentry capture end-to-end.
    // eslint-disable-next-line no-undef
    foo();
  } catch (error) {
    Sentry.captureException(error);
    const flushed = await Sentry.flush(4000);
    console.log('sentry-captured:', error.name, '-', error.message);
    console.log('sentry-flush:', flushed ? 'ok' : 'timeout');
    process.exit(flushed ? 0 : 1);
  }
}

run().catch(async (error) => {
  Sentry.captureException(error);
  await Sentry.flush(4000);
  console.error('sentry-smoke-failed:', error.message);
  process.exit(1);
});

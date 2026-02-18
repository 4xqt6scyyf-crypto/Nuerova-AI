async function trackAI(operation, context = {}, options = {}) {
  const endpoint = options.endpoint || 'http://localhost:3000/track';
  const startedAt = Date.now();

  try {
    const result = await operation;

    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        status: 'success',
        durationMs: Date.now() - startedAt
      })
    });

    return result;
  } catch (error) {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...context,
        status: 'error',
        durationMs: Date.now() - startedAt,
        metadata: { message: error.message }
      })
    });

    throw error;
  }
}

module.exports = { trackAI };

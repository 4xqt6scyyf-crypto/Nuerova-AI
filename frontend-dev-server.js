const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.FRONTEND_PORT || 8080);
const HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const BACKEND_TARGET = process.env.BACKEND_URL || 'https://api.nerovai.com';
const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/app-config.js', (_req, res) => {
  const configuredBaseUrl = process.env.VITE_API_URL || process.env.NEXT_PUBLIC_API_URL || '';
  const serialized = JSON.stringify({ API_BASE_URL: configuredBaseUrl });

  res.type('application/javascript');
  res.send(`window.__APP_CONFIG__ = ${serialized};`);
});

app.use('/api', createProxyMiddleware({
  target: BACKEND_TARGET,
  changeOrigin: true
}));

app.use('/health', createProxyMiddleware({
  target: BACKEND_TARGET,
  changeOrigin: true
}));

app.use(express.static(PUBLIC_DIR));

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'landing.html'));
});

app.get('/app', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/app/*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'reset-password.html'));
});

app.get('/pricing', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'pricing.html'));
});

app.get('/billing', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'billing.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/agents', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'agents.html'));
});

app.get('/docs', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'docs.html'));
});

app.get('/status', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'status.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Frontend dev server listening on http://${HOST}:${PORT}`);
  console.log(`Proxying /api and /health to ${BACKEND_TARGET}`);
});
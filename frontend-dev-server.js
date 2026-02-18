const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = Number(process.env.FRONTEND_PORT || 8080);
const HOST = process.env.FRONTEND_HOST || '0.0.0.0';
const BACKEND_TARGET = process.env.BACKEND_URL || 'http://127.0.0.1:3000';

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

app.use(express.static(path.join(__dirname)));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Frontend dev server listening on http://${HOST}:${PORT}`);
  console.log(`Proxying /api and /health to ${BACKEND_TARGET}`);
});
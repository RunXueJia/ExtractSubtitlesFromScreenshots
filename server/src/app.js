const http = require('node:http');
const { getServerConfig, loadEnvFile } = require('./libs/config');
const { AppError, getClientError, isAppError } = require('./libs/errors');
const { extractSubtitle, translateSubtitle } = require('./services/subtitleService');

loadEnvFile();

const DEV_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?::\d+)?$/i;

function createResponseBody(code, message, data = {}) {
  return { code, message, data };
}

function isAllowedOrigin(origin, configuredOrigins) {
  if (!origin) return false;
  if (configuredOrigins.includes('*')) return true;
  if (configuredOrigins.includes(origin)) return true;
  return DEV_ORIGIN_PATTERN.test(origin);
}

function applyCorsHeaders(req, res, configuredOrigins) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin, configuredOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', configuredOrigins.includes('*') ? '*' : origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(req, res, statusCode, payload) {
  const { corsOrigins } = getServerConfig();
  applyCorsHeaders(req, res, corsOrigins);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendSuccess(req, res, data) {
  sendJson(req, res, 200, createResponseBody(200, '成功', data));
}

function logError(req, statusCode, error) {
  const message = isAppError(error) ? error.publicMessage : error?.message || 'unknown error';
  console.error(`[api] ${req.method} ${req.url} -> ${statusCode}: ${message}`);
}

function sendError(req, res, error) {
  const clientError = getClientError(error);
  logError(req, clientError.statusCode, error);
  sendJson(req, res, clientError.statusCode, createResponseBody(clientError.statusCode, clientError.message));
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      reject(new AppError(415, 'Content-Type 必须是 application/json。'));
      req.resume();
      return;
    }

    const chunks = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', chunk => {
      if (rejected) return;

      totalBytes += chunk.length;
      if (totalBytes > limitBytes) {
        rejected = true;
        reject(new AppError(413, '请求体过大。'));
        req.resume();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (rejected) return;

      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        reject(new AppError(400, '请求体不能为空。'));
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new AppError(400, '请求体不是有效 JSON。'));
      }
    });

    req.on('error', () => {
      if (!rejected) reject(new AppError(400, '请求体读取失败。'));
    });
  });
}

function getRouteHandler(req) {
  if (req.method !== 'POST') return null;

  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/extract-subtitle') return extractSubtitle;
  if (pathname === '/api/translate-subtitle') return translateSubtitle;
  return null;
}

async function handleRequest(req, res) {
  const config = getServerConfig();
  applyCorsHeaders(req, res, config.corsOrigins);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const handler = getRouteHandler(req);
  if (!handler) {
    sendJson(req, res, 404, createResponseBody(404, '接口不存在。'));
    return;
  }

  try {
    const body = await readJsonBody(req, config.bodyLimitBytes);
    const data = await handler(body);
    sendSuccess(req, res, data);
  } catch (error) {
    sendError(req, res, error);
  }
}

function createServer() {
  return http.createServer(handleRequest);
}

if (require.main === module) {
  const { host, port } = getServerConfig();
  createServer().listen(port, host, () => {
    console.log(`Subtitle API server listening on http://${host}:${port}`);
  });
}

module.exports = {
  createServer,
  handleRequest,
  readJsonBody
};

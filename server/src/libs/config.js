const fs = require('node:fs');
const path = require('node:path');
const { AppError } = require('./errors');

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const ENV_FILE_PATH = path.join(SERVER_ROOT, '.env');

function stripInlineComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? '' : char;
    }
    if (char === '#' && !quote) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function unquote(value) {
  const trimmed = stripInlineComment(value).trim();
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).replace(/\\n/g, '\n');
  }
  return trimmed;
}

function loadEnvFile(filePath = ENV_FILE_PATH) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex <= 0) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) continue;

    process.env[key] = unquote(normalized.slice(equalsIndex + 1));
  }
}

function getEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseByteSize(value, fallbackBytes) {
  if (!value) return fallbackBytes;

  const match = String(value).trim().toLowerCase().match(/^(\d+)(b|kb|mb)?$/);
  if (!match) return fallbackBytes;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] || 'b';
  const multiplier = unit === 'mb' ? 1024 * 1024 : unit === 'kb' ? 1024 : 1;
  return amount * multiplier;
}

function getServerConfig() {
  return {
    host: getEnv('HOST') || '0.0.0.0',
    port: parsePositiveInteger(getEnv('PORT'), 3001),
    bodyLimitBytes: parseByteSize(getEnv('JSON_BODY_LIMIT'), 8 * 1024 * 1024),
    corsOrigins: getEnv('CORS_ORIGIN')
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  };
}

function getModelConfig() {
  const config = {
    apiUrl: getEnv('SUBTITLE_API_URL'),
    model: getEnv('SUBTITLE_MODEL'),
    apiKey: getEnv('SUBTITLE_API_KEY'),
    timeoutMs: parsePositiveInteger(getEnv('SUBTITLE_REQUEST_TIMEOUT_MS'), 30000)
  };

  const missing = ['apiUrl', 'model', 'apiKey'].filter(key => !config[key]);
  if (missing.length) {
    throw new AppError(500, '字幕服务未配置完整，请检查服务端环境变量。', { details: missing });
  }

  return config;
}

module.exports = {
  ENV_FILE_PATH,
  getModelConfig,
  getServerConfig,
  loadEnvFile,
  parseByteSize
};

class AppError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.publicMessage = message;
    this.details = options.details;
  }
}

function isAppError(error) {
  return error instanceof AppError;
}

function sanitizeSecretLikeValues(message) {
  return String(message || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/gi, 'sk-[redacted]')
    .replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[redacted-token]');
}

function normalizeModelErrorMessage(message) {
  const sanitized = sanitizeSecretLikeValues(message).trim();
  if (!sanitized) return '外部字幕服务返回错误。';

  if (sanitized.includes('无权使用模型') || sanitized.toLowerCase().includes('model')) {
    return `${sanitized}。请检查服务端 .env 中的 SUBTITLE_MODEL 是否是当前密钥有权限调用的模型。`;
  }

  return sanitized.slice(0, 240);
}

function getClientError(error) {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      message: sanitizeSecretLikeValues(error.publicMessage)
    };
  }

  return {
    statusCode: 500,
    message: '服务暂时不可用，请稍后重试。'
  };
}

module.exports = {
  AppError,
  getClientError,
  isAppError,
  normalizeModelErrorMessage,
  sanitizeSecretLikeValues
};

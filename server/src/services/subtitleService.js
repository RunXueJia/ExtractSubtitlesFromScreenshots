const { AppError } = require('../libs/errors');
const {
  extractSubtitleFromImage,
  translateSubtitleToChinese
} = require('../libs/modelClient');

function assertPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, '请求体必须是 JSON 对象。');
  }
}

function validateImageDataUrl(imageDataUrl) {
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.trim()) {
    throw new AppError(400, 'imageDataUrl 不能为空。');
  }

  const normalized = imageDataUrl.trim();
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+$/.test(normalized)) {
    throw new AppError(400, 'imageDataUrl 必须是 base64 图片 data URL。');
  }

  return normalized;
}

function validateText(text) {
  if (typeof text !== 'string') {
    throw new AppError(400, 'text 必须是字符串。');
  }

  return text.trim();
}

async function extractSubtitle(body) {
  assertPlainObject(body);
  const text = await extractSubtitleFromImage(validateImageDataUrl(body.imageDataUrl));
  return { text };
}

async function translateSubtitle(body) {
  assertPlainObject(body);
  const text = await translateSubtitleToChinese(validateText(body.text));
  return { text };
}

module.exports = {
  extractSubtitle,
  translateSubtitle
};

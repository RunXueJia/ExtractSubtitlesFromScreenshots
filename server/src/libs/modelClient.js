const { getModelConfig } = require('./config');
const { AppError, normalizeModelErrorMessage } = require('./errors');

const EXTRACT_PROMPT = '提取图片字幕，英文正常书写，中文拼音使用<mark>拼音内容</mark>标签高亮包裹，**只输出最终字幕文本，禁止额外解释、开场白、说明文字、格式注释、多余换行，不能附带任何补充话语，严格只返回处理完的字幕结果**。';
const TRANSLATE_PROMPT = '将下面的字幕翻译成自然流畅的中文。输入中如果包含<mark>...</mark>标签，只翻译标签外的语义，不要输出HTML标签。只输出中文译文，禁止解释、开场白、说明文字、格式注释和多余换行。';

function getHeaders(apiKey) {
  return {
    Accept: '*/*',
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

function readCompletionContent(payload, label) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();

  if (Array.isArray(content)) {
    return content
      .map(item => item?.text || '')
      .join('')
      .trim();
  }

  throw new AppError(502, `${label}接口未返回可用文本。`);
}

async function callChatCompletion(body, label) {
  const config = getModelConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  let raw;
  try {
    response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: getHeaders(config.apiKey),
      body: JSON.stringify({
        model: config.model,
        ...body
      }),
      signal: controller.signal
    });
    raw = await response.text();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new AppError(504, `${label}接口请求超时。`);
    }
    throw new AppError(502, `${label}接口请求失败。`);
  } finally {
    clearTimeout(timeout);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new AppError(502, `${label}接口返回格式异常。`);
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || response.statusText;
    throw new AppError(502, `${label}接口调用失败：${normalizeModelErrorMessage(message)}`);
  }

  return readCompletionContent(payload, label);
}

async function extractSubtitleFromImage(imageDataUrl) {
  return callChatCompletion(
    {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl
              }
            },
            {
              type: 'text',
              text: EXTRACT_PROMPT
            }
          ]
        }
      ],
      thinking: {
        type: 'disabled'
      },
      temperature: 1,
      max_tokens: 500,
      top_p: 1,
      stream: false
    },
    '字幕'
  );
}

async function translateSubtitleToChinese(text) {
  if (!text.trim()) return '';

  return callChatCompletion(
    {
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${TRANSLATE_PROMPT}\n\n${text}`
            }
          ]
        }
      ],
      thinking: {
        type: 'disabled'
      },
      temperature: 0.4,
      max_tokens: 500,
      top_p: 1,
      stream: false
    },
    '翻译'
  );
}

module.exports = {
  extractSubtitleFromImage,
  translateSubtitleToChinese
};

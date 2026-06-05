const { getModelConfig } = require('./config');
const { AppError, normalizeModelErrorMessage } = require('./errors');
const { EXTRACT_PROMPT, TRANSLATE_PROMPT } = require('./modelPrompts.json');
function getPromptVersion(promptMap, version, promptName) {
  const prompt = promptMap?.[version];
  if (typeof prompt === 'string' && prompt.trim()) return prompt;

  throw new AppError(500, `${promptName} ${version} 未配置。`);
}

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
              text: getPromptVersion(EXTRACT_PROMPT, EXTRACT_PROMPT.VERSION, 'EXTRACT_PROMPT')
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
              text: `${getPromptVersion(TRANSLATE_PROMPT, TRANSLATE_PROMPT.VERSION, 'TRANSLATE_PROMPT')}\n\n${text}`
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

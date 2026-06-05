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

function stripWrappingCodeFence(value) {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function readFirstCodeFence(value) {
  const match = /```(?:json)?\s*([\s\S]*?)```/i.exec(value);
  return match?.[1]?.trim() || null;
}

function readFirstJsonObject(value) {
  const start = value.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, index + 1);
    }
  }

  return null;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function readTextPayload(content) {
  const candidates = [
    content.trim(),
    stripWrappingCodeFence(content),
    readFirstCodeFence(content),
    readFirstJsonObject(content)
  ];

  const fenced = readFirstCodeFence(content);
  if (fenced) {
    candidates.push(readFirstJsonObject(fenced));
  }

  const seen = new Set();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);

    const parsed = parseJsonObject(candidate);
    if (parsed) return parsed;
  }

  return null;
}

function stripWrappingQuotes(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed;
  } catch {
    // Fall through to single-quote cleanup.
  }

  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function normalizeSubtitleText(value) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeTextContent(content, labelPattern) {
  const payload = readTextPayload(content);
  if (payload) {
    if (payload.text == null) return '';
    return normalizeSubtitleText(String(payload.text));
  }

  const withoutFence = stripWrappingCodeFence(content);
  const withoutLabel = withoutFence.replace(labelPattern, '');
  return normalizeSubtitleText(stripWrappingQuotes(withoutLabel));
}

function normalizeExtractSubtitleContent(content) {
  return normalizeTextContent(content, /^(?:text|字幕文本|字幕|结果)\s*[:：]\s*/i);
}

function normalizeTranslateSubtitleContent(content) {
  return normalizeTextContent(content, /^(?:text|中文译文|译文|翻译|结果)\s*[:：]\s*/i);
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
  const content = await callChatCompletion(
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
      temperature: 0,
      max_tokens: 500,
      top_p: 1,
      stream: false
    },
    '字幕'
  );

  return normalizeExtractSubtitleContent(content);
}

async function translateSubtitleToChinese(text) {
  if (!text.trim()) return '';

  const content = await callChatCompletion(
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
      temperature: 0,
      max_tokens: 500,
      top_p: 1,
      stream: false
    },
    '翻译'
  );

  return normalizeTranslateSubtitleContent(content);
}

module.exports = {
  extractSubtitleFromImage,
  translateSubtitleToChinese
};

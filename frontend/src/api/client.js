async function requestJson(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('服务返回了无法解析的数据。');
  }

  if (!response.ok || payload.code >= 400) {
    throw new Error(payload.message || '请求失败。');
  }

  return payload.data || {};
}

export async function extractSubtitle(imageDataUrl) {
  const data = await requestJson('/api/extract-subtitle', { imageDataUrl });
  return data.text || '';
}

export async function translateSubtitle(text) {
  const data = await requestJson('/api/translate-subtitle', { text });
  return data.text || '';
}

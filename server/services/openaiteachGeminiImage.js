function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeGeminiInlineImagePart(part) {
  if (!part || typeof part !== 'object') return null;

  const inlineData = part.inlineData || part.inline_data;
  if (!inlineData || typeof inlineData !== 'object') return null;

  const data = inlineData.data;
  if (typeof data !== 'string' || !data) return null;

  const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
  return {
    mimeType,
    data,
  };
}

function resolveGeneratedImagePart(payload) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inlineImage = normalizeGeminiInlineImagePart(part);
      if (inlineImage) return inlineImage;
    }
  }
  return null;
}

function buildGeminiContents({ prompt, imageBase64Array }) {
  const parts = [{ text: prompt || '' }];

  if (Array.isArray(imageBase64Array)) {
    for (const image of imageBase64Array) {
      if (typeof image !== 'string' || !image) continue;
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({
          inline_data: {
            mime_type: matches[1],
            data: matches[2],
          },
        });
      }
    }
  }

  return [
    {
      role: 'user',
      parts,
    },
  ];
}

export async function generateOpenAiTeachGeminiImage({
  prompt,
  imageBase64Array,
  imageModel,
  apiKey,
  baseUrl = 'https://openaiteach.com/v1',
}) {
  const requestBody = {
    contents: buildGeminiContents({ prompt, imageBase64Array }),
  };

  const response = await fetch(
    `${trimTrailingSlash(baseUrl).replace(/\/v1$/, '')}/v1beta/models/${imageModel}:generateContent?key=`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const error = new Error(`OpenAiTeach Gemini 图片生成失败（HTTP ${response.status}）${text ? `: ${text}` : ''}`);
    error.status = response.status;
    throw error;
  }

  const generated = resolveGeneratedImagePart(payload);
  if (!generated) {
    throw new Error('OpenAiTeach Gemini 图片接口未返回可解析的图片数据');
  }

  return Buffer.from(generated.data, 'base64');
}

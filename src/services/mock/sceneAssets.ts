import type { FrameDeductionResult, StoryboardShot } from '../../types/scene';

export function makeMockImageDataUrl(label: string, accent = '#3b82f6', index = 1) {
  const safeLabel = label.replace(/[<>&]/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="0.55" stop-color="#1f2937"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="42%" r="55%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.26"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="960" height="540" fill="url(#bg)"/>
      <rect width="960" height="540" fill="url(#glow)"/>
      <g opacity="0.2">
        ${Array.from({ length: 18 }).map((_, i) => `<circle cx="${70 + i * 52}" cy="${80 + ((i * 67) % 360)}" r="${12 + (i % 5) * 8}" fill="#fff"/>`).join('')}
      </g>
      <text x="54" y="80" fill="#fff" font-size="30" font-family="Arial, sans-serif" font-weight="700">Liblib Scene Mock</text>
      <text x="54" y="130" fill="#e5e7eb" font-size="22" font-family="Arial, sans-serif">${safeLabel}</text>
      <text x="54" y="488" fill="#fff" font-size="72" font-family="Arial, sans-serif" font-weight="800">${String(index).padStart(2, '0')}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function makeStoryboardShots(count: number, storyText = '一段电影级故事'): StoryboardShot[] {
  return Array.from({ length: count }).map((_, index) => {
    const shotNumber = index + 1;
    return {
      shotNumber,
      durationSeconds: count > 4 ? 4 : 6,
      plotDescription: `${storyText} · 第 ${shotNumber} 个关键情节点`,
      shotSize: shotNumber % 3 === 0 ? 'wide shot' : shotNumber % 3 === 1 ? 'medium shot' : 'close-up',
      characterAction: shotNumber % 2 === 0 ? '角色转身观察环境' : '角色向镜头方向推进',
      emotion: shotNumber % 2 === 0 ? '紧张克制' : '期待与决心',
      sceneTags: shotNumber % 2 === 0 ? '夜景, 室内, 低调光' : '外景, 纵深, 电影感',
      lightingAndAtmosphere: shotNumber % 2 === 0 ? '冷色边缘光，暗部保留细节' : '暖色主光，柔和空气透视',
      imageGenerationPrompt: `cinematic storyboard frame ${shotNumber}, ${storyText}, consistent character, high detail`,
      videoMotionPrompt: `camera slowly moves through shot ${shotNumber}, coherent action continuity`,
    };
  });
}

export function makeFrameDeduction(direction: 'plus' | 'minus'): FrameDeductionResult {
  return {
    motionDelta: direction === 'plus' ? '主体向画面右前方推进约 3 秒' : '主体回到 5 秒前的起始姿态',
    cameraDelta: direction === 'plus' ? '镜头轻微推近并降低机位' : '镜头回拉，恢复更宽的环境视野',
    environmentDelta: direction === 'plus' ? '背景光源略微增强，空气尘埃更明显' : '环境动态更安静，运动模糊减少',
    targetFramePrompt: direction === 'plus'
      ? 'future keyframe, 3 seconds later, cinematic continuity'
      : 'previous keyframe, 5 seconds earlier, cinematic continuity',
  };
}

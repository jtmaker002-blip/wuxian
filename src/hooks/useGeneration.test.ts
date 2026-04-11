import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGeneration } from './useGeneration';
import { NodeStatus, NodeType, type NodeData } from '../types';
import {
  getAllVideoCapabilities,
  resetRuntimeVideoCapabilities,
  setRuntimeVideoCapabilities,
} from '../config/modelCapabilities';

const generateImageMock = vi.fn();
const generateVideoMock = vi.fn();
const generateAudioMock = vi.fn();
const generateLocalImageMock = vi.fn();
const extractVideoLastFrameMock = vi.fn();
const readStoredOpenAiTeachProviderConfigMock = vi.fn();

vi.mock('../services/generationService', () => ({
  generateImage: (...args: unknown[]) => generateImageMock(...args),
  generateVideo: (...args: unknown[]) => generateVideoMock(...args),
  generateAudio: (...args: unknown[]) => generateAudioMock(...args),
}));

vi.mock('../services/localModelService', () => ({
  generateLocalImage: (...args: unknown[]) => generateLocalImageMock(...args),
}));

vi.mock('../utils/videoHelpers', () => ({
  extractVideoLastFrame: (...args: unknown[]) => extractVideoLastFrameMock(...args),
}));

vi.mock('../shared/provider/openaiteach-config', () => ({
  readStoredOpenAiTeachProviderConfig: (...args: unknown[]) => readStoredOpenAiTeachProviderConfigMock(...args),
  useStoredOpenAiTeachProviderConfig: (...args: unknown[]) => readStoredOpenAiTeachProviderConfigMock(...args),
}));

function createVideoNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'video-node',
    type: NodeType.VIDEO,
    x: 0,
    y: 0,
    prompt: '测试视频生成',
    status: NodeStatus.IDLE,
    model: 'wan2.6-i2v',
    videoModel: 'wan2.6-i2v',
    videoMode: 'standard',
    videoDuration: 5,
    aspectRatio: '16:9',
    resolution: '720p',
    parentIds: [],
    ...overrides,
  };
}

function createAudioNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'audio-node',
    type: NodeType.AUDIO,
    x: 0,
    y: 0,
    prompt: '测试语音生成',
    status: NodeStatus.IDLE,
    model: 'qwen3-tts-flash',
    audioModel: 'qwen3-tts-flash',
    aspectRatio: 'Auto',
    resolution: 'Auto',
    parentIds: [],
    ...overrides,
  };
}

function createImageNode(id: string, resultUrl = 'data:image/png;base64,abc'): NodeData {
  return {
    id,
    type: NodeType.IMAGE,
    x: 0,
    y: 0,
    prompt: '',
    status: NodeStatus.SUCCESS,
    resultUrl,
    model: 'gemini-3.1-flash-image-preview',
    imageModel: 'gemini-3.1-flash-image-preview',
    aspectRatio: '16:9',
    resolution: '1K',
  };
}

function installImageStub(width = 1280, height = 720) {
  class MockImage {
    naturalWidth = width;
    naturalHeight = height;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;

    set src(_value: string) {
      queueMicrotask(() => {
        if (typeof this.onload === 'function') {
          this.onload();
        }
      });
    }
  }

  Object.defineProperty(globalThis, 'Image', {
    value: MockImage,
    configurable: true,
    writable: true,
  });
}

function createParentVideoNode(id: string, resultUrl = 'https://example.com/ref.mp4'): NodeData {
  return {
    id,
    type: NodeType.VIDEO,
    x: 0,
    y: 0,
    prompt: '',
    status: NodeStatus.SUCCESS,
    resultUrl,
    model: 'veo3.1',
    videoModel: 'veo3.1',
    videoMode: 'standard',
    videoDuration: 4,
    aspectRatio: '16:9',
    resolution: '720p',
  };
}

function installVideoMetadataStub(width = 1280, height = 720) {
  const fakeVideo = {
    videoWidth: width,
    videoHeight: height,
    onloadedmetadata: null as null | (() => void),
    onerror: null as null | (() => void),
    set src(_value: string) {
      queueMicrotask(() => {
        if (typeof fakeVideo.onloadedmetadata === 'function') {
          fakeVideo.onloadedmetadata();
        }
      });
    },
  };

  Object.defineProperty(globalThis, 'document', {
    value: {
      createElement: vi.fn(() => fakeVideo),
    },
    configurable: true,
    writable: true,
  });
}

describe('useGeneration 视频链路保护', () => {
  beforeEach(() => {
    generateImageMock.mockReset();
    generateVideoMock.mockReset();
    generateAudioMock.mockReset();
    generateLocalImageMock.mockReset();
    extractVideoLastFrameMock.mockReset();
    readStoredOpenAiTeachProviderConfigMock.mockReset();
    readStoredOpenAiTeachProviderConfigMock.mockReturnValue({
      providerApiKey: 'sk-test-token',
      providerBaseUrl: 'https://openaiteach.com/v1',
    });
    installVideoMetadataStub();
    installImageStub();
    resetRuntimeVideoCapabilities();
  });

  it('图片生成会携带已记录的聚焦框，即使当前已退出 focus 叠层', async () => {
    const updateNode = vi.fn();
    generateImageMock.mockResolvedValue('https://example.com/result.png');

    const nodes = [
      createImageNode('source-image', 'data:image/png;base64,source'),
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '只修改人物面部区域',
        resultUrl: undefined,
        parentIds: ['source-image'],
        imageToolMode: null,
        focusSelection: { x: 10, y: 20, width: 30, height: 40 },
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: ['data:image/png;base64,source'],
        focusSelection: { x: 10, y: 20, width: 30, height: 40 },
      })
    );
  });

  it.each(['mark', 'enhance', 'grid', 'split'] as const)(
    '图片生成会把 %s 工具意图附带到请求里',
    async (imageToolMode) => {
      const updateNode = vi.fn();
      generateImageMock.mockResolvedValue('https://example.com/result.png');

      const nodes = [
        createImageNode('source-image', 'data:image/png;base64,source'),
        {
          ...createImageNode('image-node'),
          id: 'image-node',
          status: NodeStatus.IDLE,
          prompt: '按当前工具执行',
          resultUrl: undefined,
          parentIds: ['source-image'],
          imageToolMode,
        },
      ];

      const { handleGenerate } = useGeneration({ nodes, updateNode });

      await handleGenerate('image-node');

      expect(generateImageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          imageToolMode,
        })
      );
    }
  );

  it('图片生成会把具体工具动作附带到请求里', async () => {
    const updateNode = vi.fn();
    generateImageMock.mockResolvedValue('https://example.com/result.png');

    const nodes = [
      createImageNode('source-image', 'data:image/png;base64,source'),
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '执行高清动作',
        resultUrl: undefined,
        parentIds: ['source-image'],
        imageToolMode: 'enhance' as const,
        imageToolAction: '扩图',
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageToolMode: 'enhance',
        imageToolAction: '扩图',
      })
    );
  });

  it('切到不支持具体动作的图片工具时不会发送旧动作', async () => {
    const updateNode = vi.fn();
    generateImageMock.mockResolvedValue('https://example.com/result.png');

    const nodes = [
      createImageNode('source-image', 'data:image/png;base64,source'),
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '',
        resultUrl: undefined,
        parentIds: ['source-image'],
        imageToolMode: 'focus' as const,
        imageToolAction: '扩图',
        focusSelection: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageToolMode: 'focus',
        imageToolAction: undefined,
      })
    );
  });

  it('图片工具流即使没有提示词也会继续执行生成', async () => {
    const updateNode = vi.fn();
    generateImageMock.mockResolvedValue('https://example.com/result.png');

    const nodes = [
      createImageNode('source-image', 'data:image/png;base64,source'),
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '',
        resultUrl: undefined,
        parentIds: ['source-image'],
        imageToolMode: 'enhance' as const,
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: ['data:image/png;base64,source'],
        imageToolMode: 'enhance',
      })
    );
  });

  it('图片生成会把保留和忽略标记区域附带到请求里', async () => {
    const updateNode = vi.fn();
    generateImageMock.mockResolvedValue('https://example.com/result.png');
    const annotations = [
      {
        id: 'keep-1',
        type: 'preserve' as const,
        label: '保留区域',
        selection: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      },
      {
        id: 'ignore-1',
        type: 'ignore' as const,
        label: '忽略区域',
        selection: { x: 0.5, y: 0.6, width: 0.2, height: 0.1 },
      },
    ];

    const nodes = [
      createImageNode('source-image', 'data:image/png;base64,source'),
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '根据标记微调',
        resultUrl: undefined,
        parentIds: ['source-image'],
        imageAnnotations: annotations,
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageAnnotations: annotations,
      })
    );
  });

  it('首尾帧模式缺少两张图片时会阻止生成，而不是静默按 standard 执行', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createImageNode('image-a'),
      createVideoNode({
        videoModel: 'kling-v3',
        videoMode: 'frame-to-frame',
        frameInputs: [{ nodeId: 'image-a', order: 'start' }],
        parentIds: ['image-a'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '首尾帧模式需要两张图片输入后才能生成。',
      })
    );
  });

  it('首尾帧模式兼容旧节点：即使没有 frameInputs，只要连了两张图片也能按默认顺序生成', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,start-a'),
      createImageNode('image-b', 'data:image/png;base64,end-b'),
      createVideoNode({
        videoModel: 'kling-v3',
        videoMode: 'frame-to-frame',
        parentIds: ['image-a', 'image-b'],
        frameInputs: undefined,
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'data:image/png;base64,start-a',
        lastFrameBase64: 'data:image/png;base64,end-b',
      })
    );
  });

  it('kling-v2-6 首尾帧模式会把两张图片一起传给后端', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');
    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,start-a'),
      createImageNode('image-b', 'data:image/png;base64,end-b'),
      createVideoNode({
        videoModel: 'kling-v2-6',
        videoMode: 'frame-to-frame',
        parentIds: ['image-a', 'image-b'],
        frameInputs: [
          { nodeId: 'image-a', order: 'start' },
          { nodeId: 'image-b', order: 'end' },
        ],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'data:image/png;base64,start-a',
        lastFrameBase64: 'data:image/png;base64,end-b',
        videoModel: 'kling-v2-6',
      })
    );
  });

  it('首尾帧节点配置了 start/end 但实际可用图片不足两张时会直接报错，而不是静默降级', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,start-a'),
      createVideoNode({
        videoModel: 'kling-v3',
        videoMode: 'frame-to-frame',
        parentIds: ['image-a', 'image-b'],
        frameInputs: [
          { nodeId: 'image-a', order: 'start' },
          { nodeId: 'image-b', order: 'end' },
        ],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '首尾帧模式需要两张图片输入后才能生成。',
      })
    );
  });

  it('运动参考模式缺少视频或角色图时会阻止生成，而不是静默按 standard 执行', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createParentVideoNode('video-ref'),
      createVideoNode({
        videoModel: 'kling-v2-6',
        videoMode: 'motion-control',
        parentIds: ['video-ref'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '运动参考模式需要同时连接一个视频参考和一张角色图片。',
      })
    );
  });

  it('未接通的运动参考模式会直接报错，而不是保留设置后静默生成', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createParentVideoNode('video-ref', 'https://example.com/motion.mp4'),
      createImageNode('character-image', 'data:image/png;base64,character'),
      createVideoNode({
        videoModel: 'kling-v3',
        videoMode: 'motion-control',
        parentIds: ['video-ref', 'character-image'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前视频模型尚未接通运动参考模式，请切换到支持该模式的模型。',
      })
    );
  });

  it('Veo 标准模式会把非法参数清洗成能力表默认值后再发请求', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createVideoNode({
        videoModel: 'veo3.1',
        videoDuration: 10,
        aspectRatio: '1:1',
        resolution: '4K',
        generateAudio: true,
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoModel: 'veo3.1',
        duration: 4,
        aspectRatio: '16:9',
        resolution: '720p',
        generateAudio: false,
      })
    );
  });

  it('Kling 2.6 运动参考模式只会发送视频参考、角色图，并移除音频开关', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createParentVideoNode('video-ref', 'https://example.com/motion.mp4'),
      createImageNode('character-image', 'data:image/png;base64,character'),
      createVideoNode({
        videoModel: 'kling-v2-6',
        videoMode: 'motion-control',
        parentIds: ['video-ref', 'character-image'],
        generateAudio: true,
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoModel: 'kling-v2-6',
        imageBase64: 'data:image/png;base64,character',
        motionReferenceUrl: 'https://example.com/motion.mp4',
        lastFrameBase64: undefined,
        generateAudio: false,
        })
    );
  });

  it('Kling 2.6 标准模式遇到多图输入时不会静默降级成单图，而是直接报错', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,img-a'),
      createImageNode('image-b', 'data:image/png;base64,img-b'),
      createVideoNode({
        videoModel: 'kling-v2-6',
        videoMode: 'standard',
        parentIds: ['image-a', 'image-b'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。',
      })
    );
  });

  it('支持音频的模式默认会以 false 发送音频开关，而不是 undefined', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createVideoNode({
        videoModel: 'kling-v2-6',
        videoMode: 'standard',
        generateAudio: undefined,
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generateAudio: false,
      })
    );
  });

  it('标准模式多图输入但当前模型不支持时会明确报错，而不是静默只取第一张图', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,image-a'),
      createImageNode('image-b', 'data:image/png;base64,image-b'),
      createVideoNode({
        videoModel: 'veo3.1',
        videoMode: 'standard',
        parentIds: ['image-a', 'image-b'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。',
      })
    );
  });

  it('grok-video-3 标准模式多图输入未接通时会明确报错，而不是静默只取第一张图', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,image-a'),
      createImageNode('image-b', 'data:image/png;base64,image-b'),
      createVideoNode({
        videoModel: 'grok-video-3',
        parentIds: ['image-a', 'image-b'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前后端尚未接通标准模式的多图/全图参考，请先减少为单图，或改用已接通的专用模式。',
      })
    );
  });

  it('minimax-hailuo 标准模式多图输入会作为参考图发送，而不是直接报错', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createImageNode('image-a', 'data:image/png;base64:image-a'),
      createImageNode('image-b', 'data:image/png;base64:image-b'),
      createVideoNode({
        videoModel: 'minimax-hailuo',
        parentIds: ['image-a', 'image-b'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoModel: 'minimax-hailuo',
        referenceImagesBase64: [
          'data:image/png;base64:image-a',
          'data:image/png;base64:image-b',
        ],
        imageBase64: undefined,
      })
    );
  });

  it('minimax-hailuo 标准模式单图输入也会走参考图链，而不是退回普通单图视频', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createImageNode('image-a', 'data:image/png;base64:image-a'),
      createVideoNode({
        videoModel: 'minimax-hailuo',
        parentIds: ['image-a'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoModel: 'minimax-hailuo',
        referenceImagesBase64: ['data:image/png;base64:image-a'],
        imageBase64: undefined,
      })
    );
  });

  it('当最终能力表显式开启标准模式全图参考时，会按 referenceImages 链发送，而不是继续走单图降级', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');
    const currentCapabilities = getAllVideoCapabilities();
    setRuntimeVideoCapabilities({
      ...currentCapabilities,
      'veo3.1': {
        ...currentCapabilities['veo3.1'],
        modes: {
          ...currentCapabilities['veo3.1'].modes,
          standard: {
            ...currentCapabilities['veo3.1'].modes.standard,
            supportsFullReference: true,
          },
        },
      },
    });

    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,image-a'),
      createImageNode('image-b', 'data:image/png;base64,image-b'),
      createVideoNode({
        videoModel: 'veo3.1',
        videoMode: 'standard',
        parentIds: ['image-a', 'image-b'],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoModel: 'veo3.1',
        referenceImagesBase64: [
          'data:image/png;base64,image-a',
          'data:image/png;base64,image-b',
        ],
        imageBase64: undefined,
      })
    );
  });

  it('首尾帧模式会按 frameInputs 的顺序发送首尾帧，而不是按父节点顺序硬编码', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createImageNode('image-a', 'data:image/png;base64,start-a'),
      createImageNode('image-b', 'data:image/png;base64,end-b'),
      createVideoNode({
        videoModel: 'kling-v3',
        videoMode: 'frame-to-frame',
        parentIds: ['image-a', 'image-b'],
        frameInputs: [
          { nodeId: 'image-b', order: 'start' },
          { nodeId: 'image-a', order: 'end' },
        ],
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'data:image/png;base64,end-b',
        lastFrameBase64: 'data:image/png;base64,start-a',
      })
    );
  });

  it('标准模式接父视频时优先使用 lastFrame，而不是原视频地址', async () => {
    const updateNode = vi.fn();
    generateVideoMock.mockResolvedValue('https://example.com/result.mp4');
    extractVideoLastFrameMock.mockResolvedValue('data:image/png;base64,last-frame');

    const nodes = [
      createParentVideoNode('video-ref', 'https://example.com/ref.mp4'),
      createVideoNode({
        videoModel: 'veo3.1',
        parentIds: ['video-ref'],
      }),
      {
        ...createParentVideoNode('video-ref', 'https://example.com/ref.mp4'),
        lastFrame: 'data:image/png;base64,parent-last-frame',
      },
    ];

    const dedupedNodes = [nodes[2], nodes[1]];
    const { handleGenerate } = useGeneration({ nodes: dedupedNodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'data:image/png;base64,parent-last-frame',
      })
    );
  });

  it('视频节点没有显式 videoModel 时会直接报错，而不是静默回落到默认模型', async () => {
    const updateNode = vi.fn();

    const nodes = [
      createVideoNode({
        videoModel: undefined,
        model: '未设置视频模型',
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenLastCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '请先为当前视频节点选择模型，再开始生成。',
      })
    );
  });

  it('hosted 图片模型未绑定 OpenAiTeach token 时会在前端直接拦住', async () => {
    readStoredOpenAiTeachProviderConfigMock.mockReturnValue({});
    const updateNode = vi.fn();
    const nodes = [
      {
        ...createImageNode('image-node'),
        id: 'image-node',
        status: NodeStatus.IDLE,
        prompt: '测试出图',
        imageModel: 'midjourney-v6',
        model: 'Midjourney',
        resultUrl: undefined,
      },
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('image-node');

    expect(generateImageMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'image-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前图片模型需要先在设置里绑定 OpenAiTeach Token 后才能生成。',
      })
    );
  });

  it('hosted 标准视频模式未绑定 OpenAiTeach token 时会在前端直接拦住', async () => {
    readStoredOpenAiTeachProviderConfigMock.mockReturnValue({});
    const updateNode = vi.fn();
    const nodes = [
      createVideoNode({
        videoModel: 'veo3.1',
        videoMode: 'standard',
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('video-node');

    expect(generateVideoMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'video-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '当前视频模式需要先在设置里绑定 OpenAiTeach Token 后才能生成。',
      })
    );
  });

  it('语音节点当前会在前端直接拦住，不再继续请求后端', async () => {
    const updateNode = vi.fn();
    generateAudioMock.mockResolvedValue('https://example.com/result.mp3');

    const nodes = [createAudioNode()];
    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('audio-node');

    expect(generateAudioMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'audio-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
      })
    );
  });

  it('语音节点未接通 provider 时会明确报错', async () => {
    const updateNode = vi.fn();
    generateAudioMock.mockRejectedValue(new Error('语音模型 qwen3-tts-flash 当前后端尚未接通 provider，请先完成语音 provider 接入。'));

    const nodes = [createAudioNode()];
    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('audio-node');

    expect(updateNode).toHaveBeenCalledWith(
      'audio-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
      })
    );
  });

  it('语音节点未实现时会在前端直接拦住，而不是继续请求后端', async () => {
    const updateNode = vi.fn();
    const nodes = [createAudioNode()];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('audio-node');

    expect(generateAudioMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'audio-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '语音 provider 仍未实现；即使绑定了 OpenAiTeach token，当前也无法执行。',
      })
    );
  });

  it('语音节点没有显式模型时会直接报错，而不是静默回退到第一个语音模型', async () => {
    const updateNode = vi.fn();
    const nodes = [
      createAudioNode({
        model: undefined,
        audioModel: undefined,
      }),
    ];

    const { handleGenerate } = useGeneration({ nodes, updateNode });

    await handleGenerate('audio-node');

    expect(generateAudioMock).not.toHaveBeenCalled();
    expect(updateNode).toHaveBeenCalledWith(
      'audio-node',
      expect.objectContaining({
        status: NodeStatus.ERROR,
        errorMessage: '请先为当前语音节点选择模型，再开始生成。',
      })
    );
  });
});

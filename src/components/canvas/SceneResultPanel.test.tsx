import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../../types';
import { SCENES } from '../../types/scene';
import { SceneResultPanel } from './SceneResultPanel';

function createSceneNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'scene-node',
    type: NodeType.STORYBOARD,
    x: 0,
    y: 0,
    prompt: '测试故事',
    status: NodeStatus.SUCCESS,
    model: 'mock-scene-pipeline',
    aspectRatio: '16:9',
    resolution: 'Auto',
    scene: SCENES.PLOT_DEDUCTION_FOUR_GRID,
    outputs: {
      imageList: [
        { url: 'data:image/svg+xml;base64,a', label: 'Result 1', status: 'succeeded' },
        { url: 'data:image/svg+xml;base64,b', label: 'Result 2', status: 'succeeded' },
      ],
      structuredData: {
        storyboard: [
          {
            shotNumber: 1,
            plotDescription: '第一格剧情',
            emotion: '紧张',
            shotSize: 'close-up',
            lightingAndAtmosphere: '冷色边缘光',
            imageGenerationPrompt: 'shot one prompt',
          },
          {
            shotNumber: 2,
            plotDescription: '第二格剧情',
            emotion: '坚定',
            shotSize: 'wide shot',
            lightingAndAtmosphere: '暖色主光',
            imageGenerationPrompt: 'shot two prompt',
          },
        ],
      },
    },
    structuredData: {
      storyboard: [
        {
          shotNumber: 1,
          plotDescription: '第一格剧情',
          emotion: '紧张',
          shotSize: 'close-up',
          lightingAndAtmosphere: '冷色边缘光',
          imageGenerationPrompt: 'shot one prompt',
        },
      ],
    },
    ...overrides,
  };
}

describe('SceneResultPanel', () => {
  it('renders provider fallback warning instead of silently showing mock success', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode({
          structuredData: {
            providerFallback: '真实图片服务缺少 OPENAI_API_KEY 或 IMAGES_DIR，已回退 mock。',
            storyboard: [],
          },
        })}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).toContain('真实服务未执行，已回退 Mock');
    expect(markup).toContain('OPENAI_API_KEY');
  });

  it('renders single-cell retry, upscale, new-node, and download actions for grid results', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode()}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).toContain('单格重试');
    expect(markup).toContain('单格放大');
    expect(markup).toContain('新节点');
    expect(markup).toContain('下载');
  });

  it('renders a single export label for the 25-grid storyboard button', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode({
          scene: SCENES.COHERENT_STORYBOARD_25,
        })}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup.match(/导出 JSON/g)).toHaveLength(1);
  });

  it('renders a finished-sheet download action for character three-view results', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode({
          scene: SCENES.CHARACTER_THREE_VIEW_GENERATE,
          outputs: {
            imageList: [
              { url: 'data:image/svg+xml;base64,a', label: 'Front / Side / Back', status: 'succeeded' },
            ],
          },
        })}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).toContain('下载三视图成品');
  });
});

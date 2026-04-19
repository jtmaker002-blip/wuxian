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
  it('renders real generation failures instead of silently showing mock success', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode({
          status: NodeStatus.ERROR,
          outputs: undefined,
          structuredData: undefined,
          errorMessage: 'OpenAiTeach Gemini 图片生成失败（HTTP 403）：user quota is not enough',
          taskInfo: {
            loading: false,
            status: 'failed',
            failedReason: 'OpenAiTeach Gemini 图片生成失败（HTTP 403）：user quota is not enough',
            progressPercent: 0,
          },
        })}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).toContain('真实生成失败');
    expect(markup).toContain('user quota is not enough');
  });

  it('renders storyboard results as compact image nodes with hover actions', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode()}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).toContain('Result 2');
    expect(markup).toContain('下载');
    expect(markup).toContain('高清');
    expect(markup).toContain('新节点');
    expect(markup).not.toContain('单格详情 · #1');
  });

  it('does not render full export controls inside compact 25-grid result nodes', () => {
    const markup = renderToStaticMarkup(
      <SceneResultPanel
        data={createSceneNode({
          scene: SCENES.COHERENT_STORYBOARD_25,
        })}
        selected={false}
        isLoading={false}
      />
    );

    expect(markup).not.toContain('导出 JSON');
    expect(markup).toContain('Result 1');
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

    expect(markup).toContain('Front / Side / Back');
    expect(markup).toContain('下载');
  });
});

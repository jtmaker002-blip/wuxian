import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../../../types';
import { SCENES } from '../../../types/scene';
import { SceneParameterForm } from './SceneParameterForm';

function createSceneNode(overrides: Partial<NodeData> = {}): NodeData {
  return {
    id: 'scene-node',
    type: NodeType.TOOL,
    x: 0,
    y: 0,
    prompt: '',
    status: NodeStatus.IDLE,
    model: 'mock-scene-pipeline',
    aspectRatio: '16:9',
    resolution: 'Auto',
    scene: SCENES.FRAME_DEDUCTION_PLUS_3S,
    params: {},
    ...overrides,
  };
}

describe('SceneParameterForm', () => {
  it('keeps an editable source field for standalone image-based scene nodes', () => {
    const markup = renderToStaticMarkup(
      <SceneParameterForm
        data={createSceneNode({
          scene: SCENES.CHARACTER_THREE_VIEW_GENERATE,
          params: {},
        })}
      />
    );

    expect(markup).toContain('输入素材');
    expect(markup).toContain('粘贴图片 URL');
  });

  it('renders connected source previews without removing the editable source URL', () => {
    const markup = renderToStaticMarkup(
      <SceneParameterForm
        data={createSceneNode({
          scene: SCENES.CINEMATIC_LIGHT_CORRECTION,
          params: {
            originImage: 'data:image/png;base64,source',
          },
        })}
      />
    );

    expect(markup).toContain('来自已连接图片节点');
    expect(markup).toContain('data:image/png;base64,source');
  });
});

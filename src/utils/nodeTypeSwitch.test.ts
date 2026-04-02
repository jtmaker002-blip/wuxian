import { describe, expect, it } from 'vitest';
import { NodeStatus, NodeType, type NodeData } from '../types';
import { getNodeTypeOptionLabels } from '../config/nodeTypeRegistry';
import { switchNodeTypeData } from './nodeTypeSwitch';

describe('node type switch registry', () => {
  it('exposes text image and video labels for the dropdown', () => {
    expect(getNodeTypeOptionLabels()).toEqual([
      { type: NodeType.TEXT, label: '文字' },
      { type: NodeType.IMAGE, label: '图片' },
      { type: NodeType.VIDEO, label: '视频' },
    ]);
  });
});

describe('switchNodeTypeData', () => {
  it('keeps prompt and title but clears image-only state when switching image to text', () => {
    const source: NodeData = {
      id: 'node-1',
      type: NodeType.IMAGE,
      title: '封面图',
      x: 120,
      y: 240,
      prompt: 'a banana astronaut',
      status: NodeStatus.SUCCESS,
      resultUrl: 'https://example.com/result.png',
      resultAspectRatio: '1/1',
      generationStartTime: 123456,
      errorMessage: 'old error',
      imageModel: 'gemini-3.1-flash-image-preview',
      model: 'Banana Pro',
      aspectRatio: '1:1',
      resolution: '2K',
      parentIds: ['parent-1'],
      angleMode: true,
      angleSettings: { rotation: 10, tilt: 0, scale: 0, wideAngle: false },
    };

    const next = switchNodeTypeData(source, NodeType.TEXT);

    expect(next.type).toBe(NodeType.TEXT);
    expect(next.prompt).toBe('a banana astronaut');
    expect(next.title).toBe('封面图');
    expect(next.parentIds).toEqual(['parent-1']);
    expect(next.status).toBe(NodeStatus.IDLE);
    expect(next.resultUrl).toBeUndefined();
    expect(next.resultAspectRatio).toBeUndefined();
    expect(next.errorMessage).toBeUndefined();
    expect(next.textMode).toBe('editing');
    expect(next.imageModel).toBeUndefined();
    expect(next.angleMode).toBeUndefined();
  });

  it('assigns video defaults when switching text to video', () => {
    const source: NodeData = {
      id: 'node-2',
      type: NodeType.TEXT,
      x: 10,
      y: 20,
      prompt: 'turn this into a trailer',
      status: NodeStatus.IDLE,
      model: 'gpt-4o',
      aspectRatio: 'Auto',
      resolution: 'Auto',
      textMode: 'editing',
    };

    const next = switchNodeTypeData(source, NodeType.VIDEO);

    expect(next.type).toBe(NodeType.VIDEO);
    expect(next.prompt).toBe('turn this into a trailer');
    expect(next.videoMode).toBe('standard');
    expect(next.videoModel).toBeTruthy();
    expect(next.aspectRatio).toBe('16:9');
    expect(next.resolution).toBe('Auto');
    expect(next.textMode).toBeUndefined();
  });
});

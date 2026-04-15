import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NodeStatus, NodeType, type NodeData, type NodeGroup } from '../../types';
import { SelectionBoundingBox } from './SelectionBoundingBox';

function createNode(id: string, x: number): NodeData {
  return {
    id,
    type: NodeType.IMAGE,
    x,
    y: 0,
    prompt: '',
    status: NodeStatus.IDLE,
    model: 'model',
    aspectRatio: 'Auto',
    resolution: 'Auto',
    groupId: 'group-1',
  };
}

describe('SelectionBoundingBox group toolbar', () => {
  it('renders localized grouped actions and keeps create video enabled when provided', () => {
    const group: NodeGroup = {
      id: 'group-1',
      nodeIds: ['node-1', 'node-2'],
      label: '分组',
    };

    const markup = renderToStaticMarkup(
      <SelectionBoundingBox
        selectedNodes={[createNode('node-1', 0), createNode('node-2', 420)]}
        group={group}
        viewport={{ x: 0, y: 0, zoom: 1 }}
        onGroup={vi.fn()}
        onUngroup={vi.fn()}
        onBoundingBoxPointerDown={vi.fn()}
        onSortNodes={vi.fn()}
        onCreateVideo={vi.fn()}
      />
    );

    expect(markup).toContain('整理');
    expect(markup).toContain('取消编组');
    expect(markup).toContain('生成视频');
    expect(markup).not.toContain('Sort');
    expect(markup).not.toContain('Ungroup');
    expect(markup).not.toContain('Create Videos');
    expect(markup).not.toContain('disabled=""');
  });
});

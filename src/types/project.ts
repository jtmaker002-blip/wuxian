import type { NodeData, NodeGroup, Viewport } from '../types';
import type { TaskSnapshot } from './scene';

export type GridImageItem = {
  url: string;
  width?: number;
  height?: number;
  label?: string;
  status?: string;
  taskId?: string;
};

export type TaskInfo = {
  taskId?: string;
  loading?: boolean;
  status?: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  failedReason?: string;
  progressPercent?: number;
  maxConcurrency?: number;
  childTasks?: TaskSnapshot['childTasks'];
};

export type CanvasEdge = {
  id: string;
  source_node_id?: string;
  target_node_id?: string;
  source?: string;
  target?: string;
};

export type CanvasNodeData = NodeData;

export type Project = {
  id: string | null;
  name: string;
  title: string;
  description?: string;
  nodes: CanvasNodeData[];
  edges: CanvasEdge[];
  groups: NodeGroup[];
  viewport: Viewport;
  createdAt?: string;
  updatedAt?: string;
};

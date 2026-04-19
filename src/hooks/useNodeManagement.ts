/**
 * useNodeManagement.ts
 * 
 * Custom hook for managing node state and operations.
 * Handles node creation, updates, selection, and deletion.
 */

import { useState } from 'react';
import { NodeData, NodeType, NodeStatus, Viewport } from '../types';
import { getDefaultModelForNodeType, isSwitchableNodeType, type SwitchableNodeType } from '../config/nodeTypeRegistry';
import { nodeEmitsImageResult } from '../utils/nodeResultTyping';
import { switchNodeTypeData } from '../utils/nodeTypeSwitch';

const DEFAULT_NODE_X_OFFSET = 170;
const DEFAULT_NODE_Y_OFFSET = 100;
const MIN_VISIBLE_NODE_X = 220;
const MIN_VISIBLE_NODE_Y = 72;

export function getNextVideoNodeTitle(nodes: Pick<NodeData, 'type'>[]): string {
    const videoCount = nodes.filter((node) => node.type === NodeType.VIDEO).length;
    return `视频节点 ${videoCount + 1}`;
}

export function resolveStandaloneNodeCanvasPosition(
    screenX: number,
    screenY: number,
    viewport: Viewport
) {
    const canvasX = (screenX - viewport.x) / viewport.zoom;
    const canvasY = (screenY - viewport.y) / viewport.zoom;
    const minCanvasX = (MIN_VISIBLE_NODE_X - viewport.x) / viewport.zoom;
    const minCanvasY = (MIN_VISIBLE_NODE_Y - viewport.y) / viewport.zoom;

    return {
        canvasX: Math.max(canvasX - DEFAULT_NODE_X_OFFSET, minCanvasX),
        canvasY: Math.max(canvasY - DEFAULT_NODE_Y_OFFSET, minCanvasY),
    };
}

export const useNodeManagement = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [nodes, setNodes] = useState<NodeData[]>([]);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

    // ============================================================================
    // NODE OPERATIONS
    // ============================================================================

    /**
     * Adds a new node to the canvas
     * @param type - Type of node to create
     * @param x - Screen X coordinate
     * @param y - Screen Y coordinate
     * @param parentId - Optional parent node ID for connections
     * @param viewport - Current viewport for coordinate conversion
     */
    const addNode = (
        type: NodeType,
        x: number,
        y: number,
        parentId: string | undefined,
        viewport: Viewport
    ) => {
        const pointerCanvasX = (x - viewport.x) / viewport.zoom;
        const pointerCanvasY = (y - viewport.y) / viewport.zoom;
        const standalonePosition = resolveStandaloneNodeCanvasPosition(x, y, viewport);

        const newNode: NodeData = {
            id: crypto.randomUUID(),
            type,
            x: parentId ? pointerCanvasX : standalonePosition.canvasX,
            y: parentId ? pointerCanvasY : standalonePosition.canvasY,
            prompt: '',
            status: NodeStatus.IDLE,
            model:
                type === NodeType.IMAGE
                    ? getDefaultModelForNodeType(NodeType.IMAGE)
                    : type === NodeType.VIDEO
                        ? getDefaultModelForNodeType(NodeType.VIDEO)
                        : 'Banana Pro',
            imageModel: type === NodeType.IMAGE ? getDefaultModelForNodeType(NodeType.IMAGE) : undefined,
            videoModel: type === NodeType.VIDEO ? getDefaultModelForNodeType(NodeType.VIDEO) : undefined,
            videoMode: type === NodeType.VIDEO ? 'standard' : undefined,
            videoPanelMode: type === NodeType.VIDEO ? 'text2video' : undefined,
            aspectRatio: type === NodeType.VIDEO ? '16:9' : 'Auto',
            resolution: 'Auto',
            parentIds: parentId ? [parentId] : [],
            title: type === NodeType.VIDEO ? getNextVideoNodeTitle(nodes) : undefined,
        };

        setNodes(prev => [...prev, newNode]);
        setSelectedNodeIds([newNode.id]);

        return newNode.id;
    };

    /**
     * Updates a node with partial data
     * @param id - Node ID to update
     * @param updates - Partial node data to merge
     */
    const updateNode = (id: string, updates: Partial<NodeData>) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    };

    /**
     * Switches a node between text/image/video while preserving shared content.
     */
    const switchNodeType = (id: string, nextType: SwitchableNodeType) => {
        setNodes(prev => prev.map(node => {
            if (node.id !== id) return node;
            if (!isSwitchableNodeType(node.type)) return node;
            return switchNodeTypeData(node, nextType);
        }));
    };

    /**
     * Deletes a node by ID
     * @param id - Node ID to delete
     */
    const deleteNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setSelectedNodeIds(prev => prev.filter(nodeId => nodeId !== id));
    };

    /**
     * Deletes multiple nodes by IDs
     * @param ids - Array of node IDs to delete
     */
    const deleteNodes = (ids: string[]) => {
        setNodes(prev => prev.filter(n => !ids.includes(n.id)));
        setSelectedNodeIds([]);
    };

    /**
     * Clears all node selections
     */
    const clearSelection = () => {
        setSelectedNodeIds([]);
    };

    /**
     * Handles node type selection from context menu
     * Creates new node or deletes existing node
     */
    const handleSelectTypeFromMenu = (
        type: NodeType | 'DELETE',
        contextMenu: any,
        viewport: Viewport,
        onCloseMenu: () => void
    ) => {
        // Handle Delete Action
        if (type === 'DELETE') {
            if (contextMenu.sourceNodeId) {
                deleteNode(contextMenu.sourceNodeId);
            }
            onCloseMenu();
            return;
        }

        if (contextMenu.type === 'node-connector' && contextMenu.sourceNodeId) {
            const sourceNode = nodes.find(n => n.id === contextMenu.sourceNodeId);
            if (sourceNode) {
                const direction = contextMenu.connectorSide || 'right';
                const canCreatePrependConnection = (sourceType: NodeType, nextType: NodeType) => {
                    if (direction !== 'left') return true;
                    if (sourceType === NodeType.IMAGE || sourceType === NodeType.IMAGE_EDITOR) {
                        return nextType === NodeType.TEXT || nextType === NodeType.IMAGE || nextType === NodeType.IMAGE_EDITOR;
                    }
                    if (sourceType === NodeType.VIDEO || sourceType === NodeType.VIDEO_EDITOR) {
                        return nextType === NodeType.TEXT || nextType === NodeType.VIDEO || nextType === NodeType.VIDEO_EDITOR;
                    }
                    if (sourceType === NodeType.TEXT) {
                        return false;
                    }
                    return true;
                };
                if (!canCreatePrependConnection(sourceNode.type, type)) {
                    onCloseMenu();
                    return;
                }
                const newNodeId = crypto.randomUUID();
                const GAP = 100;
                const NODE_WIDTH = 340;
                const dropCanvasPosition = contextMenu.dropCanvasPosition;
                const defaultNodeWidth =
                    type === NodeType.VIDEO || type === NodeType.LOCAL_VIDEO_MODEL
                        ? 385
                        : 365;
                const defaultNodeHeight =
                    type === NodeType.VIDEO || type === NodeType.LOCAL_VIDEO_MODEL
                        ? 385 / (16 / 9)
                        : type === NodeType.AUDIO
                            ? 365 / (16 / 7)
                            : 365 / (4 / 3);
                const fallbackX = direction === 'right'
                    ? sourceNode.x + NODE_WIDTH + GAP
                    : sourceNode.x - NODE_WIDTH - GAP;
                const fallbackY = sourceNode.y;
                const spawnX = dropCanvasPosition
                    ? dropCanvasPosition.x + (direction === 'right' ? 24 : -defaultNodeWidth - 24)
                    : fallbackX;
                const spawnY = dropCanvasPosition
                    ? dropCanvasPosition.y - defaultNodeHeight / 2
                    : fallbackY;
                const sourceFeedsImageFlow =
                    nodeEmitsImageResult(sourceNode) || sourceNode.type === NodeType.IMAGE_EDITOR;

                let newNode: NodeData;

                if (direction === 'right') {
                    // Append: Source -> New
                    if (sourceFeedsImageFlow && type === NodeType.VIDEO) {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: sourceNode.prompt?.trim() || '基于已接入的图片素材生成视频',
                            status: NodeStatus.IDLE,
                            model: getDefaultModelForNodeType(NodeType.VIDEO),
                            videoModel: getDefaultModelForNodeType(NodeType.VIDEO),
                            videoMode: 'standard',
                            videoPanelMode: 'singleImage2video',
                            aspectRatio: sourceNode.aspectRatio && sourceNode.aspectRatio !== 'Auto' ? sourceNode.aspectRatio : '16:9',
                            resolution: 'Auto',
                            inputUrl: sourceNode.resultUrl,
                            parentIds: [contextMenu.sourceNodeId],
                            isPromptExpanded: true,
                            title: getNextVideoNodeTitle(nodes),
                        };
                    } else if (sourceFeedsImageFlow && type === NodeType.IMAGE) {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: sourceNode.prompt || '',
                            status: NodeStatus.IDLE,
                            model: getDefaultModelForNodeType(NodeType.IMAGE),
                            imageModel: getDefaultModelForNodeType(NodeType.IMAGE),
                            aspectRatio: 'Auto',
                            resolution: 'Auto',
                            parentIds: [contextMenu.sourceNodeId],
                            isPromptExpanded: true,
                        };
                    } else if (sourceFeedsImageFlow && type === NodeType.TEXT) {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: sourceNode.prompt || '基于这张图片补充文本描述',
                            status: NodeStatus.IDLE,
                            model: 'Banana Pro',
                            aspectRatio: 'Auto',
                            resolution: 'Auto',
                            inputUrl: sourceNode.resultUrl,
                            parentIds: [contextMenu.sourceNodeId],
                            textMode: 'editing',
                            isPromptExpanded: true,
                            title: '文本节点',
                        };
                    } else if (sourceFeedsImageFlow && type === NodeType.AUDIO) {
                        const audioModel = getDefaultModelForNodeType(NodeType.AUDIO);
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: sourceNode.prompt || '',
                            status: NodeStatus.IDLE,
                            model: audioModel,
                            audioModel,
                            aspectRatio: 'Auto',
                            resolution: 'Auto',
                            parentIds: [contextMenu.sourceNodeId],
                            isPromptExpanded: true,
                        };
                    } else {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: '',
                            status: NodeStatus.IDLE,
                            model:
                                type === NodeType.IMAGE
                                    ? getDefaultModelForNodeType(NodeType.IMAGE)
                                    : type === NodeType.VIDEO
                                        ? getDefaultModelForNodeType(NodeType.VIDEO)
                                        : type === NodeType.AUDIO
                                            ? getDefaultModelForNodeType(NodeType.AUDIO)
                                            : 'Banana Pro',
                            imageModel: type === NodeType.IMAGE ? getDefaultModelForNodeType(NodeType.IMAGE) : undefined,
                            videoModel: type === NodeType.VIDEO ? getDefaultModelForNodeType(NodeType.VIDEO) : undefined,
                            videoMode: type === NodeType.VIDEO ? 'standard' : undefined,
                            videoPanelMode: type === NodeType.VIDEO ? 'text2video' : undefined,
                            audioModel: type === NodeType.AUDIO ? getDefaultModelForNodeType(NodeType.AUDIO) : undefined,
                            aspectRatio: type === NodeType.VIDEO ? '16:9' : 'Auto',
                            resolution: 'Auto',
                            parentIds: contextMenu.sourceNodeId ? [contextMenu.sourceNodeId] : [],
                            textMode: type === NodeType.TEXT ? 'editing' : undefined,
                            title: type === NodeType.VIDEO ? getNextVideoNodeTitle(nodes) : undefined,
                        };
                    }
                } else {
                    // Prepend: New -> Source
                    if (sourceFeedsImageFlow && type === NodeType.TEXT) {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: sourceNode.prompt || '基于这张图片补充文本描述',
                            status: NodeStatus.IDLE,
                            model: 'Banana Pro',
                            aspectRatio: 'Auto',
                            resolution: 'Auto',
                            parentIds: [],
                            textMode: 'editing',
                            isPromptExpanded: true,
                            title: '文本节点',
                        };
                    } else {
                        newNode = {
                            id: newNodeId,
                            type,
                            x: spawnX,
                            y: spawnY,
                            prompt: '',
                            status: NodeStatus.IDLE,
                            model:
                                type === NodeType.IMAGE
                                    ? getDefaultModelForNodeType(NodeType.IMAGE)
                                    : type === NodeType.VIDEO
                                        ? getDefaultModelForNodeType(NodeType.VIDEO)
                                        : type === NodeType.AUDIO
                                            ? getDefaultModelForNodeType(NodeType.AUDIO)
                                        : 'Banana Pro',
                            imageModel: type === NodeType.IMAGE ? getDefaultModelForNodeType(NodeType.IMAGE) : undefined,
                            videoModel: type === NodeType.VIDEO ? getDefaultModelForNodeType(NodeType.VIDEO) : undefined,
                            videoMode: type === NodeType.VIDEO ? 'standard' : undefined,
                            videoPanelMode: type === NodeType.VIDEO ? 'text2video' : undefined,
                            audioModel: type === NodeType.AUDIO ? getDefaultModelForNodeType(NodeType.AUDIO) : undefined,
                            aspectRatio: type === NodeType.VIDEO ? '16:9' : 'Auto',
                            resolution: 'Auto',
                            parentIds: [],
                            textMode: type === NodeType.TEXT ? 'editing' : undefined,
                            title: type === NodeType.VIDEO ? getNextVideoNodeTitle(nodes) : undefined,
                        };
                    }
                    // Update source to add new node as parent
                    const existingParentIds = sourceNode.parentIds || [];
                    updateNode(contextMenu.sourceNodeId, { parentIds: [...existingParentIds, newNodeId] });
                }

                setNodes(prev => [...prev, newNode]);
                setSelectedNodeIds([newNodeId]);
            }
        } else {
            // Global menu - add at click position
            addNode(type, contextMenu.x, contextMenu.y, undefined, viewport);
        }

        onCloseMenu();
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        nodes,
        setNodes,
        selectedNodeIds,
        setSelectedNodeIds,
        addNode,
        updateNode,
        switchNodeType,
        deleteNode,
        deleteNodes,
        clearSelection,
        handleSelectTypeFromMenu
    };
};

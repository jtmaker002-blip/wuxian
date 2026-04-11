/**
 * useConnectionDragging.ts
 * 
 * Custom hook for managing connection dragging between nodes.
 * Handles drag-to-connect functionality with visual feedback.
 */

import React, { useState, useRef } from 'react';
import { NodeData, NodeStatus, NodeType, Viewport } from '../types';

interface ConnectionStart {
    nodeId: string;
    handle: 'left' | 'right';
}

export const useConnectionDragging = () => {
    // ============================================================================
    // STATE
    // ============================================================================

    const [isDraggingConnection, setIsDraggingConnection] = useState(false);
    const [connectionStart, setConnectionStart] = useState<ConnectionStart | null>(null);
    const [tempConnectionEnd, setTempConnectionEnd] = useState<{ x: number; y: number } | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredSide, setHoveredSide] = useState<'left' | 'right' | null>(null);
    const [selectedConnection, setSelectedConnection] = useState<{ parentId: string; childId: string } | null>(null);
    const dragStartTime = useRef<number>(0);
    const CONNECTOR_SNAP_RADIUS = 104;

    const getNodeDimensions = (node: NodeData) => {
        const width = node.type === NodeType.VIDEO ? 385 : 365;

        if (node.type === NodeType.AUDIO) {
            return { width, height: width / (16 / 7) };
        }

        if (node.type === NodeType.VIDEO || node.type === NodeType.LOCAL_VIDEO_MODEL) {
            return { width, height: width / (16 / 9) };
        }

        if (node.resultAspectRatio && node.status === NodeStatus.SUCCESS) {
            const [w, h] = node.resultAspectRatio.split('/').map(Number);
            if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
                return { width, height: width / (w / h) };
            }
        }

        return { width, height: width / (4 / 3) };
    };

    const getConnectionChildUpdates = (
        parentNode: NodeData,
        childNode: NodeData,
        nextParentIds: string[]
    ): Partial<NodeData> => {
        if (
            (parentNode.type === NodeType.IMAGE || parentNode.type === NodeType.IMAGE_EDITOR) &&
            childNode.type === NodeType.VIDEO
        ) {
            const inheritedAspectRatio =
                parentNode.aspectRatio && parentNode.aspectRatio !== 'Auto'
                    ? parentNode.aspectRatio
                    : childNode.aspectRatio;
            const nextPrompt =
                childNode.prompt?.trim()
                    ? childNode.prompt
                    : parentNode.prompt?.trim()
                        ? parentNode.prompt
                        : '基于已接入的图片素材生成视频';

            return {
                parentIds: nextParentIds,
                prompt: nextPrompt,
                status: NodeStatus.IDLE,
                videoMode: 'standard',
                aspectRatio: inheritedAspectRatio,
                inputUrl: parentNode.resultUrl,
                resultUrl: undefined,
                resultAspectRatio: undefined,
                lastFrame: undefined,
                frameInputs: undefined,
                requestedVideoModel: undefined,
                executedVideoModel: undefined,
                executedVideoMode: undefined,
                executionProvider: undefined,
                generationStartTime: undefined,
                isPromptExpanded: true,
                errorMessage: undefined,
            };
        }

        return { parentIds: nextParentIds };
    };

    // ============================================================================
    // HELPERS
    // ============================================================================

    /**
     * Checks if mouse is hovering over a node (for connection target)
     * Also determines which side (left or right connector) is being hovered
     * @param mouseX - Screen X coordinate
     * @param mouseY - Screen Y coordinate
     * @param nodes - Array of all nodes
     * @param viewport - Current viewport
     */
    const checkHoveredNode = (
        mouseX: number,
        mouseY: number,
        nodes: NodeData[],
        viewport: Viewport
    ) => {
        const canvasX = (mouseX - viewport.x) / viewport.zoom;
        const canvasY = (mouseY - viewport.y) / viewport.zoom;
        const sourceNode = nodes.find((node) => node.id === connectionStart?.nodeId);

        const connectorCandidates = nodes.flatMap((n) => {
            if (n.id === connectionStart?.nodeId) return [];
            const dimensions = getNodeDimensions(n);
            const leftX = n.x;
            const rightX = n.x + dimensions.width;
            const centerY = n.y + dimensions.height / 2;
            const sourceFeedsVideo =
                sourceNode &&
                (sourceNode.type === NodeType.IMAGE || sourceNode.type === NodeType.IMAGE_EDITOR) &&
                (n.type === NodeType.VIDEO || n.type === NodeType.LOCAL_VIDEO_MODEL);
            return [
                {
                    nodeId: n.id,
                    side: 'left' as const,
                    distance: Math.hypot(canvasX - leftX, canvasY - centerY) * (sourceFeedsVideo ? 0.56 : 1),
                },
                {
                    nodeId: n.id,
                    side: 'right' as const,
                    distance: Math.hypot(canvasX - rightX, canvasY - centerY) * (sourceFeedsVideo ? 1.08 : 1),
                },
            ];
        });

        const nearestConnector = connectorCandidates
            .filter((candidate) => candidate.distance <= CONNECTOR_SNAP_RADIUS)
            .sort((a, b) => a.distance - b.distance)[0];

        if (nearestConnector) {
            setHoveredNodeId(nearestConnector.nodeId);
            setHoveredSide(nearestConnector.side);
            const targetNode = nodes.find((node) => node.id === nearestConnector.nodeId);
            if (targetNode) {
                const dimensions = getNodeDimensions(targetNode);
                const snappedCanvasX = nearestConnector.side === 'left' ? targetNode.x : targetNode.x + dimensions.width;
                const snappedCanvasY = targetNode.y + dimensions.height / 2;
                return {
                    nodeId: nearestConnector.nodeId,
                    side: nearestConnector.side,
                    x: snappedCanvasX * viewport.zoom + viewport.x,
                    y: snappedCanvasY * viewport.zoom + viewport.y,
                };
            }
            return null;
        }

        const found = nodes.find(n => {
            if (n.id === connectionStart?.nodeId) return false;
            const dimensions = getNodeDimensions(n);
            return (
                canvasX >= n.x && canvasX <= n.x + dimensions.width &&
                canvasY >= n.y && canvasY <= n.y + dimensions.height
            );
        });

        if (found) {
            setHoveredNodeId(found.id);

            const dimensions = getNodeDimensions(found);
            const nodeCenter = found.x + dimensions.width / 2;
            const sourceFeedsVideo =
                sourceNode &&
                (sourceNode.type === NodeType.IMAGE || sourceNode.type === NodeType.IMAGE_EDITOR) &&
                (found.type === NodeType.VIDEO || found.type === NodeType.LOCAL_VIDEO_MODEL);
            const side = sourceFeedsVideo ? 'left' : (canvasX < nodeCenter ? 'left' : 'right');
            setHoveredSide(side);
            return {
                nodeId: found.id,
                side,
                x: (side === 'left' ? found.x : found.x + dimensions.width) * viewport.zoom + viewport.x,
                y: (found.y + dimensions.height / 2) * viewport.zoom + viewport.y,
            };
        } else {
            setHoveredNodeId(null);
            setHoveredSide(null);
            return null;
        }
    };

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    /**
     * Starts connection dragging from a connector button
     */
    const handleConnectorPointerDown = (
        e: React.PointerEvent,
        nodeId: string,
        side: 'left' | 'right'
    ) => {
        e.stopPropagation();
        e.preventDefault();
        dragStartTime.current = Date.now();
        setIsDraggingConnection(true);
        setConnectionStart({ nodeId, handle: side });
        setTempConnectionEnd({ x: e.clientX, y: e.clientY });
    };

    /**
     * Updates temporary connection end point during drag
     */
    const updateConnectionDrag = (
        e: React.PointerEvent,
        nodes: NodeData[],
        viewport: Viewport
    ) => {
        if (!isDraggingConnection) return false;

        const hoveredTarget = checkHoveredNode(e.clientX, e.clientY, nodes, viewport);
        setTempConnectionEnd(
            hoveredTarget
                ? { x: hoveredTarget.x, y: hoveredTarget.y }
                : { x: e.clientX, y: e.clientY }
        );
        return true;
    };

    /**
     * Completes connection drag and creates connection if valid
     * Returns true if connection was handled, false otherwise
     * @param nodes - All nodes for validation
     * @param onConnectionMade - Optional callback called with (parentId, childId) when connection is created
     */
    const completeConnectionDrag = (
        onAddNext: (nodeId: string, direction: 'left' | 'right', screenPosition?: { x: number; y: number }) => void,
        onUpdateNodes: (updater: (prev: NodeData[]) => NodeData[]) => void,
        nodes: NodeData[],
        onConnectionMade?: (parentId: string, childId: string) => void
    ): boolean => {
        if (!isDraggingConnection || !connectionStart) return false;

        const dragDuration = Date.now() - dragStartTime.current;

        /**
         * Check if a connection is valid based on node types
         * Rules:
         * - IMAGE → IMAGE, VIDEO, IMAGE_EDITOR: ✅ (image as input)
         * - VIDEO → VIDEO: ✅ (video chaining via lastFrame)
         * - VIDEO → IMAGE, IMAGE_EDITOR: ❌ (can't generate image from video)
         * - TEXT → IMAGE, VIDEO: ✅ (text provides prompt)
         * - TEXT → TEXT, IMAGE_EDITOR: ❌ (no text chaining, no text editing)
         * - Any → TEXT: ❌ (text nodes can't receive input)
         * - AUDIO: ❌ (not supported yet)
         */
        const isValidConnection = (parentId: string, childId: string): boolean => {
            const parentNode = nodes.find(n => n.id === parentId);
            const childNode = nodes.find(n => n.id === childId);

            if (!parentNode || !childNode) return false;

            // AUDIO nodes not supported yet
            if (parentNode.type === NodeType.AUDIO || childNode.type === NodeType.AUDIO) {
                return false;
            }

            // STORYBOARD nodes - allow connections to/from for now (future feature)
            // Can be restricted later when storyboard logic is implemented

            // TEXT nodes can't receive input (can only be parents)
            if (childNode.type === NodeType.TEXT) {
                return false;
            }

            // TEXT nodes can only connect to IMAGE or VIDEO (to provide prompts)
            if (parentNode.type === NodeType.TEXT) {
                return childNode.type === NodeType.IMAGE || childNode.type === NodeType.VIDEO;
            }

            // VIDEO nodes can only connect to other VIDEO nodes (via lastFrame)
            // Cannot connect to IMAGE or IMAGE_EDITOR
            if (parentNode.type === NodeType.VIDEO) {
                return childNode.type === NodeType.VIDEO ||
                    childNode.type === NodeType.VIDEO_EDITOR;
            }

            // IMAGE nodes can connect to IMAGE, VIDEO, or IMAGE_EDITOR
            if (parentNode.type === NodeType.IMAGE) {
                return childNode.type === NodeType.IMAGE ||
                    childNode.type === NodeType.VIDEO ||
                    childNode.type === NodeType.IMAGE_EDITOR;
            }

            // IMAGE_EDITOR can connect to IMAGE, VIDEO, or IMAGE_EDITOR
            if (parentNode.type === NodeType.IMAGE_EDITOR) {
                return childNode.type === NodeType.IMAGE ||
                    childNode.type === NodeType.VIDEO ||
                    childNode.type === NodeType.IMAGE_EDITOR;
            }

            // VIDEO_EDITOR can only connect to VIDEO (to feed trimmed video for generation)
            // No chaining VIDEO_EDITOR → VIDEO_EDITOR
            if (parentNode.type === NodeType.VIDEO_EDITOR) {
                return childNode.type === NodeType.VIDEO;
            }

            return true;
        };

        // Short click - open menu
        if (!hoveredNodeId) {
            const menuPosition = tempConnectionEnd
                ? { x: tempConnectionEnd.x, y: tempConnectionEnd.y }
                : undefined;
            onAddNext(connectionStart.nodeId, connectionStart.handle, menuPosition);
        }
        // Drag to node - create connection based on target side
        else if (hoveredNodeId && hoveredSide) {
            if (hoveredSide === 'left') {
                // Connecting to LEFT connector = target receives input (target is child)
                // source is parent, hoveredNode is child
                if (!isValidConnection(connectionStart.nodeId, hoveredNodeId)) {
                    // Invalid connection - reset and return
                    setIsDraggingConnection(false);
                    setConnectionStart(null);
                    setTempConnectionEnd(null);
                    setHoveredNodeId(null);
                    setHoveredSide(null);
                    return true;
                }

                // Add source as a parent to target node
                let didAddConnection = false;
                onUpdateNodes(prev => prev.map(n => {
                    if (n.id === hoveredNodeId) {
                        const existingParents = n.parentIds || [];
                        // Prevent duplicate connections
                        if (existingParents.includes(connectionStart.nodeId)) {
                            return n;
                        }

                        didAddConnection = true;
                        const nextParentIds = [...existingParents, connectionStart.nodeId];
                        const parentNode = nodes.find(node => node.id === connectionStart.nodeId);

                        if (!parentNode) {
                            return { ...n, parentIds: nextParentIds };
                        }

                        return {
                            ...n,
                            ...getConnectionChildUpdates(parentNode, n, nextParentIds),
                        };
                    }
                    return n;
                }));
                // Notify about new connection: source is parent, hoveredNode is child
                if (didAddConnection) {
                    onConnectionMade?.(connectionStart.nodeId, hoveredNodeId);
                }
            } else {
                // Connecting to RIGHT connector = target provides output (target is parent)
                // hoveredNode is parent, source is child
                if (!isValidConnection(hoveredNodeId, connectionStart.nodeId)) {
                    // Invalid connection - reset and return
                    setIsDraggingConnection(false);
                    setConnectionStart(null);
                    setTempConnectionEnd(null);
                    setHoveredNodeId(null);
                    setHoveredSide(null);
                    return true;
                }

                // Add target as a parent to source node
                onUpdateNodes(prev => prev.map(n => {
                    if (n.id === connectionStart.nodeId) {
                        const existingParents = n.parentIds || [];
                        // Prevent duplicate connections
                        if (!existingParents.includes(hoveredNodeId)) {
                            return { ...n, parentIds: [...existingParents, hoveredNodeId] };
                        }
                    }
                    return n;
                }));
                // Notify about new connection: hoveredNode is parent, source is child
                onConnectionMade?.(hoveredNodeId, connectionStart.nodeId);
            }
        }

        // Reset state
        setIsDraggingConnection(false);
        setConnectionStart(null);
        setTempConnectionEnd(null);
        setHoveredNodeId(null);
        setHoveredSide(null);
        return true;
    };

    /**
     * Handles clicking on a connection line to select it
     */
    const handleEdgeClick = (e: React.MouseEvent, parentId: string, childId: string) => {
        e.stopPropagation();
        setSelectedConnection({ parentId, childId });
    };

    /**
     * Deletes the currently selected connection
     */
    const deleteSelectedConnection = (onUpdateNodes: (updater: (prev: NodeData[]) => NodeData[]) => void) => {
        if (!selectedConnection) return false;

        onUpdateNodes(prev => prev.map(n => {
            if (n.id === selectedConnection.childId) {
                const existingParents = n.parentIds || [];
                return { ...n, parentIds: existingParents.filter(pid => pid !== selectedConnection.parentId) };
            }
            return n;
        }));
        setSelectedConnection(null);
        return true;
    };

    // ============================================================================
    // RETURN
    // ============================================================================

    return {
        isDraggingConnection,
        connectionStart,
        tempConnectionEnd,
        hoveredNodeId,
        selectedConnection,
        setSelectedConnection,
        handleConnectorPointerDown,
        updateConnectionDrag,
        completeConnectionDrag,
        handleEdgeClick,
        deleteSelectedConnection
    };
};
